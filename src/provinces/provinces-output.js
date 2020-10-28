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

const PROV_DENOMINAZIONE_REG = 'denominazione_regione'
const PROV_DENOMINAZIONE = 'denominazione_provincia'
const PROV_TOT_CASI = 'totale_casi'
const PROVCUST_NUOVI_CASI = 'nuovi_casi'

/**
 * Creates daily HTML-formatted digest message.
 * @param {Object} dataset 
 * @returns {string}
 */
export function createProvinceDailyDigest(dataset){

	const lastDate = lastDateAsString(dataset);
	const provincia = lastValueAsString(dataset, PROV_DENOMINAZIONE);
	const regione = lastValueAsString(dataset, PROV_DENOMINAZIONE_REG);
	const totCasi = lastValue(dataset, PROV_TOT_CASI);
	const deltaCasi = deltaValue(dataset, PROV_TOT_CASI);
	
	let text = `<b>Provincia ${provincia} (${regione}): aggiornamento del ${lastDate}.</b>`
	text += `\nNelle ultime 24 ore ci sono stati <b>${deltaCasi}</b> nuovi casi di positività, per un totale di <b>${totCasi}</b> dell'inizio dell'epidemia.`

	return text;

}

/**
 * Creates histogram with daily new infections. Returns a PNG stream inside a Buffer.
 * @param {Object[]} fullDataset Dataset for the region.
 * @param {Object} regionObject Region object.
 * @returns {Promise<Buffer>}
 */
export function createProvincialPlot(fullDataset, regionObject) {

	let dataset = sliceDataset(fullDataset)

	dataset = dataset.map((record, index, dataset) => (
		{
			...record, 
			[PROVCUST_NUOVI_CASI]: index - 1 >= 0 ? record[PROV_TOT_CASI] - dataset[index-1][PROV_TOT_CASI] : 0
		}
	))
	
    const nuoviPOS = lastValueWithSign(dataset, PROVCUST_NUOVI_CASI);

    const configuration = {
        type: 'bar',
        data: {
            labels: dataset.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Totale casi (${nuoviPOS})`,
					backgroundColor: 'blue',
					borderColor: 'blue',
					data: dataset.map(element => element[PROVCUST_NUOVI_CASI])
				},
            ]
        },
        options: {
			title: {
				display: true,
				text: `Andamento nuovi casi in prov. ${regionObject['denominazione_provincia']} al ${lastDateAsString(dataset)} (${nuoviPOS})`
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