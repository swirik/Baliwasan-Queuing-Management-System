const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database(path.join(__dirname, 'queue_data.db'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS system_state (id INTEGER PRIMARY KEY, state_json TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ticket_history (id INTEGER PRIMARY KEY AUTOINCREMENT, ticketNumber INTEGER, name TEXT, contact TEXT, priority TEXT, document TEXT, scheduledDate TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

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

app.get('/export', (req, res) => {
    db.all("SELECT * FROM ticket_history ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        let csv = "ID,Ticket Number,Name,Contact,Priority,Document,Scheduled Date,Timestamp\n";
        rows.forEach(r => {
            const safeName = r.name ? r.name.replace(/"/g, '""') : '';
            const safeContact = r.contact ? r.contact.replace(/"/g, '""') : '';
            const safeDoc = r.document ? r.document.replace(/"/g, '""') : '';
            csv += `${r.id},${r.ticketNumber},"${safeName}","${safeContact}","${r.priority}","${safeDoc}","${r.scheduledDate}","${r.created_at}"\n`;
        });
        const dateStr = new Date().toISOString().split('T')[0];
        res.header('Content-Type', 'text/csv');
        res.attachment(`Baliwasan_Queue_Report_${dateStr}.csv`);
        return res.send(csv);
    });
});

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
    appointments: [],
    ticketCounter: 0,
    media: { type: 'none', url: '' },
    tickerText: 'WELCOME TO BARANGAY BALIWASAN. PLEASE WAIT FOR YOUR NUMBER TO BE CALLED.',
    disabledServices: []
};

db.get("SELECT state_json FROM system_state WHERE id = 1", (err, row) => {
    if (row && row.state_json) {
        try {
            const parsed = JSON.parse(row.state_json);
            queueState = { ...queueState, ...parsed };
            if (!queueState.appointments) queueState.appointments = [];
        } catch (e) {
            console.error(e);
        }
    }
});

function saveState() {
    const stateStr = JSON.stringify(queueState);
    db.run("INSERT OR REPLACE INTO system_state (id, state_json) VALUES (1, ?)", [stateStr]);
}

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
    const localISOTime = (new Date(now - offset)).toISOString().split('T')[0];
    return localISOTime;
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
            document: data.document,
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
        
        saveState();

        db.run("INSERT INTO ticket_history (ticketNumber, name, contact, priority, document, scheduledDate) VALUES (?, ?, ?, ?, ?, ?)", 
            [newTicket.ticketNumber, newTicket.name, newTicket.contact, newTicket.priority, newTicket.document, newTicket.date]);

        io.emit('queueUpdated', queueState);
        socket.emit('ticketIssued', { ticket: newTicket, ewt: ewt, isToday: isToday });
    });

    socket.on('generateTicket', (data) => {
        queueState.ticketCounter++;
        const walkInDate = getTodayDate();
        queueState.waitingList.push({
            ticketNumber: queueState.ticketCounter,
            name: 'Walk-in',
            contact: 'N/A',
            priority: data.priority,
            document: data.document,
            date: walkInDate
        });
        sortQueue();
        saveState();

        db.run("INSERT INTO ticket_history (ticketNumber, name, contact, priority, document, scheduledDate) VALUES (?, ?, ?, ?, ?, ?)", 
            [queueState.ticketCounter, 'Walk-in', 'N/A', data.priority, data.document, walkInDate]);

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
            saveState();
            io.emit('queueUpdated', queueState);
        }
    });

    socket.on('updateMedia', (data) => {
        queueState.media = data;
        saveState();
        io.emit('queueUpdated', queueState);
    });

    socket.on('updateTicker', (text) => {
        queueState.tickerText = text;
        saveState();
        io.emit('queueUpdated', queueState);
    });

    socket.on('toggleService', (serviceName) => {
        const index = queueState.disabledServices.indexOf(serviceName);
        if (index > -1) {
            queueState.disabledServices.splice(index, 1);
        } else {
            queueState.disabledServices.push(serviceName);
        }
        saveState();
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
            appointments: [],
            ticketCounter: 0,
            media: queueState.media,
            tickerText: queueState.tickerText,
            disabledServices: queueState.disabledServices
        };
        saveState();
        io.emit('queueUpdated', queueState);
    });
});

server.listen(3000, '0.0.0.0');