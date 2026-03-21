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
});

function showSlide(carouselId, index) {
    let slides = carousels[carouselId].slides;
    let indicators = carousels[carouselId].indicators;
    
    if (!slides.length) return;
    
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    
    slides.forEach(slide => {
        slide.style.opacity = '0';
    });
    
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