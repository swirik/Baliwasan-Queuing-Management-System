function logout() {
    if (confirm('Are you sure you want to logout?')) {
        
        window.location.href = 'admin-login.html'; }
}

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


document.addEventListener('DOMContentLoaded', function() {
    updatePortalClock();
    setInterval(updatePortalClock, 1000);
    
    const emergencyBtn = document.querySelector('.bg-gradient-to-r.from-red-600 .bg-white');
    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if(confirm('Send emergency alert to all citizens?')) {
                alert('Emergency alert sent!');
            }
        });
    }

    const downloadButtons = document.querySelectorAll('.bg-red-500, .bg-green-600');
    downloadButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Downloading transaction logs...');
        });
    });

    const ticketSection = document.querySelector('[class*="from-yellow-500"]')?.closest('.bg-white');
    if (ticketSection) {
        const serveButtons = ticketSection.querySelectorAll('.bg-green-500');
        const holdButtons = ticketSection.querySelectorAll('.bg-gray-200');
        const callButtons = ticketSection.querySelectorAll('.bg-yellow-400');
        
        serveButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                alert('Serving ticket...');
            });
        });
        
        holdButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                alert('Holding ticket...');
            });
        });
        
        callButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                alert('Calling ticket...');
            });
        });
    }

    const generateBtn = document.querySelector('.bg-\\[\\#071c4d\\]');
    if (generateBtn) {
        generateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Generating new ticket...');
        });
    }
});