export default async function handler(req, res) {
  const q = String(req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'missing query' });

  const key = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
  if (!key) return res.status(503).json({ error: 'search provider not configured' });

  try {
    const params = new URLSearchParams({
      engine: 'google',
      q: `"${q}"`,
      api_key: key,
      num: '10',
      hl: 'it',
      gl: 'it',
      safe: 'active'
    });
    const r = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!r.ok) return res.status(502).json({ error: 'search provider unavailable' });
    const data = await r.json();
    const results = (data.organic_results || []).slice(0, 10).map(x => ({
      title: x.title || '',
      link: x.link || '',
      snippet: x.snippet || '',
      displayed_link: x.displayed_link || ''
    }));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(500).json({ error: 'search failed' });
  }
}
