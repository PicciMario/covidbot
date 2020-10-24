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
	_lastValue, lastValue, lastValueWithSign, lastValueAsString,
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

	const lastDate = lastDateAsString(dataset);
	const regione = lastValueAsString(dataset, REG_DENOMINAZIONE);
	const nuoviPos = lastValue(dataset, REG_NUOVI_POS);
	const totDimessi = lastValue(dataset, REG_DIMESSI);
	const totDeceduti = lastValue(dataset, REG_DECEDUTI);
	const lastTotPos = lastValue(dataset, REG_TOT_POS);
	const deltaTotPos = lastValueWithSign(dataset, REG_DELTA_TOT_POS);
	const lastRic = lastValue(dataset, REG_RICOVERATI);
	const deltaRic = deltaValueWithSign(dataset, REG_RICOVERATI);
	const lastTI = lastValue(dataset, REG_TERAPIA);
	const deltaTI = deltaValueWithSign(dataset, REG_TERAPIA);
	const totCasi = lastValue(dataset, REG_TOT_CASI);
	
	let text = `<b>Regione ${regione}: aggiornamento del ${lastDate}.</b>`
	text += `\nNelle ultime 24 ore ci sono stati <b>${nuoviPos}</b> nuovi casi di positività, per un totale di <b>${lastTotPos}</b> attualmente positivi (<b>${deltaTotPos}</b> rispetto a ieri).`;
	text += `\nCi sono <b>${lastRic}</b> persone ricoverate in ospedale (<b>${deltaRic}</b> rispetto al giorno precedente) e <b>${lastTI}</b> persone in terapia intensiva (<b>${deltaTI}</b> rispetto al giorno precedente).`;
	text += `\nDall'inizio dell'epidemia, la regione ha avuto un numero totale di <b>${totCasi}</b> casi, <b>${totDimessi}</b> guariti e <b>${totDeceduti}</b> vittime.`

	return text;

}

/**
 * Creates histogram with daily new infections. Returns a PNG stream inside a Buffer.
 * @param {Object[]} fullDataset Dataset for the region.
 * @param {Object} regionObject Region object.
 * @returns {Promise<Buffer>}
 */
export function createRegionalPlot(fullDataset, regionObject) {

    const dataset = sliceDataset(fullDataset)

    const nuoviPOS = lastValueWithSign(dataset, REG_NUOVI_POS);

    const configuration = {
        type: 'bar',
        data: {
            labels: dataset.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Nuovi positivi (${nuoviPOS})`,
					backgroundColor: 'blue',
					borderColor: 'blue',
					data: dataset.map(element => element[REG_NUOVI_POS])
				},
            ]
        },
        options: {
			title: {
				display: true,
				text: `Andamento nuovi casi in ${regionObject.descr} al ${lastDateAsString(dataset)} (${nuoviPOS})`
			},
			legend: {
				position: 'bottom',
				display: false
			}
        }
    };

    const canvasRenderService = new CanvasRenderService(500, 250);
	return canvasRenderService.renderToBuffer(configuration, 'image/png');
	
}