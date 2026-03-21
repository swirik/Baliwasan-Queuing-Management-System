function formatTicket(num, cat) {
    if (!num) return "----";
    const prefix = cat ? cat : "M";
    return `${prefix}-${num.toString().padStart(3, '0')}`;
}

function updateGlobalClocks() {
    const now = new Date();
    
    const portalClock = document.getElementById('portal-clock');
    if (portalClock) {
        portalClock.innerText = now.toLocaleString('en-US', { 
            month: 'long', day: 'numeric', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
        });
    }

    const dateDisplay = document.getElementById('clock-date');
    const timeDisplay = document.getElementById('clock-time');
    if (dateDisplay && timeDisplay) {
        dateDisplay.innerText = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        timeDisplay.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const todayElement = document.getElementById('today-date');
    if (todayElement) {
        todayElement.innerText = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    
    const analyticsDate = document.getElementById('current-date-display');
    if (analyticsDate) {
        analyticsDate.innerText = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
}

setInterval(updateGlobalClocks, 1000);
document.addEventListener('DOMContentLoaded', updateGlobalClocks);

function openDirections() {
    const latitude = 6.9157146;
    const longitude = 122.0600172;
    window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
        '_blank'
    );
}