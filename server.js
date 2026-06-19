// server.js
// Custom local development server for Token x Tiptonic Cap Table & Deal Tracker.
// Serves static assets and maps /api/save-settings to the Vercel function handler,
// loading local environment variables from .env.

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Parse .env file manually to avoid dependency
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          // Remove surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    });
    console.log("✅ Loaded environment variables from .env file.");
  } else {
    console.log("⚠️ No .env file found. API requests to Vercel KV might fail if env is not configured globally.");
  }
}

loadEnv();

// Import the serverless function handler
const saveSettingsHandler = require('./api/save-settings');

const PORT = 3005;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  console.log(`[${req.method}] ${pathname}`);

  // Route API requests to the Vercel serverless function
  if (pathname.startsWith('/api/save-settings')) {
    // Decorate response to match Express/Vercel serverless response signature
    res.status = function(statusCode) {
      res.statusCode = statusCode;
      return res;
    };
    
    res.json = function(body) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
      return res;
    };
    
    // Read body buffer if POST
    if (req.method === 'POST') {
      let bodyData = '';
      req.on('data', chunk => {
        bodyData += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          req.body = JSON.parse(bodyData);
        } catch (e) {
          req.body = {};
        }
        
        req.query = parsedUrl.query;
        try {
          await saveSettingsHandler(req, res);
        } catch (err) {
          console.error("API Handler error:", err);
          res.status(500).json({ error: "Internal Server Error", details: err.message });
        }
      });
    } else {
      req.query = parsedUrl.query;
      try {
        await saveSettingsHandler(req, res);
      } catch (err) {
        console.error("API Handler error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
      }
    }
    return;
  }

  // Handle SPA Routing: fall back to index.html if file doesn't exist
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Fallback to index.html for client side routing if needed
      filePath = path.join(__dirname, 'index.html');
    }
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      } else {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Development server is running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop`);
});
