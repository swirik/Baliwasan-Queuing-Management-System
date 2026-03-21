
const locations = [
    { name: "San Jose Road", category: "road", icon: "🛣️", description: "Major thoroughfare" },
    { name: "Ranches Drive", category: "road", icon: "🏘️", description: "Residential area" },
    { name: "Aquino Drive", category: "road", icon: "🛣️", description: "Main road" },
    { name: "Arizonas Drive", category: "road", icon: "🛣️", description: "Residential area" },
    { name: "Zamboanga International Airport Rd", category: "airport", icon: "✈️", description: "Airport access road" },
    { name: "Garden Orchid Hotel & Resort Corp.", category: "hotel", icon: "🏨", description: "Hotel and resort" },
    { name: "Claret School of Zamboanga City", category: "school", icon: "📚", description: "Educational institution" },
    { name: "Marcian Gar", category: "business", icon: "⛽", description: "Gas station" },
    { name: "Denni's Coffee Garden", category: "food", icon: "☕", description: "Coffee shop" }
];


function populateLandmarks() {
    const landmarksList = document.getElementById('landmarks-list');
    if (landmarksList) {
        landmarksList.innerHTML = locations.map(loc => `
            <div class="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-all cursor-pointer landmark-item" data-name="${loc.name}">
                <span class="text-yellow-400 text-xl">${loc.icon}</span>
                <div>
                    <span class="font-medium">${loc.name}</span>
                    <p class="text-xs text-gray-300">${loc.description}</p>
                </div>
            </div>
        `).join('');
    }
}


function setupSearch() {
    const searchInput = document.getElementById('landmark-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.landmark-item');
            
            items.forEach(item => {
                const name = item.dataset.name.toLowerCase();
                item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populateLandmarks();
    setupSearch();
});