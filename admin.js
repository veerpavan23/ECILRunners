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
            <button onclick="openEditEvent('${ev.id}')" class="text-blue-500 text-sm hover:underline mr-3">Edit</button><button onclick="deleteRecord('events', '${ev.id}')" class="ml-auto text-red-500 text-sm">Delete</button>
        </div>
    `).join('') || 'No events found.';
}

// MERCH CRUD
document.getElementById('form-merch').addEventListener('submit', async (e) => {
    e.preventDefault();
    loader.classList.remove('hidden');
    const statusEl = document.getElementById('mc-status');
    try {
        const files = document.getElementById('mc-images').files;
        statusEl.textContent = `Uploading 0 of ${files.length} images...`;
        
        let imageUrls = [];
        for (let i = 0; i < files.length; i++) {
            const url = await uploadImage(files[i]);
            imageUrls.push(url);
            statusEl.textContent = `Uploading ${i + 1} of ${files.length} images...`;
        }
        
        const { error } = await supabaseClient.from('merch').insert([{
            category: document.getElementById('mc-category').value,
            title: document.getElementById('mc-title').value,
            price: document.getElementById('mc-price').value,
            sizes: document.getElementById('mc-sizes').value,
            images: imageUrls,
            image_url: imageUrls[0] // fallback
        }]);
        if (error) throw error;
        alert('Merch added!');
        document.getElementById('form-merch').reset();
        statusEl.textContent = '';
        loadMerch();
    } catch (err) {
        alert('Error: ' + err.message);
        if (statusEl) statusEl.textContent = 'Upload failed.';
    }
    loader.classList.add('hidden');
});

async function loadMerch() {
    
    const list = document.getElementById('list-merch');
    const { data, error } = await supabaseClient.from('merch').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = 'Error loading merch.'; return; }
    
    // Extract unique categories and populate datalist
    const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
    const datalist = document.getElementById('category-options');
    if (datalist) {
        datalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
    }

    list.innerHTML = data.map(mc => `
        <div class="flex items-center gap-4 p-3 border rounded">
            ${mc.images && mc.images.length > 0 ? `<img src="${mc.images[0]}" class="w-16 h-16 object-cover rounded border">` : (mc.image_url ? `<img src="${mc.image_url}" class="w-16 h-16 object-cover rounded border">` : `<div class="w-16 h-16 bg-gray-200 rounded"></div>`)}
            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">${mc.category || 'Mens Collection'}</div>
                <div class="font-bold">${mc.title} <span class="text-[#F97316]">${mc.price}</span></div>
                <div class="text-sm text-gray-500">Sizes: ${mc.sizes} | ${mc.images ? mc.images.length : 1} photos</div>
            </div>
            <button onclick="openEditMerch('${mc.id}')" class="text-blue-500 text-sm hover:underline mr-3">Edit</button><button onclick="deleteRecord('merch', '${mc.id}')" class="ml-auto text-red-500 text-sm hover:underline">Delete</button>
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
    const { data, error } = await supabaseClient.from('gallery').select('*').order('order_index', { ascending: true }).order('created_at', { ascending: false });
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
                <button onclick="openEditGallery('${albumName}')" class="text-blue-500 text-sm hover:underline font-medium mr-4">Edit Album</button><button onclick="deleteAlbum('${albumName}')" class="text-red-500 text-sm hover:underline font-medium">Delete Entire Album</button>
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




// GLOBALS FOR EDIT
let currentEditId = null;
let currentEditImages = [];

window.closeEditModal = () => {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('edit-modal-content').innerHTML = '';
};

// EDIT EVENTS
window.openEditEvent = async (id) => {
    loader.classList.remove('hidden');
    const { data, error } = await supabaseClient.from('events').select('*').eq('id', id).single();
    loader.classList.add('hidden');
    if (error) return alert('Error fetching event');
    
    currentEditId = id;
    document.getElementById('edit-modal-title').textContent = 'Edit Event';
    document.getElementById('edit-modal-content').innerHTML = `
        <form id="form-edit-event" class="space-y-4">
            <div><label class="block text-sm text-gray-600 mb-1">Event Title</label><input type="text" id="edit-ev-title" value="${data.title}" required class="w-full border rounded p-2"></div>
            <div><label class="block text-sm text-gray-600 mb-1">Date & Time</label><input type="text" id="edit-ev-date" value="${data.date}" required class="w-full border rounded p-2"></div>
            <div><label class="block text-sm text-gray-600 mb-1">Location</label><input type="text" id="edit-ev-location" value="${data.location}" required class="w-full border rounded p-2"></div>
            <div>
                <label class="block text-sm text-gray-600 mb-1">Current Image</label>
                <img src="${data.image_url}" class="w-32 h-32 object-cover rounded mb-2 border">
                <label class="block text-sm text-gray-600 mb-1">Upload New Image (Leave blank to keep current)</label>
                <input type="file" id="edit-ev-image" accept="image/*" class="w-full border rounded p-1">
            </div>
            <button type="submit" class="bg-[#F97316] text-white px-6 py-2 rounded font-bold w-full">Save Changes</button>
            <p id="edit-ev-status" class="text-sm text-gray-500 mt-2 text-center"></p>
        </form>
    `;
    document.getElementById('edit-modal').classList.remove('hidden');

    document.getElementById('form-edit-event').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('edit-ev-status');
        statusEl.textContent = 'Saving...';
        
        let imageUrl = data.image_url;
        const file = document.getElementById('edit-ev-image').files[0];
        if (file) {
            statusEl.textContent = 'Uploading new image...';
            imageUrl = await uploadImage(file);
        }
        
        await supabaseClient.from('events').update({
            title: document.getElementById('edit-ev-title').value,
            date: document.getElementById('edit-ev-date').value,
            location: document.getElementById('edit-ev-location').value,
            image_url: imageUrl
        }).eq('id', currentEditId);
        
        closeEditModal();
        loadEvents();
    });
};

// EDIT MERCHANDISE
window.renderEditMerchImages = () => {
    return currentEditImages.map((img, idx) => `
        <div class="flex items-center gap-4 mb-2 bg-gray-50 p-3 rounded border">
            <img src="${img}" class="w-16 h-16 object-cover rounded shadow-sm border border-gray-200">
            <div class="flex flex-col gap-1">
                ${idx > 0 ? `<button type="button" onclick="window.moveMerchImage(${idx}, -1)" class="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100 shadow-sm"><i class="fas fa-arrow-up"></i> Move Up</button>` : ''}
                ${idx < currentEditImages.length - 1 ? `<button type="button" onclick="window.moveMerchImage(${idx}, 1)" class="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100 shadow-sm"><i class="fas fa-arrow-down"></i> Move Down</button>` : ''}
            </div>
            <button type="button" onclick="window.deleteMerchImage(${idx})" class="ml-auto text-red-500 hover:text-red-700 bg-white border px-3 py-1 rounded shadow-sm"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
};

window.moveMerchImage = (idx, direction) => {
    const temp = currentEditImages[idx];
    currentEditImages[idx] = currentEditImages[idx + direction];
    currentEditImages[idx + direction] = temp;
    document.getElementById('edit-mc-images-container').innerHTML = window.renderEditMerchImages();
};

window.deleteMerchImage = (idx) => {
    if(currentEditImages.length === 1) return alert("Must have at least one image!");
    currentEditImages.splice(idx, 1);
    document.getElementById('edit-mc-images-container').innerHTML = window.renderEditMerchImages();
};

window.openEditMerch = async (id) => {
    loader.classList.remove('hidden');
    const { data, error } = await supabaseClient.from('merch').select('*').eq('id', id).single();
    loader.classList.add('hidden');
    if (error) return alert('Error fetching merch');
    
    currentEditId = id;
    currentEditImages = data.images || [data.image_url];
    
    document.getElementById('edit-modal-title').textContent = 'Edit Merchandise';
    document.getElementById('edit-modal-content').innerHTML = `
        <form id="form-edit-merch" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm text-gray-600 mb-1">Category</label><input type="text" id="edit-mc-category" value="${data.category || ''}" list="category-options" required class="w-full border rounded p-2"></div>
                <div><label class="block text-sm text-gray-600 mb-1">Item Name</label><input type="text" id="edit-mc-title" value="${data.title}" required class="w-full border rounded p-2"></div>
                <div><label class="block text-sm text-gray-600 mb-1">Price</label><input type="text" id="edit-mc-price" value="${data.price}" required class="w-full border rounded p-2"></div>
                <div><label class="block text-sm text-gray-600 mb-1">Sizes Available</label><input type="text" id="edit-mc-sizes" value="${data.sizes}" required class="w-full border rounded p-2"></div>
            </div>
            
            <div class="mt-4 p-4 border rounded bg-gray-50/50">
                <label class="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Manage Photos</label>
                <div id="edit-mc-images-container" class="mb-4">
                    ${window.renderEditMerchImages()}
                </div>
                <label class="block text-sm text-gray-600 mb-1 mt-4">Add More Photos</label>
                <input type="file" id="edit-mc-new-images" accept="image/*" multiple class="w-full border rounded p-2 bg-white">
            </div>
            
            <button type="submit" class="bg-[#F97316] text-white px-6 py-3 rounded-lg font-bold w-full mt-4 text-lg tracking-wide shadow-md hover:bg-orange-600 transition-colors">Save All Changes</button>
            <p id="edit-mc-status" class="text-sm text-gray-500 mt-2 text-center"></p>
        </form>
    `;
    
    document.getElementById('edit-modal').classList.remove('hidden');

    document.getElementById('form-edit-merch').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('edit-mc-status');
        statusEl.textContent = 'Saving...';
        
        const files = document.getElementById('edit-mc-new-images').files;
        if (files.length > 0) {
            statusEl.textContent = `Uploading ${files.length} new images...`;
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImage(files[i]);
                currentEditImages.push(url);
            }
        }
        
        await supabaseClient.from('merch').update({
            category: document.getElementById('edit-mc-category').value,
            title: document.getElementById('edit-mc-title').value,
            price: document.getElementById('edit-mc-price').value,
            sizes: document.getElementById('edit-mc-sizes').value,
            images: currentEditImages,
            image_url: currentEditImages[0]
        }).eq('id', currentEditId);
        
        closeEditModal();
        loadMerch();
    });
};


// EDIT GALLERY
let currentEditAlbum = null;

window.renderEditGalleryImages = () => {
    return currentEditImages.map((photo, idx) => `
        <div class="flex items-center gap-4 mb-2 bg-gray-50 p-3 rounded border">
            <img src="${photo.image_url}" class="w-16 h-16 object-cover rounded shadow-sm border border-gray-200">
            <div class="flex flex-col gap-1">
                ${idx > 0 ? `<button type="button" onclick="window.moveGalleryImage(${idx}, -1)" class="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100 shadow-sm"><i class="fas fa-arrow-up"></i> Move Up</button>` : ''}
                ${idx < currentEditImages.length - 1 ? `<button type="button" onclick="window.moveGalleryImage(${idx}, 1)" class="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100 shadow-sm"><i class="fas fa-arrow-down"></i> Move Down</button>` : ''}
            </div>
            <button type="button" onclick="window.deleteGalleryImage(${idx})" class="ml-auto text-red-500 hover:text-red-700 bg-white border px-3 py-1 rounded shadow-sm"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
};

window.moveGalleryImage = (idx, direction) => {
    const temp = currentEditImages[idx];
    currentEditImages[idx] = currentEditImages[idx + direction];
    currentEditImages[idx + direction] = temp;
    document.getElementById('edit-gl-images-container').innerHTML = window.renderEditGalleryImages();
};

window.deleteGalleryImage = async (idx) => {
    if(!confirm('Delete this photo immediately?')) return;
    const photo = currentEditImages[idx];
    if(photo.id) {
        await supabaseClient.from('gallery').delete().eq('id', photo.id);
    }
    currentEditImages.splice(idx, 1);
    document.getElementById('edit-gl-images-container').innerHTML = window.renderEditGalleryImages();
    loadGallery();
};

window.openEditGallery = async (albumName) => {
    loader.classList.remove('hidden');
    const { data, error } = await supabaseClient.from('gallery').select('*').eq('album_name', albumName).order('order_index', { ascending: true }).order('created_at', { ascending: false });
    loader.classList.add('hidden');
    if (error) return alert('Error fetching gallery');
    
    currentEditAlbum = albumName;
    currentEditImages = data; // Array of objects {id, image_url, album_name}
    
    document.getElementById('edit-modal-title').textContent = `Edit Album: ${albumName}`;
    document.getElementById('edit-modal-content').innerHTML = `
        <form id="form-edit-gallery" class="space-y-4">
            <div><label class="block text-sm text-gray-600 mb-1">Rename Album (Optional)</label><input type="text" id="edit-gl-album-name" value="${albumName}" required class="w-full border rounded p-2 text-lg font-bold"></div>
            
            <div class="mt-4 p-4 border rounded bg-gray-50/50 max-h-[40vh] overflow-y-auto">
                <label class="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Rearrange Photos</label>
                <div id="edit-gl-images-container" class="mb-4">
                    ${window.renderEditGalleryImages()}
                </div>
            </div>
            
            <div class="mt-4 p-4 border rounded bg-gray-50/50">
                <label class="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider">Add More Photos to this Album</label>
                <input type="file" id="edit-gl-new-images" accept="image/*" multiple class="w-full border rounded p-2 bg-white">
            </div>
            
            <button type="submit" class="bg-[#F97316] text-white px-6 py-3 rounded-lg font-bold w-full mt-4 text-lg tracking-wide shadow-md hover:bg-orange-600 transition-colors">Save & Update Order</button>
            <p id="edit-gl-status" class="text-sm text-gray-500 mt-2 text-center"></p>
        </form>
    `;
    
    document.getElementById('edit-modal').classList.remove('hidden');

    document.getElementById('form-edit-gallery').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('edit-gl-status');
        const newAlbumName = document.getElementById('edit-gl-album-name').value;
        statusEl.textContent = 'Saving changes...';
        
        // 1. Upload new photos if any
        const files = document.getElementById('edit-gl-new-images').files;
        if (files.length > 0) {
            statusEl.textContent = `Uploading ${files.length} new photos...`;
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImage(files[i]);
                currentEditImages.push({ album_name: newAlbumName, image_url: url, isNew: true });
            }
        }
        
        // 2. Update order and rename
        statusEl.textContent = 'Updating photo arrangement...';
        for (let idx = 0; idx < currentEditImages.length; idx++) {
            const photo = currentEditImages[idx];
            if (photo.isNew) {
                await supabaseClient.from('gallery').insert([{
                    album_name: newAlbumName,
                    image_url: photo.image_url,
                    order_index: idx
                }]);
            } else {
                await supabaseClient.from('gallery').update({
                    order_index: idx,
                    album_name: newAlbumName
                }).eq('id', photo.id);
            }
            statusEl.textContent = `Updating photo arrangement... (${idx+1}/${currentEditImages.length})`;
        }
        
        closeEditModal();
        loadGallery();
    });
};






