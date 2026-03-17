const socket = io();
const waitingListContainer = document.getElementById('waiting-list-container');
const waitingCount = document.getElementById('waiting-count');
const dateDisplay = document.getElementById('clock-date');
const timeDisplay = document.getElementById('clock-time');
const mediaContainer = document.getElementById('media-container');
const displayTicket = document.getElementById('current-ticket');
const displayCounter = document.getElementById('current-counter');
const displayDoc = document.getElementById('current-doc');
const tickerDisplay = document.getElementById('scrolling-ticker');
const servingRow = document.getElementById('currently-serving-row');

const chimeSound = new Audio('/media/chime.mp3');
let currentMediaUrl = '';
let currentlyServingTicket = null;

function formatTicket(num, doc) {
    if (!num) return "----";
    let prefix = "TK";
    if(doc === 'Ayuda / Cash Assistance') prefix = 'ACA';
    else if(doc === 'Barangay Clearance') prefix = 'BC';
    else if(doc === 'Barangay ID') prefix = 'BI';
    else if(doc === 'Building and Fencing Permit') prefix = 'BFP';
    else if(doc === 'Business Clearance/Permit') prefix = 'BCP';
    else if(doc === 'Certificate of Indigency') prefix = 'CI';
    else if(doc === 'Certificate of Residency') prefix = 'CR';
    else if(doc === 'First Time Jobseeker') prefix = 'FTJ';
    else if(doc === 'Fit to Work Certificate') prefix = 'FWC';
    else if(doc === 'Solo Parent Certification') prefix = 'SPC';
    return prefix + num.toString().padStart(3, '0');
}

document.body.addEventListener('click', () => {
    chimeSound.play().then(() => {
        chimeSound.pause();
        chimeSound.currentTime = 0;
    }).catch(err => console.log(err));
}, { once: true });

socket.on('queueUpdated', (state) => {
    
    tickerDisplay.innerText = state.tickerText || "WELCOME TO BARANGAY BALIWASAN";

    servingRow.innerHTML = '';
    state.counters.forEach(c => {
        const tNum = c.currentTicket ? formatTicket(c.currentTicket, c.currentDocument) : '----';
        const doc = c.currentDocument !== 'SYSTEM STANDBY' ? c.currentDocument : 'Available';
        
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center justify-center bg-[#FFF9E2] px-8 py-2 rounded-2xl border-2 border-[#FFD500] shadow-sm min-w-[250px]';
        el.innerHTML = `
            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">COUNTER ${c.id} &bull; <span class="truncate max-w-[150px] inline-block align-bottom">${doc}</span></span>
            <span class="text-3xl font-black text-gray-900 leading-none">${tNum}</span>
        `;
        servingRow.appendChild(el);
    });

    if (!state.lastCalled || state.lastCalled.ticket === null) {
        displayTicket.innerText = "----";
        displayCounter.innerText = "--";
        displayDoc.innerText = "SYSTEM STANDBY";
        currentlyServingTicket = null;
    } else {
        
        if (state.lastCalled.ticket !== currentlyServingTicket) {
            currentlyServingTicket = state.lastCalled.ticket;

            displayTicket.innerText = formatTicket(state.lastCalled.ticket, state.lastCalled.document);

            displayTicket.classList.remove('is-blinking');
            void displayTicket.offsetWidth;
            displayTicket.classList.add('is-blinking');

            chimeSound.currentTime = 0;
            chimeSound.play().catch(e => console.log(e));

            const formattedTicket = formatTicket(state.lastCalled.ticket, state.lastCalled.document);
            const spokenTicket = formattedTicket.split('').join(' ');
            
            const utterance = new SpeechSynthesisUtterance(`Ticket number, ${spokenTicket}, please proceed to counter ${state.lastCalled.counter}`);
            utterance.rate = 0.85;
            
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else {
            displayTicket.innerText = formatTicket(state.lastCalled.ticket, state.lastCalled.document);
        }

        displayCounter.innerText = `COUNTER ${state.lastCalled.counter}`;
        displayDoc.innerText = state.lastCalled.document;
    }

    waitingCount.innerText = state.waitingList.length;

    if (state.waitingList.length === 0) {
        waitingListContainer.innerHTML = '<div class="w-full text-center text-gray-400 font-bold py-10 uppercase tracking-wider text-sm">Queue is empty</div>';
    } else {
        waitingListContainer.innerHTML = '';
        state.waitingList.forEach((item) => {
            const badgeColor = item.priority === 'PWD / SENIOR' ? 'bg-black text-[#FFD500] border-gray-800' : 'bg-[#FFF394] text-black border-[#FFE761]';
            
            const el = document.createElement('div');
            el.className = 'bg-white border-l-8 border-[#FFD500] rounded-xl p-3 shadow-sm flex justify-between items-center';
            el.innerHTML = `
                <div>
                    <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket</span>
                    <span class="block text-2xl font-black text-gray-900">${formatTicket(item.ticketNumber, item.document)}</span>
                </div>
                <div class="text-right flex flex-col items-end gap-1 w-2/3">
                    <span class="block text-[9px] font-black uppercase ${badgeColor} px-2 py-0.5 rounded border">${item.priority}</span>
                    <span class="block text-[10px] font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 truncate w-full text-right">${item.document}</span>
                </div>
            `;
            waitingListContainer.appendChild(el);
        });
    }

    if (state.media && state.media.url !== currentMediaUrl) {
        currentMediaUrl = state.media.url;
        
        if (state.media.type === 'image') {
            mediaContainer.innerHTML = `<img src="${state.media.url}" class="w-full h-full object-cover">`;
        } else if (state.media.type === 'video') {
            mediaContainer.innerHTML = `<video src="${state.media.url}" class="w-full h-full object-cover" autoplay loop muted></video>`;
        } else if (state.media.type === 'youtube') {
            const videoIdMatch = state.media.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : '';
            mediaContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}" class="w-full h-full pointer-events-none" frameborder="0" allow="autoplay; fullscreen"></iframe>`;
        } else {
            mediaContainer.innerHTML = `<div class="w-full h-full bg-gray-900 flex items-center justify-center text-[#FFD500] font-black text-4xl uppercase opacity-20">Standby Media</div>`;
        }
    }
});

function updateClock() {
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    dateDisplay.innerText = now.toLocaleDateString('en-US', dateOptions);
    timeDisplay.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

setInterval(updateClock, 1000);
updateClock();