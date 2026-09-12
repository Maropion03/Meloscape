// /api/proxy?url=ENCODED_URL

const ALLOWED_HOSTS = [
  'netease-cloud-music-api-alpha-dun.vercel.app',
  'music.163.com',
  'c.y.qq.com',
  'u.y.qq.com',
  'y.qq.com',
  'www.kugou.com',
];

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
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

function isAllowedPath(hostname, pathname) {
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
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
  if (!isSupportedProtocol(parsed.protocol) || isBlockedHostname(parsed.hostname) || !isAllowedHost(parsed.hostname) || !isAllowedPath(parsed.hostname, parsed.pathname)) {
    res.status(403).json({ error: 'forbidden_target' });
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

  if (parsed.hostname === 'c.y.qq.com' || parsed.hostname === 'u.y.qq.com' || parsed.hostname === 'y.qq.com' || parsed.hostname.endsWith('.y.qq.com')) {
    options.headers['Referer'] = 'https://y.qq.com';
  }
  if (parsed.hostname === 'music.163.com') {
    options.headers['Referer'] = 'https://music.163.com';
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      headers: options.headers,
      signal: ctrl.signal,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    const cacheControl = upstream.headers.get('cache-control');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(body);
  } catch {
    res.status(502).json({ error: 'proxy_error' });
  } finally {
    clearTimeout(timer);
  }
}

export const config = {
  api: {
    responseLimit: '30mb',
  },
};
