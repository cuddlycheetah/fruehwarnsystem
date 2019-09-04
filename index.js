const WebSocket = require('ws')
const { Client: BlitzortungClient } = require('@simonschick/blitzortungapi')
const TelegramBot = require('node-telegram-bot-api')
const Push = require('pushover-notifications')
const express = require('express')
const Settings = require('./Settings')
const SR_STATE = {
    NEW_CELL: 0,
    NEW_STRIKE: 0,
}






const home = {
    latitude: 37.563,
    longitude: 18.012,
}
/*Settings.get('homePos', {
    latitude: 48.5335544,
    longitude: 10.1278816,
})*/
const { sequelize, LightningEvent, LightningCell } = require('./database')
const app = express()

const pushoverSettings = Settings.get('pushoverSettings', {
    user: '',
    token: '',
})

var pusher = Settings.get('pushoverEnabled', false)
    ? new Push (pushoverSettings)
    : false

const bot = new TelegramBot(Settings.get('botToken', ''), { polling: false })
/*interface NotificationService {
    public onStartup();
    public onError(error);
    public onCell(cell);
    public onStrike(strike);
}*/

function sphericalDistance(pos1, pos2) {
    return getDistanceFromLatLonInKm(pos1.latitude, pos1.longitude, pos2.latitude, pos2.longitude)
}
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var deg2Rad = deg => {
        return deg * Math.PI / 180;
    }

    var r = 6371; // Radius of the earth in km
    var dLat = deg2Rad(lat2 - lat1);   
    var dLon = deg2Rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2Rad(lat1)) * Math.cos(deg2Rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = r * c; // Distance in km
    return d;
}

// live.lightningmaps.org/
// ws8.blitzortung.org:8055
const client = new BlitzortungClient({
    make: () => new WebSocket('ws://ws1.blitzortung.org:8055/')
})

client.on('connect', () => {
    client.setIncludeDetectors(false)
    client.setArea({
        latitude: 90,
        longitude: -180
    },{
        latitude: -90,
        longitude: 180
    })
    if (!!pusher) {
        pusher.send({
            title: "Frühwarnsystem",
            message: 'gestartet',
            sound: 'echo',
            priority: 0,
        })
    }
})

const newStrike = async ({location, deviation, delay, time}) => {
    let result = {
        state: SR_STATE.NEW_STRIKE,   
    }
    const cells = await LightningCell.findAll()
    const nearbyCells = cells.filter((cell) => {
        const cellPos = { latitude: cell.lat, longitude: cell.lng, }
        const dist = Math.round(sphericalDistance(location, cellPos), 3)
        return dist <= Settings.get('cellSize', 5)
    })
    let inCell = nearbyCells.length > 0
        ? nearbyCells[0]
        : false
    if (!inCell) {
        inCell = await LightningCell.create({
            lat: location.latitude,
            lng: location.longitude,
            time: new Date(time),
        })
        result = {
            state: SR_STATE.NEW_CELL,
            cellId: inCell.id,
        }
    }
    inCell.lcCount++
    await inCell.save()

    await LightningCell.create({
        cellId: inCell.id,
        deviation: deviation,
        delay: delay,
        lat: location.latitude,
        lng: location.longitude,
        time: new Date(time),
    })

    return result
}

client.on('data', async strike => {
    let dist = Math.round(sphericalDistance(home, strike.location))
    if (dist <= Settings.get('zoneSize', 20)) {
        console.log(strike)
        let state = newStrike(strike)

        //let { cellIncreased, cellKey } = cellCalc(strike.location.latitude, strike.location.longitude)

        /*console.log({
            cellKey: cellKey,
            cellIncreased: cellIncreased,
            ...strike.location,
            distance: dist+'km'
        })*/
        const ownerId = Settings.get('ownerId', 0)
        /*if (!cellIncreased) {
            if (!!pusher) {
                await pusher.send({
                    title: "Frühwarnsystem",
                    message: `Neue Gewitterzelle ${dist}km entfernt`,
                    //message: `${dist}km\n ${strike.delay}s`,
                    sound: 'intermission',
                    priority: 1,
                })
            }
            await bot.sendLocation(ownerId, strike.location.latitude, strike.location.longitude, {disable_notification:true})
            await bot.sendMessage(ownerId, `<pre>Neue Gewitterzelle ${dist}km entfernt</pre>`, {parse_mode: 'HTML'})
        } else {
            await bot.sendLocation(ownerId, strike.location.latitude, strike.location.longitude, {disable_notification:true})
            await bot.sendMessage(ownerId, `<pre>Zellenaktivität ${dist}km\n${strike.delay} Sekunden</pre>`, {parse_mode: 'HTML'})
        }*/
    } else {
        //console.info(dist+'km')
    }
})
bot.on('message', (msg) => {
    const chatId = msg.chat.id

    bot.sendMessage(chatId, "lass mich in ruhe du kek " + chatId)
})
client.on('error', () => {
    console.error('error')
    if (!!pusher) {
        pusher.send({
            title: "Frühwarnsystem",
            message: 'STÖRUNG',
            sound: 'gamelan',
            priority: 1,
        })
    }
    setTimeout(() => client.connect(), 1000 * 5)
})

LightningCell.sync()
.then(LightningEvent.sync())
.then(client.connect())

app.listen(3000, function () {
    console.log('listening on port 3000!');
})