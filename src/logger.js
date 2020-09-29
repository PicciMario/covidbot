/**
 * Classe di utilità per log a console.
 */

import Moment from 'moment';

export default class Logger{


	constructor(prefix){
		this.prefix = prefix;
	}

	_log(level, args){
		console.log(
			'[' + level + ']', 
			this.prefix,
			Moment().locale('it').format('DD/MM/YYYY-HH:MM:ss'),
			[...args]
		);
	}

	debug(){
		this._log('DEBUG', arguments);
	}

	info(){
		this._log('INFO', arguments);
	}

	warn(){
		this._log('WARN', arguments);
	}

	err(){
		this._log('ERROR', arguments);
	}
	error(){
		this.err(arguments);
	}	

}