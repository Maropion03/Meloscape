// Audio Visualizer — Local Server with API Proxy
// Serves static files + proxies QQ/163/Kugou API requests

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const STATIC_DIR = __dirname;

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

function proxyRequest(targetUrl, req, res) {
  const parsed = new URL(targetUrl);

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  };

  // Platform-specific headers
  if (parsed.hostname.includes('qq.com')) {
    options.headers['Referer'] = 'https://y.qq.com';
  }
  if (parsed.hostname.includes('163.com')) {
    options.headers['Referer'] = 'https://music.163.com';
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const proxyReq = client.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
  });

  proxyReq.end();
}

// Special endpoint: scrape 163 song page title
function fetch163SongTitle(songId) {
  return new Promise((resolve) => {
    const url = `https://music.163.com/song?id=${songId}`;
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://music.163.com/',
        'Cookie': 'os=pc;',
      },
    }, (resp) => {
      let body = '';
      resp.on('data', (chunk) => body += chunk);
      resp.on('end', () => {
        // Strategy 1: og:title meta tag (most reliable)
        const ogTitle = body.match(/og:title[^"]*"?\s*content\s*=\s*"([^"]+)"/);
        // Strategy 2: meta description
        const descM = body.match(/name\s*=\s*"description"[^>]*content\s*=\s*"([^"]{10,200})"/);
        
        if (ogTitle) {
          const songname = ogTitle[1].trim();
          // Try to find artist from description: "歌曲名《XXX》，由 YYY 演唱"
          let artist = '';
          if (descM) {
            const desc = descM[1];
            const singerM = desc.match(/由\s*(.+?)\s*演唱/);
            if (singerM) artist = singerM[1].trim();
          }
          // Fallback: parse from <title> for artist
          if (!artist) {
            const titleM = body.match(/<title>([^<]+)<\/title>/);
            if (titleM) {
              const title = titleM[1].replace(/\s*-\s*单曲\s*-\s*网易云音乐\s*$/, '').trim();
              const parts = title.split(/\s*-\s*/);
              if (parts.length >= 2 && parts[1].trim() !== songname) {
                artist = parts[0].trim();
              }
            }
          }
          resolve({ artist: artist || '未知', songname });
        } else {
          // Last resort: <title> tag
          const m = body.match(/<title>([^<]+)<\/title>/);
          if (m) {
            const title = m[1].replace(/\s*-\s*单曲\s*-\s*网易云音乐\s*$/, '').trim();
            const parts = title.split(/\s*-\s*/);
            if (parts.length >= 2) {
              resolve({ artist: parts[0].trim(), songname: parts.slice(1).join(' - ').trim() });
            } else {
              resolve({ artist: '未知', songname: title });
            }
          } else {
            resolve(null);
          }
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API proxy: /api/proxy?url=ENCODED_URL
  if (url.pathname === '/api/proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      return res.end('Missing ?url= parameter');
    }
    return proxyRequest(targetUrl, req, res);
  }

  // 163 song title scraper: /api/163-title?id=1871871952
  if (url.pathname === '/api/163-title') {
    const songId = url.searchParams.get('id');
    if (!songId) {
      res.writeHead(400);
      return res.end('Missing ?id= parameter');
    }
    fetch163SongTitle(songId).then((data) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data || { error: 'not_found' }));
    });
    return;
  }

  // Audio proxy: /api/audio?url=ENCODED_AUDIO_URL (for QQ CDN audio with CORS)
  if (url.pathname === '/api/audio') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      return res.end('Missing ?url= parameter');
    }
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    client.get(targetUrl, { headers: { 'Referer': 'https://y.qq.com' } }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
        'Content-Length': proxyRes.headers['content-length'],
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    }).on('error', () => { res.writeHead(502); res.end('proxy error'); });
    return;
  }

  // Static file serving
  let filePath = path.join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  filePath = path.normalize(filePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎵 Audio Visualizer → http://localhost:${PORT}`);
  console.log('   拖入歌曲链接或 Ctrl+V 粘贴');
  console.log('   Ctrl+C 停止');
});
