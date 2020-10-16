import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import moment from 'moment'
import Logger from './logger'
import dotenv from 'dotenv'
import Redis from 'redis';
import {retrieveDailyData} from './datarecovery'
import {buildPlot, createDailyDigest} from './plotter';
import * as redislib from './redislib';
import * as messages from './messages';

// Bot version
const VERSION = '1.3.0';

// REDIS set holding the subscribers list (as list of chat id)
const REDIS_SUBSCRIBERS = 'subscribers'

// Prefix to REDIS hashes holding data for each subscriber (PREFIX + chatId)
const REDIS_SUB_PREFIX = 'sub:'

// Key holding the formatted timestamp of the last valid dataset retrieved
const REDIS_LASTVALIDDATE = 'last'
// Date format for the REDIS_LASTVALIDDATE Redis key content.
const REDIS_LASTVALIDDATE_FORMAT = 'DD MMM YYYY HH:mm:SS';

// Actual timestamp of the last successful retrieval operation
const REDIS_LASTRETRIEVETIMESTAMP = 'last_timestamp'

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
bot.on("polling_error", (err) => log.error("Telegram polling error", err));

// Initialize REDIS connection --------------------------------------------------------------------

// Read params from .env file
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

// Seconds between redis connection attempts
const SECONDS_REDIS_CONN_RETRY = 10;

// REDIS connection retry strategy
function _redis_retry_strategy({error, total_retry_time, attempt}){

	// Total time: 60 sec
	if (total_retry_time > 1000 * 60) {
		log.debug(`Unable to reach Redis instance on ${redisHost}:${redisPort}, retry time exhausted, exiting.`);
		process.exit()
	}

	// Max connection attempts: 10
	if (attempt > 10) {
		log.debug(`Unable to reach Redis instance on ${redisHost}:${redisPort}, retry attempts exhausted, exiting.`);
		process.exit()
	}

	log.debug(`Unable to reach Redis instance on ${redisHost}:${redisPort}, will retry in ${SECONDS_REDIS_CONN_RETRY} seconds...`);
	
	// Next attempt in X ms.
	return SECONDS_REDIS_CONN_RETRY*1000; 

}

// Init connection
log.debug(`Attempting Redis connection on ${redisHost}:${redisPort}...`);
const redisclient = Redis.createClient({
	host: redisHost,
	port: redisPort,
	retry_strategy: _redis_retry_strategy
});

// Callback after successful redis connection
redisclient.on("connect", async function() {
	log.debug("...Redis connection established.");
	main();
});

// ------------------------------------------------------------------------------------------------

/**
 * Application entry point (called after Redis connection established).
 */
async function main(){

	log.debug('Retrieving italian nation-level data...')

	try{
		italianData = await retrieveDailyData()
		log.debug(`...italian nation-level data done (${italianData.length} records).`)
	}
	catch (err){
		italianData = []
		log.err(`Error: ${err.message}`)
	}

	const lastElement = italianData[italianData.length-1];
	if (lastElement){
		await setLastValidDate(lastElement['data'].format(REDIS_LASTVALIDDATE_FORMAT));
		await setLastRetrieveTimestamp(moment().format('DD/MMM/YYYY HH:mm:SS'));
	}

	// Everyday at 5pm, start a task which will try to send to subscribers until
	// it is able to do so (because it retrieved new data).
	cron.schedule('00 17 * * *', () => {

		log.debug(`Starting scheduled task...`);
	
		// Delete existing task
		if (scheduledTask != null){
			try{
				scheduledTask.destroy();
				scheduledTask = null;
			}
			catch (err){
				log.debug(`Error while killing scheduled task: ${err.message}`)
			}
		}

		scheduledTask = cron.schedule('*/2 * * * *', async () => {
			const done = await sendAll();
			if (done){
				scheduledTask.destroy();
				scheduledTask = null;
			}
		})

	})

}

/**
 * Send plot data to all subscribers.
 */
async function sendAll(force=false) {
	
	try{

		const subscribers = await redislib.smembers(redisclient, REDIS_SUBSCRIBERS)

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
			const storedLastValidDate = await getLastValidDate();
			
			if (lastElementsDate !== storedLastValidDate || force === true){

				log.debug(`Sending updated plot to ${subscribers.length} subscribers.`)

				await setLastValidDate(lastElementsDate);

				italianData = data;	
				log.debug(`Retrieved new data (${data.length} records).`);
				await setLastRetrieveTimestamp(moment().format('DD/MMM/YYYY HH:mm:SS'));
		
				const buffer = await buildPlot(italianData)
				const digest = await createDailyDigest(italianData)
		
				subscribers.forEach(chatId => {
					bot.sendPhoto(
						chatId, 
						buffer,
						{},
						{
							filename: 'plot.png',
							contentType: 'image/png'
						}
					)
					bot.sendMessage(
						chatId,
						digest,
						{
							parse_mode: "HTML"
						}
					)
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

function getLastValidDate(){
	return redislib.get(redisclient, REDIS_LASTVALIDDATE)
}

function setLastValidDate(value){
	return redislib.set(redisclient, REDIS_LASTVALIDDATE, value)
}

// -----

function getLastRetrieveTimestamp(){
	return redislib.get(redisclient, REDIS_LASTRETRIEVETIMESTAMP)
}

function setLastRetrieveTimestamp(value){
	return redislib.set(redisclient, REDIS_LASTRETRIEVETIMESTAMP, value)
}

// ------------------------------------------------------------------------------------------------

/*
sub - Subscribe to daily COVID-19 updates
unsub - Unsubscribe
status - Subscription status
plot - Request actual situation plot
digest - Riassunto giornaliero
about - About this bot
help - Commands list
*/

if (DEVELOPMENT){
	bot.onText(/\/sendall/, (msg, match) => sendAll(true))
}

bot.onText(/\/debug/, async (msg, match) => {
	
	const chatId = msg.chat.id;

	try{
		const subs = await redislib.smembers(redisclient, REDIS_SUBSCRIBERS)
		const lastValidDate = await getLastValidDate()
		const lastRetrieval = await getLastRetrieveTimestamp()
		let message = `Number of subscribers: ${subs.length}; Last valid date: ${lastValidDate} (retrieved on ${lastRetrieval})`;
		if (DEVELOPMENT) message += `\nRunning in DEVELOPMENT mode!`;
		bot.sendMessage(chatId, message)	
	}
	catch (err){
		log.error(`Error while retrieving data: ${err.message}`)
	}

})

bot.onText(/\/digest/, (msg, match) => {
	const chatId = msg.chat.id;
	bot.sendMessage(
		chatId, 
		createDailyDigest(italianData),
		{
			parse_mode: 'HTML'
		}
	)
});

bot.onText(/\/sub/, async (msg, match) => {
	const chatId = msg.chat.id;
	log.debug(`Adding new subscribe ${chatId} to db...`);
	await redislib.sadd(redisclient, REDIS_SUBSCRIBERS, chatId);
	await redislib.hset(redisclient, REDIS_SUB_PREFIX + chatId, 'timestamp', moment().format("DD MMM YYYY HH:mm:SS").toString());
	bot.sendMessage(chatId, messages.subRequested());
});

bot.onText(/\/unsub/, async (msg, match) => {
	const chatId = msg.chat.id;
	log.debug(`Removing subscription of ${chatId} from db...`);
	await redislib.srem(redisclient, REDIS_SUBSCRIBERS, chatId);
	await redislib.del(redisclient, REDIS_SUB_PREFIX + chatId);
	bot.sendMessage(chatId, messages.cancRequested());
});

bot.onText(/\/status/, async (msg, match) => {
	
	const chatId = msg.chat.id;

	const isMember = await redislib.sismember(redisclient, REDIS_SUBSCRIBERS, chatId);

	if (isMember === 1){
		const subSince = await redislib.hget(redisclient, REDIS_SUB_PREFIX + chatId, 'timestamp');
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
	
	bot.sendPhoto(
		chatId, 
		imageBuffer,
		{
			caption: messages.photoCaption()
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