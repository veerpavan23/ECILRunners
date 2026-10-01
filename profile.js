// Theme logic
const themeToggle = document.getElementById('theme-toggle-profile');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    });
}

// Supabase Logic
const SUPABASE_URL = 'https://cvehhriirejuffbrowkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const form = document.getElementById('profile-form');
const msgBox = document.getElementById('profile-msg');
const saveBtn = document.getElementById('profile-save-btn');
const inputEmail = document.getElementById('profile-email');
const inputName = document.getElementById('profile-name');
const inputAge = document.getElementById('profile-age');
const inputGender = document.getElementById('profile-gender');
const inputGroup = document.getElementById('profile-group');
const inputShirt = document.getElementById('profile-shirt');
const inputBlood = document.getElementById('profile-blood');
const inputEmergency = document.getElementById('profile-emergency');
const inputAvatar = document.getElementById('profile-avatar-url');
const avatarPreview = document.getElementById('profile-avatar-preview');
const avatarFallback = document.getElementById('profile-avatar-fallback');

// Load Profile Data
async function loadProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        // Redirect to home if not logged in
        window.location.href = 'index.html';
        return;
    }

    inputEmail.value = user.email;
    
    // Parse user metadata
    const meta = user.user_metadata || {};
    
    if (meta.full_name) inputName.value = meta.full_name;
    if (meta.age) inputAge.value = meta.age;
    if (meta.gender) inputGender.value = meta.gender;
    if (meta.group) inputGroup.value = meta.group;
    if (meta.shirt) inputShirt.value = meta.shirt;
    if (meta.blood) inputBlood.value = meta.blood;
    if (meta.emergency) inputEmergency.value = meta.emergency;
    
    if (meta.avatar_url) {
        inputAvatar.value = meta.avatar_url;
        avatarPreview.src = meta.avatar_url;
        avatarPreview.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
    }
}

// Update avatar preview when URL changes
if (inputAvatar) {
    inputAvatar.addEventListener('input', (e) => {
        const url = e.target.value;
        if (url) {
            avatarPreview.src = url;
            avatarPreview.classList.remove('hidden');
            avatarFallback.classList.add('hidden');
        } else {
            avatarPreview.classList.add('hidden');
            avatarFallback.classList.remove('hidden');
        }
    });
}

// Save Profile Data
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
        msgBox.classList.add('hidden');
        
        const updates = {
            full_name: inputName.value,
            age: inputAge.value,
            gender: inputGender.value,
            group: inputGroup.value,
            shirt: inputShirt.value,
            blood: inputBlood.value,
            emergency: inputEmergency.value,
            avatar_url: inputAvatar.value
        };

        try {
            const { data, error } = await supabaseClient.auth.updateUser({
                data: updates
            });

            if (error) throw error;
            
            msgBox.textContent = 'Profile updated successfully!';
            msgBox.className = 'mb-6 p-4 rounded-xl text-sm font-bold text-center bg-green-50 text-green-600 border border-green-200 block';
        } catch (error) {
            msgBox.textContent = error.message;
            msgBox.className = 'mb-6 p-4 rounded-xl text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200 block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> <span>Save Profile</span>';
        }
    });
}

// Init
document.addEventListener('DOMContentLoaded', loadProfile);
