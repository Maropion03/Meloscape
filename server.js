// Meloscape — Local Server with API Proxy
// Serves static files + proxies QQ/163/Kugou API requests

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8765);
const STATIC_DIR = __dirname;
const ALLOWED_PROXY_HOSTS = [
  'netease-cloud-music-api-alpha-dun.vercel.app',
  'music.163.com',
  'c.y.qq.com',
  'u.y.qq.com',
  'y.qq.com',
  'www.kugou.com',
];
const ALLOWED_AUDIO_HOST_SUFFIXES = ['qq.com', 'music.163.com', '163.com', 'music.126.net', 'kugou.com'];

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

function hostMatches(hostname, allowed) {
  const host = hostname.toLowerCase();
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isSupportedProtocol(protocol) {
  return protocol === 'https:' || protocol === 'http:';
}

function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase();
  return host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host);
}

function isAllowedProxyPath(hostname, pathname) {
  const host = hostname.toLowerCase();
  if (host === 'netease-cloud-music-api-alpha-dun.vercel.app') {
    return ['/song/detail', '/song/url', '/search', '/lyric'].includes(pathname);
  }
  if (host === 'c.y.qq.com') return pathname === '/soso/fcgi-bin/client_search_cp';
  if (host === 'u.y.qq.com') return pathname === '/cgi-bin/musicu.fcg';
  if (host === 'www.kugou.com') return pathname === '/yy/index.php';
  if (host === 'music.163.com') return pathname === '/song';
  return false;
}

function proxyRequest(targetUrl, req, res) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(JSON.stringify({ error: 'invalid_url' }));
  }
  if (!isSupportedProtocol(parsed.protocol) || isBlockedHostname(parsed.hostname) || !hostMatches(parsed.hostname, ALLOWED_PROXY_HOSTS) || !isAllowedProxyPath(parsed.hostname, parsed.pathname)) {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(JSON.stringify({ error: 'forbidden_target' }));
  }

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
  if (parsed.hostname === 'c.y.qq.com' || parsed.hostname === 'u.y.qq.com' || parsed.hostname === 'y.qq.com' || parsed.hostname.endsWith('.y.qq.com')) {
    options.headers['Referer'] = 'https://y.qq.com';
  }
  if (parsed.hostname === 'music.163.com') {
    options.headers['Referer'] = 'https://music.163.com';
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const proxyReq = client.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...(proxyRes.headers['content-type'] ? { 'Content-Type': proxyRes.headers['content-type'] } : {}),
      ...(proxyRes.headers['cache-control'] ? { 'Cache-Control': proxyRes.headers['cache-control'] } : {}),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    // Upstream may fail after headers were already sent (mid-body socket error
    // or timeout). Writing headers again would throw and crash the process.
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'proxy_error' }));
    } else {
      res.destroy();
    }
  });
  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy(new Error('upstream timeout'));
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
          resolve({ artist: artist || 'Unknown', songname });
        } else {
          // Last resort: <title> tag
          const m = body.match(/<title>([^<]+)<\/title>/);
          if (m) {
            const title = m[1].replace(/\s*-\s*单曲\s*-\s*网易云音乐\s*$/, '').trim();
            const parts = title.split(/\s*-\s*/);
            if (parts.length >= 2) {
              resolve({ artist: parts[0].trim(), songname: parts.slice(1).join(' - ').trim() });
            } else {
              resolve({ artist: 'Unknown', songname: title });
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
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'method_not_allowed' }));
    }
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
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'method_not_allowed' }));
    }
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      return res.end('Missing ?url= parameter');
    }
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify({ error: 'invalid_url' }));
    }
    if (!isSupportedProtocol(parsed.protocol) || isBlockedHostname(parsed.hostname) || !hostMatches(parsed.hostname, ALLOWED_AUDIO_HOST_SUFFIXES)) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify({ error: 'forbidden_target' }));
    }
    const is163AudioHost = parsed.hostname === 'music.163.com' || parsed.hostname.endsWith('.music.163.com') || parsed.hostname === '163.com' || parsed.hostname.endsWith('.163.com') || parsed.hostname === 'music.126.net' || parsed.hostname.endsWith('.music.126.net') || parsed.hostname.endsWith('.126.net');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': is163AudioHost ? 'https://music.163.com/' : 'https://y.qq.com/',
    };
    if (req.headers.range) headers.Range = req.headers.range;
    const requestAudio = (currentUrl, redirectsLeft = 3) => {
      const currentParsed = new URL(currentUrl);
      if (!isSupportedProtocol(currentParsed.protocol) || isBlockedHostname(currentParsed.hostname) || !hostMatches(currentParsed.hostname, ALLOWED_AUDIO_HOST_SUFFIXES)) {
        res.writeHead(403, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        return res.end(JSON.stringify({ error: 'forbidden_target' }));
      }
      const client = currentParsed.protocol === 'https:' ? https : http;
      const upstreamReq = client.request(currentUrl, { method: req.method, headers }, (proxyRes) => {
        const location = proxyRes.headers.location;
        if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && location && redirectsLeft > 0) {
          proxyRes.resume();
          requestAudio(new URL(location, currentUrl).toString(), redirectsLeft - 1);
          return;
        }
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
        ...(proxyRes.headers['content-length'] ? { 'Content-Length': proxyRes.headers['content-length'] } : {}),
        ...(proxyRes.headers['content-range'] ? { 'Content-Range': proxyRes.headers['content-range'] } : {}),
        ...(proxyRes.headers['accept-ranges'] ? { 'Accept-Ranges': proxyRes.headers['accept-ranges'] } : {}),
        'Access-Control-Allow-Origin': '*',
      });
      if (req.method === 'HEAD') res.end();
      else proxyRes.pipe(res);
      }).on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('proxy error');
        } else {
          res.destroy();
        }
      });
      upstreamReq.setTimeout(0); // media streams idle under browser backpressure — never kill on inactivity
      upstreamReq.end();
    };
    requestAudio(targetUrl);
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
  console.log(`🎵 Meloscape → http://localhost:${PORT}`);
  console.log('   Paste a music link or press Ctrl+V');
  console.log('   Ctrl+C to stop');
});
