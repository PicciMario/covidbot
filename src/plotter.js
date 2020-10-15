import sharp from 'sharp';
import { CanvasRenderService } from 'chartjs-node-canvas';

// ------------------------------------------------------------------------------------------------

function _sliceDataset(dataset, maxItems = 120){

	const num = Math.min(maxItems, dataset.length);
	const elements = dataset.slice(dataset.length-num, dataset.length);
    const lastElement = dataset[dataset.length-1]
    
    return {elements, lastElement}

}

// ------------------------------------------------------------------------------------------------

/**
 * Creates italian nation-level plot. Returns a buffer with the png image of the plot itself.
 */
function _createTopPlot(dataset) {

	const {elements, lastElement} = _sliceDataset(dataset)

    const configuration = {
        type: 'bar',
        data: {
            labels: elements.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Nuovi positivi (${lastElement['nuovi_positivi']})`,
					backgroundColor: 'red',
					borderColor: 'red',
					data: elements.map(element => element['nuovi_positivi'])
				},
            ]
        },
        options: {
			title: {
				display: true,
				text: `Situazione in italia al ${lastElement['data'].format('DD/MM/YYYY')} (+${lastElement['nuovi_positivi']} nuovi casi)`
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
function _createBottomPlot(dataset) {

	const {elements, lastElement} = _sliceDataset(dataset)

    const configuration = {
        type: 'bar',
        data: {
			labels: elements.map(element => element['data'].format('DD MMM')),
            datasets: [
                {
					label: `Posti occupati in terapia intensiva (ad oggi: ${lastElement['terapia_intensiva']})`,
					backgroundColor: 'darkred',
					borderColor: 'darkred',
					data: elements.map(element => element['terapia_intensiva'])
				},           
				{
					label: `Ricoverati con sintomi (ad oggi: ${lastElement['ricoverati_con_sintomi']})`,
					backgroundColor: 'darkred',
					borderColor: 'darkred',
					data: elements.map(element => element['ricoverati_con_sintomi'])
				}
            ]
		},
        options: {
			title: {
				display: true,
				text: `Situazione ospedali ad oggi. Ricoverati ${lastElement['ricoverati_con_sintomi']}, terapia intensiva ${lastElement['terapia_intensiva']}.`
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