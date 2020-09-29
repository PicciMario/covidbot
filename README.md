# COVIDBOT
by *PicciMario <mario.piccinelli@gmail.com>*

Sample Telegram bot written in NodeJS. Retrieves italian state-level COVID-19 infection numbers (new daily infections) from the Italian Ministry of Health website; provides upon request a plot of the last 3 months values. Also, an user can subscribe and receive updates every evening at 17.05 (italian ministry of health publishes daily data at 5pm).

![Sample plot](/sampleplot.jpg)

Requires a *.env* file with your bot key:

```
BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Supported commands:
- /sub - Subscribe to daily COVID-19 updates
- /unsub - Unsubscribe
- /status - Subscription status
- /plot - Request actual situation plot