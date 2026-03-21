function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
    const selectedSection = document.getElementById('section-' + sectionName);
    if (selectedSection) selectedSection.classList.remove('hidden');
    
    const titles = {
        'dashboard': 'Dashboard', 'profiling': 'Resident Profiling', 'employment': 'Employment Tracking',
        'employers': 'Employers', 'cdsp': 'CDSP', 'livelihood': 'Livelihood',
        'accreditation': 'Accreditation', 'skills': 'Skills Training', 'reports': 'Reports', 'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titles[sectionName] || 'Dashboard';
    
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active', 'bg-yellow-400', 'text-[#071c4d]', 'font-bold');
        item.classList.add('text-white/80');
    });
    
    const activeButton = document.getElementById('nav-' + sectionName);
    if (activeButton) {
        activeButton.classList.add('active', 'bg-yellow-400', 'text-[#071c4d]', 'font-bold');
        activeButton.classList.remove('text-white/80');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('enrollmentChart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'],
                datasets: [{
                    label: 'Beneficiaries',
                    data: [4, 8, 12, 16, 20],
                    borderColor: '#071c4d',
                    backgroundColor: 'rgba(7, 28, 77, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 20 } } }
        });
    }

    const ageCtx = document.getElementById('ageChart')?.getContext('2d');
    if (ageCtx) {
        new Chart(ageCtx, {
            type: 'bar',
            data: {
                labels: ['18-25', '26-35', '36-45', '46-55', '56+'],
                datasets: [{
                    label: 'Number of Residents',
                    data: [28, 42, 35, 24, 27],
                    backgroundColor: '#054E98',
                    borderRadius: 6
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    const eduCtx = document.getElementById('educationChart')?.getContext('2d');
    if (eduCtx) {
        new Chart(eduCtx, {
            type: 'doughnut',
            data: {
                labels: ['Elementary', 'High School', 'College', 'Vocational'],
                datasets: [{
                    data: [24, 18, 12, 10],
                    backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const employmentCtx = document.getElementById('employmentTrendChart')?.getContext('2d');
    if (employmentCtx) {
        new Chart(employmentCtx, {
            type: 'line',
            data: {
                labels: ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'],
                datasets: [
                    { label: 'Employed', data: [45, 52, 58, 64, 78], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: false },
                    { label: 'Unemployed', data: [28, 32, 35, 38, 42], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }

    document.querySelector('.bg-gradient-to-r button')?.addEventListener('click', function() {
        if(confirm('Send emergency alert to all citizens?')) alert('Emergency alert sent!');
    });

    updatePortalClock();
    setInterval(updatePortalClock, 1000);
    showSection('dashboard');
});
const cdspCtx = document.getElementById('cdspEnrollmentChart')?.getContext('2d');
if (cdspCtx) {
    new Chart(cdspCtx, {
        type: 'line',
        data: {
            labels: ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'],
            datasets: [{
                label: 'Beneficiaries',
                data: [4, 8, 12, 16, 20],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 20,
                    grid: { display: true }
                }
            }
        }
    });
}

const barangayCtx = document.getElementById('barangayChart')?.getContext('2d');
if (barangayCtx) {
    new Chart(barangayCtx, {
        type: 'bar',
        data: {
            labels: ['Baliwasan Grande', 'Manggal', 'Acacia Drive', 'Seaside', 'Tabuk', 'Lemon Drive', 'Newslane', 'Monseratt', 'Aquino', 'Ranchez'],
            datasets: [{
                label: 'Number of Beneficiaries',
                data: [8, 7, 6, 6, 5, 5, 4, 4, 3, 2],
                backgroundColor: '#f59e0b',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 10,
                    grid: { display: true }
                }
            }
        }
    });
}

const programCtx = document.getElementById('programTypeChart')?.getContext('2d');
if (programCtx) {
    new Chart(programCtx, {
        type: 'doughnut',
        data: {
            labels: ['Small Business', 'Agricultural', 'Fishery', 'Handicraft', 'Food Processing', 'Livestock'],
            datasets: [{
                data: [4, 3, 2, 2, 1, 1],
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

const accreditationCtx = document.getElementById('accreditationTrendChart')?.getContext('2d');
if (accreditationCtx) {
    new Chart(accreditationCtx, {
        type: 'line',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [
                {
                    label: 'Applications',
                    data: [18, 22, 25, 28, 32, 31],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 40,
                    grid: { display: true }
                }
            }
        }
    });
}

const categoryCtx = document.getElementById('trainingCategoryChart')?.getContext('2d');
if (categoryCtx) {
    new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['Technical', 'Vocational', 'Digital Skills', 'Entrepreneurship', 'Agriculture', 'Healthcare'],
            datasets: [{
                data: [5, 4, 3, 2, 3, 1],
                backgroundColor: ['#f59e0b', '#10981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}


const monthlyCtx = document.getElementById('monthlyEnrollmentChart')?.getContext('2d');
if (monthlyCtx) {
    new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'New Enrollees',
                data: [24, 32, 45, 38, 28, 18],
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 50,
                    grid: { display: true }
                }
            }
        }
    });
}