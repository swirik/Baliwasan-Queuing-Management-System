const socket = io();

const offlineScreen = document.getElementById('offline-screen');
const ticketResult = document.getElementById('ticket-result');
const mobileQueueScreen = document.getElementById('mobile-queue-screen');
const btnShowQueue = document.getElementById('btn-show-queue');
const btnShowMyTicket = document.getElementById('btn-show-my-ticket');
const smsToast = document.getElementById('sms-toast');
const smsMessage = document.getElementById('sms-message');
const confirmDocName = document.getElementById('confirm-doc-name');
const confirmDate = document.getElementById('confirm-date');
const confirmPriority = document.getElementById('confirm-priority');
const dynamicServicesContainer = document.getElementById('dynamic-services-container');

let pendingUser = { name: '', contact: '', priority: '', document: '', date: '' };
let mySavedTickets = []; 
let currentTrackId = null;
let fpInstance = null;
let swRegistration = null;
let currentQueueState = null;

const phTime = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
const localISOTime = phTime.toISOString().split('T')[0];

if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        swRegistration = reg;
    }).catch(err => {});
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

document.body.addEventListener('click', requestNotificationPermission, { once: true });

window.cancelMyTicket = function(ticketNumber, event) {
    if(event) event.stopPropagation();
    if(confirm('Are you sure you want to cancel this ticket?')) {
        socket.emit('cancelTicket', ticketNumber);
        mySavedTickets = mySavedTickets.filter(t => t.res.ticket.ticketNumber !== ticketNumber);
        localStorage.setItem('baliwasanTicketsArray', JSON.stringify(mySavedTickets));
        if(mySavedTickets.length > 0) {
            showMyTicketsDashboard();
        } else {
            goToStep1();
        }
    }
}

function hideAllScreens() {
    const screens = ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'pending-approval-screen', 'rejected-screen', 'ticket-result', 'offline-screen', 'my-tickets-screen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function goToStep1() {
    hideAllScreens();
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('step-3-form').reset();
    window.scrollTo(0, 0);
}

function saveTicketLocally(res) {
    const ticketData = { 
        res: res, 
        savedDate: localISOTime, 
        notified: false,
        notifiedApproaching: false,
        notifiedVoided: false,
        isServing: false,
        counterId: null
    };
    mySavedTickets.push(ticketData);
    localStorage.setItem('baliwasanTicketsArray', JSON.stringify(mySavedTickets));
}

function checkSavedTicket() {
    const saved = localStorage.getItem('baliwasanTicketsArray');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            mySavedTickets = parsed.filter(t => t.savedDate === localISOTime || t.res.ticket.date >= localISOTime);
            if (mySavedTickets.length > 0) {
                localStorage.setItem('baliwasanTicketsArray', JSON.stringify(mySavedTickets));
                btnShowMyTicket.classList.remove('hidden');
                return true;
            }
        } catch(e) {}
    }
    localStorage.removeItem('baliwasanTicketsArray');
    return false;
}

function showMyTicketsDashboard() {
    hideAllScreens();
    document.getElementById('my-tickets-screen').classList.remove('hidden');
    const container = document.getElementById('tickets-container');
    container.innerHTML = '';
    
    mySavedTickets.forEach((t, index) => {
        const tick = t.res.ticket;
        const dTime = t.res.displayTime || tick.displayTime || 'Please wait';
        const dateColor = tick.date === localISOTime ? 'text-green-600' : 'text-gray-500';

        let statusUI = t.isServing 
            ? `<div class="mt-2"><p class="text-[9px] font-black text-white bg-green-600 px-3 py-2 rounded-lg shadow-md animate-pulse uppercase tracking-widest"><i class="fas fa-walking mr-1"></i> Counter ${t.counterId}</p></div>`
            : `<div>
                    <p class="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-1 opacity-70">Expected</p>
                    <p class="text-sm font-black text-[#071c4d] bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">${dTime}</p>
                </div>`;

        const el = document.createElement('div');
        el.className = 'bg-white border border-gray-200 p-5 rounded-2xl cursor-pointer hover:border-[#071c4d] hover:shadow-lg transition-all flex justify-between items-center group relative overflow-hidden';
        el.onclick = () => renderTicketResultScreen(t.res, false);
        el.innerHTML = `
            <div class="absolute left-0 top-0 bottom-0 w-2 bg-[#071c4d]"></div>
            <div class="flex-1 pl-4" onclick="renderTicketResultScreen(mySavedTickets[${index}].res, false)">
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate max-w-[150px] mb-1">${tick.document}</p>
                <p class="text-3xl font-black text-[#071c4d] tracking-tighter leading-none">${formatTicket(tick.ticketNumber, tick.category)}</p>
                <p class="text-[10px] font-bold mt-2 ${dateColor}"><i class="fas fa-calendar-day mr-1"></i>${tick.date} &nbsp;&bull;&nbsp; ${tick.timeSlot || 'WALK-IN'}</p>
            </div>
            <div class="text-right shrink-0 ml-2 flex flex-col items-end justify-between h-full">
                ${statusUI}
                <button onclick="cancelMyTicket(${tick.ticketNumber}, event)" class="mt-3 text-[9px] text-red-500 font-bold uppercase tracking-widest hover:text-white hover:bg-red-500 bg-red-50 px-3 py-1.5 rounded-md transition-colors shadow-sm"><i class="fas fa-trash-alt mr-1"></i> Cancel</button>
            </div>
        `;
        container.appendChild(el);
    });
    window.scrollTo(0,0);
}

btnShowMyTicket.addEventListener('click', () => {
    showMyTicketsDashboard();
});

const myBookingEngine = new BookingCalendar(socket, {
    onLoadingDates: () => {
        document.getElementById('user-date').placeholder = "Fetching available dates...";
        document.getElementById('user-date').disabled = true;
    },
    onDatesLoaded: (dates) => {
        const dateInput = document.getElementById('user-date');
        const btnToday = document.getElementById('btn-select-today');
        
        dateInput.disabled = false;
        dateInput.placeholder = "Select Date";
        
        if (fpInstance) fpInstance.destroy();
        
        fpInstance = flatpickr(dateInput, {
            minDate: "today",
            enable: dates,
            dateFormat: "Y-m-d",
            disableMobile: "true"
        });

        if (dates.includes(localISOTime)) {
            btnToday.classList.remove('hidden');
            btnToday.onclick = () => {
                fpInstance.setDate(localISOTime, true);
            };
        } else {
            btnToday.classList.add('hidden');
        }
    },
    onRequestPending: (res) => {
        hideAllScreens();
        document.getElementById('pending-approval-screen').classList.remove('hidden');
        currentTrackId = res.id;
        document.getElementById('pending-track-id').innerText = currentTrackId;
        window.scrollTo(0, 0);
    },
    onAutoApproved: (res) => {
        saveTicketLocally(res);
        renderTicketResultScreen(res, true);
    },
    onBookingResolved: (res) => {
        if (res.id !== currentTrackId && res.id !== 'N/A') return;
        hideAllScreens();
        if (res.approved) {
            saveTicketLocally(res);
            renderTicketResultScreen(res, true);
        } else {
            if (res.reason) {
                document.getElementById('rejected-reason').innerText = res.reason;
            }
            document.getElementById('rejected-screen').classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    },
    onError: (msg) => {
        alert(msg);
    }
});

function renderTicketResultScreen(res, isNew) {
    btnShowMyTicket.classList.remove('hidden');
    hideAllScreens();
    document.getElementById('ticket-result').classList.remove('hidden');
    
    document.getElementById('my-ticket-number').innerText = formatTicket(res.ticket.ticketNumber, res.ticket.category);
    document.getElementById('my-time-slot').innerText = res.ticket.timeSlot || 'WALK-IN';
    
    if (res.isToday) {
        document.getElementById('display-time-container').classList.remove('hidden');
        document.getElementById('live-message').classList.remove('hidden');
        document.getElementById('appt-message').classList.add('hidden');

        const servingCounter = currentQueueState ? currentQueueState.counters.find(c => c.currentTicket === res.ticket.ticketNumber && c.currentCategory === res.ticket.category) : null;
        
        if (servingCounter) {
            document.getElementById('display-time-container').innerHTML = `
                <div class="bg-green-100 border-2 border-green-500 rounded-2xl p-6 text-center animate-pulse shadow-inner">
                    <p class="text-xs text-green-700 font-black uppercase tracking-widest mb-1"><i class="fas fa-bullhorn mr-1"></i> It is your turn!</p>
                    <p class="text-3xl font-black text-green-800">PROCEED TO COUNTER ${servingCounter.id}</p>
                </div>
            `;
            document.getElementById('live-message').classList.add('hidden');
        } else {
            document.getElementById('display-time-container').innerHTML = `
                <div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-inner">
                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2"><i class="fas fa-clock mr-1"></i> Expected Time</p>
                    <p id="display-time" class="text-3xl font-black text-gray-900">${res.displayTime || res.ticket.displayTime || '--:--'}</p>
                </div>
            `;
            document.getElementById('live-message').classList.remove('hidden');
        }

        const phNow = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
        const currentHour = phNow.getUTCHours();
        if (res.ticket.timeSlot === 'AFTERNOON' && currentHour < 12) {
            document.getElementById('afternoon-notice').classList.remove('hidden');
        } else {
            document.getElementById('afternoon-notice').classList.add('hidden');
        }
    } else {
        document.getElementById('display-time-container').classList.add('hidden');
        document.getElementById('live-message').classList.add('hidden');
        document.getElementById('appt-message').classList.remove('hidden');
        document.getElementById('afternoon-notice').classList.add('hidden');
    }

    document.getElementById('btn-ticket-done').onclick = () => showMyTicketsDashboard();
    document.getElementById('btn-cancel-active-ticket').onclick = () => {
        if(confirm('Are you sure you want to cancel this ticket?')) {
            socket.emit('cancelTicket', res.ticket.ticketNumber);
            mySavedTickets = mySavedTickets.filter(t => t.res.ticket.ticketNumber !== res.ticket.ticketNumber);
            localStorage.setItem('baliwasanTicketsArray', JSON.stringify(mySavedTickets));
            if(mySavedTickets.length > 0) {
                showMyTicketsDashboard();
            } else {
                goToStep1();
            }
        }
    };
    window.scrollTo(0, 0);
}

btnShowQueue.addEventListener('click', () => {
    mobileQueueScreen.classList.remove('hidden');
    mobileQueueScreen.classList.add('flex');
});

document.getElementById('btn-hide-queue').addEventListener('click', () => {
    mobileQueueScreen.classList.add('hidden');
    mobileQueueScreen.classList.remove('flex');
});

function setupDocButtons() {
    document.querySelectorAll('.doc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.disabled) return;
            pendingUser.document = e.target.getAttribute('data-doc');
            myBookingEngine.selectService(pendingUser.document);
            hideAllScreens();
            document.getElementById('step-2').classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    });
}

document.getElementById('btn-back-to-1').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('step-1').classList.remove('hidden');
});

document.getElementById('step-2-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!document.getElementById('user-date').value) return alert("Select a date first.");
    pendingUser.date = document.getElementById('user-date').value;
    hideAllScreens();
    document.getElementById('step-3').classList.remove('hidden');
    window.scrollTo(0, 0);
});

document.getElementById('btn-back-to-2').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('step-2').classList.remove('hidden');
});

document.getElementById('step-3-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fname = document.getElementById('user-fname').value.trim();
    const mname = document.getElementById('user-mname').value.trim();
    const lname = document.getElementById('user-lname').value.trim();
    
    pendingUser.name = fname + (mname ? ' ' + mname : '') + ' ' + lname;
    pendingUser.contact = document.getElementById('user-contact').value;
    pendingUser.priority = document.getElementById('user-priority').value;
    
    confirmDocName.innerText = pendingUser.document;
    confirmDate.innerText = pendingUser.date;
    confirmPriority.innerText = pendingUser.priority;

    hideAllScreens();
    document.getElementById('step-4').classList.remove('hidden');
    window.scrollTo(0, 0);
});

document.getElementById('btn-cancel-confirm').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('step-3').classList.remove('hidden');
});

document.getElementById('btn-proceed-consent').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('step-5').classList.remove('hidden');
    window.scrollTo(0, 0);
});

document.getElementById('btn-back-to-4').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('step-4').classList.remove('hidden');
});

document.getElementById('btn-submit-queue').addEventListener('click', () => {
    myBookingEngine.submitRequest(pendingUser, pendingUser.date);
});

document.getElementById('user-priority').addEventListener('change', function(e) {
    const warning = document.getElementById('priority-warning');
    if (e.target.value !== 'REGULAR') {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
});

socket.on('ticketIssued', (response) => {
    saveTicketLocally(response);
    renderTicketResultScreen(response, true);
});

socket.on('bookingEngineUpdated', (engineState) => {
    if (!engineState.globalOnlineBookingEnabled) {
        hideAllScreens();
        offlineScreen.classList.remove('hidden');
    } else {
        if(!offlineScreen.classList.contains('hidden')) {
            if (mySavedTickets.length > 0) showMyTicketsDashboard();
            else goToStep1();
        }
    }
});

socket.on('queueUpdated', (state) => {
    currentQueueState = state;
    dynamicServicesContainer.innerHTML = '';
    
    const specialServices = state.services.filter(s => s.category === 'S');
    if(specialServices.length > 0) {
        const specialHTML = specialServices.map(s => {
            const disabledClass = state.disabledServices.includes(s.name) ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : 'bg-gradient-to-r from-[#FFD500] to-yellow-400 hover:to-yellow-500 border-[#FFD500] text-[#071c4d] hover:shadow-lg hover:-translate-y-1';
            const newBadge = s.isNew ? '<span class="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full absolute -top-3 -right-2 tracking-widest shadow-md border-2 border-white animate-pulse">NEW</span>' : '';
            return `
                <button ${state.disabledServices.includes(s.name) ? 'disabled' : ''} class="doc-btn ${disabledClass} relative border-2 font-black py-5 px-6 rounded-2xl shadow-sm transition-all uppercase text-sm tracking-widest w-full flex items-center justify-between group" data-doc="${s.name}">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-star text-lg opacity-70"></i>
                        <span>${s.name}</span>
                    </div>
                    <i class="fas fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    ${newBadge}
                </button>
            `;
        }).join('');
        dynamicServicesContainer.innerHTML += `
            <div class="mb-8">
                <h3 class="text-[10px] font-black text-[#071c4d] uppercase tracking-widest mb-3 border-b border-gray-200 pb-2"><i class="fas fa-bolt mr-1 text-[#FFD500]"></i> Priority & Special Events</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${specialHTML}</div>
            </div>
        `;
    }

    const standardServices = state.services.filter(s => s.category !== 'S');
    if(standardServices.length > 0) {
        const standardHTML = standardServices.map(s => {
            const disabledClass = state.disabledServices.includes(s.name) ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400' : 'bg-white hover:bg-[#071c4d] hover:text-white border-gray-200 hover:border-[#071c4d] text-gray-800 hover:shadow-lg hover:-translate-y-1';
            const newBadge = s.isNew ? '<span class="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full absolute -top-3 -right-2 tracking-widest shadow-md border-2 border-white animate-pulse">NEW</span>' : '';
            return `
                <button ${state.disabledServices.includes(s.name) ? 'disabled' : ''} class="doc-btn ${disabledClass} relative border-2 font-bold py-4 md:py-5 px-5 rounded-2xl shadow-sm transition-all uppercase text-xs md:text-sm w-full flex items-center justify-between group" data-doc="${s.name}">
                    <span>${s.name}</span>
                    <i class="fas fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity text-[#FFD500]"></i>
                    ${newBadge}
                </button>
            `;
        }).join('');
        dynamicServicesContainer.innerHTML += `
            <div>
                <h3 class="text-[10px] font-black text-[#071c4d] uppercase tracking-widest mb-3 border-b border-gray-200 pb-2"><i class="fas fa-file-alt mr-1 text-gray-400"></i> Standard Documents</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">${standardHTML}</div>
            </div>
        `;
    }
    setupDocButtons();

    document.getElementById('mobile-serving-ticket').innerText = state.lastCalled && state.lastCalled.ticket ? formatTicket(state.lastCalled.ticket, state.lastCalled.category) : "----";
    document.getElementById('mobile-serving-counter').innerText = state.lastCalled && state.lastCalled.counter ? `COUNTER ${state.lastCalled.counter}` : "--";
    document.getElementById('mobile-serving-doc').innerText = state.lastCalled && state.lastCalled.document ? state.lastCalled.document : "SYSTEM STANDBY";
    document.getElementById('mobile-waiting-count').innerText = state.waitingList.length;
    
    const mobileList = document.getElementById('mobile-waiting-list');
    mobileList.innerHTML = '';

    if (state.waitingList.length === 0) {
        mobileList.innerHTML = '<div class="text-center py-10 text-gray-300 font-bold uppercase text-xs tracking-wider">Queue is empty</div>';
    } else {
        state.waitingList.forEach(item => {
            const badgeColor = item.priority === 'PWD / Senior / Pregnant' ? 'bg-[#071c4d] text-[#FFD500] border-[#071c4d]' : 'bg-white text-gray-600 border-gray-200';
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center p-4 border border-gray-200 rounded-2xl bg-white shadow-sm';
            el.innerHTML = `
                <div class="font-black text-3xl text-gray-900">${formatTicket(item.ticketNumber, item.category)}</div>
                <div class="text-[9px] font-black uppercase ${badgeColor} px-2 py-1 rounded-md border tracking-widest shadow-sm">${item.priority}</div>
            `;
            mobileList.appendChild(el);
        });
    }

    if (mySavedTickets.length > 0) {
        let needsSave = false;
        let activeTickets = [];

        mySavedTickets.forEach((t) => {
            const tick = t.res.ticket;
            const inWaitingList = state.waitingList.findIndex(x => x.ticketNumber === tick.ticketNumber && x.category === tick.category);
            const servingCounter = state.counters.find(c => c.currentTicket === tick.ticketNumber && c.currentCategory === tick.category);
            const isToday = tick.date === localISOTime;

            if (isToday) {
                if (servingCounter) {
                    t.isServing = true;
                    t.counterId = servingCounter.id;
                    if (!t.notified) {
                        const formattedTicket = formatTicket(tick.ticketNumber, tick.category);
                        if (swRegistration && Notification.permission === 'granted') {
                            swRegistration.showNotification('It is your turn!', {
                                body: `Ticket #${formattedTicket} is now being served at Counter ${servingCounter.id}.`,
                                icon: '/resources/logo.png',
                                vibrate: [200, 100, 200]
                            });
                        }
                        smsMessage.innerText = `Hello! Ticket #${formattedTicket} is now being served at Counter ${servingCounter.id}. Please proceed to the counter.`;
                        smsToast.classList.remove('hidden');
                        setTimeout(() => { smsToast.classList.remove('-translate-y-[150%]'); smsToast.classList.add('translate-y-0'); }, 50);
                        setTimeout(() => { smsToast.classList.remove('translate-y-0'); smsToast.classList.add('-translate-y-[150%]'); setTimeout(() => { smsToast.classList.add('hidden'); }, 500); }, 6000);
                        t.notified = true;
                        needsSave = true;
                    }
                    activeTickets.push(t);
                } else if (inWaitingList !== -1) {
                    t.isServing = false;
                    if (inWaitingList > 0 && inWaitingList <= 3) {
                        if (!t.notifiedApproaching) {
                            const formattedTicket = formatTicket(tick.ticketNumber, tick.category);
                            if (swRegistration && Notification.permission === 'granted') {
                                swRegistration.showNotification('Get Ready!', {
                                    body: `Ticket #${formattedTicket} is almost up. There are ${inWaitingList} people ahead of you.`,
                                    icon: '/resources/logo.png',
                                    vibrate: [100, 50, 100]
                                });
                            }
                            t.notifiedApproaching = true;
                            needsSave = true;
                        }
                    }
                    activeTickets.push(t);
                } else {
                    needsSave = true;
                    if (t.notified) {
                        const formattedTicket = formatTicket(tick.ticketNumber, tick.category);
                        smsMessage.innerText = `Ticket #${formattedTicket} has been completed. Thank you!`;
                        smsToast.classList.remove('hidden');
                        setTimeout(() => { smsToast.classList.remove('-translate-y-[150%]'); smsToast.classList.add('translate-y-0'); }, 50);
                        setTimeout(() => { smsToast.classList.remove('translate-y-0'); smsToast.classList.add('-translate-y-[150%]'); setTimeout(() => { smsToast.classList.add('hidden'); }, 500); }, 6000);
                    } else if (!t.notifiedVoided) {
                        const formattedTicket = formatTicket(tick.ticketNumber, tick.category);
                        if (swRegistration && Notification.permission === 'granted') {
                            swRegistration.showNotification('Ticket Voided', {
                                body: `Ticket #${formattedTicket} was voided because you missed your expected time.`,
                                icon: '/resources/logo.png',
                                vibrate: [500, 200, 500]
                            });
                        }
                        t.notifiedVoided = true;
                    }
                }
            } else {
                activeTickets.push(t);
            }
        });

        if (mySavedTickets.length !== activeTickets.length || needsSave) {
            mySavedTickets = activeTickets;
            localStorage.setItem('baliwasanTicketsArray', JSON.stringify(mySavedTickets));
            
            if (mySavedTickets.length === 0) {
                btnShowMyTicket.classList.add('hidden');
                if (!document.getElementById('my-tickets-screen').classList.contains('hidden') || 
                    !document.getElementById('ticket-result').classList.contains('hidden')) {
                    goToStep1();
                }
            } else {
                if (!document.getElementById('my-tickets-screen').classList.contains('hidden')) {
                    showMyTicketsDashboard();
                } else if (!document.getElementById('ticket-result').classList.contains('hidden')) {
                    const activeRes = mySavedTickets.find(t => t.res.ticket.ticketNumber === document.getElementById('my-ticket-number').innerText.split('-')[1] * 1);
                    if(activeRes) renderTicketResultScreen(activeRes.res, false);
                }
            }
        }
    }
});
window.addEventListener('load', () => {
    if (checkSavedTicket()) {
        showMyTicketsDashboard();
    } else {
        goToStep1();
    }
});