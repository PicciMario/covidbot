import TelegramBot from 'node-telegram-bot-api';
import { createRegionDailyDigest } from './plotter';
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
				descr: 'Lombardia',
				codice_regione: 3
			},
			{
				id: 'piemonte',
				descr: 'Piemonte',
				codice_regione: 1
			},
			{
				id: 'valledaosta',
				descr: 'Valle d\'Aosta',
				codice_regione: 2
			},									
			{
				id: 'liguria',
				descr: 'Liguria',
				codice_regione: 7
			},
		]
	},
	{
		id: 'nordest',
		descr: 'Nord-Est',
		regions: [
			/*
			{
				id: 'trentino',
				descr: 'Trentino-Alto Adige',
				codice_regione: 4
			},
			*/
			{
				id: 'bolzano',
				descr: 'P.A. Bolzano',
				codice_regione: 21
			},
			{
				id: 'trento',
				descr: 'P.A. Trento',
				codice_regione: 22
			},
			{
				id: 'veneto',
				descr: 'Veneto',
				codice_regione: 5
			},
			{
				id: 'friuli',
				descr: 'Friuli-Venezia Giulia',
				codice_regione: 6
			},
			{
				id: 'emilia',
				descr: 'Emilia-Romagna',
				codice_regione: 8
			}
		]
	},
	{
		id: 'centro',
		descr: 'Centro',
		regions: [
			{
				id: 'toscana',
				descr: 'Toscana',
				codice_regione: 9
			},
			{
				id: 'umbria',
				descr: 'Umbria',
				codice_regione: 10
			},
			{
				id: 'marche',
				descr: 'Marche',
				codice_regione: 11
			},
			{
				id: 'lazio',
				descr: 'Lazio',
				codice_regione: 12
			}
		]
	},
	{
		id: 'sud',
		descr: 'Sud',
		regions: [
			{
				id: 'abruzzo',
				descr: 'Abruzzo',
				codice_regione: 13
			},
			{
				id: 'molise',
				descr: 'Molise',
				codice_regione: 14
			},
			{
				id: 'campania',
				descr: 'Campania',
				codice_regione: 15
			},
			{
				id: 'puglia',
				descr: 'Puglia',
				codice_regione: 16
			},
			{
				id: 'basilicata',
				descr: 'Basilicata',
				codice_regione: 17
			},
			{
				id: 'calabria',
				descr: 'Calabria',
				codice_regione: 18
			},															
		]
	},
	{
		id: 'isole',
		descr: 'Isole',
		regions: [
			{
				id: 'sicilia',
				descr: 'Sicilia',
				codice_regione: 19
			},
			{
				id: 'sardegna',
				descr: 'Sardegna',
				codice_regione: 20
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
 * @param {object[]} regionalData
 */
export function manageRegionCallback(bot, chat_id, message_id, data, regionalData){
	
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

	const regionData = regionalData.find(candidate => candidate.codice_regione === reg.codice_regione)
	if (regionData == null){
		console.err(`Dati inesistenti per codice regione ${id_reg} in area ${id_area}.`)
		return;
	}

	const text = createRegionDailyDigest(regionData);

	bot.editMessageText(
		text,
		{
			chat_id: chat_id,
			message_id: message_id,
			reply_markup: {
				inline_keyboard: [
					[]
				]
			},
			parse_mode: 'HTML'					
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
				inline_keyboard: splitArray(keyboard, 3)
			}					
		}
	)

}