const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());

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

const TicketLogSchema = new mongoose.Schema({
    ticketNumber: Number,
    category: String,
    document: String,
    priority: String,
    date: String,
    timestamp: { type: Date, default: Date.now }
});
const TicketLog = mongoose.model('TicketLog', TicketLogSchema);

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

app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;
    const correctPassword = process.env.ADMIN_PASS || 'Padayon2026!';
    
    if (username === 'admin' && password === correctPassword) {
        res.cookie('baliwasanAdminAuth', 'secure_auth_token', { httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

const protectedRoutes = [
    '/admin.html', 
    '/admin-queue.html', 
    '/homepage-admin.html', 
    '/news&update-admin.html', 
    '/garbage-admin.html', 
    '/citizen-profiling.html'
];

app.use((req, res, next) => {
    const isProtected = protectedRoutes.some(route => req.path.includes(route));
    if (isProtected) {
        if (req.cookies.baliwasanAdminAuth === 'secure_auth_token') {
            next();
        } else {
            res.redirect('/admin-login.html');
        }
    } else {
        next();
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'homepage.html'));
});

app.post('/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = '/media/' + req.file.filename;
    res.json({ url: fileUrl });
});

app.get('/export', async (req, res) => {
    if (!useMongo) return res.status(400).send("Database offline");
    try {
        const logs = await TicketLog.find({}).sort({ timestamp: -1 });
        let csv = "Date,Time,Ticket,Category,Document,Priority\n";
        logs.forEach(l => {
            const timeStr = l.timestamp.toISOString().split('T')[1].substring(0, 8);
            csv += `${l.date},${timeStr},${l.category}-${l.ticketNumber},${l.category},${l.document},${l.priority}\n`;
        });
        res.header('Content-Type', 'text/csv');
        res.attachment('baliwasan_queue_report.csv');
        return res.send(csv);
    } catch (err) {
        res.status(500).send("Export failed");
    }
});

let bookingEngine = {
    globalOnlineBookingEnabled: true,
    autoApprove: false,
    defaultMaxCapacity: 50,
    disabledDaysOfWeek: [], 
    blockedDates: [], 
    serviceRules: {},
    pendingRequests: [],
    dailyLoad: {},
    ignoreTimeLock: false // Experimental 5 PM override
};

let queueState = { 
    counters: [
        { id: 1, isActive: true, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' },
        { id: 2, isActive: true, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' }
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
    media: { type: 'none', url: '', muted: false }, // Muted state added
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

function getPhDateObj() {
    return new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
}

function sortQueue() {
    queueState.waitingList.sort((a, b) => {
        const priorityA = a.priority === 'PWD / Senior / Pregnant' ? 1 : 0;
        const priorityB = b.priority === 'PWD / Senior / Pregnant' ? 1 : 0;
        if (priorityA !== priorityB) return priorityB - priorityA;
        return a.ticketNumber - b.ticketNumber;
    });
}

function getTodayDate() {
    return getPhDateObj().toISOString().split('T')[0];
}

function isSystemClosed() {
    if (bookingEngine.ignoreTimeLock) return false;
    return getPhDateObj().getUTCHours() >= 17;
}

function generateAutoTime(position, isOnline = false) {
    let phNow = getPhDateObj();

    if (isOnline) {
        let tenAM = getPhDateObj();
        tenAM.setUTCHours(10, 0, 0, 0);
        if (phNow < tenAM) {
            phNow = tenAM;
        }
    }

    phNow.setUTCMinutes(phNow.getUTCMinutes() + (position * 12));
    let hours = phNow.getUTCHours();
    let mins = phNow.getUTCMinutes();
    
    if (hours >= 17 && !bookingEngine.ignoreTimeLock) {
        return "5:00 PM";
    }

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

    socket.on('getAnalytics', async () => {
        if (!useMongo) {
            socket.emit('analyticsData', { total: 0, pwdCount: 0, topServices: [] });
            return;
        }
        try {
            const today = getTodayDate();
            const logs = await TicketLog.find({ date: today });
            
            const total = logs.length;
            const pwdCount = logs.filter(l => l.priority === 'PWD / Senior / Pregnant').length;
            
            const serviceCounts = {};
            logs.forEach(l => {
                serviceCounts[l.document] = (serviceCounts[l.document] || 0) + 1;
            });
            
            const topServices = Object.keys(serviceCounts)
                .map(name => ({ name, count: serviceCounts[name] }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            socket.emit('analyticsData', { total, pwdCount, topServices });
        } catch (err) {
            console.log(err);
        }
    });

    socket.on('requestAvailableDates', (data) => {
        const dates = getAvailableDates(data.serviceName, data.startDate, 60);
        socket.emit('availableDatesResponse', dates);
    });

    socket.on('toggleCounter', (data) => {
        const counterIndex = queueState.counters.findIndex(c => c.id === data.counterId);
        if (counterIndex !== -1) {
            queueState.counters[counterIndex].isActive = !queueState.counters[counterIndex].isActive;
            if (!queueState.counters[counterIndex].isActive) {
                queueState.counters[counterIndex].currentTicket = null;
                queueState.counters[counterIndex].currentPriority = '';
                queueState.counters[counterIndex].currentDocument = 'OFFLINE';
                queueState.counters[counterIndex].currentName = '';
                queueState.counters[counterIndex].currentCategory = '';
            } else {
                queueState.counters[counterIndex].currentDocument = 'SYSTEM STANDBY';
            }
            saveState();
            io.emit('queueUpdated', queueState);
        }
    });

    socket.on('toggleTimeLock', () => {
        bookingEngine.ignoreTimeLock = !bookingEngine.ignoreTimeLock;
        saveState();
        io.emit('bookingEngineUpdated', bookingEngine);
    });

    socket.on('cancelTicket', (ticketNumber) => {
        const waitIndex = queueState.waitingList.findIndex(t => t.ticketNumber === ticketNumber);
        if (waitIndex > -1) {
            queueState.waitingList.splice(waitIndex, 1);
        } else {
            const apptIndex = queueState.appointments.findIndex(t => t.ticketNumber === ticketNumber);
            if (apptIndex > -1) {
                queueState.appointments.splice(apptIndex, 1);
            }
        }
        saveState();
        io.emit('queueUpdated', queueState);
    });

    socket.on('submitBookingRequest', (requestData) => {
        if (!bookingEngine.globalOnlineBookingEnabled) {
            socket.emit('bookingResolved', { id: 'N/A', approved: false, reason: 'Online booking is disabled' });
            return;
        }

        if (requestData.date === getTodayDate() && isSystemClosed()) {
            socket.emit('bookingResolved', { id: 'N/A', approved: false, reason: 'The queue system is closed for today. Please select a future date.' });
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
            const nowHour = getPhDateObj().getUTCHours();
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
                dTime = generateAutoTime(position, true);
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
                let finalTimeSlot = reviewData.timeSlot;

                if (dTime) {
                    const parts = dTime.split(':');
                    if (parts.length === 2) {
                        let h = parseInt(parts[0]);
                        let m = parts[1];
                        
                        finalTimeSlot = h >= 12 ? 'AFTERNOON' : 'MORNING';
                        
                        let ampm = h >= 12 ? 'PM' : 'AM';
                        h = h % 12;
                        h = h ? h : 12;
                        m = m.toString().padStart(2, '0');
                        dTime = `${h}:${m} ${ampm}`;
                    }
                }

                const finalAppointment = {
                    ...request,
                    ticketNumber: tNum,
                    category: cat,
                    timeSlot: finalTimeSlot, 
                    status: 'APPROVED',
                    date: request.requestedDate
                };

                const today = getTodayDate();
                let isToday = false;

                if (request.requestedDate === today) {
                    isToday = true;
                    if (!dTime) {
                        const position = queueState.waitingList.length;
                        dTime = generateAutoTime(position, true);
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
        if (data.date === getTodayDate() && isSystemClosed()) {
            return;
        }

        const tNum = getNextTicketNumber(data.date);
        const cat = getServiceCategory(data.document);
        const nowHour = getPhDateObj().getUTCHours();
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
            dTime = generateAutoTime(position, true);
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
        if (isSystemClosed()) {
            socket.emit('ticketError', "Walk-ins are currently disabled. The queue system is closed for today.");
            return;
        }

        const walkInDate = getTodayDate();
        const tNum = getNextTicketNumber(walkInDate);
        const cat = getServiceCategory(data.document);
        const nowHour = getPhDateObj().getUTCHours();
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
        newTicket.displayTime = generateAutoTime(position, false);
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
                
                if (useMongo) {
                    const logEntry = new TicketLog({
                        ticketNumber: next.ticketNumber,
                        category: next.category,
                        document: next.document,
                        priority: next.priority,
                        date: getTodayDate()
                    });
                    logEntry.save().catch(err => console.log(err));
                }

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
        // data expects { type, url, muted }
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
            { id: 1, isActive: true, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' },
            { id: 2, isActive: true, currentTicket: null, currentPriority: '', currentDocument: 'SYSTEM STANDBY', currentName: '', currentCategory: '' }
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

setInterval(() => {
    if (!useMongo) return;
    const phNow = getPhDateObj();
    const currentAbsolute = phNow.getUTCHours() * 60 + phNow.getUTCMinutes();

    let changed = false;
    const today = getTodayDate();
    
    for (let i = 0; i < queueState.waitingList.length; i++) {
        const ticket = queueState.waitingList[i];
        if (ticket.date !== today) continue;
        if (!ticket.displayTime || ticket.displayTime === 'Please wait' || ticket.displayTime === '5:00 PM') continue;
        
        const match = ticket.displayTime.match(/(\d+):(\d+)\s+(AM|PM)/);
        if (match) {
            let h = parseInt(match[1]);
            let m = parseInt(match[2]);
            if (match[3] === 'PM' && h !== 12) h += 12;
            if (match[3] === 'AM' && h === 12) h = 0;
            
            const ticketAbsolute = h * 60 + m;
            
            if (currentAbsolute >= ticketAbsolute) {
                const freeCounter = queueState.counters.find(c => c.isActive && !c.currentTicket);
                if (freeCounter) {
                    freeCounter.currentTicket = ticket.ticketNumber;
                    freeCounter.currentPriority = ticket.priority;
                    freeCounter.currentDocument = ticket.document;
                    freeCounter.currentName = ticket.name;
                    freeCounter.currentCategory = ticket.category;

                    queueState.lastCalled = {
                        ticket: ticket.ticketNumber,
                        counter: freeCounter.id,
                        document: ticket.document,
                        category: ticket.category
                    };

                    if (useMongo) {
                        const logEntry = new TicketLog({
                            ticketNumber: ticket.ticketNumber,
                            category: ticket.category,
                            document: ticket.document,
                            priority: ticket.priority,
                            date: today
                        });
                        logEntry.save().catch(err => console.log(err));
                    }

                    queueState.waitingList.splice(i, 1);
                    i--; 
                    changed = true;
                }
            }
        }
    }

    const originalLength = queueState.waitingList.length;
    queueState.waitingList = queueState.waitingList.filter(ticket => {
        if (ticket.date !== today) return true;
        if (!ticket.displayTime || ticket.displayTime === 'Please wait' || ticket.displayTime === '5:00 PM') return true;
        
        const match = ticket.displayTime.match(/(\d+):(\d+)\s+(AM|PM)/);
        if (match) {
            let h = parseInt(match[1]);
            let m = parseInt(match[2]);
            if (match[3] === 'PM' && h !== 12) h += 12;
            if (match[3] === 'AM' && h === 12) h = 0;
            
            const ticketAbsolute = h * 60 + m;
            
            if (currentAbsolute > ticketAbsolute + 10) { 
                return false; 
            }
        }
        return true;
    });

    if (queueState.waitingList.length !== originalLength) {
        changed = true;
    }

    if (changed) {
        saveState();
        io.emit('queueUpdated', queueState);
    }
}, 5000);

server.listen(process.env.PORT || 3000, '0.0.0.0');