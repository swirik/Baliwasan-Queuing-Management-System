const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let queueState = { 
    currentTicket: null, 
    currentCategory: 'SYSTEM STANDBY',
    waitingList: [],
    ticketCounter: 0
};

io.on('connection', (socket) => {
    socket.emit('queueUpdated', queueState);

    socket.on('generateTicket', (data) => {
        queueState.ticketCounter++;
        queueState.waitingList.push({
            ticketNumber: queueState.ticketCounter,
            category: data.category
        });
        io.emit('queueUpdated', queueState);
    });

    socket.on('callNext', () => {
        if (queueState.waitingList.length > 0) {
            const next = queueState.waitingList.shift();
            queueState.currentTicket = next.ticketNumber;
            queueState.currentCategory = next.category;
        } else {
            queueState.currentTicket = null;
            queueState.currentCategory = 'SYSTEM STANDBY';
        }
        io.emit('queueUpdated', queueState);
    });

    socket.on('resetQueue', () => {
        queueState = { 
            currentTicket: null, 
            currentCategory: 'SYSTEM STANDBY',
            waitingList: [],
            ticketCounter: 0
        };
        io.emit('queueUpdated', queueState);
    });
});

server.listen(3000, '0.0.0.0');