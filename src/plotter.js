import sharp from 'sharp';
import { CanvasRenderService } from 'chartjs-node-canvas';
import numeral from 'numeral';

// numeral configuration  -------------------------------------------------------------------------

numeral.register('locale', 'it', {
    delimiters: {
        thousands: '\'',
        decimal: ','
    },
    abbreviations: {
        thousand: 'k',
        million: 'm',
        billion: 'b',
        trillion: 't'
    },
    currency: {
        symbol: '€'
    }
});

numeral.locale('it');

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
 * Returns a new dataset with the "maxItems" last elements (if available).
 * @param {Object[]} dataset 
 * @param {number} [maxItems=120] - Items to slice
 */
function _sliceDataset(dataset, maxItems = 120){

	const num = Math.min(maxItems, dataset.length);
	const elements = dataset.slice(dataset.length-num, dataset.length);
    
    return elements

}

/**
 * Value of the key item inside the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
function _lastValue(dataset, key){

    if (dataset.length === 0) return 0;

    const lastElement = dataset[dataset.length-1];
    
    if (lastElement){
        return lastElement[key] || 0;
    }
    else {
        return 0;
    }

}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
function _deltaValue(dataset, key){

    if (dataset.length === 0) return 0;

	const lastElement = dataset[dataset.length-1];

    if (dataset.length === 1){
        return lastElement[key] || 0;
    }

	const prevElement = dataset[dataset.length-2]

    return (lastElement[key] - prevElement[key])

}

/**
 * Value of the key item inside the last element of the dataset.
 * Formatted as string.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
function lastValue(dataset, key){
	const val = _lastValue(dataset, key);
	return numeral(val).format();
}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * * Formatted as string.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
function deltaValue(dataset, key){
	const val = _deltaValue(dataset, key);
	return numeral(val).format();
}

/**
 * Value of the key item inside the last element of the dataset.
 * Formatted as string with explicit sign (+/-).
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
function lastValueWithSign(dataset, key){
    const last = _lastValue(dataset, key);
	return numeral(last).format('+0,0');
}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * Formatted as string with explicit sign (+/-).
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
function deltaValueWithSign(dataset, key){
    const delta = _deltaValue(dataset, key);
	return numeral(delta).format('+0,0');
}

/**
 * Formatted date from the "key" of the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} [key="data"]
 * @returns {string}
 */
function lastDateAsString(dataset, key='data'){

    const lastElement = dataset[dataset.length-1];

    if (lastElement){
        return lastElement[key].format('DD/MM/YYYY')
    }
    else {
        return '';
    }    

}

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
	const totTamp = lastValue(dataset, KEY_TAMPONI);
	const deltaTamp = deltaValue(dataset, KEY_TAMPONI);

	const percNum = _lastValue(dataset, KEY_NUOVI_POSITIVI) / _deltaValue(dataset, KEY_TAMPONI) * 100;
	const perc = numeral(percNum).format('0,0.00')
	
	let text = `<b>Aggiornamento del ${lastDate}</b>`
	text += `\nNelle ultime 24 ore ci sono stati <b>${nuoviPOS}</b> nuovi casi di positività, <b>${nuoviDimessi}</b> guariti e <b>${nuoviDeceduti}</b> deceduti, per un totale di <b>${lastTotPos}</b> attualmente positivi (<b>${deltaTotPos}</b> rispetto a ieri).`;
	text += `\nCi sono <b>${lastRIC}</b> persone ricoverate in ospedale (<b>${deltaRIC}</b> rispetto al giorno precedente) e <b>${lastTI}</b> persone in terapia intensiva (<b>${deltaTI}</b> rispetto al giorno precedente).`;
	text += `\nSono stati svolti <b>${deltaTamp}</b> tamponi, di cui sono risultati positivi <b>${perc}%</b>.`;

	return text;

}

// ------------------------------------------------------------------------------------------------

/**
 * Creates histogram with daily new infections. Returns a PNG stream inside a Buffer.
 * @param {Object[]} fullDataset
 * @returns {Buffer}
 */
function _createTopPlot(fullDataset) {

    const dataset = _sliceDataset(fullDataset)

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
 * @returns {Buffer}
 */
function _createBottomPlot(fullDataset) {

    const dataset = _sliceDataset(fullDataset)
    
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
 * @returns {Buffer}
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