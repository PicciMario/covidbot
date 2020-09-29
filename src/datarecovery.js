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
 * Retrieves italian state-level daily data and hands them to the callback.
 * The "data" item in the records is converted to a moment object, and the
 * array is sorted by that.
 * @param {*} callback 
 */
export function retrieveAndamentoNazionale(callback = () => {}){

	https.get(ANDAMENTO_NAZIONALE, resp => {

		const { statusCode } = resp;
	  
		// Any 2xx status code signals a successful response but
		// here we're only checking for 200.
		if (statusCode !== 200) {
		  let error = new Error(`Request Failed. Status Code: ${statusCode}`);
		  log.error(error.message);
		  // Consume response data to free up memory
		  resp.resume();
		  return;		  
		}
		
		let data = ''

		resp.on('data', chunk => data += chunk)
		
		resp.on('end', () => {

			let parsed = JSON.parse(data)

			parsed = 
				parsed
				.map(elem => _parseAndConvertDate(elem))
				.sort((a,b) => _sortByDateColumn(a, b))			

			callback(parsed)
		})

	}).on('error', (e) => {
		log.error("Unexpected error", e);
	});

}
