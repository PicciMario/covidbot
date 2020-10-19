import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import moment from 'moment'
import Logger from './logger'
import dotenv from 'dotenv'
import botRedisConnector from './botRedisConnector';
import {retrieveDailyData} from './datarecovery'
import {buildPlot, createDailyDigest} from './plotter';
import * as messages from './messages';

// Bot version
const VERSION = '1.3.1';

// Date format for the REDIS_LASTVALIDDATE Redis key content.
const REDIS_LASTVALIDDATE_FORMAT = 'DD MMM YYYY HH:mm:SS';

// ------------------------------------------------------------------------------------------------

// Init dotenv (to access .env variables)
dotenv.config()

// Check if development mode
// (add NODE_ENV=development in your .env file)
const DEVELOPMENT = process.env.NODE_ENV  === 'development'

// To disable a deprecation warning in the sendPhoto bot function
// (mime type warning even when the type is explicitly set)
process.env.NTBA_FIX_350 = true;

// Init logger
const log = new Logger("index.js")

/**
 * Data retrieved stored as local variable.
 */
let italianData = []

let scheduledTask = null;

// Startup console messages -----------------------------------------------------------------------

log.info(`COVIDBOT v. ${VERSION}`)

if (DEVELOPMENT) log.info(`Running in DEVELOPMENT mode!`)

// Initialize Telegram Bot ------------------------------------------------------------------------

// Bot token
const token = process.env.BOT_TOKEN;
if (!token){
	log.err("Telegram bot token not provided (need a .env file with BOT_TOKEN key)!")
	process.exit()
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new telegrambot(token, {polling: true});
bot.on("polling_error", (err) => log.err("Telegram polling error", err));

// Initialize REDIS connection --------------------------------------------------------------------

// Connect to REDIS server
const redisclient = new botRedisConnector(
	process.env.REDIS_HOST || 'localhost', 
	process.env.REDIS_PORT || 6379
);

redisclient.connect();

// Waits for the connection to be up, then runs main method.
redisclient
	.getClient()
	.then(main)
	.catch((err) => {
		log.error("Unexpected error in main(), quitting.", err.message)
		process.exit()
	});

// ------------------------------------------------------------------------------------------------

/**
 * Application entry point (called after Redis connection established).
 */
async function main(){

	log.debug('Retrieving italian nation-level data...')

	try{
		italianData = await retrieveDailyData()
		log.debug(`Data retrieved (${italianData.length} records).`)
	}
	catch (err){
		log.err(`Error during initial data retrieve: ${err.message}. Exiting.`)
		process.exit()
	}

	const lastElement = italianData[italianData.length-1];
	if (lastElement){
		await redisclient.setLastValidDate(lastElement['data'].format(REDIS_LASTVALIDDATE_FORMAT));
		await redisclient.setLastRetrieveTimestampAsNow();
	}
	else {
		log.err(`Initial retrieve returned empty data, exiting.`);
		process.exit()
	}

	// Everyday at 5pm, start a task which will try to send to subscribers until
	// it is able to do so (it won't until it retrieves updated data).
	const startDailyCheck = () => {

		log.debug(`Starting daily check.`);
	
		// Delete existing task
		if (scheduledTask != null){
			try{
				scheduledTask.destroy();
				scheduledTask = null;
			}
			catch (err){
				log.error(`Error while killing scheduled task: ${err.message}`)
			}
		}

		scheduledTask = cron.schedule('* * * * *', async () => {
			const done = await sendAll();
			if (done){
				scheduledTask.destroy();
				scheduledTask = null;
				log.debug(`Daily check terminated.`);
			}
		})

	}
	cron.schedule('00 17 * * *', startDailyCheck);

}

/**
 * Send plot data to all subscribers.
 */
async function sendAll(force=false) {
	
	try{

		const subscribers = await redisclient.getSubscribers()

		if (subscribers.length === 0) {
			log.debug('Send all requested, but no subscribers available. Skipping request.')
			return;
		}
		else {
			log.debug(`Checking whether to send plot to ${subscribers.length} subscribers.`)
		}

		const data = await retrieveDailyData()

		const lastRetrievedElement = data[data.length-1];
		if (lastRetrievedElement){

			const lastElementsDate = lastRetrievedElement['data'].format(REDIS_LASTVALIDDATE_FORMAT);
			const storedLastValidDate = await redisclient.getLastValidDate();
			
			if (lastElementsDate !== storedLastValidDate || force === true){

				log.debug(`Sending updated plot to ${subscribers.length} subscribers.`)

				await redisclient.setLastValidDate(lastElementsDate);

				italianData = data;	
				log.debug(`Retrieved new data (${data.length} records).`);
				await redisclient.setLastRetrieveTimestampAsNow();
		
				const buffer = await buildPlot(italianData)
				const digest = await createDailyDigest(italianData)
		
				subscribers.forEach(async chatId => {
					try{
						await bot.sendPhoto(
							chatId, 
							buffer,
							{},
							{
								filename: 'plot.png',
								contentType: 'image/png'
							}
						)
						await bot.sendMessage(
							chatId,
							digest,
							{
								parse_mode: "HTML"
							}
						)
					}
					catch (err){
						if (err.response && err.response.body){

							const {error_code, description} = err.response.body;

							// Errors which suggest removing the chatId from the subscription list
							// 403 (forbidden): bot can't send to chat (maybe removed from group, or blocked)
							if (error_code === 403){
								log.err(`Removing subscription of ${chatId} from db due to error ${error_code} ${description}`);
								redisclient.removeSubscriber(chatId)
							}
							else{
								log.err(`Unable to send messages to ${chatId}: ${error_code} ${description}`)
							}

						}
						else {
							log.err(`Unable to send messages to ${chatId} due to unknown error: ${err.message}`)
						}
					}
				})
		
				log.debug('Updated plots sent to all subscribers.')	
				
				return true;

			}
			else {
				log.debug(`Retrieved data showing the same date as previously stored ${storedLastValidDate}, skipping transmission of stale data.`)
			}

		}

	}
	catch(err) {
		log.err(`Unexpected error during sendAll(): ${err.message}`);
	}

	return false;

}

// ------------------------------------------------------------------------------------------------

if (DEVELOPMENT){
	bot.onText(/\/sendall/, (msg, match) => sendAll(true))
}

bot.onText(/\/debug/, async (msg, match) => {
	
	const chatId = msg.chat.id;

	try{
		const subs = await redisclient.getSubscribers()
		const lastValidDate = await redisclient.getLastValidDate()
		const lastRetrieval = await redisclient.getLastRetrieveTimestamp()
		let message = `Number of subscribers: ${subs.length}; Last valid date: ${lastValidDate} (retrieved on ${lastRetrieval})`;
		if (DEVELOPMENT) message += `\nRunning in DEVELOPMENT mode!`;
		bot.sendMessage(chatId, message)	
	}
	catch (err){
		log.err(`Error while retrieving data: ${err.message}`)
	}

})

bot.onText(/\/digest/, (msg, match) => {

	const chatId = msg.chat.id;
	
	log.debug(`Requested digest from chat id: ${chatId}`);

	// If an user requests an update, alert him if I'm still trying to download the 
	// daily update (anytime from 17.00 onwards, usually before 17.15).
	let text = createDailyDigest(italianData);
	if (scheduledTask != null){
		text =
			messages.retrievalInProgress()
			+ text;
	}

	bot.sendMessage(
		chatId, 
		text,
		{
			parse_mode: 'HTML'
		}
	)

});

bot.onText(/\/sub/, async (msg, match) => {
	const chatId = msg.chat.id;
	log.debug(`Adding new subscribe ${chatId} to db...`);
	await redisclient.addSubscriber(chatId)
	bot.sendMessage(chatId, messages.subRequested());
});

bot.onText(/\/unsub/, async (msg, match) => {
	const chatId = msg.chat.id;
	log.debug(`Removing subscription of ${chatId} from db...`);
	await redisclient.removeSubscriber(chatId)
	bot.sendMessage(chatId, messages.cancRequested());
});

bot.onText(/\/status/, async (msg, match) => {
	
	const chatId = msg.chat.id;

	const isMember = await redisclient.checkIfSubscribed(chatId);

	if (isMember === 1){
		const subSince = await redisclient.getSubTimestamp(chatId);
		bot.sendMessage(chatId, messages.isSubscribed(subSince))
	}
	else {
		bot.sendMessage(chatId, messages.isNotSubscribed())
	}

});

bot.onText(/\/plot/, async (msg, match) => {

	const chatId = msg.chat.id;

	log.debug(`Requested plot from chat id: ${chatId}`);

	const imageBuffer = await buildPlot(italianData);

	// If an user requests an update, alert him if I'm still trying to download the 
	// daily update (anytime from 17.00 onwards, usually before 17.15).	
	let caption = messages.photoCaption();
	if (scheduledTask != null){
		caption = messages.retrievalInProgressCaption() + caption;
	}
	
	bot.sendPhoto(
		chatId, 
		imageBuffer,
		{
			caption: caption
		},
		{
			filename: 'plot.png',
			contentType: 'image/png',
		}
	)

})

bot.onText(/\/about/, (msg, match) => {
	bot.sendMessage(msg.chat.id, messages.aboutMessage(VERSION), {parse_mode: 'HTML'});
})

bot.onText(/\/start/, (msg, match) => {
	bot.sendMessage(msg.chat.id, messages.aboutMessage(VERSION), {parse_mode: 'HTML'});
})

bot.onText(/\/help/, (msg, match) => {
	bot.sendMessage(msg.chat.id, messages.helpMessage(VERSION), {parse_mode: 'HTML'});
})
bot.onText(/\/aiuto/, (msg, match) => {
	bot.sendMessage(msg.chat.id, messages.helpMessage(VERSION), {parse_mode: 'HTML'});
})