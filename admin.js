const SUPABASE_URL = 'https://cvehhriirejuffbrowkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';

// Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    errorEl.classList.add('hidden');
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } else {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadDashboardData();
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

// Check session on load
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadDashboardData();
    }
}
checkSession();




// Tab Switching
const tabs = document.querySelectorAll('[data-tab]');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Reset styles
        tabs.forEach(t => { t.classList.remove('bg-orange-50', 'text-[#F97316]'); t.classList.add('text-gray-600'); });
        tabContents.forEach(c => c.classList.add('hidden'));
        
        // Active style
        tab.classList.add('bg-orange-50', 'text-[#F97316]');
        tab.classList.remove('text-gray-600');
        document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    });
});

const loader = document.getElementById('admin-loader');

// Reusable Image Uploader
async function uploadImage(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = Math.random().toString(36).substring(2) + '.' + fileExt;
    const { data, error } = await supabaseClient.storage.from('images').upload(fileName, file);
    if (error) throw error;
    const { data: publicUrlData } = supabaseClient.storage.from('images').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

// EVENTS CRUD
document.getElementById('form-event').addEventListener('submit', async (e) => {
    e.preventDefault();
    loader.classList.remove('hidden');
    try {
        const file = document.getElementById('ev-image').files[0];
        const imageUrl = await uploadImage(file);
        
        const { error } = await supabaseClient.from('events').insert([{
            title: document.getElementById('ev-title').value,
            date: document.getElementById('ev-date').value,
            location: document.getElementById('ev-location').value,
            image_url: imageUrl
        }]);
        if (error) throw error;
        alert('Event added!');
        document.getElementById('form-event').reset();
        loadEvents();
    } catch (err) {
        alert(err.message);
    }
    loader.classList.add('hidden');
});

async function loadEvents() {
    const list = document.getElementById('list-events');
    const { data, error } = await supabaseClient.from('events').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = 'Error loading events.'; return; }
    list.innerHTML = data.map(ev => `
        <div class="flex items-center gap-4 p-3 border rounded">
            ${ev.image_url ? `<img src="${ev.image_url}" class="w-12 h-12 object-cover rounded">` : `<div class="w-12 h-12 bg-gray-200 rounded"></div>`}
            <div>
                <div class="font-bold">${ev.title}</div>
                <div class="text-sm text-gray-500">${ev.date} | ${ev.location}</div>
            </div>
            <button onclick="deleteRecord('events', '${ev.id}')" class="ml-auto text-red-500 text-sm">Delete</button>
        </div>
    `).join('') || 'No events found.';
}

// MERCH CRUD
document.getElementById('form-merch').addEventListener('submit', async (e) => {
    e.preventDefault();
    loader.classList.remove('hidden');
    try {
        const file = document.getElementById('mc-image').files[0];
        const imageUrl = await uploadImage(file);
        
        const { error } = await supabaseClient.from('merch').insert([{
            title: document.getElementById('mc-title').value,
            price: document.getElementById('mc-price').value,
            sizes: document.getElementById('mc-sizes').value,
            image_url: imageUrl
        }]);
        if (error) throw error;
        alert('Merch added!');
        document.getElementById('form-merch').reset();
        loadMerch();
    } catch (err) {
        alert(err.message);
    }
    loader.classList.add('hidden');
});

async function loadMerch() {
    const list = document.getElementById('list-merch');
    const { data, error } = await supabaseClient.from('merch').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = 'Error loading merch.'; return; }
    list.innerHTML = data.map(mc => `
        <div class="flex items-center gap-4 p-3 border rounded">
            ${mc.image_url ? `<img src="${mc.image_url}" class="w-12 h-12 object-cover rounded">` : `<div class="w-12 h-12 bg-gray-200 rounded"></div>`}
            <div>
                <div class="font-bold">${mc.title} <span class="text-[#F97316]">${mc.price}</span></div>
                <div class="text-sm text-gray-500">Sizes: ${mc.sizes}</div>
            </div>
            <button onclick="deleteRecord('merch', '${mc.id}')" class="ml-auto text-red-500 text-sm">Delete</button>
        </div>
    `).join('') || 'No merch found.';
}

// Global Delete
window.deleteRecord = async (table, id) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    loader.classList.remove('hidden');
    await supabaseClient.from(table).delete().eq('id', id);
    if (table === 'events') loadEvents();
    if (table === 'merch') loadMerch();
    loader.classList.add('hidden');
};

// GALLERY CRUD
document.getElementById('form-gallery').addEventListener('submit', async (e) => {
    e.preventDefault();
    loader.classList.remove('hidden');
    const statusEl = document.getElementById('gl-status');
    try {
        const albumName = document.getElementById('gl-album').value;
        const files = document.getElementById('gl-images').files;
        
        statusEl.textContent = `Uploading 0 of ${files.length} photos...`;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const imageUrl = await uploadImage(file);
            
            await supabaseClient.from('gallery').insert([{
                album_name: albumName,
                image_url: imageUrl
            }]);
            statusEl.textContent = `Uploading ${i + 1} of ${files.length} photos...`;
        }
        
        alert('All photos uploaded successfully!');
        document.getElementById('form-gallery').reset();
        statusEl.textContent = '';
        loadGallery();
    } catch (err) {
        alert('Error: ' + err.message);
        statusEl.textContent = 'Upload failed.';
    }
    loader.classList.add('hidden');
});

async function loadGallery() {
    const list = document.getElementById('list-gallery');
    const { data, error } = await supabaseClient.from('gallery').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = 'Error loading gallery.'; return; }
    
    // Group by album name
    const albums = {};
    data.forEach(photo => {
        if (!albums[photo.album_name]) albums[photo.album_name] = [];
        albums[photo.album_name].push(photo);
    });
    
    list.innerHTML = Object.keys(albums).map(albumName => `
        <div class="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg text-gray-800">${albumName} <span class="text-sm font-normal text-gray-500">(${albums[albumName].length} photos)</span></h3>
                <button onclick="deleteAlbum('${albumName}')" class="text-red-500 text-sm hover:underline font-medium">Delete Entire Album</button>
            </div>
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                ${albums[albumName].map(photo => `
                    <div class="relative group aspect-square">
                        <img src="${photo.image_url}" class="w-full h-full object-cover rounded shadow-sm border border-gray-200">
                        <button onclick="deleteRecord('gallery', '${photo.id}')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs shadow-md transition-opacity">×</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('') || 'No albums found.';
}

window.deleteAlbum = async (albumName) => {
    if (!confirm(`Are you sure you want to delete ALL photos in "${albumName}"?`)) return;
    loader.classList.remove('hidden');
    await supabaseClient.from('gallery').delete().eq('album_name', albumName);
    loadGallery();
    loader.classList.add('hidden');
};

// Override original loadDashboardData to load our specific lists
function loadDashboardData() {
    loadEvents();
    loadMerch();
    loadGallery();
};
