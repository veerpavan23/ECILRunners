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

function updateScroll() {
    // Progress Bar
    const scrollTop = window.scrollY;
    const docHeight = document.body.offsetHeight - window.innerHeight;
    let scrollPercent = scrollTop / docHeight;
    if (isNaN(scrollPercent)) scrollPercent = 0;
    
    if(scrollTrack && scrollRunner) {
        scrollTrack.style.width = `${scrollPercent * 100}%`;
        
        // Prevent runner from going off-screen.
        scrollRunner.style.left = `calc(${scrollPercent * 100}% + ${24 - (scrollPercent * 48)}px)`;
        
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
            let screenX = 24 + scrollPercent * (window.innerWidth - 48);
            let hudShift = 0;
            if (screenX < 100) hudShift = 100 - screenX; // 100px buffer for left edge
            if (screenX > window.innerWidth - 100) hudShift = (window.innerWidth - 100) - screenX; // 100px buffer for right edge
            runnerHud.style.left = `${screenX}px`;
            runnerHud.style.transform = `translateX(calc(-50% + ${hudShift}px))`;
            
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

window.addEventListener('scroll', () => {
    updateScroll();
    
    // Clear the timeout throughout the scroll
    window.clearTimeout(isScrollingTimeout);

    // Set a timeout to run after scrolling ends
    isScrollingTimeout = setTimeout(function() {
        if (runnerGif && runnerCanvas) {
            runnerGif.classList.add('hidden');
            if(ctx) { runnerCanvas.width = runnerGif.width || 80; runnerCanvas.height = runnerGif.height || 80; ctx.clearRect(0,0,runnerCanvas.width,runnerCanvas.height); ctx.drawImage(runnerGif, 0, 0, runnerCanvas.width, runnerCanvas.height); } runnerCanvas.classList.remove('hidden');
        }
        if (hudHr) {
            hudHr.innerText = '72'; // Reset HR
        }
    }, 150);
});

window.addEventListener('resize', updateScroll);
updateScroll(); // init


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
