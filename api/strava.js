export default async function handler(req, res) {
    try {
        const response = await fetch('https://www.strava.com/clubs/572051', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        
        if (!response.ok) {
            throw new Error('Strava returned ' + response.status);
        }

        const html = await response.text();
        
        const memberMatch = html.match(/"memberCount":(\d+)/);
        const activeRunners = memberMatch ? parseInt(memberMatch[1], 10) : 0;
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour to avoid rate limits
        res.status(200).json({ success: true, activeRunners });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
}
