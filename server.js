const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let queueState = { 
    counters: [
        { id: 1, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '' },
        { id: 2, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '' }
    ],
    lastCalled: {
        ticket: null,
        counter: null,
        document: 'SYSTEM STANDBY'
    },
    waitingList: [],
    ticketCounter: 0,
    media: { type: 'none', url: '' }
};

function sortQueue() {
    queueState.waitingList.sort((a, b) => {
        const priorityA = a.priority === 'PWD / SENIOR' ? 1 : 0;
        const priorityB = b.priority === 'PWD / SENIOR' ? 1 : 0;
        
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }
        return a.ticketNumber - b.ticketNumber;
    });
}

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
        sortQueue();
        
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
        sortQueue();
        io.emit('queueUpdated', queueState);
    });

    socket.on('callNext', (data) => {
        const counterIndex = queueState.counters.findIndex(c => c.id === data.counterId);
        if (counterIndex !== -1) {
            if (queueState.waitingList.length > 0) {
                const next = queueState.waitingList.shift();
                queueState.counters[counterIndex].currentTicket = next.ticketNumber;
                queueState.counters[counterIndex].currentPriority = next.priority;
                queueState.counters[counterIndex].currentDocument = next.document;
                queueState.counters[counterIndex].currentName = next.name;

                queueState.lastCalled = {
                    ticket: next.ticketNumber,
                    counter: data.counterId,
                    document: next.document
                };
            } else {
                queueState.counters[counterIndex].currentTicket = null;
                queueState.counters[counterIndex].currentPriority = '';
                queueState.counters[counterIndex].currentDocument = 'SYSTEM STANDBY';
                queueState.counters[counterIndex].currentName = '';
            }
            io.emit('queueUpdated', queueState);
        }
    });

    socket.on('updateMedia', (data) => {
        queueState.media = data;
        io.emit('queueUpdated', queueState);
    });

    socket.on('resetQueue', () => {
        queueState = { 
            counters: [
                { id: 1, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '' },
                { id: 2, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '' }
            ],
            lastCalled: {
                ticket: null,
                counter: null,
                document: 'SYSTEM STANDBY'
            },
            waitingList: [],
            ticketCounter: 0,
            media: { type: 'none', url: '' }
        };
        io.emit('queueUpdated', queueState);
    });
});

server.listen(3000, '0.0.0.0');