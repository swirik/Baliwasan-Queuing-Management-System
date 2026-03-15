const socket = io();
const waitingListContainer = document.getElementById('waiting-list-container');
const waitingCount = document.getElementById('waiting-count');
const dateDisplay = document.getElementById('date-display');
const timeDisplay = document.getElementById('time-display');
const mediaContainer = document.getElementById('media-container');

const chimeSound = new Audio('/media/chime.mp3');
let currentMediaUrl = '';
let currentlyServingC1 = null;
let currentlyServingC2 = null;

document.body.addEventListener('click', () => {
    chimeSound.play().then(() => {
        chimeSound.pause();
        chimeSound.currentTime = 0;
    }).catch(err => console.log(err));
}, { once: true });

socket.on('queueUpdated', (state) => {
    const c1 = state.counters.find(c => c.id === 1);
    const c2 = state.counters.find(c => c.id === 2);

    let newlyCalledTicket = null;
    let newlyCalledCounter = null;

    if (c1.currentTicket !== null && c1.currentTicket !== currentlyServingC1) {
        newlyCalledTicket = c1.currentTicket;
        newlyCalledCounter = 1;
        currentlyServingC1 = c1.currentTicket;
    }
    
    if (c2.currentTicket !== null && c2.currentTicket !== currentlyServingC2) {
        newlyCalledTicket = c2.currentTicket;
        newlyCalledCounter = 2;
        currentlyServingC2 = c2.currentTicket;
    }
    
    if (newlyCalledTicket !== null) {
        chimeSound.currentTime = 0;
        chimeSound.play().catch(e => console.log(e));

        const formattedTicket = newlyCalledTicket.toString().padStart(4, '0');
        const spokenTicket = formattedTicket.split('').join(' ');
        
        const utterance = new SpeechSynthesisUtterance(`Ticket number, ${spokenTicket}, please proceed to counter ${newlyCalledCounter}`);
        utterance.rate = 0.85;
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    document.getElementById('c1-ticket').innerText = c1.currentTicket ? c1.currentTicket.toString().padStart(4, '0') : "----";
    document.getElementById('c1-doc').innerText = c1.currentDocument;

    document.getElementById('c2-ticket').innerText = c2.currentTicket ? c2.currentTicket.toString().padStart(4, '0') : "----";
    document.getElementById('c2-doc').innerText = c2.currentDocument;

    waitingCount.innerText = state.waitingList.length;

    if (state.waitingList.length === 0) {
        waitingListContainer.innerHTML = '<div class="w-full text-center text-gray-400 font-bold py-10 uppercase tracking-wider text-sm">Queue is empty</div>';
    } else {
        waitingListContainer.innerHTML = '';
        state.waitingList.forEach((item) => {
            const badgeColor = item.priority === 'PWD / SENIOR' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-[#FFF394] text-black border-[#FFE761]';
            
            const el = document.createElement('div');
            el.className = 'bg-gray-50 border-l-8 border-[#FFD500] rounded-xl p-3 shadow-sm flex justify-between items-center';
            el.innerHTML = `
                <div>
                    <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket</span>
                    <span class="block text-2xl font-black text-gray-900">${item.ticketNumber.toString().padStart(4, '0')}</span>
                </div>
                <div class="text-right flex flex-col items-end gap-1 w-2/3">
                    <span class="block text-[9px] font-black uppercase ${badgeColor} px-2 py-0.5 rounded border">${item.priority}</span>
                    <span class="block text-[10px] font-bold text-gray-600 bg-white px-2 py-1 rounded-md border border-gray-200 truncate w-full text-right">${item.document}</span>
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