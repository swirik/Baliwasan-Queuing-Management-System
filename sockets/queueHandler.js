const State = require('../models/State');
const TicketLog = require('../models/TicketLog');

async function sendIprogSms(targetNumber, messageText) {
    const apiToken = 'f55a945baa03e8ed6b3fd85ba12e0e686cf15338';
    const endpoint = 'https://www.iprogsms.com/api/v1/sms_messages';

    const payload = {
        api_token: apiToken,
        phone_number: targetNumber,
        message: messageText
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error('IPROG API Failure:', error.message);
    }
}

module.exports = function(io, useMongo) {
    let bookingEngine = {
        globalOnlineBookingEnabled: true,
        autoApprove: false,
        defaultMaxCapacity: 50,
        disabledDaysOfWeek: [], 
        blockedDates: [], 
        serviceRules: {},
        pendingRequests: [],
        dailyLoad: {},
        ignoreTimeLock: false
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
        media: { type: 'none', url: '', muted: false },
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

    if (useMongo) {
        loadState();
    } else {
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
        let primaryService = serviceName.split(', ')[0];
        let rules = bookingEngine.serviceRules[primaryService];
        if (!rules) return availableDates;

        
        let todayStr = getTodayDate();
        let closedNow = isSystemClosed();

        for (let i = 0; i < daysToGenerate; i++) {
            let dateString = currentDate.toISOString().split('T')[0];
            
            
            let dayOfWeek = currentDate.getUTCDay(); 
            
            let isBlockedDay = bookingEngine.disabledDaysOfWeek.includes(dayOfWeek);
            let isBlockedDate = bookingEngine.blockedDates.includes(dateString);
            let isServiceAllowed = rules.allowedDays.includes(dayOfWeek);
            let currentLoad = bookingEngine.dailyLoad[dateString] || 0;
            let isFull = currentLoad >= bookingEngine.defaultMaxCapacity;
            
            
            let isPastCutoff = (dateString === todayStr && closedNow);

            if (!isBlockedDay && !isBlockedDate && isServiceAllowed && !isFull && !isPastCutoff) {
                availableDates.push(dateString);
            }
            
            
            currentDate.setUTCDate(currentDate.getUTCDate() + 1); 
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
                const todayStr = getTodayDate();
                let autoSlot;
                if (newRequest.requestedDate === todayStr) {
                    const nowHour = getPhDateObj().getUTCHours();
                    autoSlot = nowHour < 12 ? 'MORNING' : 'AFTERNOON';
                } else {
                    autoSlot = 'MORNING'; 
                }

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
            const todayStr = getTodayDate();
            let autoSlot;
            if (data.date === todayStr) {
                const nowHour = getPhDateObj().getUTCHours();
                autoSlot = nowHour < 12 ? 'MORNING' : 'AFTERNOON';
            } else {
                autoSlot = 'MORNING'; 
            }

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
                    if (next.contact && next.contact !== 'N/A') {
                        const formattedTicket = `${next.category}-${next.ticketNumber.toString().padStart(3, '0')}`;
                        const smsBody = `Barangay Baliwasan: Ticket ${formattedTicket} is now serving at Counter ${data.counterId}. Please proceed.`;
                        sendIprogSms(next.contact, smsBody);
                    }
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
                        
                        if (ticket.contact && ticket.contact !== 'N/A') {
                            const formattedTicket = `${ticket.category}-${ticket.ticketNumber.toString().padStart(3, '0')}`;
                            const smsBody = `Ticket ${formattedTicket} is now serving at Counter ${freeCounter.id}. Please proceed.`;
                            sendIprogSms(ticket.contact, smsBody);
                        }

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

        if (changed) {
            saveState();
            io.emit('queueUpdated', queueState);
        }
    }, 5000);
};