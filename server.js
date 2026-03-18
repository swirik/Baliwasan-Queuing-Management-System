const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let useMongo = false;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baliwasan_queue', {
    serverSelectionTimeoutMS: 5000
}).then(() => {
    console.log("MongoDB Connected");
    useMongo = true;
    loadState();
}).catch(err => {
    console.log("MongoDB connection failed. Running in ephemeral memory mode.");
    useMongo = false;
});

const StateSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    data: mongoose.Schema.Types.Mixed
});
const State = mongoose.model('State', StateSchema);

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

let bookingEngine = {
    globalOnlineBookingEnabled: true,
    autoApprove: false,
    defaultMaxCapacity: 50,
    disabledDaysOfWeek: [], 
    blockedDates: [], 
    serviceRules: {},
    pendingRequests: [],
    dailyLoad: {}
};

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
    dailyCounters: {},
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

async function loadState() {
    if (!useMongo) return;
    try {
        const dbQueue = await State.findOne({ key: 'queue' });
        const dbBooking = await State.findOne({ key: 'booking' });
        if (dbQueue) queueState = dbQueue.data;
        if (dbBooking) bookingEngine = dbBooking.data;
        
        if (!queueState.dailyCounters) queueState.dailyCounters = {};
        
        queueState.services.forEach(s => {
            if (!bookingEngine.serviceRules[s.name]) {
                bookingEngine.serviceRules[s.name] = { allowedDays: [1, 2, 3, 4, 5] };
            }
        });
    } catch (err) {
        console.log(err);
    }
}

async function saveState() {
    if (!useMongo) return;
    try {
        await State.findOneAndUpdate({ key: 'queue' }, { data: queueState }, { upsert: true });
        await State.findOneAndUpdate({ key: 'booking' }, { data: bookingEngine }, { upsert: true });
    } catch (err) {
        console.log(err);
    }
}

if (!useMongo) {
    if (!queueState.dailyCounters) queueState.dailyCounters = {};
    queueState.services.forEach(s => {
        if (!bookingEngine.serviceRules[s.name]) {
            bookingEngine.serviceRules[s.name] = { allowedDays: [1, 2, 3, 4, 5] };
        }
    });
}

function sortQueue() {
    queueState.waitingList.sort((a, b) => {
        const priorityA = a.priority === 'PWD / SENIOR' ? 1 : 0;
        const priorityB = b.priority === 'PWD / SENIOR' ? 1 : 0;
        if (priorityA !== priorityB) return priorityB - priorityA;
        return a.ticketNumber - b.ticketNumber;
    });
}

function getTodayDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now - offset)).toISOString().split('T')[0];
}

function generateAutoTime(position) {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now - offset);
    localNow.setMinutes(localNow.getMinutes() + (position * 12));
    let hours = localNow.getHours();
    let mins = localNow.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    mins = mins < 10 ? '0' + mins : mins;
    return `${hours}:${mins} ${ampm}`;
}

function getServiceCategory(docName) {
    const srv = queueState.services.find(s => s.name === docName);
    return srv ? srv.category : 'M';
}

function getNextTicketNumber(dateString) {
    if (!queueState.dailyCounters) queueState.dailyCounters = {};
    if (!queueState.dailyCounters[dateString]) {
        queueState.dailyCounters[dateString] = 0;
    }
    queueState.dailyCounters[dateString]++;
    return queueState.dailyCounters[dateString];
}

function getAvailableDates(serviceName, startDate, daysToGenerate) {
    if (!bookingEngine.globalOnlineBookingEnabled) return [];
    let availableDates = [];
    let currentDate = new Date(startDate);
    let rules = bookingEngine.serviceRules[serviceName];
    if (!rules) return availableDates;

    for (let i = 0; i < daysToGenerate; i++) {
        let dateString = currentDate.toISOString().split('T')[0];
        let dayOfWeek = currentDate.getDay();
        let isBlockedDay = bookingEngine.disabledDaysOfWeek.includes(dayOfWeek);
        let isBlockedDate = bookingEngine.blockedDates.includes(dateString);
        let isServiceAllowed = rules.allowedDays.includes(dayOfWeek);
        let currentLoad = bookingEngine.dailyLoad[dateString] || 0;
        let isFull = currentLoad >= bookingEngine.defaultMaxCapacity;

        if (!isBlockedDay && !isBlockedDate && isServiceAllowed && !isFull) {
            availableDates.push(dateString);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return availableDates;
}

io.on('connection', (socket) => {
    socket.emit('queueUpdated', queueState);
    socket.emit('bookingEngineUpdated', bookingEngine);

    socket.on('requestAvailableDates', (data) => {
        const dates = getAvailableDates(data.serviceName, data.startDate, 60);
        socket.emit('availableDatesResponse', dates);
    });

    socket.on('submitBookingRequest', (requestData) => {
        if (!bookingEngine.globalOnlineBookingEnabled) {
            socket.emit('bookingResolved', { id: 'N/A', approved: false, reason: 'Online booking is disabled' });
            return;
        }

        const requestId = 'REQ-' + Date.now();
        const cat = getServiceCategory(requestData.document);
        
        const newRequest = {
            id: requestId,
            name: requestData.name,
            contact: requestData.contact,
            priority: requestData.priority,
            document: requestData.document,
            category: cat,
            requestedDate: requestData.date,
            date: requestData.date 
        };

        if (bookingEngine.autoApprove) {
            const tNum = getNextTicketNumber(newRequest.requestedDate);
            const nowHour = new Date().getHours();
            const autoSlot = nowHour < 12 ? 'MORNING' : 'AFTERNOON';

            const finalAppointment = {
                ...newRequest,
                ticketNumber: tNum,
                timeSlot: autoSlot,
                status: 'APPROVED'
            };
            
            const today = getTodayDate();
            let isToday = false;
            let dTime = '';

            if (newRequest.requestedDate === today) {
                isToday = true;
                queueState.waitingList.push(finalAppointment);
                sortQueue();
                const position = queueState.waitingList.findIndex(t => t.ticketNumber === finalAppointment.ticketNumber);
                dTime = generateAutoTime(position + 1);
            } else {
                queueState.appointments.push(finalAppointment);
                dTime = autoSlot === 'MORNING' ? '8:00 AM' : '1:00 PM';
            }

            finalAppointment.displayTime = dTime;
            bookingEngine.dailyLoad[newRequest.requestedDate] = (bookingEngine.dailyLoad[newRequest.requestedDate] || 0) + 1;
            
            saveState();
            io.emit('queueUpdated', queueState);
            socket.emit('bookingApproved', { ticket: finalAppointment, isToday: isToday, displayTime: dTime, id: requestId });
        } else {
            newRequest.status = 'PENDING';
            bookingEngine.pendingRequests.push(newRequest);
            saveState();
            io.emit('bookingEngineUpdated', bookingEngine);
            socket.emit('bookingSubmitted', { id: requestId, status: 'PENDING' });
        }
    });

    socket.on('adminReviewBooking', (reviewData) => {
        const reqIndex = bookingEngine.pendingRequests.findIndex(r => r.id === reviewData.id);
        if (reqIndex > -1) {
            const request = bookingEngine.pendingRequests[reqIndex];
            bookingEngine.pendingRequests.splice(reqIndex, 1);

            if (reviewData.approved) {
                const tNum = getNextTicketNumber(request.requestedDate);
                const cat = getServiceCategory(request.document);
                
                let dTime = reviewData.customTime;
                if (dTime) {
                    const parts = dTime.split(':');
                    if (parts.length === 2) {
                        let h = parseInt(parts[0]);
                        let m = parts[1];
                        
                        if (reviewData.timeSlot === 'MORNING' && h >= 12) h -= 12;
                        if (reviewData.timeSlot === 'AFTERNOON' && h < 12) h += 12;
                        
                        let ampm = h >= 12 ? 'PM' : 'AM';
                        h = h % 12;
                        h = h ? h : 12;
                        dTime = `${h}:${m} ${ampm}`;
                    }
                }

                const finalAppointment = {
                    ...request,
                    ticketNumber: tNum,
                    category: cat,
                    timeSlot: reviewData.timeSlot, 
                    status: 'APPROVED',
                    date: request.requestedDate
                };

                const today = getTodayDate();
                let isToday = false;

                if (request.requestedDate === today) {
                    isToday = true;
                    if (!dTime) {
                        const position = queueState.waitingList.length;
                        dTime = generateAutoTime(position + 1);
                    }
                    finalAppointment.displayTime = dTime;
                    queueState.waitingList.push(finalAppointment);
                    sortQueue();
                } else {
                    if (!dTime) dTime = reviewData.timeSlot === 'MORNING' ? '8:00 AM' : '1:00 PM';
                    finalAppointment.displayTime = dTime;
                    queueState.appointments.push(finalAppointment);
                }

                bookingEngine.dailyLoad[request.requestedDate] = (bookingEngine.dailyLoad[request.requestedDate] || 0) + 1;
                io.emit('queueUpdated', queueState);
                io.emit('bookingResolved', { id: reviewData.id, approved: true, ticket: finalAppointment, isToday: isToday, displayTime: dTime });
            } else {
                io.emit('bookingResolved', { id: reviewData.id, approved: false });
            }
            saveState();
            io.emit('bookingEngineUpdated', bookingEngine);
        }
    });

    socket.on('updateBookingRules', (newRules) => {
        bookingEngine = { ...bookingEngine, ...newRules };
        saveState();
        io.emit('bookingEngineUpdated', bookingEngine);
        io.emit('queueUpdated', queueState);
    });

    socket.on('updateServiceRule', (ruleData) => {
        if (!bookingEngine.serviceRules[ruleData.serviceName]) {
            bookingEngine.serviceRules[ruleData.serviceName] = { allowedDays: [] };
        }
        bookingEngine.serviceRules[ruleData.serviceName].allowedDays = ruleData.allowedDays;
        saveState();
        io.emit('bookingEngineUpdated', bookingEngine);
    });

    socket.on('joinQueue', (data) => {
        const tNum = getNextTicketNumber(data.date);
        const cat = getServiceCategory(data.document);
        const nowHour = new Date().getHours();
        const autoSlot = nowHour < 12 ? 'MORNING' : 'AFTERNOON';

        const newTicket = {
            ticketNumber: tNum,
            name: data.name,
            contact: data.contact,
            priority: data.priority,
            document: data.document,
            category: cat,
            date: data.date,
            timeSlot: autoSlot
        };

        const today = getTodayDate();
        let isToday = false;
        let dTime = '';

        if (data.date === today) {
            isToday = true;
            queueState.waitingList.push(newTicket);
            sortQueue();
            const position = queueState.waitingList.findIndex(t => t.ticketNumber === newTicket.ticketNumber);
            dTime = generateAutoTime(position + 1);
        } else {
            queueState.appointments.push(newTicket);
            dTime = autoSlot === 'MORNING' ? '8:00 AM' : '1:00 PM';
        }
        
        newTicket.displayTime = dTime;
        saveState();
        io.emit('queueUpdated', queueState);
        socket.emit('ticketIssued', { ticket: newTicket, displayTime: dTime, isToday: isToday });
    });

    socket.on('generateTicket', (data) => {
        const walkInDate = getTodayDate();
        const tNum = getNextTicketNumber(walkInDate);
        const cat = getServiceCategory(data.document);
        const nowHour = new Date().getHours();
        const autoSlot = nowHour < 12 ? 'MORNING' : 'AFTERNOON';

        const newTicket = {
            ticketNumber: tNum,
            name: 'Walk-in',
            contact: 'N/A',
            priority: data.priority,
            document: data.document,
            category: cat,
            date: walkInDate,
            timeSlot: autoSlot
        };

        const position = queueState.waitingList.length;
        newTicket.displayTime = generateAutoTime(position + 1);
        queueState.waitingList.push(newTicket);
        sortQueue();
        saveState();
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

    socket.on('addService', (serviceData) => {
        queueState.services.push({
            name: serviceData.name,
            category: serviceData.category,
            isNew: true
        });
        bookingEngine.serviceRules[serviceData.name] = { allowedDays: [1, 2, 3, 4, 5] };
        saveState();
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
        queueState.dailyCounters = {};
        bookingEngine.pendingRequests = [];
        saveState();
        io.emit('queueUpdated', queueState);
        io.emit('bookingEngineUpdated', bookingEngine);
    });
});

server.listen(process.env.PORT || 3000, '0.0.0.0');