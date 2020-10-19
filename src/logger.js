/**
 * Classe di utilità per log a console.
 */

import Moment from 'moment';

export default class Logger{


	constructor(prefix){
		this.prefix = prefix;
	}

	_log(level, args){
		const lev = `[${level}]`.padEnd(8);
		const pref = this.prefix.padEnd(20)
		const ts = Moment().locale('it').format('DD/MM/YYYY-HH:mm:ss');
		console.log(`${lev} | ${pref} | ${ts} | ${args.join(' ')}`);
	}

	debug(...args){
		this._log('DEBUG', args);
	}

	info(...args){
		this._log('INFO', args);
	}

	warn(...args){
		this._log('WARN', args);
	}

	err(...args){
		this._log('ERROR', args);
	}	
	error(...args){
		this._log('ERROR', args);
	}		

}