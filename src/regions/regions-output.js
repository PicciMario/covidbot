/**
 * Functions used to produce output related to regional daily data.
 *
 * @link    https://github.com/PicciMario/covidbot
 * @author  Mario Piccinelli <mario.piccinelli@gmail.com>
 */

import sharp from 'sharp';
import { CanvasRenderService } from 'chartjs-node-canvas';
import {
	sliceDataset, 
	_prevValue, _beforePrevValue,
	_lastValue, lastValue, lastValueWithSign, 
	_deltaValue, deltaValue, deltaValueWithSign, 
	lastDateAsString, dateAsString,
	formatInt, formatIntSign, formatPerc
} from '../utilities'

const REG_DENOMINAZIONE = 'denominazione_regione'
const REG_RICOVERATI = 'ricoverati_con_sintomi'
const REG_TERAPIA = 'terapia_intensiva'
const REG_TOT_POS = 'totale_positivi'
const REG_NUOVI_POS = 'nuovi_positivi'
const REG_DIMESSI = 'dimessi_guariti'
const REG_DECEDUTI = 'deceduti'
const REG_DELTA_TOT_POS = 'variazione_totale_positivi'
const REG_TOT_CASI = 'totale_casi'

/**
 * Creates daily HTML-formatted digest message.
 * @param {Object} dataset 
 * @returns {string}
 */
export function createRegionDailyDigest(dataset){

	const lastDate = dateAsString(dataset);
	const regione = dataset[REG_DENOMINAZIONE];
	const nuoviPos = formatInt(dataset[REG_NUOVI_POS]);
	const totDimessi = formatInt(dataset[REG_DIMESSI]);
	const totDeceduti = formatInt(dataset[REG_DECEDUTI]);
	const lastTotPos = formatInt(dataset[REG_TOT_POS]);
	const deltaTotPos = formatIntSign(dataset[REG_DELTA_TOT_POS]);
	const lastRic = formatInt(dataset[REG_RICOVERATI]);
	const lastTI = formatInt(dataset[REG_TERAPIA]);
	const totCasi = formatInt(dataset[REG_TOT_CASI]);

	
	let text = `<b>Regione ${regione}: aggiornamento del ${lastDate}.</b>`
	text += `\nNelle ultime 24 ore ci sono stati <b>${nuoviPos}</b> nuovi casi di positività, per un totale di <b>${lastTotPos}</b> attualmente positivi (<b>${deltaTotPos}</b> rispetto a ieri).`;
	text += `\nCi sono <b>${lastRic}</b> persone ricoverate in ospedale e <b>${lastTI}</b> persone in terapia intensiva.`;
	text += `\nDall'inizio dell'epidemia, la regione ha avuto un numero totale di <b>${totCasi}</b> casi, <b>${totDimessi}</b> guariti e <b>${totDeceduti}</b> vittime.`

	return text;

}