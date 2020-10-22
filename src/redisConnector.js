import Redis from 'redis';
import Logger from './logger'

// Init logger
const log = new Logger("redisConnector.js")

// Seconds between redis connection attempts
const SECONDS_REDIS_CONN_RETRY = 10;

export default class redisConnector{

    /**
     * Constructor.
     * @param {string} redisHost REDIS host (default: localhost)
     * @param {number} redisPort REDIS port number (default: 6379)
     * @param {function} onTotalFailure Callback in case of failure to connect/reconnect (default: process.exit)
     */
    constructor(redisHost, redisPort, onTotalFailure = () => process.exit()){

        this.redisHost = redisHost || 'localhost';
        this.redisPort = redisPort || 6379;

        this.redisClient = null;

        this.isConnected = false;
        this.connectionRefused = false;
        this.onTotalFailure = onTotalFailure;

        // Creates redis commands as class methods.
        ['get', 'set', 'del', 'sadd', 'srem', 'hset', 'hget', 'smembers', 'sismember'].forEach(command => {
            this[command] = (...params) => this._redisCommand(command, ...params)
        })        

    }

    /**
     * REDIS connect/reconnect strategy.
     * @param {*} param0 
     */
    _redis_retry_strategy = ({error, total_retry_time, attempt}) => {

        // Total time: 60 sec
        if (total_retry_time > 1000 * 60) {
            log.debug(`Unable to reach Redis instance on ${this.redisHost}:${this.redisPort}, retry time exhausted, exiting.`);
            this.onTotalFailure();
            return null;
        }

        // Max connection attempts: 10
        if (attempt > 10) {
            log.debug(`Unable to reach Redis instance on ${this.redisHost}:${this.redisPort}, retry attempts exhausted, exiting.`);
            this.onTotalFailure();
            return null;
        }

        log.debug(`Unable to reach Redis instance on ${this.redisHost}:${this.redisPort}, will retry in ${SECONDS_REDIS_CONN_RETRY} seconds...`);
        
        // Next attempt in X ms.
        return SECONDS_REDIS_CONN_RETRY*1000; 

    }

    /**
     * Starts connection attempt.
     */
    connect = () => {

        // Init connection
        log.debug(`Attempting Redis connection on ${this.redisHost}:${this.redisPort}...`);
        this.redisClient = Redis.createClient({
            host: this.redisHost,
            port: this.redisPort,
            retry_strategy: this._redis_retry_strategy
        });

        // Callback after successful redis connection
        this.redisClient.on("connect", () => {
            log.debug("Redis connection established.");
            this.isConnected = true;            
        });          

        // Callback after disconnection
        this.redisClient.on("end", () => {
            log.debug("Redis connection lost.");
            this.isConnected = false;            
        });          
  
    }

    /**
     * Retrieve client. Returns a Promise which resolves with the redis client as soon as
     * the connection is available.
     * @returns {Promise<Redis.RedisClient>}
     */
    getClient = () => {
        return new Promise((accept, reject) => {
            
            if (this.connectionRefused){
                reject("Unable to connect to redis server")
            }
            
            if (this.isConnected){
                accept(this.redisClient)
            }

            function check() {
                if (this.connectionRefused){
                    reject("Unable to connect to redis server")
                }                    
                else if (this.isConnected){
                    accept(this.redisClient)
                }         
                else {
                    setTimeout(check.bind(this), 500)       
                }
            }
            setTimeout(check.bind(this), 500)
            
        })
    }

    /**
     * Prototype for any redis command.
     * @param {string} commandName 
     * @param  {...string|number} params 
     */
    _redisCommand = (commandName, ...params) => {
        return new Promise(async (resolve, reject) => {
            const client = await this.getClient();
            client[commandName](...params, (err, value) => {
                if (err != null){
                    reject(err);
                }
                resolve(value);
            })		
        })
    }

}