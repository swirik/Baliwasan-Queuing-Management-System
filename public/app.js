const socket = io();
const displayTicket = document.getElementById('current-ticket');
const displayCategory = document.getElementById('current-category');
const waitingListContainer = document.getElementById('waiting-list-container');
const waitingCount = document.getElementById('waiting-count');
const dateDisplay = document.getElementById('date-display');
const timeDisplay = document.getElementById('time-display');

socket.on('queueUpdated', (state) => {
    if (state.currentTicket === null) {
        displayTicket.innerText = "----";
        displayCategory.innerText = state.currentDocument;
    } else {
        displayTicket.innerText = state.currentTicket.toString().padStart(4, '0');
        displayCategory.innerText = state.currentDocument;
    }

    waitingCount.innerText = state.waitingList.length;

    if (state.waitingList.length === 0) {
        waitingListContainer.innerHTML = '<div class="w-full text-center text-gray-400 font-bold py-10 uppercase tracking-wider">Queue is empty</div>';
    } else {
        waitingListContainer.innerHTML = '';
        state.waitingList.forEach((item) => {
            const badgeColor = item.priority === 'PWD / SENIOR' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-[#FFF394] text-black border-[#FFE761]';
            
            const el = document.createElement('div');
            el.className = 'bg-white border-l-8 border-[#FFD500] rounded-xl p-5 shadow-sm flex justify-between items-center';
            el.innerHTML = `
                <div>
                    <span class="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket</span>
                    <span class="block text-4xl font-black text-gray-900">${item.ticketNumber.toString().padStart(4, '0')}</span>
                </div>
                <div class="text-right flex flex-col items-end gap-1">
                    <span class="block text-[10px] font-black uppercase ${badgeColor} px-2 py-1 rounded border">${item.priority}</span>
                    <span class="block text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">${item.document}</span>
                </div>
            `;
            waitingListContainer.appendChild(el);
        });
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