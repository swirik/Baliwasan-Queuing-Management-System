const socket = io();
let currentAutoApproveState = false;
let globalBookingEnabled = true;
let ignoreTimeLock = false;
let blockedDatesList = [];
let engineRulesData = {};


window.toggleCounter = function(id) {
    socket.emit('toggleCounter', { counterId: id });
}

function checkSystemTime() {
    const phNow = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
    const currentHour = phNow.getUTCHours();
    
    const btnGenWalkin = document.getElementById('btn-gen-walkin');
    
    if (currentHour >= 17 && !ignoreTimeLock) {
        btnGenWalkin.disabled = true;
        btnGenWalkin.className = "w-full bg-gray-400 text-white font-black py-4 rounded-xl transition-all text-xs uppercase tracking-widest shadow-inner flex justify-center items-center gap-2 cursor-not-allowed";
        btnGenWalkin.innerHTML = '<i class="fas fa-lock"></i> SYSTEM CLOSED (PAST 5PM)';
    } else {
        btnGenWalkin.disabled = false;
        btnGenWalkin.className = "w-full bg-[#071c4d] hover:bg-[#0a2a6e] text-white font-black py-4 rounded-xl transition-all text-xs uppercase tracking-widest shadow-md flex justify-center items-center gap-2 border-b-4 border-gray-900 active:border-b-0 active:translate-y-1";
        btnGenWalkin.innerHTML = '<i class="fas fa-plus-circle text-[#FFD500] text-sm"></i> ADD WALK-IN';
    }
}
setInterval(checkSystemTime, 60000);

const mediaTypeSelect = document.getElementById('media-type');
const mediaUrlInput = document.getElementById('media-url');
const mediaFileInput = document.getElementById('media-file');
const pushBtn = document.getElementById('btn-push-media');

mediaTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'upload') {
        mediaUrlInput.classList.add('hidden');
        mediaFileInput.classList.remove('hidden');
    } else if (e.target.value === 'youtube') {
        mediaFileInput.classList.add('hidden');
        mediaUrlInput.classList.remove('hidden');
    } else {
        mediaFileInput.classList.add('hidden');
        mediaUrlInput.classList.add('hidden');
    }
});

document.getElementById('btn-freeze-system').addEventListener('click', () => {
    socket.emit('toggleFreeze');
});

document.getElementById('btn-c1-noshow').addEventListener('click', () => {
    socket.emit('markNoShow', { counterId: 1 });
});

document.getElementById('btn-c2-noshow').addEventListener('click', () => {
    socket.emit('markNoShow', { counterId: 2 });
});

document.getElementById('btn-gen-walkin').addEventListener('click', () => {
    const priority = document.getElementById('admin-priority').value;
    const documentType = document.getElementById('admin-document').value;
    socket.emit('generateTicket', { priority, document: documentType });
});

document.getElementById('btn-add-service').addEventListener('click', () => {
    const name = document.getElementById('new-service-name').value.trim();
    const cat = document.getElementById('new-service-cat').value;
    if(name) {
        socket.emit('addService', { name: name, category: cat });
        document.getElementById('new-service-name').value = '';
    }
});

document.getElementById('btn-call-1').addEventListener('click', () => {
    socket.emit('callNext', { counterId: 1 });
});

document.getElementById('btn-call-2').addEventListener('click', () => {
    socket.emit('callNext', { counterId: 2 });
});

document.getElementById('btn-c1-success').addEventListener('click', () => {
    socket.emit('resolveTicket', { counterId: 1, status: 'success' });
});

document.getElementById('btn-c1-fail').addEventListener('click', () => {
    socket.emit('resolveTicket', { counterId: 1, status: 'failed' });
});

document.getElementById('btn-c2-success').addEventListener('click', () => {
    socket.emit('resolveTicket', { counterId: 2, status: 'success' });
});

document.getElementById('btn-c2-fail').addEventListener('click', () => {
    socket.emit('resolveTicket', { counterId: 2, status: 'failed' });
});

document.getElementById('btn-update-ticker').addEventListener('click', () => {
    const text = document.getElementById('ticker-input').value;
    if(text) {
        socket.emit('updateTicker', text);
        document.getElementById('ticker-input').value = '';
    }
});

document.getElementById('btn-open-monitor').addEventListener('click', () => {
    window.open('queue-monitor.html', '_blank');
});

socket.on('ticketError', (msg) => {
    alert(msg);
});

pushBtn.addEventListener('click', async () => {
    const type = mediaTypeSelect.value;
    const isMuted = document.getElementById('media-muted').checked;

    if (type === 'none') {
        socket.emit('updateMedia', { type: 'none', url: '', muted: isMuted });
        return;
    }
    if (type === 'youtube') {
        const url = mediaUrlInput.value;
        if (!url) return alert('Enter a valid YouTube URL');
        socket.emit('updateMedia', { type: 'youtube', url: url, muted: isMuted });
        return;
    }
    if (type === 'upload') {
        const file = mediaFileInput.files[0];
        if (!file) return alert('Select a file to upload first.');
        pushBtn.innerText = 'UPLOADING...';
        pushBtn.classList.add('opacity-50', 'pointer-events-none');
        const formData = new FormData();
        formData.append('mediaFile', file);
        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            const detectedType = file.type.startsWith('video') ? 'video' : 'image';
            socket.emit('updateMedia', { type: detectedType, url: data.url, muted: isMuted });
            mediaFileInput.value = '';
        } catch (error) {
            alert('Error uploading file: ' + error.message);
        } finally {
            pushBtn.innerText = 'PUSH TO SCREEN';
            pushBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if(confirm("DANGER: This will wipe all current queue data. Proceed?")) {
        socket.emit('resetQueue');
    }
});

document.getElementById('toggle-auto-approve').addEventListener('click', () => {
    currentAutoApproveState = !currentAutoApproveState;
    socket.emit('updateBookingRules', { autoApprove: currentAutoApproveState });
});

document.getElementById('toggle-global-booking').addEventListener('click', () => {
    globalBookingEnabled = !globalBookingEnabled;
    socket.emit('updateBookingRules', { globalOnlineBookingEnabled: globalBookingEnabled });
});

document.getElementById('toggle-time-lock').addEventListener('click', () => {
    socket.emit('toggleTimeLock');
});

document.getElementById('btn-update-capacity').addEventListener('click', () => {
    const cap = parseInt(document.getElementById('admin-capacity').value);
    if(cap > 0) {
        socket.emit('updateBookingRules', { defaultMaxCapacity: cap });
    }
});

document.getElementById('btn-add-block').addEventListener('click', () => {
    const bDate = document.getElementById('admin-block-date').value;
    if(bDate && !blockedDatesList.includes(bDate)) {
        blockedDatesList.push(bDate);
        socket.emit('updateBookingRules', { blockedDates: blockedDatesList });
        document.getElementById('admin-block-date').value = '';
    }
});

document.getElementById('matrix-service-select').addEventListener('change', (e) => {
    renderMatrixDays(e.target.value);
});

document.getElementById('btn-save-matrix').addEventListener('click', () => {
    const srv = document.getElementById('matrix-service-select').value;
    if(!srv) return;
    const checkboxes = document.querySelectorAll('.matrix-day-chk');
    let allowed = [];
    checkboxes.forEach(chk => {
        if(chk.checked) allowed.push(parseInt(chk.value));
    });
    socket.emit('updateServiceRule', { serviceName: srv, allowedDays: allowed });
    alert("Rules updated for " + srv);
});

document.getElementById('btn-export-data').addEventListener('click', () => {
    window.open('/export', '_blank');
});

document.getElementById('btn-open-analytics').addEventListener('click', () => {
    window.open('admin-analytics.html', '_blank');
});

window.approveRequest = function(id) {
    const slot = document.getElementById('slot-' + id).value;
    const timeInput = document.getElementById('time-' + id).value;
    socket.emit('adminReviewBooking', { id: id, approved: true, timeSlot: slot, customTime: timeInput });
}

window.rejectRequest = function(id) {
    socket.emit('adminReviewBooking', { id: id, approved: false });
}

window.adminCancelTicket = function(ticketNumber) {
    if(confirm('Are you sure you want to cancel this ticket?')) {
        socket.emit('cancelTicket', ticketNumber);
    }
}

function renderMatrixDays(serviceName) {
    const container = document.getElementById('matrix-days-container');
    container.innerHTML = '';
    const days = [{d:1, n:'Mon'}, {d:2, n:'Tue'}, {d:3, n:'Wed'}, {d:4, n:'Thu'}, {d:5, n:'Fri'}, {d:6, n:'Sat'}, {d:0, n:'Sun'}];
    const rules = engineRulesData[serviceName] ? engineRulesData[serviceName].allowedDays : [1,2,3,4,5];
    
    days.forEach(day => {
        const isChecked = rules.includes(day.d) ? 'checked' : '';
        container.innerHTML += `
            <label class="flex flex-col items-center bg-white p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm">
                <span class="text-[9px] font-black text-[#071c4d] uppercase mb-1">${day.n}</span>
                <input type="checkbox" value="${day.d}" class="matrix-day-chk accent-[#FFD500] w-4 h-4 cursor-pointer" ${isChecked}>
            </label>
        `;
    });
}

socket.on('bookingEngineUpdated', (engineState) => {
    engineRulesData = engineState.serviceRules;
    currentAutoApproveState = engineState.autoApprove;
    globalBookingEnabled = engineState.globalOnlineBookingEnabled;
    blockedDatesList = engineState.blockedDates;
    ignoreTimeLock = engineState.ignoreTimeLock;
    
    document.getElementById('admin-capacity').value = engineState.defaultMaxCapacity;

    const toggleAutoBtn = document.getElementById('toggle-auto-approve');
    const knobAuto = document.getElementById('knob-auto-approve');
    if (currentAutoApproveState) {
        toggleAutoBtn.classList.replace('bg-gray-400', 'bg-green-500');
        knobAuto.classList.replace('left-[2px]', 'left-[26px]');
    } else {
        toggleAutoBtn.classList.replace('bg-green-500', 'bg-gray-400');
        knobAuto.classList.replace('left-[26px]', 'left-[2px]');
    }

    const toggleGlobalBtn = document.getElementById('toggle-global-booking');
    const knobGlobal = document.getElementById('knob-global-booking');
    if (globalBookingEnabled) {
        toggleGlobalBtn.classList.replace('bg-gray-400', 'bg-green-500');
        knobGlobal.classList.replace('left-[2px]', 'left-[26px]');
    } else {
        toggleGlobalBtn.classList.replace('bg-green-500', 'bg-gray-400');
        knobGlobal.classList.replace('left-[26px]', 'left-[2px]');
    }

    const toggleTimeBtn = document.getElementById('toggle-time-lock');
    const knobTime = document.getElementById('knob-time-lock');
    if (ignoreTimeLock) {
        toggleTimeBtn.classList.replace('bg-gray-400', 'bg-red-500');
        knobTime.classList.replace('left-[2px]', 'left-[26px]');
    } else {
        toggleTimeBtn.classList.replace('bg-red-500', 'bg-gray-400');
        knobTime.classList.replace('left-[26px]', 'left-[2px]');
    }
    
    checkSystemTime();

    const pendingList = document.getElementById('admin-pending-list');
    document.getElementById('admin-pending-count').innerText = engineState.pendingRequests.length;
    document.getElementById('header-pending-count').innerText = engineState.pendingRequests.length;
    pendingList.innerHTML = '';

    if (engineState.pendingRequests.length === 0) {
        pendingList.innerHTML = '<div class="h-full flex items-center justify-center text-gray-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-hourglass-half mr-2 text-xl opacity-50"></i> No pending requests</div>';
    } else {
        engineState.pendingRequests.forEach(req => {
            const el = document.createElement('div');
            el.className = 'bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3 hover:border-[#FFD500] hover:shadow-md transition-all';
            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-black text-lg text-[#071c4d] mb-1 tracking-tight">${req.name}</div>
                        <div class="text-[10px] text-gray-500 font-bold"><i class="fas fa-phone mr-1"></i>${req.contact}</div>
                        <div class="text-[10px] font-bold text-gray-600 mt-1"><i class="fas fa-calendar-alt mr-1"></i>${req.requestedDate}</div>
                    </div>
                    <div class="text-[9px] font-black uppercase bg-[#071c4d] text-[#FFD500] px-3 py-1.5 rounded-lg shadow-sm border border-[#071c4d] max-w-[80px] text-center">${req.priority}</div>
                </div>
                <div class="text-[10px] font-bold bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 uppercase truncate shadow-inner">
                    <i class="fas fa-file-alt mr-2 text-gray-400"></i> ${req.document}
                </div>
                <div class="flex gap-3 items-center mt-2">
                    <div class="flex flex-col gap-1 w-1/2">
                        <select id="slot-${req.id}" class="text-xs bg-white border border-gray-300 rounded-lg p-2.5 font-bold focus:border-[#FFD500] outline-none shadow-sm cursor-pointer text-gray-700">
                            <option value="MORNING">Morning</option>
                            <option value="AFTERNOON">Afternoon</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-1 w-1/2">
                        <input type="time" id="time-${req.id}" class="text-xs bg-white border border-gray-300 rounded-lg p-2.5 font-bold w-full focus:border-[#FFD500] outline-none shadow-sm text-gray-700" title="Leave blank for Auto">
                    </div>
                </div>
                <div class="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                    <button class="flex-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 text-xs font-black py-3 rounded-xl uppercase transition-all shadow-sm flex items-center justify-center gap-2" onclick="rejectRequest('${req.id}')">
                        <i class="fas fa-times-circle"></i> Reject
                    </button>
                    <button class="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-black py-3 rounded-xl uppercase transition-all shadow-md flex items-center justify-center gap-2 border-b-4 border-green-700 active:border-b-0 active:translate-y-1" onclick="approveRequest('${req.id}')">
                        <i class="fas fa-check-circle"></i> Approve
                    </button>
                </div>
            `;
            pendingList.appendChild(el);
        });
    }
});

function createTicketCard(item, isLive) {
    const badgeColor = item.priority === 'PWD / Senior / Pregnant' ? 'bg-[#071c4d] text-[#FFD500] border-[#071c4d]' : 'bg-gray-100 text-gray-700 border-gray-200';
    const dateColor = isLive ? 'text-green-600' : 'text-gray-500';
    
    const el = document.createElement('div');
    el.className = 'bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3 hover:border-[#FFD500] transition-all hover:shadow-md relative group';
    
    el.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <div class="font-black text-2xl text-[#071c4d] mb-1 leading-none tracking-tight">${formatTicket(item.ticketNumber, item.category)}</div>
                <div class="text-sm font-bold text-gray-800">${item.name}</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1"><i class="fas fa-phone mr-1"></i>${item.contact}</div>
                <div class="text-[10px] font-bold mt-1 ${dateColor}"><i class="fas fa-calendar-day mr-1"></i>${item.date} ${item.timeSlot && !isLive ? '· ' + item.timeSlot : ''} ${item.displayTime ? '· ' + item.displayTime : ''}</div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <div class="text-[9px] font-black uppercase ${badgeColor} px-3 py-1.5 rounded-lg border tracking-tighter text-center max-w-[80px] shadow-sm">
                    ${item.priority}
                </div>
            </div>
        </div>
        <div class="text-[10px] font-bold bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 uppercase truncate shadow-inner">
            <i class="fas fa-file-alt mr-2 text-gray-400"></i> ${item.document}
        </div>
        
        <div class="grid grid-cols-2 gap-3 mt-3 border-t border-gray-100 pt-3">
            <button class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 text-xs font-black py-3 rounded-xl uppercase transition-all flex justify-center items-center gap-2 shadow-sm" onclick="adminCancelTicket(${item.ticketNumber})">
                <i class="fas fa-trash-alt"></i> Cancel
            </button>
            ${isLive ? `
                <button class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-3 rounded-xl uppercase transition-all flex justify-center items-center gap-2 shadow-md border-b-4 border-blue-800 active:border-b-0 active:translate-y-1" onclick="socket.emit('callNext', {counterId: 1});">
                    <i class="fas fa-bullhorn"></i> Call C1
                </button>
            ` : `
                <button class="bg-gray-100 text-gray-400 text-xs font-black py-3 rounded-xl uppercase flex justify-center items-center gap-2 cursor-not-allowed shadow-inner">
                    <i class="fas fa-clock"></i> Waiting
                </button>
            `}
        </div>
    `;
    return el;
}

socket.on('queueUpdated', (state) => {
    
    const freezeBtn = document.getElementById('btn-freeze-system');
    if (state.isFrozen) {
        freezeBtn.className = "w-full bg-blue-600 text-white font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest border-2 border-blue-800 flex items-center justify-center gap-2 animate-pulse";
        freezeBtn.innerHTML = '<i class="fas fa-play"></i> UNFREEZE SYSTEM';
        
        document.getElementById('btn-call-1').disabled = true;
        document.getElementById('btn-call-1').classList.add('opacity-50', 'cursor-not-allowed');
        document.getElementById('btn-call-2').disabled = true;
        document.getElementById('btn-call-2').classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        freezeBtn.className = "w-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest border-2 border-blue-200 flex items-center justify-center gap-2";
        freezeBtn.innerHTML = '<i class="fas fa-snowflake"></i> FREEZE SYSTEM';
    }
    const c1 = state.counters.find(c => c.id === 1);
    const c2 = state.counters.find(c => c.id === 2);

    const btnCall1 = document.getElementById('btn-call-1');
    const toggleC1 = document.getElementById('btn-toggle-c1');
    const resC1 = document.getElementById('c1-resolution');

    if (c1.isActive) {
        toggleC1.className = "text-sm font-bold bg-white/80 px-4 py-1.5 rounded-full transition-colors hover:bg-white text-black shadow-sm flex items-center";
        toggleC1.innerHTML = '<i class="fas fa-power-off mr-2 text-green-600"></i> Active';
        
        document.getElementById('c1-ticket').innerText = c1.currentTicket ? formatTicket(c1.currentTicket, c1.currentCategory) : "----";
        document.getElementById('c1-name').innerText = c1.currentName ? `Name: ${c1.currentName}` : "Name: ---";
        document.getElementById('c1-doc').innerText = c1.currentDocument || "WAITING";
        document.getElementById('c1-doc').className = "text-xs font-bold text-[#071c4d] bg-[#FFD500] px-5 py-2.5 rounded-xl mb-4 uppercase tracking-widest shadow-md";

        if (c1.currentTicket) {
            btnCall1.classList.add('hidden');
            if(resC1) resC1.classList.remove('hidden');
        } else {
            btnCall1.classList.remove('hidden');
            btnCall1.disabled = false;
            btnCall1.classList.remove('opacity-50', 'cursor-not-allowed');
            if(resC1) resC1.classList.add('hidden');
        }
    } else {
        toggleC1.className = "text-sm font-bold bg-red-600 text-white px-4 py-1.5 rounded-full transition-colors hover:bg-red-700 shadow-inner flex items-center";
        toggleC1.innerHTML = '<i class="fas fa-power-off mr-2 text-white"></i> Offline';
        btnCall1.classList.remove('hidden');
        btnCall1.disabled = true;
        btnCall1.classList.add('opacity-50', 'cursor-not-allowed');
        if(resC1) resC1.classList.add('hidden');
        document.getElementById('c1-ticket').innerText = "----";
        document.getElementById('c1-name').innerText = "Name: ---";
        document.getElementById('c1-doc').innerText = "OFFLINE";
        document.getElementById('c1-doc').className = "text-xs font-bold text-white bg-red-600 px-5 py-2.5 rounded-xl mb-4 uppercase tracking-widest shadow-inner";
    }

    const btnCall2 = document.getElementById('btn-call-2');
    const toggleC2 = document.getElementById('btn-toggle-c2');
    const resC2 = document.getElementById('c2-resolution');
    
    if (c2.isActive) {
        toggleC2.className = "text-sm font-bold bg-white/80 px-4 py-1.5 rounded-full transition-colors hover:bg-white text-black shadow-sm flex items-center";
        toggleC2.innerHTML = '<i class="fas fa-power-off mr-2 text-green-600"></i> Active';
        
        document.getElementById('c2-ticket').innerText = c2.currentTicket ? formatTicket(c2.currentTicket, c2.currentCategory) : "----";
        document.getElementById('c2-name').innerText = c2.currentName ? `Name: ${c2.currentName}` : "Name: ---";
        document.getElementById('c2-doc').innerText = c2.currentDocument || "WAITING";
        document.getElementById('c2-doc').className = "text-xs font-bold text-[#071c4d] bg-[#FFD500] px-5 py-2.5 rounded-xl mb-4 uppercase tracking-widest shadow-md";

        if (c2.currentTicket) {
            btnCall2.classList.add('hidden');
            if(resC2) resC2.classList.remove('hidden');
        } else {
            btnCall2.classList.remove('hidden');
            btnCall2.disabled = false;
            btnCall2.classList.remove('opacity-50', 'cursor-not-allowed');
            if(resC2) resC2.classList.add('hidden');
        }
    } else {
        toggleC2.className = "text-sm font-bold bg-red-600 text-white px-4 py-1.5 rounded-full transition-colors hover:bg-red-700 shadow-inner flex items-center";
        toggleC2.innerHTML = '<i class="fas fa-power-off mr-2 text-white"></i> Offline';
        btnCall2.classList.remove('hidden');
        btnCall2.disabled = true;
        btnCall2.classList.add('opacity-50', 'cursor-not-allowed');
        if(resC2) resC2.classList.add('hidden');
        document.getElementById('c2-ticket').innerText = "----";
        document.getElementById('c2-name').innerText = "Name: ---";
        document.getElementById('c2-doc').innerText = "OFFLINE";
        document.getElementById('c2-doc').className = "text-xs font-bold text-white bg-red-600 px-5 py-2.5 rounded-xl mb-4 uppercase tracking-widest shadow-inner";
    }
    
    document.getElementById('admin-waiting-count').innerText = state.waitingList.length;
    document.getElementById('header-waiting-count').innerText = state.waitingList.length;
    document.getElementById('ticker-input').placeholder = state.tickerText;
    
    const docSelect = document.getElementById('admin-document');
    const matrixSelect = document.getElementById('matrix-service-select');
    
    const currentMatrixVal = matrixSelect.value;
    
    docSelect.innerHTML = '';
    matrixSelect.innerHTML = '';
    
    state.services.forEach(s => {
        const opt1 = document.createElement('option');
        opt1.value = s.name;
        opt1.innerText = s.name;
        docSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = s.name;
        opt2.innerText = s.name;
        matrixSelect.appendChild(opt2);
    });

    if(currentMatrixVal && state.services.find(s => s.name === currentMatrixVal)) {
        matrixSelect.value = currentMatrixVal;
    } else if (state.services.length > 0) {
        renderMatrixDays(state.services[0].name);
    }

    const toggleContainer = document.getElementById('service-toggles');
    toggleContainer.innerHTML = '';
    state.services.forEach(service => {
        const isOff = state.disabledServices.includes(service.name);
        const colorClass = isOff ? 'bg-gray-300' : 'bg-green-500';
        const textClass = isOff ? 'text-gray-400 line-through' : 'text-[#071c4d]';
        const knobClass = isOff ? 'bg-white left-[2px]' : 'bg-white left-[22px]';
        
        const el = document.createElement('div');
        el.className = 'flex justify-between items-center p-3 bg-white hover:bg-gray-50 rounded-lg shrink-0 border border-gray-200 transition-colors shadow-sm';
        el.innerHTML = `
            <span class="text-[10px] font-black ${textClass} truncate pr-2 uppercase">${service.name}</span>
            <button class="shrink-0 w-11 h-6 rounded-full ${colorClass} transition-colors relative shadow-inner" onclick="socket.emit('toggleService', '${service.name}')">
                <div class="w-5 h-5 rounded-full absolute top-[2px] transition-all ${knobClass} shadow-md"></div>
            </button>
        `;
        toggleContainer.appendChild(el);
    });

    const listContainer = document.getElementById('admin-waiting-list');
    listContainer.innerHTML = '';
    if (state.waitingList.length === 0) {
        listContainer.innerHTML = '<div class="h-full flex items-center justify-center text-gray-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-inbox mr-2 text-xl opacity-50"></i> Queue is empty</div>';
    } else {
        state.waitingList.forEach(item => listContainer.appendChild(createTicketCard(item, true)));
    }

    const appointmentList = state.appointments || [];
    document.getElementById('admin-appointment-count').innerText = appointmentList.length;
    const apptContainer = document.getElementById('admin-appointment-list');
    apptContainer.innerHTML = '';
    if (appointmentList.length === 0) {
        apptContainer.innerHTML = '<div class="h-full flex items-center justify-center text-gray-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-calendar-times mr-2 text-xl opacity-50"></i> No future appointments</div>';
    } else {
        appointmentList.forEach(item => apptContainer.appendChild(createTicketCard(item, false)));
    }
});