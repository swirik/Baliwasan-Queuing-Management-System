function updatePortalClock() {
    const now = new Date();
    const options = { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true
    };
    const clockElement = document.getElementById('portal-clock');
    if (clockElement) {
        clockElement.innerText = now.toLocaleString('en-US', options);
    }
    
    const todayElement = document.getElementById('today-date');
    if (todayElement) {
        todayElement.innerText = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updatePortalClock();
    setInterval(updatePortalClock, 1000);
});