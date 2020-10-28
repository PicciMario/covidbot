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