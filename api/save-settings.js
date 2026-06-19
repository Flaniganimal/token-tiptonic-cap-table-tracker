// api/save-settings.js
const axios = require('axios');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

  // GET: read a setting back from KV
  if (req.method === 'GET') {
    try {
      if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
        return res.status(500).json({ error: 'Vercel KV environment variables are not configured.' });
      }
      const key = req.query.key;
      if (!key) {
        return res.status(400).json({ error: 'Missing setting key.' });
      }
      const kvRes = await axios.post(KV_REST_API_URL, ["GET", key], {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' }
      });
      const value = (kvRes.data && kvRes.data.result !== undefined) ? kvRes.data.result : null;
      return res.status(200).json({ key, value });
    } catch (err) {
      console.error("Error reading setting from Vercel KV:", err.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to read setting from KV storage', details: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
      return res.status(500).json({ error: 'Vercel KV environment variables are not configured.' });
    }

    const { key, value } = req.body || {};
    if (!key) {
      return res.status(400).json({ error: 'Missing setting key.' });
    }

    // Write to Vercel KV using the Upstash REST client API
    const kvRes = await axios.post(KV_REST_API_URL, ["SET", key, String(value)], {
      headers: { 
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (kvRes.data && kvRes.data.result) {
      console.log(`Successfully saved setting ${key} = ${value} in Vercel KV.`);
      return res.status(200).json({ success: true, key, value });
    } else {
      console.error("Vercel KV responded with unexpected structure:", kvRes.data);
      return res.status(500).json({ error: 'Vercel KV save operation failed.' });
    }

  } catch (err) {
    console.error("Error saving settings to Vercel KV:", err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to write settings to KV storage', details: err.message });
  }
};
