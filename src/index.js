import {retrieveAndamentoNazionale} from './datarecovery'
import { CanvasRenderService } from 'chartjs-node-canvas';
import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import moment from 'moment'
import Logger from './logger'
import dotenv from 'dotenv'
import Redis from 'redis';

// Init logger
const log = new Logger("index.js")

// Init dotenv (to access .env variables)
dotenv.config()

// To disable a deprecation warning in the sendPhoto bot function
// (mime type warning even when the type is explicitly set)
process.env.NTBA_FIX_350 = true;

/**
 * Data retrieved stored as local variable.
 */
let italianData = []

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
redisclient.on("connect", function() {

	log.debug("...Redis connection established.");

	// Initial retrieve of italian data
	retrieveAll();

	// Scheduling to retrieve updated data 
	cron.schedule('00 17 * * *', retrieveAll);

	// Scheduling to send updated data to all subscribers
	cron.schedule('05 17 * * *', sendAll);

});

// ------------------------------------------------------------------------------------------------

/**
 * Retrieve all data and save it in a global variable.
 */
function retrieveAll(){	
	retrieveAndamentoNazionale(data => {
		if (data != null) italianData = data;
	});
}

/**
 * Send plot data to all subscribers.
 */
function sendAll() {

	log.debug("Sendall");

	redisclient.smembers(REDIS_SUBSCRIBERS, (err, subscribers) => {

		log.debug("Sending updates to subscribers...")
		if (subscribers.length === 0) {
			log.debug('..no subscriber to send to.')
			return;
		}
		else {
			log.debug(`..sending to ${subscribers.length} subscribers..`)
		}
	
		createAndamentoNazionaleGraph().then((buffer) => {
	
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
	
			log.debug('...sent.')
	
		});

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

// REDIS set holding the subscribers list (as list of chat id)
const REDIS_SUBSCRIBERS = 'subscribers'
// Prefix to REDIS hashes holding data for each subscriber (PREFIX + chatId)
const REDIS_SUB_PREFIX = 'sub:'

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
//bot.onText(/\/sendall/, (msg, match) => sendAll())

bot.onText(/\/sub/, (msg, match) => {
	const chatId = msg.chat.id;
	addToSubscribersList(chatId)
});

bot.onText(/\/unsub/, (msg, match) => {
	const chatId = msg.chat.id;
	removeFromSubscribersList(chatId)
});

bot.onText(/\/status/, async (msg, match) => {
	
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

bot.onText(/\/plot/, (msg, match) => {

	const chatId = msg.chat.id;

	createAndamentoNazionaleGraph().then((buffer) => {
		bot.sendPhoto(
			chatId, 
			buffer,
			{},
			{
				filename: 'plot.png',
				contentType: 'image/png'
			}
		)
	});

})

bot.onText(/\/about/, (msg, match) => {

	const chatId = msg.chat.id;

	bot.sendMessage(chatId, 
`COVID-19 bot by PicciMario <mario.piccinelli@gmail.com>. 
Daily updates of new cases in Italy, every day at about 5pm italian time (if subscribed). 
See https://github.com/PicciMario/covidbot for technical details.`
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