import numeral from 'numeral'

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

/**
 * Prints formatted result from "process.hrtime()" call.
 * @param {number[]} param0 
 * @returns {string}
 */
export function printTime([sec, nanosec]){
	if (sec === 0){
		return `${Math.ceil(nanosec/1000000)}ms`
	}
	else {
		return `${sec}s ${Math.ceil(nanosec/1000000)}ms`
	}
}

// ------------------------------------------------------------------------------------------------

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

/**
 * Returns a new dataset with the "maxItems" last elements (if available).
 * @param {Object[]} dataset 
 * @param {number} [maxItems=120] - Items to slice
 */
export function sliceDataset(dataset, maxItems = 120){

	const num = Math.min(maxItems, dataset.length);
	const elements = dataset.slice(dataset.length-num, dataset.length);
    
    return elements

}

/**
 * Value of the key item inside the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @param {[number=0]} 0 for last day, 1 for the one before, 2 for the one before that and so on.
 * @returns {number}
 */
export function _value(dataset, key, pos = 0){

    if (dataset.length < (pos+1)) return 0;

	const lastElement = dataset[dataset.length-(pos+1)];
    
    if (lastElement){
        return lastElement[key] || 0;
    }
    else {
        return 0;
    }

}

/**
 * Value of the key item inside the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
export function _lastValue(dataset, key) {return _value(dataset, key, 0)}

/**
 * Value of the key item inside the second to last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
export function _prevValue(dataset, key){return _value(dataset, key, 1)}

/**
 * Value of the key item inside the third to last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
export function _beforePrevValue(dataset, key){return _value(dataset, key, 2)}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {number}
 */
export function _deltaValue(dataset, key){
	
	const lastValue = _lastValue(dataset, key);
	const prevValue = _prevValue(dataset, key);

	return lastValue - prevValue;

}

/**
 * Format number as integer string.
 * @param {number} val 
 * @returns {string}
 */
export function formatInt(val){
	return numeral(val).format();
}

/**
 * Format number as integer string with sign.
 * @param {number} val 
 * @returns {string}
 */
export function formatIntSign(val){
	return numeral(val).format('+0,0');
}

/**
 * Format number as percentage string with two decimals.
 * @param {number} val 
 * @returns {string}
 */
export function formatPerc(val){
    return numeral(val).format('0,0.00')
}

/**
 * Value of the key item inside the last element of the dataset.
 * Formatted as string.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
export function lastValue(dataset, key){return formatInt(_lastValue(dataset, key))}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * * Formatted as string.
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
export function deltaValue(dataset, key){return formatInt(_deltaValue(dataset, key))}

/**
 * Value of the key item inside the last element of the dataset.
 * Formatted as string with explicit sign (+/-).
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
export function lastValueWithSign(dataset, key){return formatIntSign(_lastValue(dataset, key))}

/**
 * Difference between the values of the key item in the last and 
 * second-to-last elements of the dataset.
 * Formatted as string with explicit sign (+/-).
 * @param {Object[]} dataset 
 * @param {string} key 
 * @returns {string}
 */
export function deltaValueWithSign(dataset, key){return formatIntSign(_deltaValue(dataset, key))}

/**
 * Formatted date from the "key" of the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} [key="data"]
 * @returns {string}
 */
export function lastDateAsString(dataset, key='data'){

    const lastElement = dataset[dataset.length-1];

    if (lastElement){
        return lastElement[key].format('DD/MM/YYYY')
    }
    else {
        return '';
    }    

}

/**
 * Formatted date from the "key" of the dataset object.
 * @param {Object} dataset 
 * @param {string} [key="data"]
 * @returns {string}
 */
export function dateAsString(dataset, key='data'){
    return dataset[key].format('DD/MM/YYYY')
}

/**
 * Content of the "key" of the last element of the dataset.
 * @param {Object[]} dataset 
 * @param {string} key
 * @returns {string}
 */
export function lastValueAsString(dataset, key){
    const lastElement = dataset[dataset.length-1];
    return lastElement[key]
}