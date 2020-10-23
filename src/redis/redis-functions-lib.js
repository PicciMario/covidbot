/**
 * REDIS functions wrapped inside Javascript Promises.
 *
 * @link    https://github.com/PicciMario/covidbot
 * @author  Mario Piccinelli <mario.piccinelli@gmail.com>
 */

export function get(redisclient, key){
	return new Promise((resolve, reject) => {
		redisclient.get(key, (err, value) => {
			if (err != null){
				reject(err);
			}
			resolve(value);
		})		
	})
}

export function set(redisclient, key, value){
	return new Promise((resolve, reject) => {
		redisclient.set(key, value, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	})
}

export function del(redisclient, key){
	return new Promise((resolve, reject) => {
		redisclient.del(key, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	})
}

export function sadd(redisclient, key, value){
	return new Promise((resolve, reject) => {
		redisclient.sadd(key, value, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	});
}

export function srem(redisclient, key, value){
	return new Promise((resolve, reject) => {
		redisclient.srem(key, value, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	});
}

export function hset(redisclient, key, prop, value){
	return new Promise((resolve, reject) => {
		redisclient.hset(key, prop, value, (err) => {
			if (err != null){
				reject(err);
			}
			resolve();
		})		
	});
}

export function hget(redisclient, key, prop){
	return new Promise((resolve, reject) => {
		redisclient.hget(key, prop, (err, value) => {
			if (err != null){
				reject(err);
			}
			resolve(value);
		})		
	});
}

export function smembers(redisclient, key){
	return new Promise((resolve, reject) => {
		redisclient.smembers(key, (err, list) => {
			if (err != null){
				reject(err);
			}
			resolve(list);
		})		
	});
}

export function sismember(redisclient, key, value){
	return new Promise((resolve, reject) => {
		redisclient.sismember(key, value, (err, value) => {
			if (err != null){
				reject(err);
			}
			resolve(value);
		})		
	});
}