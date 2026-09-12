// /api/audio?url=ENCODED_AUDIO_URL
import https from 'https';
import http from 'http';

const ALLOWED_AUDIO_HOST_SUFFIXES = [
  'qq.com',
  'music.163.com',
  '163.com',
  'music.126.net',
  'kugou.com',
];

function isAllowedAudioHost(hostname) {
  const host = hostname.toLowerCase();
  return ALLOWED_AUDIO_HOST_SUFFIXES.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
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

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const targetUrl = req.query?.url;
  if (!targetUrl) {
    res.status(400).send('Missing ?url= parameter');
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isBlockedHostname(parsed.hostname) || !isAllowedAudioHost(parsed.hostname)) {
    res.status(403).json({ error: 'forbidden_target' });
    return;
  }

  const client = parsed.protocol === 'https:' ? https : http;
  const is163AudioHost = parsed.hostname === 'music.163.com' || parsed.hostname.endsWith('.music.163.com') || parsed.hostname === '163.com' || parsed.hostname.endsWith('.163.com') || parsed.hostname === 'music.126.net' || parsed.hostname.endsWith('.music.126.net') || parsed.hostname.endsWith('.126.net');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': is163AudioHost ? 'https://music.163.com/' : 'https://y.qq.com/',
  };
  if (req.headers.range) headers.Range = req.headers.range;
  const requestAudio = (currentUrl, redirectsLeft = 3) => {
    const currentParsed = new URL(currentUrl);
    if ((currentParsed.protocol !== 'https:' && currentParsed.protocol !== 'http:') || isBlockedHostname(currentParsed.hostname) || !isAllowedAudioHost(currentParsed.hostname)) {
      res.status(403).json({ error: 'forbidden_target' });
      return;
    }
    const currentClient = currentParsed.protocol === 'https:' ? https : http;
    const upstreamReq = currentClient.request(currentUrl, { headers, method: req.method }, (proxyRes) => {
      const location = proxyRes.headers.location;
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && location && redirectsLeft > 0) {
        proxyRes.resume();
        requestAudio(new URL(location, currentUrl).toString(), redirectsLeft - 1);
        return;
      }
    res.status(proxyRes.statusCode);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'HEAD') res.end();
    else proxyRes.pipe(res);
    });
    upstreamReq.on('error', () => {
      if (!res.headersSent) res.status(502).send('proxy error');
      else res.destroy();
    });
    // No socket timeout: browsers throttle media reads (backpressure), so the
    // upstream socket legitimately idles mid-stream. Killing it cuts playback.
    upstreamReq.end();
  };
  requestAudio(targetUrl);
}

export const config = {
  api: {
    responseLimit: '30mb',
  },
};
