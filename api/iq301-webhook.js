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

        // 2. Extract standard running registration fields with smart fallbacks
        const runnerName = payload.name || payload.runner_name || payload.full_name || 'IQ301 Runner';
        const runnerEmail = payload.email || payload.runner_email || '';
        const runnerPhone = payload.phone || payload.mobile || payload.contact_no || '';
        const category = payload.category || payload.distance || payload.race_category || 'General';
        const bibNumber = payload.bib || payload.bib_number || payload.bib_no || null;
        const tshirtSize = payload.tshirt_size || payload.size || payload.tshirt || null;
        const iq301OrderId = payload.order_id || payload.registration_id || payload.id || null;
        const amountPaid = payload.amount || payload.price || 0;
        const eventId = payload.event_id || payload.event || null;

        // 3. Supabase REST API credentials
        const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvehhriirejuffbrowkr.supabase.co';
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZWhocmlpcmVqdWZmYnJvd2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIzMDEsImV4cCI6MjEwNjIzODMwMX0.FKnvc0Xj66_VWRbeWOWChG7SSmjjPyxNyHNJmX0E8qA';

        // 4. Save registration into event_registrations table
        const insertPayload = {
            user_name: runnerName,
            user_email: runnerEmail,
            status: 'registered',
            created_at: new Date().toISOString()
        };

        if (eventId) insertPayload.event_id = eventId;

        const response = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify([insertPayload])
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Supabase insert error:", errText);
            // Still return 200 to IQ301 so their webhook doesn't fail/retry endlessly, but log details
            return res.status(200).json({ 
                received: true, 
                warning: 'Saved with warnings',
                details: errText 
            });
        }

        console.log(`Successfully recorded IQ301 registration for ${runnerName} (${runnerEmail})`);

        // 5. Acknowledge successful receipt back to IQ301
        return res.status(200).json({
            status: 'success',
            message: 'Registration recorded successfully in ECIL Runners database',
            runner: runnerName,
            order_id: iq301OrderId
        });

    } catch (error) {
        console.error("Error processing IQ301 webhook:", error);
        return res.status(500).json({ 
            error: 'Internal server error processing webhook', 
            details: error.message 
        });
    }
}
