async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('errorMessage');
    
    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/admin-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            errorDiv.classList.add('hidden');
            window.location.href = '/views/admin-dashboard.html';
        } else {
            showError('Invalid username or password. Please try again.');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        showError('Server error. Please try again later.');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = message;
    errorDiv.classList.remove('hidden');
    
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 3000);
}

window.addEventListener('load', function() {
    document.getElementById('username').focus();
});
