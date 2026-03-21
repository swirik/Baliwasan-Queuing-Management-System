let isAdmin = false;
let currentEditElement = null;
let currentEditType = 'text';

function checkAdminPassword() {
    const password = document.getElementById('adminPassword').value;
    if (password === 'admin123') {
        isAdmin = true;
        document.body.classList.add('edit-mode');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        hideAdminBar();
        alert('Admin mode activated! You can now edit content by hovering and clicking on elements.');
    } else {
        alert('Incorrect password');
    }
}

function showAdminLogin() {
    document.getElementById('adminLoginBar').classList.add('show');
}

function hideAdminBar() {
    document.getElementById('adminLoginBar').classList.remove('show');
}

function toggleEditMode() {
    if (!isAdmin) {
        showAdminLogin();
        return;
    }
    
    document.body.classList.toggle('edit-mode');
    const btn = document.getElementById('editModeBtn');
    if (document.body.classList.contains('edit-mode')) {
        btn.style.background = '#eab308';
        btn.style.color = '#071c4d';
    } else {
        btn.style.background = '#071c4d';
        btn.style.color = 'white';
    }
}

document.addEventListener('click', function(e) {
    if (!isAdmin || !document.body.classList.contains('edit-mode')) return;
    
    const editable = e.target.closest('.editable, .editable-image');
    if (editable) {
        e.preventDefault();
        openEditModal(editable);
    }
});

function openEditModal(element) {
    currentEditElement = element;
    
    if (element.classList.contains('editable-image') || element.dataset.type === 'image') {
        currentEditType = 'image';
        document.getElementById('textEditSection').classList.add('hidden');
        document.getElementById('imageEditSection').classList.remove('hidden');
        
        let imgSrc = '';
        if (element.tagName === 'IMG') {
            imgSrc = element.src;
        } else if (element.style.backgroundImage) {
            imgSrc = element.style.backgroundImage.slice(5, -2);
        }
        
        document.getElementById('imagePreview').style.backgroundImage = `url('${imgSrc}')`;
        document.getElementById('editImageInput').value = imgSrc;
        
    } else {
        currentEditType = 'text';
        document.getElementById('textEditSection').classList.remove('hidden');
        document.getElementById('imageEditSection').classList.add('hidden');
        
        const currentText = element.innerText;
        
        if (element.dataset.type === 'textarea' || element.tagName === 'P' || element.tagName === 'DIV') {
            document.getElementById('editTextInput').classList.add('hidden');
            document.getElementById('editTextareaInput').classList.remove('hidden');
            document.getElementById('editTextareaInput').value = currentText;
        } else {
            document.getElementById('editTextInput').classList.remove('hidden');
            document.getElementById('editTextareaInput').classList.add('hidden');
            document.getElementById('editTextInput').value = currentText;
        }
    }
    
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('editModal').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('editModal').classList.remove('show');
    currentEditElement = null;
}

function saveEdit() {
    if (!currentEditElement) return;
    
    if (currentEditType === 'image') {
        const newImageUrl = document.getElementById('editImageInput').value;
        
        if (currentEditElement.tagName === 'IMG') {
            currentEditElement.src = newImageUrl;
        } else if (currentEditElement.style) {
            currentEditElement.style.backgroundImage = `url('${newImageUrl}')`;
        }
        
    } else {
        let newText;
        if (document.getElementById('editTextInput').classList.contains('hidden')) {
            newText = document.getElementById('editTextareaInput').value;
        } else {
            newText = document.getElementById('editTextInput').value;
        }
        
        if (currentEditElement.querySelector('span') && !newText.includes('<span')) {
            const span = currentEditElement.querySelector('span');
            if (span) {
                const spanHTML = span.outerHTML;
                currentEditElement.innerHTML = newText + ' ' + spanHTML;
            } else {
                currentEditElement.innerText = newText;
            }
        } else {
            currentEditElement.innerHTML = newText;
        }
    }
    
    closeModal();
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').style.backgroundImage = `url('${e.target.result}')`;
            document.getElementById('editImageInput').value = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function editNewsItem(index) {
    alert('Edit news item ' + index);
}

function deleteNewsItem(index) {
    if (confirm('Are you sure you want to delete this news item?')) {
        event.target.closest('.bg-white.rounded-3xl').remove();
    }
}

function addImageToNews(index) {
    alert('Add image to news item ' + index);
}

function editRelatedCard(index) {
    alert('Edit related card ' + index);
}

function deleteRelatedCard(index) {
    if (confirm('Are you sure you want to delete this card?')) {
        event.target.closest('.bg-white.rounded-xl').remove();
    }
}

function addNewNews() {
    alert('Add new news item - This would open a form to create new content');
}

function saveAllChanges() {
    const editedData = {};
    
    document.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (el.tagName === 'IMG') {
            editedData[field] = el.src;
        } else if (el.style.backgroundImage) {
            editedData[field] = el.style.backgroundImage;
        } else {
            editedData[field] = el.innerText;
        }
    });
    
    localStorage.setItem('barangayContent', JSON.stringify(editedData));
    alert('Changes saved locally!');
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
    
    document.getElementById('portal-clock').innerText = now.toLocaleString('en-US', options);
}

let carousels = [
    { slides: [], indicators: [], currentIndex: 0 },
    { slides: [], indicators: [], currentIndex: 0 },
    { slides: [], indicators: [], currentIndex: 0 }
];

document.addEventListener('DOMContentLoaded', function() {
    carousels[0].slides = document.querySelectorAll('.carousel-slide');
    carousels[0].indicators = document.querySelectorAll('.carousel-indicator');
    
    carousels[1].slides = document.querySelectorAll('.carousel-slide2');
    carousels[1].indicators = document.querySelectorAll('.carousel-indicator2');
    
    carousels[2].slides = document.querySelectorAll('.carousel-slide3');
    carousels[2].indicators = document.querySelectorAll('.carousel-indicator3');
    
    showSlide(0, 0);
    showSlide(1, 0);
    showSlide(2, 0);
    
    setInterval(() => {
        changeSlide(0, 1);
        changeSlide(1, 1);
        changeSlide(2, 1);
    }, 5000);
    
    const savedContent = localStorage.getItem('barangayContent');
    if (savedContent) {
        const data = JSON.parse(savedContent);
        Object.keys(data).forEach(field => {
            const el = document.querySelector(`[data-field="${field}"]`);
            if (el) {
                if (el.tagName === 'IMG') {
                    el.src = data[field];
                } else if (el.style) {
                    el.innerText = data[field];
                }
            }
        });
    }
});

function showSlide(carouselId, index) {
    let slides = carousels[carouselId].slides;
    let indicators = carousels[carouselId].indicators;
    
    if (!slides.length) return;
    
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    
    slides.forEach(slide => slide.style.opacity = '0');
    slides[index].style.opacity = '1';
    
    indicators.forEach((indicator, i) => {
        if (i === index) {
            indicator.classList.add('bg-white');
            indicator.classList.remove('bg-white/50');
        } else {
            indicator.classList.remove('bg-white');
            indicator.classList.add('bg-white/50');
        }
    });
    
    carousels[carouselId].currentIndex = index;
}

function changeSlide(carouselId, direction) {
    showSlide(carouselId, carousels[carouselId].currentIndex + direction);
}

function currentSlide(carouselId, index) {
    showSlide(carouselId, index);
}

setInterval(updatePortalClock, 1000);
updatePortalClock();