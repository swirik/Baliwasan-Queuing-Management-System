const socket = io();

const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', dateOptions);

document.getElementById('btn-export-data').addEventListener('click', () => {
    window.open('/export', '_blank');
});

socket.emit('getAnalytics');

socket.on('analyticsData', (data) => {
    document.getElementById('stat-total').innerText = data.total;
    document.getElementById('stat-pwd').innerText = data.pwdCount;
    
    const servicesContainer = document.getElementById('stat-services');
    servicesContainer.innerHTML = '';
    
    if (!data.topServices || data.topServices.length === 0) {
        servicesContainer.innerHTML = '<div class="text-center py-10 text-gray-400 font-medium uppercase text-sm tracking-widest">No data collected yet today</div>';
        return;
    }

    const maxCount = data.topServices[0].count;
    
    data.topServices.forEach(srv => {
        const widthPercent = Math.max((srv.count / maxCount) * 100, 10);
        const el = document.createElement('div');
        el.className = 'flex flex-col gap-2 w-full';
        el.innerHTML = `
            <div class="flex justify-between items-end text-sm font-bold text-gray-700 uppercase tracking-wide">
                <span>${srv.name}</span>
                <span class="text-black font-black text-lg">${srv.count}</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div class="bg-[#FFD500] h-4 rounded-full border-r-2 border-black transition-all duration-1000" style="width: ${widthPercent}%"></div>
            </div>
        `;
        servicesContainer.appendChild(el);
    });
});