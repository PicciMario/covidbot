import {REGIONS} from './regions-list';

/**
 * Looks into the regions list for a region which name starts with 
 * the provided search string (case insensitive). Returns the region object.
 * @param {string} regSearch String to search.
 * @returns {object} Region object or null.
 */
export function findRegionByName(regSearch){

	for (let i = 0; i < REGIONS.length; i++){
		const area = REGIONS[i];
		for (let o = 0; o < area.regions.length; o++){
			const region = area.regions[o];
			if (region.descr.toLowerCase().indexOf(regSearch.toLowerCase()) != -1) return region;
		}
	}

	return null;

}