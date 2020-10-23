import https from 'https'
import moment from 'moment'
import Logger from './logger'

// Init logger
const log = new Logger("datarecovery.js")

const REGIONI_LATEST = 'https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-json/dpc-covid19-ita-regioni-latest.json';
const ANDAMENTO_NAZIONALE = 'https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-json/dpc-covid19-ita-andamento-nazionale.json';

/**
 * Restituisce una copia dell'oggetto passato, in cui l'elemento dataColumn (default: data)
 * è convertito in un oggetto moment.
 * @param {*} elem 
 * @param {*} dateColumn 
 */
function _parseAndConvertDate(elem, dateColumn = 'data'){
	return {...elem, [dateColumn]: moment(elem[dateColumn]).locale('it')}
}

/**
 * Sorting function to sort objects by a column dateColumn (default: data) which is
 * supposed to contain a moment object.
 * @param {*} a 
 * @param {*} b 
 * @param {*} dateColumn 
 */
function _sortByDateColumn(a, b, dateColumn = 'data'){
	if (a == null || b == null) return 0;
	if (a[dateColumn] == null || b[dateColumn] == null) return 0;
	return a[dateColumn].isBefore(b[dateColumn]) ? -1 : 1
}

/**
 * Retrieves italian state-level daily data. Returns a promise which resolves
 * on the data array. The "data" item in the records is converted to a moment object.
 * @returns {Promise<Array>}
 */
export function retrieveDailyData(){

	return new Promise((resolve, reject) => {

		https.get(ANDAMENTO_NAZIONALE, resp => {

			const { statusCode } = resp;

			if (statusCode !== 200) {
				// Consume response data to free up memory
				resp.resume();
				reject(new Error(`Request failed while fetching data. Status Code: ${statusCode}`));
			}
			
			let data = ''

			// Accumulates data retrieved from socket
			resp.on('data', chunk => data += chunk)
			
			// Collects and parses received data after finishing retrieval
			resp.on('end', () => {

				try{

					let parsed = 
						JSON.parse(data)
						.map(elem => _parseAndConvertDate(elem))
						.sort((a,b) => _sortByDateColumn(a, b))			

					resolve(parsed);

				}
				catch(err){
					reject(new Error(`Error while parsing retrieved data: ${err.message}`));
				}

			})

		}).on('error', (e) => {
			reject(new Error(`Unexpected error while fetching data: ${e.message}`));
		});

	});

}

// ------------------------------------------------------------------------------------------------

/**
 * Retrieves italian region-level daily data. Returns a promise which resolves
 * on the data array. The "data" item in the records is converted to a moment object.
* @returns {Promise<Array>}
 */
export function retrieveRegioniData(){

	return new Promise((resolve, reject) => {

		https.get(REGIONI_LATEST, resp => {

			const { statusCode } = resp;

			if (statusCode !== 200) {
				// Consume response data to free up memory
				resp.resume();
				reject(new Error(`Request failed while fetching data. Status Code: ${statusCode}`));
			}
			
			let data = ''

			// Accumulates data retrieved from socket
			resp.on('data', chunk => data += chunk)
			
			// Collects and parses received data after finishing retrieval
			resp.on('end', () => {

				try{

					let parsed = 
						JSON.parse(data)
						.map(elem => _parseAndConvertDate(elem))		

					resolve(parsed);

				}
				catch(err){
					reject(new Error(`Error while parsing retrieved data: ${err.message}`));
				}

			})

		}).on('error', (e) => {
			reject(new Error(`Unexpected error while fetching data: ${e.message}`));
		});

	});

}
