export default async function handler(req, res) {
  const q = String(req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'missing query' });

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const uniq = rows => {
    const seen = new Set();
    return rows.filter(x => {
      const key = x.image || x.thumbnail || '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  try {
    const key = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    if (key) {
      const params = new URLSearchParams({
        engine: 'google_images',
        q: `"${q}"`,
        api_key: key,
        hl: 'it',
        gl: 'it',
        safe: 'active',
        ijn: '0'
      });
      const r = await fetch(`https://serpapi.com/search.json?${params}`);
      if (r.ok) {
        const d = await r.json();
        const rows = uniq((d.images_results || []).slice(0, 16).map(x => ({
          title: clean(x.title),
          image: x.original || x.thumbnail || '',
          thumbnail: x.thumbnail || x.original || '',
          page: x.link || x.source || '',
          source: clean(x.source || '')
        })));
        if (rows.length) {
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
          return res.status(200).json({ provider: 'google-images', results: rows.slice(0, 12) });
        }
      }
    }
  } catch (e) {}

  try {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
    const page = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent('"' + q + '"')}&iax=images&ia=images`, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.7' }
    });
    if (page.ok) {
      const txt = await page.text();
      const m = txt.match(/vqd=['"]?([\d-]+)['"]?/) || txt.match(/vqd=([\d-]+)/);
      if (m?.[1]) {
        const p = new URLSearchParams({
          l: 'it-it', o: 'json', q: `"${q}"`, vqd: m[1], f: ',,,,,', p: '1'
        });
        const r = await fetch(`https://duckduckgo.com/i.js?${p}`, {
          headers: { 'User-Agent': ua, Referer: 'https://duckduckgo.com/' }
        });
        if (r.ok) {
          const d = await r.json();
          const rows = uniq((d.results || []).slice(0, 18).map(x => ({
            title: clean(x.title),
            image: x.image || x.thumbnail || '',
            thumbnail: x.thumbnail || x.image || '',
            page: x.url || '',
            source: clean(x.source || '')
          })));
          if (rows.length) {
            res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
            return res.status(200).json({ provider: 'duckduckgo-images', results: rows.slice(0, 12) });
          }
        }
      }
    }
  } catch (e) {}

  try {
    const endpoint = 'https://commons.wikimedia.org/w/api.php';
    const p = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: `"${q}"`, gsrnamespace: '6', gsrlimit: '18',
      prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '900', format: 'json', origin: '*'
    });
    const r = await fetch(`${endpoint}?${p}`);
    if (r.ok) {
      const d = await r.json();
      const rows = uniq(Object.values(d.query?.pages || {}).map(pg => {
        const ii = pg.imageinfo?.[0] || {};
        return {
          title: clean((pg.title || '').replace(/^File:/, '')),
          image: ii.thumburl || ii.url || '',
          thumbnail: ii.thumburl || ii.url || '',
          page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title || '')}`,
          source: 'Wikimedia Commons'
        };
      }));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({ provider: 'wikimedia-commons', results: rows.slice(0, 12) });
    }
  } catch (e) {}

  return res.status(200).json({ provider: 'none', results: [] });
}
