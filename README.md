# COVIDBOT

[![GitHub license](https://img.shields.io/badge/License-Creative%20Commons%20Attribution%204.0%20International-blue)](https://github.com/PicciMario/covidbot/blob/master/LICENSE.txt)
[![GitHub commit](https://img.shields.io/github/last-commit/PicciMario/covidbot)](https://github.com/PicciMario/covidbot/commits/master)

Simple Telegram bot written in NodeJS. Retrieves italian state-level COVID-19 infection numbers (new daily infections) from the Italian Civil Protection [GitHub repository](https://github.com/pcm-dpc/COVID-19); provides upon request a plot of the last 3 months values. Also, an user can subscribe and receive updates every evening at 17.05 (italian ministry of health publishes daily data at 5pm).

![Sample plot](/sampleplot.jpg)

Supported commands:
- /sub - Subscribe to daily COVID-19 updates
- /unsub - Unsubscribe
- /status - Subscription status
- /plot - Request actual situation plot
- /about - About
- /help - Commands list

## Technical details

The code implements a simple bot by leveraging the *node-telegram-bot-api* library. Upon startup, it downloads and parses COVID-19 data from the Italian Ministry of Health website; then, upon */plot* request, it creates a plot and sends it to the requestor as a PNG image.

There is also a simplified subscription feature, by which an user can request to be subscribed to daily updates. The bot will store the chat id of the request (in a REDIS server). Every day at 5pm (italian time) new COVID-19 data is retrieved, and every day at 5 past 5pm the plot function is invoked for all the subscribers, who will subsequently receive the new plot.

## How to run as-is

This code is far from great and is provided as a learning opportunity, both for you and for me. However, if you want to be able to just download it and run the bot as you own, you need to:

1) Have *docker* and *docker-compose* installed on your system.

2) Retrieve the project from git.

3) Add a *.env* file with your bot key:

	```
	BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
	```

	You need to initialize your own bot by chatting with the Botfather on Telegram, then you'll get the key.

4) Then
	
	```
	docker-compose up -d
	// If you have made some kind of update use instead:
	// docker-compose up -d --build
	```

	should do the trick.

---

## License

[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/deed.it) - [Show license text](https://github.com/PicciMario/covidbot/blob/master/LICENSE.txt)