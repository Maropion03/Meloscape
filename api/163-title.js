// /api/163-title?id=SONG_ID
import https from 'https';

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
        const ogTitle = body.match(/og:title[^"]*"?\s*content\s*=\s*"([^"]+)"/);
        const descM = body.match(/name\s*=\s*"description"[^>]*content\s*=\s*"([^"]{10,200})"/);

        if (ogTitle) {
          const songname = ogTitle[1].trim();
          let artist = '';
          if (descM) {
            const desc = descM[1];
            const singerM = desc.match(/由\s*(.+?)\s*演唱/);
            if (singerM) artist = singerM[1].trim();
          }
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

export default async function handler(req, res) {
  const songId = req.query?.id;
  if (!songId) {
    res.status(400).json({ error: 'Missing ?id= parameter' });
    return;
  }

  const data = await fetch163SongTitle(songId);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(data || { error: 'not_found' });
}
