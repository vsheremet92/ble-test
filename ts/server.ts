import * as fs from 'fs'
import * as http from 'http'
import * as mysql from 'mysql'
import * as socket_io from 'socket.io'

var KalmanFilter = require('kalmanjs').default;
var kf = new KalmanFilter({ R: 0.01, Q: 8 });

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: 'secret',
    database: 'ble'
});

const server = http.createServer((req, res) => {
    fs.readFile('././templates/charts.html', 'utf-8', (error, content) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
    })
});

pool.getConnection((err, connection) => {
    if (err) {
        console.log(err);
    }
    console.log('Connected to database');
});

const io = socket_io.listen(server);

interface MessageFromClient {
    rssi: number
    bandMac: string
    txPower: number
}

interface ScanData {
    rssi: number
    rssiFiltered: number
    bandMac: number
    txPower: number
    time: string
}

io.sockets.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('message', (message: MessageFromClient) => {


        let dataToTable: ScanData = {
            rssi: message.rssi, rssiFiltered: kf.filter(message.rssi),
            bandMac: parseInt(message.bandMac, 16), txPower: message.txPower || 127, time: new Date().toISOString()
        };
        let query = pool
            .query('INSERT INTO ble_devices_scan_data SET ?', dataToTable, (error, results, fields) => {
                console.log(query.sql);
                if (error) throw error;
            });
        console.log(message);
    });

    let sqlArr: any[] = [];
    let sqlArr2: any[] = [];
    pool
        .query("SELECT rssi, bandMac, time FROM ble.ble_devices_scan_data WHERE bandMac = '215127986425316'")
        .on('result', (data) => {
            sqlArr.push(data);
        })
        .on('end', () => {
            socket.emit('message', sqlArr);
        });

    pool
        .query("SELECT rssiFiltered, bandMac, time FROM ble.ble_devices_scan_data WHERE bandMac = '215127986425316'")
        .on('result', (data) => {
            sqlArr2.push(data);
        })
        .on('end', () => {
            socket.emit('message2', sqlArr2);
        });

});

server.listen(3000);
