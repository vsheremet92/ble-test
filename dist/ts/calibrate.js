"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const http = require("http");
const mysql = require("mysql");
const socket_io = require("socket.io");
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
    fs.readFile('././templates/index.html', 'utf-8', (error, content) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
    });
});
const args = process.argv;
var counter = 0;
var avgRssi = 0;
var avgRssiFilter = 0;
let currParams = {
    height: parseInt(args[2]),
    distance: parseInt(args[3]),
    numberOfPackages: parseInt(args[4])
};
pool.getConnection((err, connection) => {
    if (err) {
        console.log(err);
    }
    console.log('Connected to database');
});
const io = socket_io.listen(server);
io.sockets.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('message', (message) => {
        counter++;
        avgRssi += message.rssi;
        avgRssiFilter += kf.filter(message.rssi);
        console.log(avgRssi, avgRssiFilter, counter);
        if (counter === currParams.numberOfPackages) {
            avgRssi = avgRssi / counter;
            avgRssiFilter = avgRssiFilter / counter;
            console.log(avgRssi, avgRssiFilter);
            let dataToTable = {
                rssi: avgRssi, rssiFiltered: avgRssiFilter,
                bandMac: parseInt(message.bandMac, 16), txPower: message.txPower || 127, distance: currParams.distance, height: currParams.height
            };
            let query = pool.query('INSERT INTO calibration_table SET ?', dataToTable, (error, results, fields) => {
                if (error || !currParams.numberOfPackages)
                    throw error;
                counter = 0;
                currParams.distance++;
            });
        }
    });
    let calibrateDataArr = [];
    pool
        .query("SELECT rssi, distance FROM ble.calibration_table WHERE expNumber=9")
        .on('result', (data) => {
        calibrateDataArr.push(data);
    })
        .on('end', () => {
        socket.emit('message', calibrateDataArr);
    });
});
server.listen(3000);
//# sourceMappingURL=calibrate.js.map