const SUPABASE_URL = 'https://cvehhriirejuffbrowkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';

// Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const debugLogEl = document.getElementById('debug-log');

function setDebug(msg, isError = false) {
    console.log('[ADMIN_AUTH]', msg);
    if (debugLogEl) {
        const time = new Date().toLocaleTimeString();
        debugLogEl.innerHTML += `<div class="${isError ? 'text-red-600 font-bold' : 'text-gray-800'}">[${time}] ${msg}</div>`;
    }
}

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Known Admin Emails & User UUIDs as immediate fallback
const ADMIN_EMAILS = ['veer.pavan@gmail.com', 'sreedivya1901@gmail.com'];
const ADMIN_IDS = ['6e0b26ef-d6aa-4369-8eda-d89dce0bfd9e', '93400983-27da-49dd-a3ef-82cdb23f4e8e'];

// Helper to verify admin permissions
async function verifyIsAdmin(user) {
    if (!user) {
        setDebug("verifyIsAdmin: user is null/undefined", true);
        return false;
    }
    const userEmail = (user.email || user.user_metadata?.email || user.app_metadata?.email || '').toLowerCase().trim();
    setDebug(`Checking admin: ID=${user.id}, Email=${userEmail || 'none'}`);

    if (ADMIN_IDS.includes(user.id)) {
        setDebug(`Admin granted: Matched authorized admin UUID (${user.id})`);
        return true;
    }
    if (ADMIN_EMAILS.includes(userEmail)) {
        setDebug(`Admin granted: Matched authorized admin email (${userEmail})`);
        return true;
    }
    try {
        const { data: profile, error } = await supabaseClient.from('profiles').select('is_admin, super_admin').eq('id', user.id).maybeSingle();
        if (profile && (profile.is_admin === true || profile.super_admin === true)) {
            setDebug(`Admin granted: Database profile has is_admin=${profile.is_admin}`);
            return true;
        } else {
            setDebug(`Profile lookup result: ${JSON.stringify(profile)}, error: ${JSON.stringify(error)}`);
        }
    } catch (e) {
        setDebug(`Profile admin check exception: ${e.message}`, true);
    }
    return false;
}

// Auth logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = loginForm.querySelector('button[type="submit"]') || loginForm.querySelector('button');
    
    errorEl.classList.add('hidden');
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;
    setDebug(`Attempting password sign in for ${email}...`);
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (authError) {
            setDebug(`Sign-in error: ${authError.message}`, true);
            errorEl.textContent = authError.message;
            errorEl.classList.remove('hidden');
            submitBtn.textContent = prevText;
            submitBtn.disabled = false;
            return;
        } 
        
        const isAdmin = await verifyIsAdmin(authData.user);
        if (!isAdmin) {
            setDebug("Access Denied: Not recognized as admin", true);
            await supabaseClient.auth.signOut();
            errorEl.textContent = "Access Denied: You are not an authorized administrator.";
            errorEl.classList.remove('hidden');
            submitBtn.textContent = prevText;
            submitBtn.disabled = false;
            return;
        }
        
        // Success!
        grantAdminAccess(authData.user);
    } catch (err) {
        setDebug(`Exception during login: ${err.message}`, true);
        errorEl.textContent = err.message || 'Login failed';
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.textContent = prevText;
        submitBtn.disabled = false;
    }
});

// Google Auth
window.handleGoogleLogin = async function() {
    const errorEl = document.getElementById('login-error');
    const googleBtn = document.getElementById('google-login-btn');
    if (errorEl) errorEl.classList.add('hidden');
    if (googleBtn) {
        googleBtn.disabled = true;
        googleBtn.classList.add('opacity-75');
    }

    const redirectUrl = window.location.origin + window.location.pathname;
    setDebug(`[handleGoogleLogin] Redirecting to Google OAuth (target: ${redirectUrl})...`);
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) throw error;
        if (data?.url) {
            setDebug(`OAuth URL resolved: ${data.url.substring(0, 50)}... Redirecting!`);
            window.location.href = data.url;
        }
    } catch (err) {
        setDebug(`OAuth trigger error: ${err.message}`, true);
        if (errorEl) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        } else {
            alert(err.message);
        }
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.classList.remove('opacity-75');
        }
    }
};

const googleBtn = document.getElementById('google-login-btn');
if (googleBtn) {
    googleBtn.addEventListener('click', window.handleGoogleLogin);
}

// Logout handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });
}

// Function to safely display dashboard when authorized
let isDashboardLoaded = false;
async function grantAdminAccess(user) {
    setDebug(`grantAdminAccess invoked for ${user?.email || user?.id}`);
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    if (!isDashboardLoaded) {
        isDashboardLoaded = true;
        loadDashboardData();
    }
}

// Check session on load & listen for auth changes (handles Google OAuth redirect)
async function checkSession() {
    setDebug("Running checkSession()...");
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) setDebug(`getSession error: ${error.message}`, true);
        if (session && session.user) {
            setDebug(`Found active session for ${session.user.email || session.user.id}`);
            const isAdmin = await verifyIsAdmin(session.user);
            if (isAdmin) {
                grantAdminAccess(session.user);
            } else {
                const errorEl = document.getElementById('login-error');
                const msg = `Access Denied: Logged in as ${session.user.email || 'unknown'}, but this account is not an authorized administrator.`;
                setDebug(msg, true);
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        } else {
            setDebug("No active session found on initial load.");
        }
    } catch (e) {
        setDebug(`checkSession exception: ${e.message}`, true);
    }
}
checkSession();

// Also listen for OAuth redirect hash changes / auth state transitions
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    setDebug(`Auth event received: ${event}`);
    if (session && session.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        const isAdmin = await verifyIsAdmin(session.user);
        if (isAdmin) {
            grantAdminAccess(session.user);
        } else {
            const errorEl = document.getElementById('login-error');
            const msg = `Access Denied: Logged in as ${session.user.email || 'unknown'}, but this account is not an authorized administrator.`;
            setDebug(msg, true);
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
    } else if (event === 'SIGNED_OUT') {
        dashboardScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        isDashboardLoaded = false;
    }
});




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

// Client-side image compression helper to prevent oversized uploads
async function compressImageForWeb(file, maxDimension = 1400, quality = 0.75) {
    if (!file || !file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// Reusable Image Uploader with automatic pre-upload compression
async function uploadImage(file) {
    if (!file) return null;
    const compressedFile = await compressImageForWeb(file);
    const fileExt = compressedFile.name.split('.').pop() || 'jpg';
    const fileName = Math.random().toString(36).substring(2) + '.' + fileExt;
    const { data, error } = await supabaseClient.storage.from('images').upload(fileName, compressedFile, {
        cacheControl: '31536000',
        contentType: compressedFile.type || 'image/jpeg'
    });
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
            description: document.getElementById('ev-description').value,
            price: document.getElementById('ev-price').value,
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
                <div class="font-bold flex items-center gap-2">
                    <span>${mc.title}</span> 
                    <span class="text-[#F97316]">${mc.price}</span>
                    <span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Sold Out</span>
                </div>
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
                        <button onclick="deleteRecord('gallery', '${photo.id}')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs shadow-md transition-opacity">�</button>
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
    loadAttendanceEvents();
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
            <div><label class="block text-sm text-gray-600 mb-1">Price</label><input type="text" id="edit-ev-price" value="${data.price || 'FREE'}" required class="w-full border rounded p-2"></div>
            <div class="col-span-2"><label class="block text-sm text-gray-600 mb-1">Description</label><textarea id="edit-ev-description" required class="w-full border rounded p-2" rows="2">${data.description || 'Join us for this amazing ECIL Runners event. See you at the starting line!'}</textarea></div>
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
            description: document.getElementById('edit-ev-description').value,
            price: document.getElementById('edit-ev-price').value,
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










// --- ATTENDANCE MANAGEMENT ---
let adminEventsCache = [];

async function loadAttendanceEvents() {
    const select = document.getElementById('attendance-event-select');
    if (!select) return;
    const { data, error } = await supabaseClient.from('events').select('id, title, date').order('created_at', { ascending: false });
    adminEventsCache = data || [];
    
    let optionsHtml = '<option value="all">★ All Registered Runners</option>';
    
    // Find Run Jaathara 2026 event row if present
    const jaatharaEv = adminEventsCache.find(ev => ev.title && ev.title.toLowerCase().includes('run jaathara'));
    if (jaatharaEv) {
        optionsHtml += `<option value="${jaatharaEv.id}" selected>★ ${jaatharaEv.title} (${jaatharaEv.date})</option>`;
    }
    
    if (data) {
        optionsHtml += data.filter(ev => !jaatharaEv || ev.id !== jaatharaEv.id).map(ev => `<option value="${ev.id}">${ev.title} (${ev.date})</option>`).join('');
    }
    select.innerHTML = optionsHtml;

    // Auto-load registrations for Run Jaathara or All so the admin doesn't see a blank placeholder
    const defaultEventId = jaatharaEv ? jaatharaEv.id : 'all';
    select.value = defaultEventId;
    loadEventRegistrations(defaultEventId);
}

async function loadEventRegistrations(eventId) {
    const list = document.getElementById('attendance-list');
    if (!eventId) {
        list.innerHTML = '<p class="text-sm text-gray-500">Select an event above to see registered runners.</p>';
        return;
    }
    list.innerHTML = '<div class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading registered runners...</div>';
    
    let { data, error } = await supabaseClient.from('event_registrations').select('*').order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching registrations:", error);
        list.innerHTML = `<div class="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            <strong>Error loading registrations:</strong> ${error.message || JSON.stringify(error)}
        </div>`;
        return;
    }

    // Filter by selected event
    if (data && eventId !== 'all') {
        data = data.filter(r => r.event_id === eventId);
    }
    
    // Deduplicate registrations by email and event, preferring records with rich metadata
    const seenMap = new Map();
    const dedupedData = [];
    for (const reg of data) {
        const key = `${reg.event_id || 'no_event'}_${(reg.user_email || reg.user_id || reg.id).toLowerCase()}`;
        if (!seenMap.has(key)) {
            seenMap.set(key, reg);
            dedupedData.push(reg);
        } else {
            const existing = seenMap.get(key);
            const existingHasMeta = existing.user_name && (existing.user_name.includes('__META__:') || existing.user_name.includes('['));
            const currentHasMeta = reg.user_name && (reg.user_name.includes('__META__:') || reg.user_name.includes('['));
            if (!existingHasMeta && currentHasMeta) {
                const idx = dedupedData.indexOf(existing);
                if (idx !== -1) {
                    dedupedData[idx] = reg;
                    seenMap.set(key, reg);
                }
            }
        }
    }
    data = dedupedData;
    
    if (data.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-gray-200">No one has registered for this event yet.</p>';
        return;
    }
    
    const totalRegistered = data.length;
    const totalAttended = data.filter(r => r.status === 'attended').length;

    // Cache registrations so the edit modal can instantly populate
    window.allRegistrationsCache = window.allRegistrationsCache || new Map();
    window.allRegistrationsCache.clear();
    
    let html = `
        <div class="flex flex-wrap gap-4 mb-6">
            <div class="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 flex-1 min-w-[140px]">
                <span class="text-xs text-gray-500 uppercase tracking-widest font-bold block">Total Registered</span>
                <span class="text-3xl font-bold text-gray-900">${totalRegistered}</span>
            </div>
            <div class="bg-orange-50 px-4 py-3 rounded-xl border border-orange-100 flex-1 min-w-[140px]">
                <span class="text-xs text-[#F97316] uppercase tracking-widest font-bold block">Total Attended</span>
                <span class="text-3xl font-bold text-[#F97316]">${totalAttended}</span>
            </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
            <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-gray-100/80 text-gray-700 uppercase font-semibold border-b border-gray-200">
                    <tr>
                        <th class="p-3">Runner Name</th>
                        <th class="p-3">Gender / DOB</th>
                        <th class="p-3">Race Category</th>
                        <th class="p-3">Bib Name</th>
                        <th class="p-3">T-Shirt</th>
                        <th class="p-3">Blood Group</th>
                        <th class="p-3">Health Issues</th>
                        <th class="p-3">Emergency Contact</th>
                        <th class="p-3">Running Group</th>
                        <th class="p-3">Email &amp; Mobile</th>
                        <th class="p-3">Status</th>
                        <th class="p-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-gray-700">
    `;

    html += data.map(reg => {
        let runnerName = reg.user_name || 'Participant';
        let gender = '-';
        let category = 'Run Jaathara 2026';
        let bib = '-';
        let tshirt = '-';
        let blood = '-';
        let health = '-';
        let emergencyPerson = '-';
        let emergencyPhone = '-';
        let dob = '-';
        let group = 'ECIL Runners';
        let email = reg.user_email || '-';
        let phone = '-';
        let regNo = '-';

        // 1. Check if full JSON metadata is embedded in user_name
        if (reg.user_name && reg.user_name.includes('__META__:')) {
            try {
                const jsonStr = reg.user_name.split('__META__:')[1];
                const meta = JSON.parse(jsonStr);
                runnerName = meta.name || runnerName;
                gender = meta.gender || gender;
                category = meta.category || category;
                bib = meta.bib || bib;
                tshirt = meta.tshirt || tshirt;
                blood = meta.blood || blood;
                health = meta.health || health;
                emergencyPerson = meta.emergencyPerson || emergencyPerson;
                emergencyPhone = meta.emergencyPhone || emergencyPhone;
                dob = meta.dob || dob;
                group = meta.group || group;
                phone = meta.phone || phone;
                regNo = meta.regNo || regNo;
            } catch(e) {}
        }
        // 2. Also handle legacy bracketed format: "Veer • [Cat: 21.1K TIMED RUN | Bib: Veer ...]" or "Veer [Cat: ...]"
        if (reg.user_name && (reg.user_name.includes('[') || reg.user_name.includes('•'))) {
            const parts = reg.user_name.split(/[\u2022\u2023\u25E6\u2043\u2219•\[]/);
            if (parts.length > 0 && parts[0].trim()) {
                runnerName = parts[0].trim();
            }
            const tagStr = reg.user_name;
            const catMatch = tagStr.match(/Cat:\s*([^|\]]+)/i);
            const bibMatch = tagStr.match(/Bib:\s*([^|\]]+)/i);
            const tshirtMatch = tagStr.match(/T-Shirt:\s*([^|\]]+)/i);
            const bloodMatch = tagStr.match(/Blood:\s*([^|\]]+)/i);
            const phoneMatch = tagStr.match(/Ph(?:one)?:\s*([^|\]]+)/i);
            const emergPersonMatch = tagStr.match(/Emerg(?:ency)?(?:\s*Person)?:\s*([^|\]]+)/i);
            const emergPhoneMatch = tagStr.match(/Emerg(?:ency)?\s*Ph(?:one)?:\s*([^|\]]+)/i);

            if (catMatch && catMatch[1].trim()) category = catMatch[1].trim();
            if (bibMatch && bibMatch[1].trim()) bib = bibMatch[1].trim();
            if (tshirtMatch && tshirtMatch[1].trim()) tshirt = tshirtMatch[1].trim();
            if (bloodMatch && bloodMatch[1].trim()) blood = bloodMatch[1].trim();
            if (phoneMatch && phoneMatch[1].trim()) phone = phoneMatch[1].trim();
            if (emergPersonMatch && emergPersonMatch[1].trim()) emergencyPerson = emergPersonMatch[1].trim();
            if (emergPhoneMatch && emergPhoneMatch[1].trim()) emergencyPhone = emergPhoneMatch[1].trim();
        }

        // Final sanitation: clean any trailing bracket or metadata artifacts from runnerName
        if (runnerName.includes('__META__:')) {
            runnerName = runnerName.split('__META__:')[0].trim();
        }
        runnerName = runnerName.replace(/[\u2022\u2023\u25E6\u2043\u2219•\[].*$/, '').trim();
        if (!runnerName || runnerName === 'Participant') {
            runnerName = bib !== '-' ? bib : (reg.user_email ? reg.user_email.split('@')[0] : 'Participant');
        }

        // Save into global cache for rapid editing
        window.allRegistrationsCache.set(reg.id, {
            id: reg.id,
            eventId: reg.event_id || eventId,
            runnerName,
            gender,
            category,
            bib,
            tshirt,
            blood,
            health,
            emergencyPerson,
            emergencyPhone,
            dob,
            group,
            email,
            phone,
            regNo
        });

        const isAttended = reg.status === 'attended';
        const statusBadge = isAttended 
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase"><i class="fas fa-check-circle mr-1"></i> Attended</span>'
            : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#F97316] uppercase"><i class="fas fa-clock mr-1"></i> Registered</span>';

        const displayBlood = (blood && blood !== '-') 
            ? `<span class="bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold text-[10px]">${blood}</span>`
            : `<span class="text-gray-400 font-normal">—</span>`;

        const displayTshirt = (tshirt && tshirt !== '-') 
            ? `<span class="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-bold text-[11px]">${tshirt}</span>`
            : `<span class="text-gray-400 font-normal">—</span>`;

        const displayHealth = (health && health !== '-') 
            ? `<span class="text-gray-700">${health}</span>`
            : `<span class="text-gray-400 font-normal">—</span>`;

        const displayEmergency = (emergencyPerson && emergencyPerson !== '-')
            ? `<div class="font-medium text-gray-800">${emergencyPerson}</div><div class="text-gray-500 font-mono text-[11px]">${emergencyPhone !== '-' ? emergencyPhone : ''}</div>`
            : `<span class="text-gray-400 font-normal">—</span>`;

        const displayGenderDob = (gender !== '-' || dob !== '-')
            ? `<span class="font-medium text-gray-800">${gender !== '-' ? gender : ''}</span><span class="text-gray-400 block text-[11px]">${dob !== '-' ? dob : ''}</span>`
            : `<span class="text-gray-400 font-normal">—</span>`;

        return `
            <tr class="hover:bg-gray-50/70 transition-colors">
                <td class="p-3 font-bold text-gray-900 whitespace-nowrap">${runnerName}</td>
                <td class="p-3 whitespace-nowrap">${displayGenderDob}</td>
                <td class="p-3 font-bold text-[#F97316] whitespace-nowrap">${category}</td>
                <td class="p-3 font-semibold text-gray-800 whitespace-nowrap font-mono">${bib}</td>
                <td class="p-3 whitespace-nowrap">${displayTshirt}</td>
                <td class="p-3 whitespace-nowrap">${displayBlood}</td>
                <td class="p-3 whitespace-nowrap">${displayHealth}</td>
                <td class="p-3 whitespace-nowrap">${displayEmergency}</td>
                <td class="p-3 font-semibold text-gray-700 whitespace-nowrap">${group}</td>
                <td class="p-3 whitespace-nowrap">
                    <div class="font-medium text-gray-800">${email}</div>
                    <div class="text-gray-500 font-mono text-[11px]">${phone}</div>
                </td>
                <td class="p-3 whitespace-nowrap">${statusBadge}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openEditRunnerModal('${reg.id}', '${eventId}')" class="bg-white border border-gray-300 hover:border-[#F97316] hover:text-[#F97316] text-gray-700 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5" title="Edit Participant Details">
                            <i class="fas fa-edit text-orange-500"></i>
                            <span>Edit</span>
                        </button>
                        <button onclick="toggleAttendance('${reg.id}', '${eventId}', '${reg.status}')" class="${isAttended ? 'bg-green-500 hover:bg-red-500 text-white' : 'bg-gray-100 hover:bg-green-500 hover:text-white text-gray-600'} px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5" title="${isAttended ? 'Click to Unmark (Set to Registered)' : 'Click to Mark Attended'}">
                            <i class="fas ${isAttended ? 'fa-check' : 'fa-user-check'}"></i>
                            <span>${isAttended ? 'Attended' : 'Mark Present'}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    html += `
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = html;
}

// Two-way toggle attendance: can mark attended or unmark back to registered
async function toggleAttendance(regId, eventId, currentStatus) {
    const newStatus = (currentStatus === 'attended') ? 'registered' : 'attended';
    const { error } = await supabaseClient.from('event_registrations').update({ status: newStatus }).eq('id', regId);
    if (!error) {
        loadEventRegistrations(eventId);
    } else {
        alert('Failed to update attendance status: ' + error.message);
    }
}

// Open Edit Runner Modal to review or fill missing details directly in database
window.openEditRunnerModal = function(regId, eventId) {
    const runner = window.allRegistrationsCache ? window.allRegistrationsCache.get(regId) : null;
    if (!runner) return alert('Unable to locate runner details.');

    document.getElementById('edit-modal-title').textContent = `Edit Runner: ${runner.runnerName}`;
    document.getElementById('edit-modal-content').innerHTML = `
        <form id="form-edit-runner" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Runner Name</label>
                    <input type="text" id="edit-rn-name" value="${runner.runnerName !== '-' ? runner.runnerName : ''}" required class="w-full border rounded-lg p-2 text-sm font-semibold">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
                    <input type="email" id="edit-rn-email" value="${runner.email !== '-' ? runner.email : ''}" required class="w-full border rounded-lg p-2 text-sm font-semibold">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Mobile Number</label>
                    <input type="text" id="edit-rn-phone" value="${runner.phone !== '-' ? runner.phone : ''}" class="w-full border rounded-lg p-2 text-sm font-mono">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Race Category</label>
                    <input type="text" id="edit-rn-category" value="${runner.category !== '-' ? runner.category : 'Run Jaathara 2026'}" class="w-full border rounded-lg p-2 text-sm font-semibold text-orange-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Bib Name / Number</label>
                    <input type="text" id="edit-rn-bib" value="${runner.bib !== '-' ? runner.bib : ''}" class="w-full border rounded-lg p-2 text-sm font-mono">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">T-Shirt Size</label>
                    <select id="edit-rn-tshirt" class="w-full border rounded-lg p-2 text-sm font-semibold">
                        <option value="-" ${runner.tshirt === '-' ? 'selected' : ''}>Not Specified (—)</option>
                        <option value="XS" ${runner.tshirt === 'XS' ? 'selected' : ''}>XS (Chest 36")</option>
                        <option value="S" ${runner.tshirt === 'S' ? 'selected' : ''}>S (Chest 38")</option>
                        <option value="M" ${runner.tshirt === 'M' ? 'selected' : ''}>M (Chest 40")</option>
                        <option value="L" ${runner.tshirt === 'L' ? 'selected' : ''}>L (Chest 42")</option>
                        <option value="XL" ${runner.tshirt === 'XL' ? 'selected' : ''}>XL (Chest 44")</option>
                        <option value="XXL" ${runner.tshirt === 'XXL' ? 'selected' : ''}>XXL (Chest 46")</option>
                        <option value="3XL" ${runner.tshirt === '3XL' ? 'selected' : ''}>3XL (Chest 48")</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Blood Group</label>
                    <select id="edit-rn-blood" class="w-full border rounded-lg p-2 text-sm font-semibold">
                        <option value="-" ${runner.blood === '-' ? 'selected' : ''}>Not Specified (—)</option>
                        <option value="A +ve" ${runner.blood === 'A +ve' || runner.blood === 'A+' ? 'selected' : ''}>A +ve</option>
                        <option value="A -ve" ${runner.blood === 'A -ve' || runner.blood === 'A-' ? 'selected' : ''}>A -ve</option>
                        <option value="B +ve" ${runner.blood === 'B +ve' || runner.blood === 'B+' ? 'selected' : ''}>B +ve</option>
                        <option value="B -ve" ${runner.blood === 'B -ve' || runner.blood === 'B-' ? 'selected' : ''}>B -ve</option>
                        <option value="O +ve" ${runner.blood === 'O +ve' || runner.blood === 'O+' ? 'selected' : ''}>O +ve</option>
                        <option value="O -ve" ${runner.blood === 'O -ve' || runner.blood === 'O-' ? 'selected' : ''}>O -ve</option>
                        <option value="AB +ve" ${runner.blood === 'AB +ve' || runner.blood === 'AB+' ? 'selected' : ''}>AB +ve</option>
                        <option value="AB -ve" ${runner.blood === 'AB -ve' || runner.blood === 'AB-' ? 'selected' : ''}>AB -ve</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Gender</label>
                    <select id="edit-rn-gender" class="w-full border rounded-lg p-2 text-sm font-semibold">
                        <option value="-" ${runner.gender === '-' ? 'selected' : ''}>Not Specified</option>
                        <option value="Male" ${runner.gender === 'Male' ? 'selected' : ''}>Male</option>
                        <option value="Female" ${runner.gender === 'Female' ? 'selected' : ''}>Female</option>
                        <option value="Other" ${runner.gender === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Date of Birth</label>
                    <input type="text" id="edit-rn-dob" value="${runner.dob !== '-' ? runner.dob : ''}" placeholder="DD/MM/YYYY" class="w-full border rounded-lg p-2 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Running Group</label>
                    <input type="text" id="edit-rn-group" value="${runner.group !== '-' ? runner.group : 'ECIL Runners'}" class="w-full border rounded-lg p-2 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Emergency Contact Person</label>
                    <input type="text" id="edit-rn-emerg-person" value="${runner.emergencyPerson !== '-' ? runner.emergencyPerson : ''}" placeholder="Contact Person Name" class="w-full border rounded-lg p-2 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Emergency Mobile Number</label>
                    <input type="text" id="edit-rn-emerg-phone" value="${runner.emergencyPhone !== '-' ? runner.emergencyPhone : ''}" placeholder="10-digit mobile" class="w-full border rounded-lg p-2 text-sm font-mono">
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">History of Health Issues</label>
                    <input type="text" id="edit-rn-health" value="${runner.health !== '-' ? runner.health : ''}" placeholder="None or list any conditions" class="w-full border rounded-lg p-2 text-sm">
                </div>
            </div>

            <button type="submit" id="btn-save-runner" class="bg-[#F97316] text-white px-6 py-3 rounded-xl font-bold w-full mt-4 text-sm tracking-wide shadow-md hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                <i class="fas fa-save"></i> Save Runner Details
            </button>
            <p id="edit-rn-status" class="text-xs text-gray-500 mt-1 text-center"></p>
        </form>
    `;

    document.getElementById('edit-modal').classList.remove('hidden');

    document.getElementById('form-edit-runner').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-runner');
        const statusEl = document.getElementById('edit-rn-status');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        statusEl.className = 'text-xs text-gray-500 mt-1 text-center';
        statusEl.textContent = 'Saving details to database...';

        const updatedMeta = {
            name: document.getElementById('edit-rn-name').value.trim(),
            gender: document.getElementById('edit-rn-gender').value,
            category: document.getElementById('edit-rn-category').value.trim(),
            bib: document.getElementById('edit-rn-bib').value.trim(),
            tshirt: document.getElementById('edit-rn-tshirt').value,
            blood: document.getElementById('edit-rn-blood').value,
            health: document.getElementById('edit-rn-health').value.trim() || '-',
            emergencyPerson: document.getElementById('edit-rn-emerg-person').value.trim() || '-',
            emergencyPhone: document.getElementById('edit-rn-emerg-phone').value.trim() || '-',
            dob: document.getElementById('edit-rn-dob').value.trim() || '-',
            group: document.getElementById('edit-rn-group').value.trim() || 'ECIL Runners',
            phone: document.getElementById('edit-rn-phone').value.trim() || '-',
            regNo: runner.regNo || '-'
        };

        const newEmail = document.getElementById('edit-rn-email').value.trim();
        const richUserName = `${updatedMeta.name} __META__:${JSON.stringify(updatedMeta)}`;

        const { error } = await supabaseClient.from('event_registrations').update({
            user_name: richUserName,
            user_email: newEmail
        }).eq('id', regId);

        if (error) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save Runner Details';
            statusEl.className = 'text-xs text-red-600 mt-1 text-center font-bold';
            statusEl.textContent = 'Error updating runner: ' + error.message;
            return;
        }

        closeEditModal();
        loadEventRegistrations(eventId);
    });
};

// Hook into tab switching to load events
document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'attendance') loadAttendanceEvents();
        if (btn.dataset.tab === 'users') loadUsers();
    });
});





// --- USER MANAGEMENT ---
async function loadUsers() {
    const tbody = document.getElementById('users-list-body');
    const countBadge = document.getElementById('users-total-count');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i> Loading users...</td></tr>';
    
    // Check if the current user is a super_admin
    const { data: sessionData } = await supabaseClient.auth.getSession();
    let isSuperAdmin = false;
    if (sessionData?.session?.user) {
        const { data: currentProfile } = await supabaseClient.from('profiles').select('super_admin').eq('id', sessionData.session.user.id).single();
        isSuperAdmin = currentProfile?.super_admin === true;
    }

    const { data, error, count } = await supabaseClient
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
        
    if (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-500">Error loading users.</td></tr>';
        return;
    }
    
    if (countBadge) countBadge.textContent = `Total: ${count}`;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4">No users found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(user => {
        const date = new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        const isAdmin = user.is_admin === true;
        const disableToggle = !isSuperAdmin;
        
        return `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-6 py-4 font-bold text-gray-900">
                    ${user.full_name || 'Unknown'}
                    ${user.super_admin ? '<span class="ml-2 bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Super Admin</span>' : ''}
                </td>
                <td class="px-6 py-4">${user.email || 'N/A'}</td>
                <td class="px-6 py-4 font-mono text-xs text-gray-400">${date}</td>
                <td class="px-6 py-4">
                    <label class="inline-flex items-center ${disableToggle ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}">
                        <input type="checkbox" onchange="toggleAdmin('${user.id}', this.checked)" class="sr-only peer" ${isAdmin ? 'checked' : ''} ${disableToggle ? 'disabled' : ''}>
                        <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                        <span class="ms-3 text-xs font-bold text-gray-500">${isAdmin ? 'ADMIN' : 'User'}</span>
                    </label>
                </td>
            </tr>
        `;
    }).join('');
}
async function toggleAdmin(userId, makeAdmin) {
    const { error } = await supabaseClient.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
    if (error) {
        alert("Error updating permissions. Do you have permission?");
        loadUsers(); 
    } else {
        loadUsers(); 
    }
}







