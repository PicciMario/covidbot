import sharp from 'sharp';
import { CanvasRenderService } from 'chartjs-node-canvas';
import {
	sliceDataset, 
	_prevValue, _beforePrevValue,
	_lastValue, lastValue, lastValueWithSign, 
	_deltaValue, deltaValue, deltaValueWithSign, 
	lastDateAsString, dateAsString,
	formatInt, formatIntSign, formatPerc
} from './utilities'

// ------------------------------------------------------------------------------------------------

const KEY_NUOVI_POSITIVI = 'nuovi_positivi';
const KEY_DIMESSI = 'dimessi_guariti';
const KEY_DECEDUTI = 'deceduti';
const KEY_TOTALE_POSITIVI = 'totale_positivi';
const KEY_TERAPIA_INTENSIVA = 'terapia_intensiva';
const KEY_RICOVERATI = 'ricoverati_con_sintomi';
const KEY_VARIAZIONE_POSITIVI = 'variazione_totale_positivi';
const KEY_TAMPONI = 'tamponi';

// ------------------------------------------------------------------------------------------------

/**
 * Creates daily HTML-formatted digest message.
 * @param {Object[]} dataset 
 * @returns {string}
 */
export function createDailyDigest(dataset){

	const lastDate = lastDateAsString(dataset);

	const nuoviPOS = lastValue(dataset, KEY_NUOVI_POSITIVI);
	const nuoviDimessi = deltaValue(dataset, KEY_DIMESSI);
	const nuoviDeceduti = deltaValue(dataset, KEY_DECEDUTI);
	const lastTotPos = lastValue(dataset, KEY_TOTALE_POSITIVI);
	const deltaTotPos = lastValueWithSign(dataset, KEY_VARIAZIONE_POSITIVI);
    const lastTI = lastValue(dataset, KEY_TERAPIA_INTENSIVA);
    const deltaTI = deltaValueWithSign(dataset, KEY_TERAPIA_INTENSIVA);
    const lastRIC = lastValue(dataset, KEY_RICOVERATI);
	const deltaRIC = deltaValueWithSign(dataset, KEY_RICOVERATI);
	const deltaTamp = deltaValue(dataset, KEY_TAMPONI);

	const positiviSuTamponiOggi = _lastValue(dataset, KEY_NUOVI_POSITIVI) / _deltaValue(dataset, KEY_TAMPONI) * 100;
	const percPosSuTamponiOggi = formatPerc(positiviSuTamponiOggi);
	const positiviSuTamponiIeri = _prevValue(dataset, KEY_NUOVI_POSITIVI) / (_prevValue(dataset, KEY_TAMPONI) - _beforePrevValue(dataset, KEY_TAMPONI)) * 100;
	const percPosSuTamponiIeri = formatPerc(positiviSuTamponiIeri);
	
	const deltaTampIeriRaw = _prevValue(dataset, KEY_TAMPONI) - _beforePrevValue(dataset, KEY_TAMPONI);
	const deltaTampIeri = formatIntSign(deltaTampIeriRaw);

	
	let text = `<b>Aggiornamento del ${lastDate}</b>`
	text += `\nNelle ultime 24 ore ci sono stati <b>${nuoviPOS}</b> nuovi casi di positività, <b>${nuoviDimessi}</b> guariti e <b>${nuoviDeceduti}</b> deceduti, per un totale di <b>${lastTotPos}</b> attualmente positivi (<b>${deltaTotPos}</b> rispetto a ieri).`;
	text += `\nCi sono <b>${lastRIC}</b> persone ricoverate in ospedale (<b>${deltaRIC}</b> rispetto al giorno precedente) e <b>${lastTI}</b> persone in terapia intensiva (<b>${deltaTI}</b> rispetto al giorno precedente).`;
	text += `\nSono stati svolti <b>${deltaTamp}</b> tamponi, di cui sono risultati positivi <b>${percPosSuTamponiOggi}%</b> `
	text += `(ieri era <b>${percPosSuTamponiIeri}%</b> su <b>${deltaTampIeri}</b> tamponi).`;
	text += `\n\nUsa il comando <b>/regione</b> per visualizzare aggiornamenti specifici per regione, o il comando <b>/province</b> per ultimi aggiornamenti per provincia.`

	return text;

}

// ------------------------------------------------------------------------------------------------

/**
 * Creates histogram with daily new infections. Returns a PNG stream inside a Buffer.
 * @param {Object[]} fullDataset
 * @returns {Promise<Buffer>}
 */
function _createTopPlot(fullDataset) {

    const dataset = sliceDataset(fullDataset)

    const nuoviPOS = lastValueWithSign(dataset, KEY_NUOVI_POSITIVI);

    const configuration = {
        type: 'bar',
        data: {
            labels: dataset.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Nuovi positivi (${nuoviPOS})`,
					backgroundColor: 'red',
					borderColor: 'red',
					data: dataset.map(element => element[KEY_NUOVI_POSITIVI])
				},
            ]
        },
        options: {
			title: {
				display: true,
				text: `Andamento nuovi casi in italia al ${lastDateAsString(dataset)} (${nuoviPOS})`
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

// ------------------------------------------------------------------------------------------------

/**
 * Creates histogram with daily new hospitalized/intensive care numbers. Returns a PNG stream inside a Buffer.
 * @param {Object[]} fullDataset
 * @returns {Promise<Buffer>}
 */
function _createBottomPlot(fullDataset) {

    const dataset = sliceDataset(fullDataset)
    
    const lastTI = lastValue(dataset, KEY_TERAPIA_INTENSIVA);
    const deltaTI = deltaValueWithSign(dataset, KEY_TERAPIA_INTENSIVA);
    const lastRIC = lastValue(dataset, KEY_RICOVERATI);
    const deltaRIC = deltaValueWithSign(dataset, KEY_RICOVERATI);

    const configuration = {
        type: 'bar',
        data: {
			labels: dataset.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Posti occupati in terapia intensiva (ad oggi: ${lastTI})`,
					backgroundColor: 'darkred',
					borderColor: 'darkred',
					data: dataset.map(element => element[KEY_TERAPIA_INTENSIVA])
				},           
				{
					label: `Ricoverati con sintomi (ad oggi: ${lastRIC})`,
					backgroundColor: 'darkred',
					borderColor: 'darkred',
					data: dataset.map(element => element[KEY_RICOVERATI])
				}
            ]
		},
        options: {
			title: {
				display: true,
				text: `Situazione ospedali. Ricoverati ${lastRIC} (${deltaRIC}), terapia intensiva ${lastTI} (${deltaTI}).`
			},			
			legend: {
				position: 'bottom',
				display: false
			},
			scales: {
				xAxes: [{
					display: false,
					ticks: {
						display: false
					}
				}]
			}		
        }		
    };

    const canvasRenderService = new CanvasRenderService(500, 150);
	return canvasRenderService.renderToBuffer(configuration, 'image/png');
	
}

// ------------------------------------------------------------------------------------------------

/**
 * Combines the two plots into a single image. Returns a PNG Buffer.
 * @param {Object[]} dataset
 * @returns {Promise<Buffer>}
 */
export async function buildPlot(dataset){

	const buffer = await _createTopPlot(dataset);
	const buffer2 = await _createBottomPlot(dataset);

	const imageBuffer = await sharp({
			create: {
				width: 520,
				height: 400,
				channels: 3,
				background: { r: 245, g: 245, b: 245}			
			}
		})
		.composite([
			{ input: buffer, gravity: 'north' }, 
			{ input: buffer2, gravity: 'south' }
		])
		.png()
		.toBuffer();

	return imageBuffer;

}
