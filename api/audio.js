// /api/audio?url=ENCODED_AUDIO_URL
import https from 'https';
import http from 'http';

export default function handler(req, res) {
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

  const client = parsed.protocol === 'https:' ? https : http;
  client.get(targetUrl, { headers: { 'Referer': 'https://y.qq.com' } }, (proxyRes) => {
    res.status(proxyRes.statusCode);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    proxyRes.pipe(res);
  }).on('error', () => {
    res.status(502).send('proxy error');
  });
}

export const config = {
  api: {
    responseLimit: '30mb',
  },
};
