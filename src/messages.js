export function aboutMessage(version){
	/*
	return( 
`<b>Italian Daily COVID Bot</b> v.${version}
Subscribe for daily updates of new cases in Italy, every day at about 5pm italian time. Or request an immediate update with latest data. Ask /help for the command list. 
\n<i>See https://github.com/PicciMario/covidbot for technical details.</i>`
	)
	*/
	return( 
`<b>Italian Daily COVID Bot</b> v.${version}
Iscriviti per ricevere aggiornamenti sulla situazione COVID in Italia, ogni giorno verso le 17.00. Oppure richiedi un aggiornamento immediato con gli ultimi dati ufficiali. Scrivi /help per la lista dei comandi. 
\n<i>Vedi https://github.com/PicciMario/covidbot per i dettagli tecnici.</i>`
	)	
}

export function helpMessage(version){
	/*
	return(
`<b>Italian Daily COVID Bot</b> v.${version}
Subscribe /sub for daily updates of new cases in Italy, every day at about 5pm italian time. Or ask for an immediate update with /plot or /digest.
\nCommands list:
  /sub - Subscribe to daily COVID-19 updates
  /unsub - Unsubscribe
  /status - Subscription status
  /plot - Request actual situation plot
  /digest - Daily digest
  /about - About this bot
  /help - This list`
	)
	*/
	return(
`<b>Italian Daily COVID Bot</b> v.${version}
Iscriviti /sub per ricevere aggiornamenti sulla situazione COVID in Italia, ogni giorno verso le 17.00. Oppure richiedi un aggiornamento immediato con /plot o /digest.
\nLista comandi:
  /sub - Iscriviti all'aggiornamento quotidiano
  /unsub - Cancella l'iscrizione
  /status - Stato iscrizione
  /plot - Richiedi grafico
  /digest - Richiedi aggiornamento
  /about - Informazioni sul bot
  /help - Lista comandi`
	)
}

export function photoCaption(){
	return `Maggiori informazioni sulla situazione odierna: /digest`;
}

export function subRequested(){
	//return "Subscription requested (check /status for current situation, might take a while).";
	return "Iscrizione registrata (/status per verificare, /unsub per cancellare iscrizione).";
}

export function cancRequested(){
	//return "Cancellation requested (check /status for current situation, might take a while).";
	return "Iscrizione cancellata (/status per verificare, /sub per iscriverti nuovamente)."
}

export function isSubscribed(subSince){
	//return `Subscribed since ${subSince}`
	return `Iscritto dal ${subSince} (/unsub per cancellare iscrizione).`
}

export function isNotSubscribed(){
	//return `Currently not subscribed`
	return `Attualmente non iscritto (/sub per iscriverti).`
}