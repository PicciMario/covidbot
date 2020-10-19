const { default: redisConnector } = require("./redisConnector");
import moment from 'moment'

// ------------------------------------------------------------------------------------------------

// REDIS set holding the subscribers list (as list of chat id)
const REDIS_SUBSCRIBERS = 'subscribers'

// Prefix to REDIS hashes holding data for each subscriber (PREFIX + chatId)
const REDIS_SUB_PREFIX = 'sub:'

// Key holding the formatted timestamp of the last valid dataset retrieved
const REDIS_LASTVALIDDATE = 'last'

// Actual timestamp of the last successful retrieval operation
const REDIS_LASTRETRIEVETIMESTAMP = 'last_timestamp'

// ------------------------------------------------------------------------------------------------

export default class botRedisConnector extends redisConnector{

    /**
     * Most recent date of a retrieved record.
     * @returns {Promise<string>}
     */
    getLastValidDate(){
        return this.get(REDIS_LASTVALIDDATE)
    }
    
    /**
     * Set most recent date for a valid retrieved record.
     * @param {Promise} value 
     */
    setLastValidDate(value){
        return this.set(REDIS_LASTVALIDDATE, value)
    }
    
    /**
     * Get timestamp for the last retrieve operation.
     * @returns {Promise<string>}
     */
    getLastRetrieveTimestamp(){
        return this.get(REDIS_LASTRETRIEVETIMESTAMP)
    }
    
    /**
     * Set timestamp for the last retrieve operation.
     * @param {string} value 
     * @returns {Promise}
     */
    setLastRetrieveTimestamp(value){
        return this.set(REDIS_LASTRETRIEVETIMESTAMP, value)
    }

    /**
     * Set timestamp for the last retrieve operation as now.
     * @returns {Promise}
     */    
    setLastRetrieveTimestampAsNow(){
        return this.set(REDIS_LASTRETRIEVETIMESTAMP, moment().format('DD/MMM/YYYY HH:mm:SS'));
    }

    /**
     * Retrieves subscribers list.
     * @returns {Promise<string[]>} List of chat IDs.
     */
    getSubscribers(){
        return this.smembers(REDIS_SUBSCRIBERS)
    }

    /**
     * Adds new subscriber.
     * @param {string} chatId 
     * @returns {Promise}
     */
    async addSubscriber(chatId){
        await this.sadd(REDIS_SUBSCRIBERS, chatId);
        await this.hset(REDIS_SUB_PREFIX + chatId, 'timestamp', moment().format("DD MMM YYYY HH:mm:SS").toString());        
    }

    /**
     * Removes subscriber.
     * @param {string} chatId 
     * @returns {Promise}
     */
    async removeSubscriber(chatId){        
        await this.srem(REDIS_SUBSCRIBERS, chatId);
        await this.del(REDIS_SUB_PREFIX + chatId);        
    }

    /**
     * Checks if a chatId is subscribed.
     * @param {string} chatId 
     * @returns {Promise<number>} 1 if subscribed, 0 otherwise.
     */
    checkIfSubscribed(chatId){
        return this.sismember(REDIS_SUBSCRIBERS, chatId);        
    }

    /**
     * Retrieved timestamp for a subscribed chatId.
     * @param {string} chatId 
     * @returns {Promise<string>}
     */
    getSubTimestamp(chatId){
        return this.hget(REDIS_SUB_PREFIX + chatId, 'timestamp')
    }

}