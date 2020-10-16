# COVIDBOT

[![GitHub license](https://img.shields.io/badge/License-Creative%20Commons%20Attribution%204.0%20International-blue)](https://github.com/PicciMario/covidbot/blob/master/LICENSE.txt)
[![GitHub commit](https://img.shields.io/github/last-commit/PicciMario/covidbot)](https://github.com/PicciMario/covidbot/commits/master)

Play with it, just look for [@italiandailycovidbot](https://t.me/italiandailycovidbot) on Telegram (if my home server is still up, no promises here :-) ).

Simple Telegram bot written in NodeJS. Retrieves italian state-level COVID-19 infection numbers from the Italian Civil Protection [GitHub repository](https://github.com/pcm-dpc/COVID-19) and provides upon request a plot of the last 3 months values. Also, an user can subscribe and receive updates every evening at about 5pm (new data is published daily around that time).

![Sample plot](/sampleplot.jpg)

## Supported commands

- **/sub** - Subscribe to daily COVID-19 updates
- **/unsub** - Unsubscribe
- **/status** - Subscription status
- **/plot** - Request actual situation plot
- **/digest** - Request daily digest
- **/about** - About
- **/help** - Commands list

## Technical details

The code implements a simple bot by leveraging the *node-telegram-bot-api* library. Upon startup, it downloads and parses COVID-19 data from the Italian Civil Protection [GitHub repository](https://github.com/pcm-dpc/COVID-19); then, upon **/plot** request, it creates a plot and sends it to the requestor as a PNG image.

There is also a simplified subscription feature, by which an user can request to be subscribed to daily updates (either in a private chat with the bot or inside any other chat you've added the bot to). The bot will store the chat id of the request (in a REDIS server). Every day at around 5pm (italian time) new COVID-19 data is retrieveda and then the plot function is invoked for all the subscribers, who will subsequently receive the new plot.

## How to run as-is

This code is far from great and is provided as a learning opportunity, both for you and for me. However, if you want to be able to just download it and run the bot as you own, and you have *docker* on your pc, you need to:

1) Have *docker* and *docker-compose* installed on your system.

2) Retrieve the project from git.

3) Create a *.env* file copying the *.env-example* and writing your token:

	```ini
	BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
	```

	You need to initialize your own bot by chatting with the Botfather on Telegram, then you'll get the key. If you are running with *docker* the other parameters should be already fine.

4) Then
	
	```java
	docker-compose up -d
	// If you have made some kind of update use instead:
	// docker-compose up -d --build
	```

	should do the trick.

	To halt it:

	```
	docker-compose down
	```

# Kaspersky Internet Security and similar shit
If you are in a working environment and you have some kind of stupid shit which is messing with your certificates and SSL connections, you could stumble on a "Error: self signed certificate in certificate chain" while trying to build/run local machine. Apparently, you can get around that by disabling the certificate validation for the current session:

```java
// Windows only
set NODE_TLS_REJECT_UNAUTHORIZED=0
```

I know, I know, disabling security features is **BAD**, but I wasted too much time on that. Look that up and make your choice. Please don't do that in prod, but it is probably ok in dev.

---

## License

[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/deed.it) - [Show license text](https://github.com/PicciMario/covidbot/blob/master/LICENSE.txt)