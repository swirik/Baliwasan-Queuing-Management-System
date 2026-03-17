const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const mediaDir = path.join(__dirname, 'public', 'media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = '/media/' + req.file.filename;
    res.json({ url: fileUrl });
});

let queueState = { 
    counters: [
        { id: 1, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' },
        { id: 2, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' }
    ],
    lastCalled: {
        ticket: null,
        counter: null,
        document: 'SYSTEM STANDBY',
        category: ''
    },
    waitingList: [],
    appointments: [],
    ticketCounter: 0,
    media: { type: 'none', url: '' },
    tickerText: 'WELCOME TO BARANGAY BALIWASAN. PLEASE WAIT FOR YOUR NUMBER TO BE CALLED.',
    disabledServices: [],
    services: [
        { name: "Ayuda / Cash Assistance", category: "S", isNew: false },
        { name: "Barangay Clearance", category: "C", isNew: false },
        { name: "Barangay ID", category: "I", isNew: false },
        { name: "Building and Fencing Permit", category: "P", isNew: false },
        { name: "Business Clearance/Permit", category: "P", isNew: false },
        { name: "Certificate of Indigency", category: "C", isNew: false },
        { name: "Certificate of Residency", category: "C", isNew: false },
        { name: "First Time Jobseeker", category: "C", isNew: false },
        { name: "Fit to Work Certificate", category: "C", isNew: false },
        { name: "Solo Parent Certification", category: "C", isNew: false }
    ]
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

function getTodayDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now - offset)).toISOString().split('T')[0];
}

function getServiceCategory(docName) {
    const srv = queueState.services.find(s => s.name === docName);
    return srv ? srv.category : 'M';
}

io.on('connection', (socket) => {
    socket.emit('queueUpdated', queueState);

    socket.on('joinQueue', (data) => {
        queueState.ticketCounter++;
        const cat = getServiceCategory(data.document);
        
        const newTicket = {
            ticketNumber: queueState.ticketCounter,
            name: data.name,
            contact: data.contact,
            priority: data.priority,
            document: data.document,
            category: cat,
            date: data.date 
        };

        const today = getTodayDate();
        let ewt = 0;
        let isToday = false;

        if (data.date === today) {
            isToday = true;
            queueState.waitingList.push(newTicket);
            sortQueue();
            const position = queueState.waitingList.findIndex(t => t.ticketNumber === newTicket.ticketNumber);
            ewt = (position + 1) * 12; 
        } else {
            queueState.appointments.push(newTicket);
        }
        
        io.emit('queueUpdated', queueState);
        socket.emit('ticketIssued', { ticket: newTicket, ewt: ewt, isToday: isToday });
    });

    socket.on('generateTicket', (data) => {
        queueState.ticketCounter++;
        const walkInDate = getTodayDate();
        const cat = getServiceCategory(data.document);

        queueState.waitingList.push({
            ticketNumber: queueState.ticketCounter,
            name: 'Walk-in',
            contact: 'N/A',
            priority: data.priority,
            document: data.document,
            category: cat,
            date: walkInDate
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
                queueState.counters[counterIndex].currentCategory = next.category;

                queueState.lastCalled = {
                    ticket: next.ticketNumber,
                    counter: data.counterId,
                    document: next.document,
                    category: next.category
                };
            } else {
                queueState.counters[counterIndex].currentTicket = null;
                queueState.counters[counterIndex].currentPriority = '';
                queueState.counters[counterIndex].currentDocument = 'SYSTEM STANDBY';
                queueState.counters[counterIndex].currentName = '';
                queueState.counters[counterIndex].currentCategory = '';
            }
            io.emit('queueUpdated', queueState);
        }
    });

    socket.on('updateMedia', (data) => {
        queueState.media = data;
        io.emit('queueUpdated', queueState);
    });

    socket.on('updateTicker', (text) => {
        queueState.tickerText = text;
        io.emit('queueUpdated', queueState);
    });

    socket.on('toggleService', (serviceName) => {
        const index = queueState.disabledServices.indexOf(serviceName);
        if (index > -1) {
            queueState.disabledServices.splice(index, 1);
        } else {
            queueState.disabledServices.push(serviceName);
        }
        io.emit('queueUpdated', queueState);
    });

    socket.on('addService', (serviceData) => {
        queueState.services.push({
            name: serviceData.name,
            category: serviceData.category,
            isNew: true
        });
        io.emit('queueUpdated', queueState);
    });

    socket.on('resetQueue', () => {
        queueState.counters = [
            { id: 1, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' },
            { id: 2, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' }
        ];
        queueState.lastCalled = { ticket: null, counter: null, document: 'SYSTEM STANDBY', category: '' };
        queueState.waitingList = [];
        queueState.appointments = [];
        queueState.ticketCounter = 0;
        io.emit('queueUpdated', queueState);
    });
});

server.listen(process.env.PORT || 3000, '0.0.0.0');