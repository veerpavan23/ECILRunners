// Serverless Webhook Endpoint for IQ301 Integration
// Route: POST /api/iq301-webhook

export default async function handler(req, res) {
    // 1. Enable CORS & verify method
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Must be POST.' });
    }

    try {
        const payload = req.body || {};
        console.log("Received IQ301 Webhook Payload:", JSON.stringify(payload));

        // 2. Extract runner(s) - support single runner or array of runners (payload.runners / payload.participants / payload.data)
        const candidateList = payload.runners || payload.participants || payload.members || payload.data || (Array.isArray(payload) ? payload : null);
        const runnersToInsert = [];

        if (Array.isArray(candidateList) && candidateList.length > 0) {
            candidateList.forEach(item => {
                const name = item.name || item.runner_name || item.full_name || item.FirstName || 'IQ301 Runner';
                const email = item.email || item.runner_email || payload.email || '';
                const phone = item.phone || item.mobile || item.contact_no || payload.phone || '';
                const bib = item.bib || item.bib_number || item.bib_no || item.BibName || name;
                const tshirt = item.tshirt_size || item.size || item.tshirt || item.TShirtSize || '';
                const blood = item.blood_group || item.blood || item.BloodGroup || '';
                const cat = item.category || item.distance || item.race_category || item.Race || payload.category || 'General';

                const meta = {
                    name: name,
                    gender: item.gender || item.sex || item.Gender || '',
                    category: cat,
                    bib: bib,
                    tshirt: tshirt,
                    blood: blood,
                    health: item.health_issues || item.health || '',
                    emergencyPerson: item.eContactName || item.emergency_contact || item.emergency_person || '',
                    emergencyPhone: item.eContact || item.emergency_phone || item.emergency_mobile || '',
                    dob: item.DateOfBirth || item.dob || item.birth_date || '',
                    group: item.RunningGroup || item.running_group || item.group || 'ECIL Runners',
                    regNo: payload.order_id || payload.registration_id || item.RegnRef || item.reg_no || '',
                    total: payload.amount || payload.price || '₹0.00',
                    phone: phone
                };

                runnersToInsert.push({
                    user_name: `${name} __META__:${JSON.stringify(meta)}`,
                    user_email: email,
                    status: 'registered',
                    created_at: new Date().toISOString(),
                    ...(payload.event_id || payload.event ? { event_id: payload.event_id || payload.event } : {})
                });
            });
        } else {
            // Check indexed fields (runner_1, runner_2) or single object
            const runnerName = payload.name || payload.runner_name || payload.full_name || payload.FirstName || 'IQ301 Runner';
            const runnerEmail = payload.email || payload.runner_email || payload.eMail || '';
            const runnerPhone = payload.phone || payload.mobile || payload.contact_no || payload.Phone || '';
            const category = payload.category || payload.distance || payload.race_category || payload.Race || 'General';
            const bibNumber = payload.bib || payload.bib_number || payload.bib_no || payload.BibName || runnerName;
            const tshirtSize = payload.tshirt_size || payload.size || payload.tshirt || payload.TShirtSize || '';
            const bloodGroup = payload.blood_group || payload.blood || payload.BloodGroup || '';

            const meta = {
                name: runnerName,
                gender: payload.gender || payload.sex || payload.Gender || '',
                category: category,
                bib: bibNumber,
                tshirt: tshirtSize,
                blood: bloodGroup,
                health: payload.HealthIssues || payload.health_issues || payload.health || '',
                emergencyPerson: payload.eContactName || payload.EmergencyContactPerson || payload.emergency_contact || payload.emergency_person || '',
                emergencyPhone: payload.eContact || payload.EmergencyMobileNumber || payload.emergency_phone || payload.emergency_mobile || '',
                dob: payload.DateOfBirth || payload.dob || payload.birth_date || '',
                group: payload.RunningGroup || payload.running_group || payload.group || 'ECIL Runners',
                regNo: payload.order_id || payload.registration_id || payload.RegnRef || payload.id || '',
                total: payload.amount || payload.price || '₹0.00',
                phone: runnerPhone
            };

            const record = {
                user_name: `${runnerName} __META__:${JSON.stringify(meta)}`,
                user_email: runnerEmail,
                status: 'registered',
                created_at: new Date().toISOString()
            };
            if (payload.event_id || payload.event) record.event_id = payload.event_id || payload.event;
            runnersToInsert.push(record);
        }

        // 3. Supabase REST API credentials
        const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvehhriirejuffbrowkr.supabase.co';
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';

        // 4. Save registrations into event_registrations table
        const response = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(runnersToInsert)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Supabase insert error:", errText);
            return res.status(200).json({ 
                received: true, 
                warning: 'Saved with warnings',
                details: errText 
            });
        }

        console.log(`Successfully recorded ${runnersToInsert.length} IQ301 registration(s) into database`);

        // 5. Acknowledge successful receipt back to IQ301
        return res.status(200).json({
            status: 'success',
            message: `Recorded ${runnersToInsert.length} registration(s) successfully in ECIL Runners database`,
            count: runnersToInsert.length,
            order_id: payload.order_id || payload.registration_id || payload.id || null
        });

    } catch (error) {
        console.error("Error processing IQ301 webhook:", error);
        return res.status(500).json({ 
            error: 'Internal server error processing webhook', 
            details: error.message 
        });
    }
}
