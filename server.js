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
    currentPriority: '',
    currentDocument: 'SYSTEM STANDBY',
    currentName: '',
    waitingList: [],
    ticketCounter: 0
};

io.on('connection', (socket) => {
    socket.emit('queueUpdated', queueState);

    socket.on('joinQueue', (data) => {
        queueState.ticketCounter++;
        const newTicket = {
            ticketNumber: queueState.ticketCounter,
            name: data.name,
            contact: data.contact,
            priority: data.priority,
            document: data.document
        };
        queueState.waitingList.push(newTicket);
        
        io.emit('queueUpdated', queueState);
        socket.emit('ticketIssued', newTicket);
    });

    socket.on('generateTicket', (data) => {
        queueState.ticketCounter++;
        queueState.waitingList.push({
            ticketNumber: queueState.ticketCounter,
            name: 'Walk-in',
            contact: 'N/A',
            priority: data.priority,
            document: data.document
        });
        io.emit('queueUpdated', queueState);
    });

    socket.on('callNext', () => {
        if (queueState.waitingList.length > 0) {
            const next = queueState.waitingList.shift();
            queueState.currentTicket = next.ticketNumber;
            queueState.currentPriority = next.priority;
            queueState.currentDocument = next.document;
            queueState.currentName = next.name;
        } else {
            queueState.currentTicket = null;
            queueState.currentPriority = '';
            queueState.currentDocument = 'SYSTEM STANDBY';
            queueState.currentName = '';
        }
        io.emit('queueUpdated', queueState);
    });

    socket.on('resetQueue', () => {
        queueState = { 
            currentTicket: null, 
            currentPriority: '',
            currentDocument: 'SYSTEM STANDBY',
            currentName: '',
            waitingList: [],
            ticketCounter: 0
        };
        io.emit('queueUpdated', queueState);
    });
});

server.listen(3000, '0.0.0.0');