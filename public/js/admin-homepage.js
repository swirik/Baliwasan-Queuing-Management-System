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
}
setInterval(updatePortalClock, 1000);
updatePortalClock();