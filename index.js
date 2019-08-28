const Settings = require('./Settings')
const ownerId = Settings.get('ownerId', 0)
const cellSize = Settings.get('cellSize', 5) // km

const home = Settings.get('homePos', {
    latitude: 48.5335544,
    longitude: 10.1278816,
})

const WebSocket = require('ws')
const { Client } = require('@simonschick/blitzortungapi')
const TelegramBot = require('node-telegram-bot-api')
const Push = require('pushover-notifications')

const pushoverSettings = Settings.get('pushoverSettings', {
    user: '',
    token: '',
})

var pusher = Settings.get('pushoverEnabled', false)
    ? new Push (pushoverSettings)
    : false

const bot = new TelegramBot(Settings.get('botToken', ''), { polling: false })

function degToRad(deg) {
    return deg / 180 * Math.PI;
}
function sphericalDistance(pos1, pos2, radius) {
    return getDistanceFromLatLonInKm(pos1.latitude, pos1.longitude, pos2.latitude, pos2.longitude)


    const φ1 = degToRad(pos1.latitude);
    const φ2 = degToRad(pos2.latitude);
    const Δφ2 = degToRad(pos2.latitude - pos1.latitude) / 2;
    const Δλ2 = degToRad(pos2.longitude - pos1.latitude) / 2;

    const a = Math.sin(Δφ2) * Math.sin(Δφ2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ2) * Math.sin(Δλ2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return radius * c;
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

var zellenCache = {}


// live.lightningmaps.org/
// ws8.blitzortung.org:8055
const client = new Client({
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
function cellCalc(lat, lng) {
    let key = `${lat}#${lng}`
    const pos = {
        latitude: lat,
        longitude: lng,
    }
    let cellIncreased = false

    let zellenCacheKeys = Object.keys(zellenCache)
    for (let i=0;i < zellenCacheKeys.length; i++) {
        let iKey = zellenCacheKeys[ i ]
        let iLat = parseFloat(iKey.split('#')[0])
        let iLng = parseFloat(iKey.split('#')[1])
        let iPos = { latitude: iLat, longitude: iLng }
        let iDist = Math.round(sphericalDistance(pos, iPos, 6371), 2)
        if (iDist <= cellSize) {
            cellIncreased = true
            key = iKey
            break
        }
    }

    zellenCache[ key ] = cellIncreased ? (zellenCache[ key ] + 1) : 1

    console.log(Object.values(zellenCache).join(' '))
    return {
        cellIncreased: cellIncreased,
        cellKey: key,
    }
}

client.on('data', async strike => {
    let dist = Math.round(sphericalDistance(home, strike.location, 6371))

    if (dist <= 20) {
        let { cellIncreased, cellKey } = cellCalc(strike.location.latitude, strike.location.longitude)

        console.log({
            cellKey: cellKey,
            cellIncreased: cellIncreased,
            ...strike.location,
            distance: dist+'km'
        })
        
        if (!cellIncreased) {
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
        }
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
    setTimeout(() => client.connect(), 1000 * 10)
})
client.connect()
