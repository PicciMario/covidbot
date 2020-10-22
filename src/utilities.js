/**
 * Splits the array in subarrays, each one containing "number" elements 
 * (except maybe the last one).
 * @param {[]} origin 
 * @param {number} length 
 * @returns {[[]]}
 */
export function splitArray(origin, length){

	let ritorno = [];

	for (let i = 0; i < origin.length; i++){

		let posInArray = Math.floor(i / length);
		let arrInArray = ritorno.length >= posInArray+1 ? ritorno[posInArray] : []
		arrInArray.push(origin[i]);
		ritorno[posInArray] = arrInArray;

	}

	return ritorno;

}