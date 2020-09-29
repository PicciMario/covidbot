import {retrieveAndamentoNazionale} from './datarecovery'
import { CanvasRenderService } from 'chartjs-node-canvas';
import cron from 'node-cron';
import telegrambot from 'node-telegram-bot-api';
import moment from 'moment'
import Logger from './logger'
import dotenv from 'dotenv'

// Init logger
const log = new Logger("index.js")

// Init dotenv (to access .env variables)
dotenv.config()

// To disable a deprecation warning in the sendPhoto bot function
// (mime type warning even when the type is explicitly set)
process.env.NTBA_FIX_350 = true;

// Bot token
const token = process.env.BOT_TOKEN;
if (!token){
	log.err("Telegram bot token not provided (need a .env file with BOT_TOKEN key)!")
	process.exit()
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new telegrambot(token, {polling: true});
bot.on("polling_error", (err) => log.error("Polling error: " + err));

/**
 * Data retrieved.
 */
let italianData = []

/**
 * Subscribers list.
 * key: chatId
 * content: {timestamp}
 */
const subscribersList = {}

// ------------------------------------------------------------------------------------------------

// Initial retrieve of italian data
retrieveAll();

// Scheduling to retrieve updated data 
cron.schedule('00 17 * * *', retrieveAll, {timezone: "Europe/Rome"});

// Scheduling to send updated data to all subscribers
cron.schedule('05 17 * * *', sendAll, {timezone: "Europe/Rome"});

// ------------------------------------------------------------------------------------------------

/**
 * Retrieve all data and save it in a global variable.
 */
function retrieveAll(){
	log.debug('Retrieving data.')
	log.debug('Retrieving italian nation-level data...')
	retrieveAndamentoNazionale(data => {
		italianData = data;
		log.debug(`...italian nation-level data done (${data.length} records).`)
	});
}

/**
 * Send plot data to all subscribers.
 */
function sendAll() {

	log.debug("Sending updates to subscribers...")
	if (Object.keys(subscribersList).length === 0) {
		log.debug('..no subscriber to send to.')
		return;
	}
	else {
		log.debug(`..sending to ${Object.keys(subscribersList).length} subscribers..`)
	}

	createAndamentoNazionaleGraph().then((buffer) => {

		Object.keys(subscribersList).forEach(chatId => {
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
	log.debug("Subscription requested by " + chatId)
	subscribersList[chatId] = {
		timestamp: moment().format("DD MMM YYYY HH:mm:SS").toString()
	}
}

function removeFromSubscribersList(chatId){
	log.debug("Subscription removal requested by " + chatId)
	delete subscribersList[chatId]
}

function subscribersListStatus(chatId){
	return subscribersList[chatId];
}

function subscribersListStatusMessage(chatId){
	let elem = subscribersListStatus(chatId)
	if (elem){
		return "Chat subscribed to updates since " + elem.timestamp
	}
	else {
		return "Chat currently not subscribed"
	}	
}

// ------------------------------------------------------------------------------------------------

/*
sub - Subscribe to daily COVID-19 updates
unsub - Unsubscribe
status - Subscription status
plot - Request actual situation plot
*/

bot.onText(/\/sub/, (msg, match) => {
	const chatId = msg.chat.id;
	addToSubscribersList(chatId)
	bot.sendMessage(chatId, subscribersListStatusMessage(chatId))
});

bot.onText(/\/unsub/, (msg, match) => {
	const chatId = msg.chat.id;
	removeFromSubscribersList(chatId)
	bot.sendMessage(chatId, subscribersListStatusMessage(chatId))
});

bot.onText(/\/status/, (msg, match) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, subscribersListStatusMessage(chatId))
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