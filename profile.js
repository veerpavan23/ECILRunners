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
const inputPhone = document.getElementById('profile-phone');
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
    if (meta.phone) inputPhone.value = meta.phone;
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

// Handle Avatar Upload to Supabase Storage
const avatarUpload = document.getElementById('profile-avatar-upload');
if (avatarUpload) {
    avatarUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
            avatarPreview.classList.remove('hidden');
            avatarFallback.classList.add('hidden');
        };
        reader.readAsDataURL(file);

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Uploading Image...</span>';
        msgBox.classList.add('hidden');
        
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            const fileExt = file.name.split('.').pop();
            const fileName = user.id + '-' + Math.random() + '.' + fileExt;

            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            
            inputAvatar.value = publicUrl;
            msgBox.textContent = 'Image uploaded! Click Save Profile to apply.';
            msgBox.className = 'mb-6 p-4 rounded-xl text-sm font-bold text-center bg-green-50 text-green-600 block';
        } catch (error) {
            msgBox.textContent = "Upload failed: " + error.message + " (Check if 'avatars' storage bucket exists)";
            msgBox.className = 'mb-6 p-4 rounded-xl text-sm font-bold text-center bg-red-50 text-red-600 block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> <span>Save Profile</span>';
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
            phone: inputPhone.value,
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





// --- PASSPORT & STRAVA LOGIC ---
const STRAVA_CLIENT_ID = '284134';
const STRAVA_CLIENT_SECRET = 'bb433af36fb62935c760e8338ccf307998b53eaa';

document.addEventListener('DOMContentLoaded', async () => {
    const connectStravaBtn = document.getElementById('connect-strava-btn');
    if (connectStravaBtn) {
        connectStravaBtn.addEventListener('click', () => {
            const redirectUri = window.location.origin + window.location.pathname;
            const authUrl = 'https://www.strava.com/oauth/authorize?client_id=' + STRAVA_CLIENT_ID + '&response_type=code&redirect_uri=' + encodeURIComponent(redirectUri) + '&approval_prompt=force&scope=activity:read_all';
            window.location.href = authUrl;
        });
    }

    // Check for OAuth Code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        // Exchange code for tokens
        try {
            const res = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: STRAVA_CLIENT_ID,
                    client_secret: STRAVA_CLIENT_SECRET,
                    code: code,
                    grant_type: 'authorization_code'
                })
            });
            const data = await res.json();
            if (data.access_token) {
                // Save tokens to user metadata in Supabase
                const { error } = await supabaseClient.auth.updateUser({
                    data: { 
                        strava_access_token: data.access_token,
                        strava_refresh_token: data.refresh_token,
                        strava_athlete_id: data.athlete.id
                    }
                });
                if (error) throw error;
                
                // Clear the URL
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Strava Connected Successfully!");
                
                // Reload profile data
                loadPassportData();
            }
        } catch (err) {
            console.error("Strava connect error:", err);
            alert("Failed to connect Strava.");
        }
    }
});

async function loadPassportData() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const stravaUnconnected = document.getElementById('strava-unconnected');
    const stravaConnected = document.getElementById('strava-connected');
    
    if (user.user_metadata?.strava_access_token) {
        stravaUnconnected.classList.add('hidden');
        stravaConnected.classList.remove('hidden');
        
        // Fetch runs from Supabase to show total KM
        const { data: runs, error } = await supabaseClient.from('strava_runs').select('distance_meters').eq('user_id', user.id);
        if (runs) {
            let totalMeters = runs.reduce((sum, run) => sum + run.distance_meters, 0);
            document.getElementById('strava-total-km').textContent = (totalMeters / 1000).toFixed(1);
        }

        // Handle Sync Button
        document.getElementById('sync-strava-btn').onclick = async () => {
            document.getElementById('sync-strava-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Syncing...';
            try {
                // Fetch recent runs from Strava
                const res = await fetch(https://www.strava.com/api/v3/athlete/activities?per_page=30, {
                    headers: { 'Authorization': 'Bearer ' + user.user_metadata.strava_access_token }
                });
                const activities = await res.json();
                
                if (activities.message === "Authorization Error") {
                    // Token expired, need refresh logic here (simplified for prototype)
                    alert("Strava token expired. Please disconnect and reconnect.");
                } else if (Array.isArray(activities)) {
                    // Upsert into Supabase
                    for (let act of activities) {
                        if (act.type === 'Run' || act.type === 'VirtualRun') {
                            await supabaseClient.from('strava_runs').upsert({
                                user_id: user.id,
                                strava_activity_id: act.id,
                                distance_meters: act.distance,
                                moving_time_seconds: act.moving_time,
                                start_date: act.start_date,
                                average_speed: act.average_speed
                            }, { onConflict: 'strava_activity_id' });
                        }
                    }
                    loadPassportData(); // reload UI
                }
            } catch (err) {
                console.error("Sync error:", err);
            }
            document.getElementById('sync-strava-btn').innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Sync Now';
        };

    } else {
        stravaUnconnected.classList.remove('hidden');
        stravaConnected.classList.add('hidden');
    }

    // Load Community & Trophy placeholders (would fetch from DB here)
    const { count: communityCount } = await supabaseClient.from('event_attendance').select('*', { count: 'exact' }).eq('user_id', user.id);
    if (communityCount !== null) document.getElementById('community-events-count').textContent = communityCount;

    const { count: trophyCount } = await supabaseClient.from('trophy_cabinet').select('*', { count: 'exact' }).eq('user_id', user.id);
    if (trophyCount !== null) document.getElementById('trophy-count').textContent = trophyCount;
}

// Call loadPassportData after main profile loads
const originalLoadProfile = loadProfile;
loadProfile = async () => {
    await originalLoadProfile();
    await loadPassportData();
};

