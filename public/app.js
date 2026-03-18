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

function formatTicket(num, cat) {
    if (!num) return "----";
    const prefix = cat ? cat : "M";
    return `${prefix}-${num.toString().padStart(3, '0')}`;
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
        if(!c.isActive) return; // Skip offline counters
        
        const tNum = c.currentTicket ? formatTicket(c.currentTicket, c.currentCategory) : '----';
        const doc = c.currentDocument !== 'SYSTEM STANDBY' ? c.currentDocument : 'Available';
        
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center justify-center bg-white px-8 py-3 rounded-2xl border-l-8 border-[#FFD500] shadow-md min-w-[280px] transition-all hover:shadow-lg';
        el.innerHTML = `
            <span class="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">COUNTER ${c.id} &bull; <span class="truncate max-w-[150px] inline-block align-bottom text-[#071c4d]">${doc}</span></span>
            <span class="text-5xl font-black text-[#071c4d] leading-none">${tNum}</span>
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

            displayTicket.innerText = formatTicket(state.lastCalled.ticket, state.lastCalled.category);

            displayTicket.classList.remove('is-blinking');
            void displayTicket.offsetWidth;
            displayTicket.classList.add('is-blinking');

            chimeSound.currentTime = 0;
            chimeSound.play().catch(e => console.log(e));

            const formattedTicket = formatTicket(state.lastCalled.ticket, state.lastCalled.category);
            const spokenTicket = formattedTicket.split('').join(' ');
            
            const utterance = new SpeechSynthesisUtterance(`Ticket number, ${spokenTicket}, please proceed to counter ${state.lastCalled.counter}`);
            utterance.rate = 0.85;
            
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else {
            displayTicket.innerText = formatTicket(state.lastCalled.ticket, state.lastCalled.category);
        }

        displayCounter.innerText = `COUNTER ${state.lastCalled.counter}`;
        displayDoc.innerText = state.lastCalled.document;
    }

    waitingCount.innerText = state.waitingList.length;

    if (state.waitingList.length === 0) {
        waitingListContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 font-bold py-10 uppercase tracking-wider text-sm">Queue is empty</div>';
    } else {
        waitingListContainer.innerHTML = '';
        state.waitingList.forEach((item) => {
            const badgeColor = item.priority === 'PWD / Senior / Pregnant' ? 'bg-[#071c4d] text-[#FFD500] border-[#071c4d]' : 'bg-gray-100 text-gray-600 border-gray-200';
            
            const el = document.createElement('div');
            el.className = 'bg-white border-l-4 border-[#071c4d] rounded-xl p-4 shadow-sm flex justify-between items-center transition-all hover:shadow-md hover:border-[#FFD500]';
            el.innerHTML = `
                <div>
                    <span class="block text-3xl font-black text-[#071c4d] leading-none mb-1">${formatTicket(item.ticketNumber, item.category)}</span>
                    <span class="block text-[10px] font-bold text-gray-500 uppercase truncate max-w-[200px]">${item.document}</span>
                </div>
                <div class="text-right flex flex-col items-end justify-center">
                    <span class="block text-[9px] font-black uppercase ${badgeColor} px-2 py-1 rounded shadow-sm">${item.priority}</span>
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