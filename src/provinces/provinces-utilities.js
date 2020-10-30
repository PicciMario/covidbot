import {PROVINCES} from './provinces-list';

/**
 * Looks into the provinces list for a region which name contains 
 * the provided search string (case insensitive). Returns the province object.
 * @param {string} regSearch String to search.
 * @returns {object} Province object or null.
 */
export function findProvinceByName(regSearch){

    return PROVINCES.find(prov => prov.denominazione_provincia.toLowerCase().indexOf(regSearch.toLowerCase()) != -1);

}

/**
 * Analyses the provincial dataset and returns the latest date found.
 * @param {*} dataset 
 * @param {string} key (default "data")
 */
export function findProvinceDataLastTimestamp(dataset, key='data'){

    const latest = Object.keys(dataset)
    .map(key => dataset[key])
    .map(regionSet => regionSet.reduce((acc, curr) => {
        if (acc == null) return curr;
        if (curr[key].isSameOrAfter(acc[key])) return curr;
        return acc;
    }))
    .reduce((acc, curr) => {
        if (acc == null) return curr;
        if (curr[key].isSameOrAfter(acc[key])) return curr;
        return acc;
    })

    return latest[key];

}