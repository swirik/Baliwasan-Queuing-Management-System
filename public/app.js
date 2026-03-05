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
        displayCategory.innerText = state.currentCategory;
    } else {
        displayTicket.innerText = state.currentTicket.toString().padStart(4, '0');
        displayCategory.innerText = state.currentCategory;
    }

    waitingCount.innerText = state.waitingList.length;

    if (state.waitingList.length === 0) {
        waitingListContainer.innerHTML = '<div class="w-full text-center text-gray-400 font-bold py-10 uppercase tracking-wider">Queue is empty</div>';
    } else {
        waitingListContainer.innerHTML = '';
        state.waitingList.forEach((item) => {
            const el = document.createElement('div');
            el.className = 'bg-white border-l-8 border-[#FFD500] rounded-xl p-5 shadow-sm flex justify-between items-center';
            el.innerHTML = `
                <div>
                    <span class="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket</span>
                    <span class="block text-4xl font-black text-gray-900">${item.ticketNumber.toString().padStart(4, '0')}</span>
                </div>
                <div class="text-right">
                    <span class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</span>
                    <span class="block text-xs font-bold text-black bg-[#FFF394] px-4 py-2 rounded-lg border border-[#FFE761]">${item.category}</span>
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