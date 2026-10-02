const supabaseUrl = 'https://cvehhriirejuffbrowkr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const loadingState = document.getElementById('loading-state');
    const adminPanel = document.getElementById('admin-panel');
    const adminError = document.getElementById('admin-error');
    
    if (!session) {
        loadingState.style.display = 'none';
        adminError.textContent = 'Access Denied: You must be logged in to view the Admin Dashboard.';
        adminError.classList.remove('hidden');
        return;
    }
    
    // For a real production app, we would verify if the user has an admin role.
    // For now, any logged-in user can access this.

    loadingState.style.display = 'none';
    adminPanel.style.display = 'block';

    // Fetch current data
    const { data, error } = await supabaseClient.from('runner_of_the_month').select('*').eq('id', 1).single();
    if (data) {
        document.getElementById('rotm-name').value = data.name || '';
        document.getElementById('rotm-quote').value = data.quote || '';
        document.getElementById('rotm-image-url').value = data.image_url || '';
        if (data.image_url) {
            document.getElementById('rotm-preview').src = data.image_url;
            document.getElementById('rotm-preview').classList.remove('hidden');
        }
    }

    // Handle Image Upload
    document.getElementById('rotm-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const statusLabel = document.getElementById('upload-status');
        statusLabel.classList.remove('hidden');

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = 'rotm_' + Math.random().toString(36).substring(2) + '.' + fileExt;

            const { data, error } = await supabaseClient.storage
                .from('avatars') // reusing the avatars bucket for simplicity
                .upload(fileName, file, { upsert: true });

            if (error) throw error;

            const { data: publicUrlData } = supabaseClient.storage
                .from('avatars')
                .getPublicUrl(fileName);

            document.getElementById('rotm-image-url').value = publicUrlData.publicUrl;
            document.getElementById('rotm-preview').src = publicUrlData.publicUrl;
            document.getElementById('rotm-preview').classList.remove('hidden');
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            statusLabel.classList.add('hidden');
        }
    });

    // Handle Save
    document.getElementById('save-rotm').addEventListener('click', async () => {
        const name = document.getElementById('rotm-name').value;
        const quote = document.getElementById('rotm-quote').value;
        const imageUrl = document.getElementById('rotm-image-url').value;

        const btn = document.getElementById('save-rotm');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            // Check if row exists first
            const { data: existing } = await supabaseClient.from('runner_of_the_month').select('id').eq('id', 1).single();
            
            let res;
            if (existing) {
                res = await supabaseClient.from('runner_of_the_month').update({ name, quote, image_url: imageUrl }).eq('id', 1);
            } else {
                res = await supabaseClient.from('runner_of_the_month').insert([{ id: 1, name, quote, image_url: imageUrl }]);
            }

            if (res.error) throw res.error;
            
            document.getElementById('save-success').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('save-success').classList.add('hidden');
            }, 3000);
        } catch (error) {
            alert('Save failed: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    });
});

