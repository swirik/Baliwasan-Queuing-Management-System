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

function openDirections() {

const latitude = 6.9157146;
const longitude = 122.0600172;
const locationName = "Barangay Baliwasan, 550 San Jose Road, Zamboanga City";


window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(locationName)}&travelmode=driving`,
    '_blank'
);
}