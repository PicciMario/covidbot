import {retrieveDailyData} from './datarecovery'
import { CanvasRenderService } from 'chartjs-node-canvas';
import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import moment from 'moment'
import Logger from './logger'
import dotenv from 'dotenv'
import Redis from 'redis';

// Bot version
const VERSION = '1.0.0';

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
async function sendAll() {
	
	try{

		const subscribers = await retrieveSubscribersList()

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
			
			if (lastElementsDate !== storedLastValidDate){

				log.debug(`Sending updated plot to ${subscribers.length} subscribers.`)

				await setLastValidDate(lastElementsDate);

				italianData = data;	
				log.debug(`Retrieved new data (${data.length} records).`);
				await setLastRetrieveTimestamp(moment().format('DD/MMM/YYYY HH:mm:SS'));
		
				const buffer = await createAndamentoNazionaleGraph()
		
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

/**
 * Retrieve subscribers list. Returns a Promise which resolved in the list as an 
 * array of chat ids.
 * @param {*} callback 
 */
function retrieveSubscribersList(){

	return new Promise((resolve, reject) => {
		redisclient.smembers(REDIS_SUBSCRIBERS, (err, subscribers) => {
			if (err != null){
				reject(err);
			}
			resolve(subscribers);
		})
	})

}

// -----

function getLastValidDate(){
	return getRedisKey(REDIS_LASTVALIDDATE)
}

function setLastValidDate(value){
	return setRedisKey(REDIS_LASTVALIDDATE, value)
}

// -----

function getLastRetrieveTimestamp(){
	return getRedisKey(REDIS_LASTRETRIEVETIMESTAMP)
}

function setLastRetrieveTimestamp(value){
	return setRedisKey(REDIS_LASTRETRIEVETIMESTAMP, value)
}

// -----

function getRedisKey(key){
	return new Promise((resolve, reject) => {
		redisclient.get(key, (err, value) => {
			if (err != null){
				reject(err);
			}
			resolve(value);
		})		
	})
}

function setRedisKey(key, value){
	return new Promise((resolve, reject) => {
		redisclient.set(key, value, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	})
}

// ------------------------------------------------------------------------------------------------

/**
 * Creates italian nation-level plot. Returns a buffer with the png image of the plot itself.
 */
function createAndamentoNazionaleGraph() {

	const num = Math.min(120, italianData.length);
	const elements = italianData.slice(italianData.length-num, italianData.length);
	const lastElement = italianData[italianData.length-1]

    const configuration = {
        type: 'bar',
        data: {
            labels: elements.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: "Nuovi positivi (+" + lastElement['nuovi_positivi'] + ")",
					backgroundColor: 'red',
					borderColor: 'red',
					data: elements.map(element => element['nuovi_positivi'])
				},
            ]
        },
        options: {
			title: {
				display: true,
				text: 'Situazione in italia al ' + lastElement['data'].format('DD MMM YYYY')
			},
			legend: {
				position: 'bottom'
			}
        }
    };

    const canvasRenderService = new CanvasRenderService(500, 300);
	return canvasRenderService.renderToBuffer(configuration, 'image/png');
	
}

// ------------------------------------------------------------------------------------------------

function addToSubscribersList(chatId){
	redisclient.sadd(REDIS_SUBSCRIBERS, chatId, (err, res) => log.debug(`Adding new subscribe ${chatId} to db: ${res} (error: ${err})`))
	redisclient.hset(REDIS_SUB_PREFIX + chatId, 'timestamp', moment().format("DD MMM YYYY HH:mm:SS").toString())
	bot.sendMessage(chatId, "Subscription requested (check /status for current situation, might take a while).")
}

function removeFromSubscribersList(chatId){
	redisclient.srem(REDIS_SUBSCRIBERS, chatId, (err, res) => log.debug(`Removing subscription of ${chatId} from db: ${res} (error: ${err})`))
	redisclient.del(REDIS_SUB_PREFIX + chatId)
	bot.sendMessage(chatId, "Cancellation requested (check /status for current situation, might take a while).")
}

// ------------------------------------------------------------------------------------------------

/*
sub - Subscribe to daily COVID-19 updates
unsub - Unsubscribe
status - Subscription status
plot - Request actual situation plot
about - About this bot
help - Commands list
*/

// FOR TESTING PURPOSES ONLY!
/*
bot.onText(/\/sendall/, (msg, match) => sendAll())
*/

// FOR TESTING PURPOSES ONLY!
bot.onText(/\/debug/, async (msg, match) => {
	
	const chatId = msg.chat.id;

	try{
		const subs = await retrieveSubscribersList()
		const lastValidDate = await getLastValidDate()
		const lastRetrieval = await getLastRetrieveTimestamp()
		bot.sendMessage(chatId, `Number of subscribers: ${subs.length}; Last valid date: ${lastValidDate} (retrieved on ${lastRetrieval})`)	
	}
	catch (err){
		log.error(`Error while retrieving data: ${err.message}`)
	}

})

bot.onText(/\/sub/, (msg, match) => {
	const chatId = msg.chat.id;
	addToSubscribersList(chatId)
});

bot.onText(/\/unsub/, (msg, match) => {
	const chatId = msg.chat.id;
	removeFromSubscribersList(chatId)
});

bot.onText(/\/status/, (msg, match) => {
	
	const chatId = msg.chat.id;

	redisclient.sismember(REDIS_SUBSCRIBERS, chatId, (err, res) => {
		if (res === 1){
			redisclient.hget(REDIS_SUB_PREFIX + chatId, 'timestamp', (err, res) => {
				bot.sendMessage(chatId, `Subscribed since ${res}`)
			})
		}
		else {
			bot.sendMessage(chatId, `Currently not subscribed`)
		}
	})

});

bot.onText(/\/plot/, async (msg, match) => {

	const chatId = msg.chat.id;

	log.debug(`Requested plot from chat id: ${chatId}`);

	const buffer = await createAndamentoNazionaleGraph();
	
	bot.sendPhoto(
		chatId, 
		buffer,
		{},
		{
			filename: 'plot.png',
			contentType: 'image/png'
		}
	)

})

bot.onText(/\/about/, (msg, match) => {

	const chatId = msg.chat.id;

	bot.sendMessage(chatId, 
`<b>Italian Daily COVID Bot</b> v.${VERSION}
Subscribe for daily updates of new cases in Italy, every day at about 5pm italian time. 
<i>See https://github.com/PicciMario/covidbot for technical details.</i>`,
		{
			parse_mode: 'HTML'
		}
	);

})

bot.onText(/\/help/, (msg, match) => {

	const chatId = msg.chat.id;

	bot.sendMessage(chatId, 
`COVID-19 bot by PicciMario <mario.piccinelli@gmail.com>. 
Commands list:
  /sub - Subscribe to daily COVID-19 updates
  /unsub - Unsubscribe
  /status - Subscription status
  /plot - Request actual situation plot
  /about - About this bot
  /help - This list`
	);

})

bot.onText(/\/start/, (msg, match) => {

	const chatId = msg.chat.id;

	bot.sendMessage(chatId, 
`COVID-19 bot by PicciMario <mario.piccinelli@gmail.com>. 
Type /about or /help to begin.`
	);

})

// ------------------------------------------------------------------------------------------------