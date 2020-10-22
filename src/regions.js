import TelegramBot from 'node-telegram-bot-api';
import {splitArray} from './utilities'

// ------------------------------------------------------------------------------------------------

/**
 * List of italian regions, splitted by area.
 */
export const REGIONS = [
	{
		id: 'nordovest',
		descr: 'Nord-Ovest',
		regions: [
			{
				id: 'lombardia',
				descr: 'Lombardia'
			},
			{
				id: 'piemonte',
				descr: 'Piemonte'
			},
			{
				id: 'valledaosta',
				descr: 'Valle d\'Aosta'
			},									
			{
				id: 'liguria',
				descr: 'Liguria'
			},
		]
	},
	{
		id: 'nordest',
		descr: 'Nord-Est',
		regions: [
			{
				id: 'trentino',
				descr: 'Trentino-Alto Adige'
			},
			{
				id: 'veneto',
				descr: 'Veneto'
			},
			{
				id: 'friuli',
				descr: 'Friuli-Venezia Giulia'
			},
			{
				id: 'emilia',
				descr: 'Emilia-Romagna'
			}
		]
	},
	{
		id: 'centro',
		descr: 'Centro',
		regions: [
			{
				id: 'toscana',
				descr: 'Toscana'
			},
			{
				id: 'umbria',
				descr: 'Umbria'
			},
			{
				id: 'marche',
				descr: 'Marche'
			},
			{
				id: 'lazio',
				descr: 'Lazio'
			}
		]
	},
	{
		id: 'sud',
		descr: 'Sud',
		regions: [
			{
				id: 'abruzzo',
				descr: 'Abruzzo'
			},
			{
				id: 'molise',
				descr: 'Molise'
			},
			{
				id: 'campania',
				descr: 'Campania'
			},
			{
				id: 'puglia',
				descr: 'Puglia'
			},
			{
				id: 'basilicata',
				descr: 'Basilicata'
			},
			{
				id: 'calabria',
				descr: 'Calabria'
			},															
		]
	},
	{
		id: 'isole',
		descr: 'Isole',
		regions: [
			{
				id: 'sicilia',
				descr: 'Sicilia'
			},
			{
				id: 'sardegna',
				descr: 'Sardegna'
			},			
		]
	}
]

/**
 * Manages callback_query when a region is selected.
 * @param {TelegramBot} bot 
 * @param {string} chat_id 
 * @param {string} message_id 
 * @param {{id_area:string, id_reg:string}} data 
 */
export function manageRegionCallback(bot, chat_id, message_id, data){
	
	const {id_area, id_reg} = data;

	const area = REGIONS.find(area => area.id === id_area);
	if (area == null){
		console.err(`Richiesto codice area inesistente: ${id_area}`)
		return;
	}

	const reg = area.regions.find(reg => reg.id === id_reg);
	if (reg == null){
		console.err(`Richiesto codice regione inesistente ${id_reg} in area ${id_area}.`)
		return;
	}

	bot.editMessageText(
		`Hai chiesto informazioni circa la regione: ${reg.descr}`,
		{
			chat_id: chat_id,
			message_id: message_id,
			reply_markup: {
				inline_keyboard: [
					[]
				]
			}					
		}
	)		

}

/**
 * Manages callback_query when an area is selected.
 * @param {TelegramBot} bot 
 * @param {string} chat_id 
 * @param {string} message_id 
 * @param {{id_area:string}} data 
 */
export function manageAreaCallback(bot, chat_id, message_id, data){

	const {id_area} = data;
	const area = REGIONS.find(area => area.id === id_area);

	if (area == null){
		console.err(`Richiesto codice area inesistente: ${id_area}`)
		return;
	}

	const keyboard = area.regions.map(reg => ({
		text: reg.descr,
		callback_data: JSON.stringify({
			type: 'region',
			id_reg: reg.id,
			id_area: id_area
		})				
	}))
	
	keyboard.push({
		text: '<-',
		callback_data: JSON.stringify({
			type: 'areas_list'
		})
	})

	bot.editMessageText(
		`Hai chiesto regioni del ${area.descr}, seleziona regione:`,
		{
			chat_id: chat_id,
			message_id: message_id,
			reply_markup: {
				inline_keyboard: splitArray(keyboard, 3)
			}					
		}
	)	

}

/**
 * Manages callback_query when giung back from regions list to areas list.
 * @param {TelegramBot} bot 
 * @param {string} chat_id 
 * @param {string} message_id
 */
export function showAreasList(bot, chat_id, message_id){

	const keyboard = REGIONS.map(area => ({
		text: area.descr,
		callback_data: JSON.stringify({
			type: 'area',
			id_area: area.id
		})
	}))		

	bot.editMessageText(
		`Dati regionali. Seleziona area:`,
		{
			chat_id: chat_id,
			message_id: message_id,
			reply_markup: {
				inline_keyboard: [
					keyboard
				]
			}					
		}
	)

}