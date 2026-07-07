// /api/proxy?url=ENCODED_URL
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

  if (parsed.hostname.includes('qq.com')) {
    options.headers['Referer'] = 'https://y.qq.com';
  }
  if (parsed.hostname.includes('163.com')) {
    options.headers['Referer'] = 'https://music.163.com';
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const proxyReq = client.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'proxy_error', message: err.message });
  });

  proxyReq.end();
}

export const config = {
  api: {
    responseLimit: '30mb',
  },
};
