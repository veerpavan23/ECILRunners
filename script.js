// Initialize AOS
AOS.init({
    once: true,
    offset: 50,
});

// Scroll Track Logic
const scrollTrack = document.getElementById('scroll-track');
const scrollRunner = document.getElementById('scroll-runner');
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

const runnerHud = document.getElementById('runner-hud');
const hudPace = document.getElementById('hud-pace');
const hudDist = document.getElementById('hud-dist');
const hudHr = document.getElementById('hud-hr');
let isScrollingTimeout;
const runnerIcon = document.getElementById('runner-icon');
const runnerGif = document.getElementById('runner-gif');
const runnerCanvas = document.getElementById('runner-canvas');
const ctx = runnerCanvas ? runnerCanvas.getContext('2d') : null;

let cachedDocHeight = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight,
    document.body.offsetHeight, document.documentElement.offsetHeight,
    document.body.clientHeight, document.documentElement.clientHeight
) - window.innerHeight;

// Update doc height precisely using ResizeObserver to catch lazy loaded content and AOS changes
const resizeObserver = new ResizeObserver(() => {
    cachedDocHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    ) - window.innerHeight;
});
resizeObserver.observe(document.body);
window.addEventListener('resize', () => {
    cachedDocHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    ) - window.innerHeight;
});


function updateScroll() {
    // Progress Bar
    const scrollTop = window.scrollY;
    const docHeight = cachedDocHeight || 1;
    let scrollPercent = scrollTop / docHeight;
    if (isNaN(scrollPercent)) scrollPercent = 0;
    scrollPercent = Math.max(0, Math.min(1, scrollPercent));
    
    if(scrollTrack && scrollRunner) {
        scrollTrack.style.transform = 'scaleX(' + scrollPercent + ')';
        scrollTrack.style.transformOrigin = 'left';
        
        // Prevent runner from going off-screen.
        const screenWidth = window.innerWidth;
        const maxScrollX = screenWidth - 48;
        const currentX = scrollPercent * maxScrollX;
        scrollRunner.style.transform = 'translate3d(' + currentX + 'px, 0, 0)';
        scrollRunner.style.left = '0';
        
        let velocity = Math.abs(scrollTop - (window.lastScrollTop || 0));

        if (runnerIcon) {
            if (velocity > 0) {
                if (runnerGif && runnerCanvas) {
                    runnerGif.classList.remove('hidden');
                    runnerCanvas.classList.add('hidden');
                }
            }
            
            // Flip runner based on direction
            if (scrollPercent >= 0.99) {
                runnerIcon.style.transform = 'scaleX(-1)';
            } else if (scrollPercent <= 0.01) {
                runnerIcon.style.transform = 'scaleX(1)';
            } else if (scrollTop > (window.lastScrollTop || 0)) {
                runnerIcon.style.transform = 'scaleX(1)';
            } else if (scrollTop < (window.lastScrollTop || 0)) {
                runnerIcon.style.transform = 'scaleX(-1)';
            }
        }

        // HUD Logic
        if (runnerHud) {
            // Only show HUD when actively running between start and finish
            if (scrollPercent > 0.01 && scrollPercent < 0.99) {
                runnerHud.style.opacity = '1';
            } else {
                runnerHud.style.opacity = '0';
            }
            
            // Prevent HUD from going off-screen left/right
        const screenWidth = window.innerWidth;
        const maxScrollX = screenWidth - 48;
        const currentX = scrollPercent * maxScrollX;
        let screenX = 24 + currentX;
            let hudShift = 0;
            if (screenX < 100) hudShift = 100 - screenX; // 100px buffer for left edge
            if (screenX > window.innerWidth - 100) hudShift = (window.innerWidth - 100) - screenX; // 100px buffer for right edge
        runnerHud.style.left = '0';
            runnerHud.style.transform = 'translate3d(calc(' + currentX + 'px - 50% + 24px + ' + hudShift + 'px), -10px, 0)';
            
            // Distance (Assume page is a 10k run)
            let currentDist = (scrollPercent * 10).toFixed(1);
            if (hudDist) {
                hudDist.innerText = currentDist;
            }

            // Pace (changes based on scroll speed)
            let currentPaceStr = "5:30";
            if (hudPace) {
                let paceMinutes = Math.max(3, 8 - (velocity * 0.05));
                let paceSeconds = Math.floor((paceMinutes % 1) * 60).toString().padStart(2, '0');
                currentPaceStr = `${Math.floor(paceMinutes)}:${paceSeconds}`;
                hudPace.innerText = currentPaceStr;
            }

            // Heart Rate
            if (hudHr) {
                let targetHr = Math.min(180, 72 + (velocity * 2));
                let currentHr = parseFloat(hudHr.innerText) || 72;
                hudHr.innerText = Math.floor(currentHr + (targetHr - currentHr) * 0.1);
            }
            
            // Strava Card Updates
            const stravaCard = document.getElementById('strava-card');
            if (stravaCard) {
                if (scrollPercent >= 0.99) {
                    if (!window.stravaClosed) {
                        // Update Strava Stats right before showing
                        document.getElementById('strava-dist').innerText = currentDist;
                        document.getElementById('strava-pace').innerText = currentPaceStr;
                        
                        // Rough time calculation
                        let pMin = parseInt(currentPaceStr.split(':')[0]);
                        let pSec = parseInt(currentPaceStr.split(':')[1]);
                        let totalSeconds = (pMin * 60 + pSec) * parseFloat(currentDist);
                        let tMin = Math.floor(totalSeconds / 60);
                        let tSec = Math.floor(totalSeconds % 60);
                        document.getElementById('strava-time').innerText = `${tMin}m ${tSec}s`;
                        
                        stravaCard.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-8');
                        stravaCard.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
                    }
                } else {
                    // Reset closed state when user scrolls back up
                    window.stravaClosed = false;
                    stravaCard.classList.add('opacity-0', 'pointer-events-none', 'translate-y-8');
                    stravaCard.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
                }
            }
        }
        
        window.lastScrollTop = scrollTop;
    }

    // Active Nav Link
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
}

// Handle Strava Close Button
const closeStravaBtn = document.getElementById('close-strava');
if (closeStravaBtn) {
    closeStravaBtn.addEventListener('click', () => {
        window.stravaClosed = true;
        const stravaCard = document.getElementById('strava-card');
        if (stravaCard) {
            stravaCard.classList.add('opacity-0', 'pointer-events-none', 'translate-y-8');
            stravaCard.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
    });
}

let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            updateScroll();
            ticking = false;
        });
        ticking = true;
    }
    
    // Clear the timeout throughout the scroll
    window.clearTimeout(isScrollingTimeout);

    // Set a timeout to run after scrolling ends
    isScrollingTimeout = setTimeout(function() {
        if (runnerGif && runnerCanvas) {
            if(ctx) { 
                runnerCanvas.width = runnerGif.clientWidth || 38; 
                runnerCanvas.height = runnerGif.clientHeight || 38; 
                ctx.clearRect(0,0,runnerCanvas.width,runnerCanvas.height); 
                ctx.drawImage(runnerGif, 0, 0, runnerCanvas.width, runnerCanvas.height); 
            }
            runnerGif.classList.add('hidden');
            runnerCanvas.classList.remove('hidden');
        }
        if (hudHr) {
            hudHr.innerText = '72'; // Reset HR
        }
    }, 150);
});

window.addEventListener('resize', updateScroll);


// Hero Particle Canvas
const canvas = document.getElementById('particleCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particlesArray = [];

    function initCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', initCanvas);
    initCanvas();

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            const colors = ['#F97316', '#FF9A44', '#f3f4f6', '#e5e7eb', '#d1d5db'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particlesArray = [];
        let numberOfParticles = (canvas.width * canvas.height) / 10000;
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }

    initParticles();
    animateParticles();
}



// Initial draw






function freezeRunner() {
    if (runnerGif && runnerCanvas) {
        runnerGif.classList.add('hidden');
        if(ctx) { 
            runnerCanvas.width = runnerGif.width || 38; 
            runnerCanvas.height = runnerGif.height || 38; 
            ctx.clearRect(0,0,runnerCanvas.width,runnerCanvas.height); 
            ctx.drawImage(runnerGif, 0, 0, runnerCanvas.width, runnerCanvas.height); 
        } 
        runnerCanvas.classList.remove('hidden');
    }
}

if (runnerGif) {
    if (runnerGif.complete) {
        freezeRunner();
    } else {
        runnerGif.addEventListener('load', freezeRunner);
    }
}

// --- SUPABASE INTEGRATION ---
const SUPABASE_URL = 'https://cvehhriirejuffbrowkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadLiveEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient.from('events').select('*').order('created_at', { ascending: false }).limit(3);
        if (error) throw error;
        
        if (data && data.length > 0) {
            container.innerHTML = data.map(ev => `
                <div class="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:-translate-y-2 transition-all duration-300 group">
                    <div class="relative h-48 overflow-hidden">
                        <img src="${ev.image_url || 'assets/events_marathon.jpg'}" alt="Event" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        <div class="absolute top-4 right-4 bg-[#F97316] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-md">
                            ${ev.date}
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex items-center gap-2 text-sm text-[#F97316] font-bold mb-3">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span class="uppercase tracking-wider text-xs">${ev.location}</span>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">${ev.title}</h3>
                        <p class="text-gray-600 text-sm mb-6 line-clamp-2">${ev.description || 'Join us for this amazing ECIL Runners event. See you at the starting line!'}</p>
                        <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                            <span class="font-bold text-gray-900">${ev.price || 'FREE'}</span>
                              <button onclick="rsvpForEvent(${ev.id}, this)" class="bg-[#F97316] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#ea580c] transition-colors">
                                  RSVP
                              </button>
                            <button class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[#F97316] group-hover:text-white transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Failed to fetch live events:", err);
    }
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', () => { loadLiveEvents(); loadLiveGallery(); loadLiveMerch(); });


async function loadLiveGallery() {
    const container = document.getElementById('gallery-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient.from('gallery').select('*').order('order_index', { ascending: true }).order('created_at', { ascending: false });
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Group by album name
            const albums = {};
            data.forEach(photo => {
                if (!albums[photo.album_name]) albums[photo.album_name] = [];
                albums[photo.album_name].push(photo.image_url);
            });

            const albumKeys = Object.keys(albums);

            let slidesHtml = albumKeys.map((albumName, index) => `
                <div class="swiper-slide w-80 sm:w-96">
                    <div class="relative group rounded-2xl overflow-hidden shadow-2xl aspect-[3/4] album-card cursor-pointer" data-album-id="${index}">
                        <img src="${albums[albumName][0]}" class="album-img absolute inset-0 w-full h-full object-cover transition-opacity duration-1000">
                        <img src="" class="album-img-next absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-1000">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10">
                            <div class="absolute bottom-8 left-6 right-6 text-white text-center">
                                <p class="font-bold text-2xl tracking-wide mb-2">${albumName}</p>
                                <p class="text-xs text-gray-300 uppercase tracking-widest">${albums[albumName].length} Photos</p>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            // Force enough slides for an infinite loop if there are only a few albums
            if (albumKeys.length > 0 && albumKeys.length < 6) {
                slidesHtml = slidesHtml + slidesHtml + slidesHtml + slidesHtml + slidesHtml;
            }
            container.innerHTML = slidesHtml;

            // Initialize Swiper for 3D Coverflow
            new Swiper('.gallery-swiper', {
                effect: 'coverflow',
                grabCursor: true,
                centeredSlides: true,
                slidesPerView: 'auto',
                coverflowEffect: {
                    rotate: 0,
                    stretch: -60,
                    depth: 400,
                    modifier: 1,
                    slideShadows: true
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                loop: true
            });

            // Handle automatic photo crossfading within each album
            document.querySelectorAll('.album-card').forEach(card => {
                const albumId = parseInt(card.getAttribute('data-album-id'));
                const photos = albums[albumKeys[albumId]];
                
                if (photos.length > 1) {
                    let currentIndex = 0;
                    const img1 = card.querySelector('.album-img');
                    const img2 = card.querySelector('.album-img-next');
                    let showingImg1 = true;

                    setInterval(() => {
                        currentIndex = (currentIndex + 1) % photos.length;
                        const nextPhoto = photos[currentIndex];

                        if (showingImg1) {
                            img2.src = nextPhoto;
                            img2.classList.remove('opacity-0');
                            img1.classList.add('opacity-0');
                        } else {
                            img1.src = nextPhoto;
                            img1.classList.remove('opacity-0');
                            img2.classList.add('opacity-0');
                        }
                        showingImg1 = !showingImg1;
                    }, 3000 + (Math.random() * 2000));
                }
            });

            // Handle Lightbox opening
            let lightboxSwiper = null;
            document.querySelectorAll('.album-card').forEach(card => {
                card.addEventListener('click', () => {
                    const albumId = parseInt(card.getAttribute('data-album-id'));
                    const albumName = albumKeys[albumId];
                    const photos = albums[albumName];
                    
                    document.getElementById('lightbox-title').textContent = albumName;
                    
                    const lbContainer = document.getElementById('lightbox-container');
                    lbContainer.innerHTML = photos.map(url => `
                        <div class="swiper-slide flex items-center justify-center p-4">
                            <img src="${url}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl">
                        </div>
                    `).join('');
                    
                    const lb = document.getElementById('lightbox');
                    lb.classList.remove('hidden');
                    void lb.offsetWidth; // Force reflow
                    lb.classList.remove('opacity-0');
                    
                    if (lightboxSwiper) lightboxSwiper.destroy(true, true);
                    
                    lightboxSwiper = new Swiper('.lightbox-swiper', {
                        navigation: {
                            nextEl: '.lightbox-swiper .swiper-button-next',
                            prevEl: '.lightbox-swiper .swiper-button-prev',
                        },
                        keyboard: {
                            enabled: true,
                        },
                        loop: photos.length > 1,
                        grabCursor: true,
                        spaceBetween: 30
                    });
                });
            });
            
            // Close Lightbox
            document.getElementById('lightbox-close').addEventListener('click', () => {
                const lb = document.getElementById('lightbox');
                lb.classList.add('opacity-0');
                setTimeout(() => lb.classList.add('hidden'), 300);
            });
            
            // Close Lightbox on ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.getElementById('lightbox-close').click();
                }
            });
        }
    } catch (err) {
        console.error("Failed to fetch live gallery:", err);
    }
}

async function loadLiveMerch() {
    const container = document.getElementById('merch-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient.from('merch').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Group merch by category
            const categories = {};
            data.forEach(mc => {
                const cat = mc.category || 'General';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(mc);
            });

            // We will replace the container's parent innerHTML to inject category headers
            let html = '';
            for (const [catName, items] of Object.entries(categories)) {
                html += `
                    <div class="mb-16">
                        <h3 class="text-3xl font-syncopate font-bold text-gray-900 mb-8 border-b-2 border-gray-100 pb-4">${catName}</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            ${items.map(mc => {
                                const images = mc.images && mc.images.length > 0 ? mc.images : [mc.image_url || 'assets/merch_tshirt.jpg'];
                                return `
                                <div class="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-shadow duration-300">
                                    <div class="swiper product-swiper w-full h-72 bg-white relative">
                                        <div class="swiper-wrapper">
                                            ${images.map(img => `
                                                <div class="swiper-slide flex items-center justify-center p-6">
                                                    <img src="${img}" class="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-500">
                                                </div>
                                            `).join('')}
                                        </div>
                                        ${images.length > 1 ? '<div class="swiper-pagination !bottom-2"></div>' : ''}
                                    </div>
                                    <div class="p-6">
                                        <div class="flex justify-between items-start mb-2 gap-2">
                                            <h3 class="text-lg font-bold text-gray-900 leading-tight">${mc.title}</h3>
                                            <span class="text-[#F97316] font-bold text-lg whitespace-nowrap">${mc.price}</span>
                                        </div>
                                        <p class="text-sm text-gray-500 mb-6">Sizes: ${mc.sizes}</p>
                                        <button onclick="triggerRazorpay(this)" data-title="${mc.title}" data-price="${mc.price}" class="w-full bg-gray-900 text-white py-3 rounded-xl font-bold tracking-wide hover:bg-[#F97316] transition-colors flex items-center justify-center gap-2">
                                            Buy Now (Razorpay)
                                        </button>
                                    </div>
                                </div>
                                `
                            }).join('')}
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = html;

            // Initialize the mini product swipers
            new Swiper('.product-swiper', {
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                grabCursor: true,
                nested: true // Important if inside another swiper, but safe to add anyway
            });
        }
} catch (err) { console.error("Failed to fetch live merch:", err); } }










// Mobile Menu Toggle
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if(mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
    
    // Close menu when clicking a link
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
}






// Auto-fetch Strava Active Runners
async function loadStravaStats() {
    try {
        const res = await fetch('/api/strava');
        const data = await res.json();
        if (data.success && data.activeRunners) {
            const runnersEl = document.getElementById('stat-runners');
            if (runnersEl) {
                runnersEl.innerHTML = data.activeRunners + '<span class="text-[#F97316]">+</span>';
            }
        }
    } catch (err) {
        console.error('Failed to load Strava stats:', err);
    }
}
document.addEventListener('DOMContentLoaded', loadStravaStats);

// Dark Mode Toggle Logic
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    // Check saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        themeToggle.innerHTML = '<i class="fas fa-sun text-xl"></i>';
    }
    
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-sun text-xl"></i>' : '<i class="fas fa-moon text-xl"></i>';
    });
}

// Parallax Sun, Moon & Brightness Arc
let parallaxDocHeight = cachedDocHeight; // Reuse the perfectly calculated height


let tickingParallax = false;
window.addEventListener('scroll', () => {
    if (!tickingParallax) {
        window.requestAnimationFrame(() => {
            updateScroll();
            tickingParallax = false;
        });
        tickingParallax = true;
    }
    const scrollY = window.scrollY;
    const docHeight = cachedDocHeight || 1;
    let progress = scrollY / docHeight;
    progress = Math.max(0, Math.min(1, progress));
    
        // Arc (0 at top, 1 in middle, 0 at bottom)
    const arcProgress = Math.sin(progress * Math.PI);
    
    // Mathematically lock the Sun's X position to the Runner's exact X center
    const screenWidth = window.innerWidth;
    const runnerCenterX = (progress * (screenWidth - 48)) + 24;
    const sunX = runnerCenterX - (screenWidth / 2);
    const xPosCalc = 'calc(-50% + ' + sunX + 'px)';
    
    // Y-Axis: Sun rests exactly behind the runner at start and finish.
    const baseY = 45;
    const yPosPx = baseY - (arcProgress * (window.innerHeight * 0.65));
    
    // Pass arc progress to CSS for dynamic sky brightness and tracking
    document.documentElement.style.setProperty('--arc-progress', arcProgress);
    document.documentElement.style.setProperty('--arc-x', runnerCenterX + 'px');
    document.documentElement.style.setProperty('--moon-y', yPosPx + 'px');
    
    const sun = document.getElementById('the-sun');
    const moon = document.getElementById('the-moon');
    const transformStr = 'translate(' + xPosCalc + ', ' + yPosPx + 'px)';
    
    if (sun) sun.style.transform = transformStr;
    if (moon) moon.style.transform = transformStr;
});










// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
let currentUser = null;
let isSignUpMode = false;

// DOM Elements
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserMenu = document.getElementById('nav-user-menu');
const navAvatar = document.getElementById('nav-avatar');
const navAvatarFallback = document.getElementById('nav-avatar-fallback');
const authModal = document.getElementById('auth-modal');
const authModalContent = document.getElementById('auth-modal-content');
const authClose = document.getElementById('auth-close');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleMode = document.getElementById('auth-toggle-mode');
const authTogglePrefix = document.getElementById('auth-toggle-prefix');
const authTitle = document.getElementById('auth-title');
const navLogoutBtn = document.getElementById('nav-logout-btn');

// Open/Close Modal
function openAuthModal() {
    if(!authModal) return;
    authModal.classList.remove('hidden');
    authModal.classList.add('flex');
    setTimeout(() => {
        authModal.classList.remove('opacity-0');
        if(authModalContent) authModalContent.classList.remove('scale-95');
    }, 10);
}

function closeAuthModal() {
    if(!authModal) return;
    authModal.classList.add('opacity-0');
    if(authModalContent) authModalContent.classList.add('scale-95');
    setTimeout(() => {
        authModal.classList.add('hidden');
        authModal.classList.remove('flex');
    }, 300);
}

if(navLoginBtn) navLoginBtn.addEventListener('click', openAuthModal);
if(authClose) authClose.addEventListener('click', closeAuthModal);
// Close modal when clicking outside
if(authModal) {
    authModal.addEventListener('click', (e) => {
        if(e.target === authModal) closeAuthModal();
    });
}

// Toggle Sign In / Sign Up
if(authToggleMode) {
    authToggleMode.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;
        if(authTitle) authTitle.innerText = isSignUpMode ? 'Create Account' : 'Welcome Back';
        if(authSubmitBtn) authSubmitBtn.querySelector('span').innerText = isSignUpMode ? 'Sign Up' : 'Sign In';
        if(authToggleMode) authToggleMode.innerText = isSignUpMode ? 'Sign in instead' : 'Sign up';
        if(authError) authError.classList.add('hidden');
    });
}

// Handle Form Submit
if(authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!supabaseClient) {
            authError.innerText = "Database connection error.";
            authError.classList.remove('hidden');
            return;
        }
        
        const email = authEmail.value;
        const password = authPassword.value;
        
        authSubmitBtn.disabled = true;
        const originalText = authSubmitBtn.querySelector('span').innerText;
        authSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';
        authError.classList.add('hidden');
        
        try {
            if (isSignUpMode) {
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                if (data?.user?.identities?.length === 0) {
                    throw new Error("User already exists. Please sign in.");
                }
                alert("Account created successfully!");
                closeAuthModal();
            } else {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                closeAuthModal();
            }
        } catch (error) {
            authError.innerText = error.message;
            authError.classList.remove('hidden');
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerHTML = '<span>' + originalText + '</span>';
        }
    });
}

// Logout
if(navLogoutBtn) {
    navLogoutBtn.addEventListener('click', async () => {
        if(supabaseClient) {
            await supabaseClient.auth.signOut();
            window.location.reload();
        }
    });
}

// Listen to Auth State changes
if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        
        // Ensure nav elements exist (they might be hidden on mobile)
        const desktopLoginBtns = document.querySelectorAll('#nav-login-btn');
        const desktopUserMenus = document.querySelectorAll('#nav-user-menu');
        
        if (currentUser) {
            desktopLoginBtns.forEach(btn => btn.classList.add('hidden'));
            desktopUserMenus.forEach(menu => menu.classList.remove('hidden'));
            
            // Try to set avatar if google auth was used (fallback to default)
            const avatars = document.querySelectorAll('#nav-avatar');
            const fallbacks = document.querySelectorAll('#nav-avatar-fallback');
            
            if (currentUser.user_metadata?.avatar_url) {
                avatars.forEach(a => { a.src = currentUser.user_metadata.avatar_url; a.classList.remove('hidden'); });
                fallbacks.forEach(f => f.classList.add('hidden'));
            } else {
                avatars.forEach(a => a.classList.add('hidden'));
                fallbacks.forEach(f => f.classList.remove('hidden'));
            }
        } else {
            desktopLoginBtns.forEach(btn => btn.classList.remove('hidden'));
            desktopUserMenus.forEach(menu => menu.classList.add('hidden'));
        }
    });
}










// Google OAuth Login
const googleLoginBtn = document.getElementById('google-login-btn');
const modalGoogleLoginBtn = document.getElementById('modal-google-login-btn');

async function triggerGoogleLogin() {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });
        if (error) throw error;
    } catch (error) {
        if (authError) {
            authError.textContent = error.message;
            authError.classList.remove('hidden');
        } else {
            alert(error.message);
        }
    }
}

if (googleLoginBtn) googleLoginBtn.addEventListener('click', triggerGoogleLogin);
if (modalGoogleLoginBtn) modalGoogleLoginBtn.addEventListener('click', triggerGoogleLogin);


// Fetch Dynamic Runner of the Month
async function fetchRunnerOfTheMonth() {
    try {
        if (typeof supabaseClient === 'undefined') return;
        const { data, error } = await supabaseClient
            .from('runner_of_the_month')
            .select('*')
            .eq('id', 1)
            .single();
            
        if (data) {
            const nameEl = document.getElementById('spotlight-name');
            const descEl = document.getElementById('spotlight-desc');
            const imgEl = document.getElementById('spotlight-img');
            
            if (nameEl) nameEl.textContent = data.name;
            if (descEl) descEl.textContent = " + data.quote + ";
            if (imgEl && data.image_url) imgEl.src = data.image_url;
        }
    } catch (e) {
        console.log('Using static fallback for Runner of the Month.');
    }
}
fetchRunnerOfTheMonth();


// Razorpay Integration
async function triggerRazorpay(btn) {
    if (!currentUser) {
        alert("Please sign in first to purchase merchandise.");
        openAuthModal();
        return;
    }

    const title = btn.getAttribute('data-title');
    const priceStr = btn.getAttribute('data-price');
    // Extract numbers from price string (e.g. '?500' -> 500)
    let amountStr = priceStr.replace(/\D/g, '');
    let amount = parseInt(amountStr, 10);
    
    if (isNaN(amount) || amount <= 0) {
        amount = 500; // Fallback to 500 INR
    }

    // Optional: prompt for size
    const size = prompt("What size would you like? (S, M, L, XL, XXL)");
    if (!size) return;

    var options = {
        "key": "rzp_test_TiuzwhnFy7axHJ", // User's Test Key
        "amount": (amount * 100).toString(), // Razorpay expects amount in paise
        "currency": "INR",
        "name": "ECIL Runners",
        "description": title + " (Size: " + size + ")",
        "image": "https://ecil-runners.vercel.app/assets/logo.png",
        "handler": async function (response) {
            alert("Payment Successful! Payment ID: " + response.razorpay_payment_id);
            
            // Save to database
            try {
                await supabaseClient.from('merch_orders').insert([{
                    user_id: currentUser.id,
                    item_name: title,
                    size: size,
                    amount: amount,
                    razorpay_payment_id: response.razorpay_payment_id,
                    status: 'SUCCESS'
                }]);
                console.log("Order saved to database!");
            } catch (err) {
                console.error("Failed to save order to database:", err);
            }
        },
        "prefill": {
            "name": currentUser.user_metadata?.full_name || "ECIL Runner",
            "email": currentUser.email
        },
        "theme": {
            "color": "#F97316"
        }
    };
    var rzp1 = new Razorpay(options);
    rzp1.on('payment.failed', function (response){
        alert("Payment Failed. Reason: " + response.error.description);
    });
    rzp1.open();
}




// --- EVENT RSVP LOGIC ---
async function rsvpForEvent(eventId, buttonElement) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("Please log in to RSVP for events!");
        return;
    }

    const originalHtml = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    buttonElement.disabled = true;

    try {
        const { error } = await supabaseClient.from('event_registrations').insert([
            { event_id: eventId, user_id: user.id, status: 'registered' }
        ]);

        if (error) {
            if (error.code === '23505') { // Unique violation
                alert("You are already registered for this event!");
                buttonElement.innerHTML = '<i class="fas fa-check"></i> Registered';
                buttonElement.classList.replace('bg-[#F97316]', 'bg-green-500');
            } else {
                throw error;
            }
        } else {
            alert("RSVP Successful! See you there!");
            buttonElement.innerHTML = '<i class="fas fa-check"></i> Registered';
            buttonElement.classList.replace('bg-[#F97316]', 'bg-green-500');
        }
    } catch (err) {
        console.error("RSVP error:", err);
        alert("Failed to RSVP. Please try again.");
        buttonElement.innerHTML = originalHtml;
        buttonElement.disabled = false;
    }
}
