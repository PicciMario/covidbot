/**
 * Telegram bot functions related to daily regional data.
 *
 * @link    https://github.com/PicciMario/covidbot
 * @author  Mario Piccinelli <mario.piccinelli@gmail.com>
 */

import TelegramBot from 'node-telegram-bot-api';
import Logger from '../logger'
import { createProvinceDailyDigest, createProvincialPlot } from './provinces-output';

// Init logger
const log = new Logger("provinces-bot-funcs")

// ------------------------------------------------------------------------------------------------

/**
 * Sends digest for the province whose dataset is provided.
 * @param {TelegramBot} bot 
 * @param {number} chat_id 
 * @param {object[]} provinceDataset Dataset of the chosen region.
 * @param {object} provinceObject Region object.
 */
export async function sendProvinceData(bot, chat_id, provinceDataset, provinceObject){
	
	const text = createProvinceDailyDigest(provinceDataset);	

	await bot.sendMessage(
		chat_id,
		text,
		{parse_mode: 'HTML'}
	)	

	const plot = await createProvincialPlot(provinceDataset, provinceObject)

	await bot.sendPhoto(
		chat_id, 
		plot,
		{},
		{
			filename: 'plot.png',
			contentType: 'image/png'
		}
	)	

}