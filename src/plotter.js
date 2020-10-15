import sharp from 'sharp';
import { CanvasRenderService } from 'chartjs-node-canvas';

// ------------------------------------------------------------------------------------------------

function _sliceDataset(dataset, maxItems = 120){

	const num = Math.min(maxItems, dataset.length);
	const elements = dataset.slice(dataset.length-num, dataset.length);
    
    return elements

}

function lastValue(dataset, key){

    if (dataset.length === 0) return 0;

    const lastElement = dataset[dataset.length-1];
    
    if (lastElement){
        return lastElement[key] || 0;
    }
    else {
        return 0;
    }

}

function deltaValue(dataset, key){

    if (dataset.length === 0) return 0;

    const lastElement = dataset[dataset.length-1];

    if (dataset.length === 1){
        return lastElement[key] || 0;
    }

    const prevElement = dataset[dataset.length-2]

    return (lastElement[key] - prevElement[key])

}

function deltaValueWithSign(dataset, key){
    const delta = deltaValue(dataset, key);
    return delta >= 0 ? `+${delta}` : `-${delta}`
}

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
 * Creates italian nation-level plot. Returns a buffer with the png image of the plot itself.
 */
function _createTopPlot(fullDataset) {

    const KEY_NUOVI_POSITIVI = 'nuovi_positivi';

    const dataset = _sliceDataset(fullDataset)

    const nuoviPOS = lastValue(dataset, KEY_NUOVI_POSITIVI);

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
				text: `Andamento nuovi casi in italia al ${lastDateAsString(dataset)} (+${nuoviPOS})`
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
 * Creates italian nation-level plot. Returns a buffer with the png image of the plot itself.
 */
function _createBottomPlot(fullDataset) {

    const KEY_TERAPIA_INTENSIVA = 'terapia_intensiva';
    const KEY_RICOVERATI = 'ricoverati_con_sintomi';

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

async function buildPlot(dataset){

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

// ------------------------------------------------------------------------------------------------

export default buildPlot;