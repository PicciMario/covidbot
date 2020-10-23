import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import Logger from './logger'
import dotenv from 'dotenv'
import botRedisConnector from './redis/covidbot-redis-connector';
import {retrieveDailyData, retrieveRegioniData} from './datarecovery'
import {buildPlot, createDailyDigest} from './plotter';
import * as messages from './messages';
import {REGIONS} from './regions/regions-list';
import {manageAreaCallback, manageRegionCallback, manageAreasListCallback} from './regions/regions-bot-functions'
import { splitArray } from './utilities';

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
 * Global nation-level data.
 */
let italianData = []

/**
 * Global region-level data.
 */
let regionalData = []

/**
 * Plot cache.
 */
let plotBuffer = null;

/**
 * Digest text cache.
 */
let digestText = null;

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
 * Prints formatted result from "process.hrtime()" call.
 * @param {number[]} param0 
 * @returns {string}
 */
function printTime([sec, nanosec]){
	if (sec === 0){
		return `${Math.ceil(nanosec/1000000)}ms`
	}
	else {
		return `${sec}s ${Math.ceil(nanosec/1000000)}ms`
	}
}

async function buildMessagesCaches(){

	let timing;

	log.debug('Building plot and digest...');	
	
	timing = process.hrtime();
	plotBuffer = await buildPlot(italianData)
	timing = process.hrtime(timing);
	log.debug(`-> Plot cache built in ${printTime(timing)}`);
	
	timing = process.hrtime();
	digestText = await createDailyDigest(italianData)	
	timing = process.hrtime(timing);
	log.debug(`-> Digest cache built in ${printTime(timing)}`);

}

/**
 * Application entry point (called after Redis connection established).
 */
async function main(){

	log.debug('Retrieving italian data...')

	let timing;

	// Initial data retrieve
	try{
		timing = process.hrtime();
		italianData = await retrieveDailyData()		
		timing = process.hrtime(timing);
		log.debug(`-> National data: retrieved ${italianData.length} records in ${printTime(timing)}.`)
		timing = process.hrtime();
		regionalData = await retrieveRegioniData()	
		timing = process.hrtime(timing);
		log.debug(`-> Regional data: retrieved ${regionalData.length} records in ${printTime(timing)}.`)
	}
	catch (err){
		log.err(`Error during initial data retrieve: ${err.message}. Exiting.`)
		process.exit()
	}

	// Saving valid dates for he retrieved data on redis
	const lastElement = italianData[italianData.length-1];
	if (lastElement){
		await redisclient.setLastValidDate(lastElement['data'].format(REDIS_LASTVALIDDATE_FORMAT));
		await redisclient.setLastRetrieveTimestampAsNow();
	}
	else {
		log.err(`Initial retrieve returned empty data, exiting.`);
		process.exit()
	}

	// Building plot and digest
	await buildMessagesCaches();

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

	log.debug('########## Requested global transmission to subscribers. ##########');

	let timing;
	
	try{

		const subscribers = await redisclient.getSubscribers()

		if (subscribers.length === 0) {
			log.debug('-> No subscribers in database. Skipping request.')
			return true;
		}

		log.debug('Retrieving italian nation-level data...')
		timing = process.hrtime();
		const data = await retrieveDailyData()
		timing = process.hrtime(timing);
		log.debug(`-> Retrieved ${italianData.length} records in ${printTime(timing)}.`)

		const lastRetrievedElement = data[data.length-1];
		if (lastRetrievedElement){

			const lastElementsDate = lastRetrievedElement['data'].format(REDIS_LASTVALIDDATE_FORMAT);
			const storedLastValidDate = await redisclient.getLastValidDate();
			
			if (lastElementsDate !== storedLastValidDate || force === true){

				await redisclient.setLastValidDate(lastElementsDate);

				italianData = data;
				await redisclient.setLastRetrieveTimestampAsNow();

				// Retrieve regional data
				timing = process.hrtime();
				regionalData = await retrieveRegioniData()	
				timing = process.hrtime(timing);
				log.debug(`-> Regional data: retrieved ${regionalData.length} records in ${printTime(timing)}.`)				
		
				// Rebuilding plots and digests
				await buildMessagesCaches();

				log.debug(`Sending updated plot to ${subscribers.length} subscribers.`)

				timing = process.hrtime();
		
				subscribers.forEach(async chatId => {
					try{
						await bot.sendPhoto(
							chatId, 
							plotBuffer,
							{},
							{
								filename: 'plot.png',
								contentType: 'image/png'
							}
						)
						await bot.sendMessage(
							chatId,
							digestText,
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

				timing = process.hrtime(timing);
		
				log.debug(`Updated data sent to all subscribers (in ${printTime(timing)})`)
				log.debug('###################################################################');
				
				return true;

			}
			else {
				log.debug(`Retrieved data showing the same date as previously stored ${storedLastValidDate}, skipping transmission.`)
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

bot.onText(/\/digest/, async(msg, match) => {

	const chatId = msg.chat.id;
	
	// If an user requests an update, alert him if I'm still trying to download the 
	// daily update (anytime from 17.00 onwards, usually before 17.15).
	//let text = createDailyDigest(italianData);
	let text = digestText;
	if (scheduledTask != null){
		text =
			messages.retrievalInProgress()
			+ text;
	}

	let timing = process.hrtime();
	await bot.sendMessage(
		chatId, 
		text,
		{
			parse_mode: 'HTML'
		}
	)
	timing = process.hrtime(timing);

	log.debug(`Sent requested digest to chat id: ${chatId} (in ${printTime(timing)}).`);

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

	// If an user requests an update, alert him if I'm still trying to download the 
	// daily update (anytime from 17.00 onwards, usually before 17.15).	
	let caption = messages.photoCaption();
	if (scheduledTask != null){
		caption = messages.retrievalInProgressCaption() + caption;
	}
	
	let timing = process.hrtime();
	await bot.sendPhoto(
		chatId, 
		plotBuffer,
		{
			caption: caption
		},
		{
			filename: 'plot.png',
			contentType: 'image/png',
		}
	)
	timing = process.hrtime(timing);

	log.debug(`Sent requested plot to chat id: ${chatId} (in ${printTime(timing)}).`);

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

/*
bot.onText(/\/clear/, (msg) => {
	bot.sendMessage(msg.chat.id, 'Ok', {
		reply_markup: JSON.stringify({
			remove_keyboard: true
		})
	})
})
*/

bot.onText(/\/regioni/, (msg, match) => {

	const keyboard = REGIONS.map(area => ({
		text: area.descr,
		callback_data: JSON.stringify({
			type: 'area',
			id_area: area.id
		})
	}))

	const opts = {
		reply_markup: {
			inline_keyboard: splitArray(keyboard, 3)
		}		
	}

	bot.sendMessage(msg.from.id, 'Dati regionali. Seleziona area:', opts);

})


// Handle callback queries
bot.on('callback_query', (callbackQuery) => {

	const msg = callbackQuery.message;
	const chat_id = msg.chat.id;
	const message_id = msg.message_id;

	const data = JSON.parse(callbackQuery.data);
	const {type} = data;

	switch(type){

		case 'area':
			manageAreaCallback(bot, chat_id, message_id, data);
			break;

		case 'region':
			manageRegionCallback(bot, chat_id, message_id, data, regionalData);
			break;

		case 'areas_list':
			manageAreasListCallback(bot, chat_id, message_id);
			break;		

	}

	bot.answerCallbackQuery(callbackQuery.id);

});