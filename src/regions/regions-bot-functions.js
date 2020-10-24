/**
 * Telegram bot functions related to daily regional data.
 *
 * @link    https://github.com/PicciMario/covidbot
 * @author  Mario Piccinelli <mario.piccinelli@gmail.com>
 */

import TelegramBot from 'node-telegram-bot-api';
import {createRegionDailyDigest} from './regions-output';
import {splitArray} from '../utilities'
import {REGIONS} from './regions-list'

// ------------------------------------------------------------------------------------------------

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

	const text = createRegionDailyDigest(regionalData[reg.codice_regione] || []);	

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
export function manageAreasListCallback(bot, chat_id, message_id){

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

/**
 * Sends digest for the region whose dataset is provided.
 * @param {TelegramBot} bot 
 * @param {number} chat_id 
 * @param {object[]} regionDataset Dataset of the chosen region.
 */
export function sendRegionData(bot, chat_id, regionDataset){
	
	const text = createRegionDailyDigest(regionDataset);	

	bot.sendMessage(
		chat_id,
		text,
		{parse_mode: 'HTML'}
	)	

}