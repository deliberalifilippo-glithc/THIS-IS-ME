const net = require('net');

function privateHost(host=''){
  const h=String(host).toLowerCase();
  if(h==='localhost'||h.endsWith('.local')) return true;
  if(net.isIP(h)){
    if(h.startsWith('127.')||h.startsWith('10.')||h.startsWith('192.168.')||h.startsWith('169.254.')) return true;
    const m=h.match(/^172\.(\d+)\./); if(m&&+m[1]>=16&&+m[1]<=31) return true;
    if(h==='::1'||h.startsWith('fc')||h.startsWith('fd')||h.startsWith('fe80:')) return true;
  }
  return false;
}

export default async function handler(req,res){
  try{
    const raw=String(req.query?.url||'');
    if(!raw) return res.status(400).send('missing url');
    const u=new URL(raw);
    if(!/^https?:$/.test(u.protocol)||privateHost(u.hostname)) return res.status(400).send('invalid url');
    const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; THIS-IS-ME/1.0)','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},signal:AbortSignal.timeout(7000)});
    if(!r.ok) return res.status(502).send('upstream error');
    const ct=(r.headers.get('content-type')||'').split(';')[0].trim();
    if(!ct.startsWith('image/')) return res.status(415).send('not image');
    const ab=await r.arrayBuffer();
    if(ab.byteLength>8*1024*1024) return res.status(413).send('image too large');
    res.setHeader('Content-Type',ct);
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).send(Buffer.from(ab));
  }catch(e){return res.status(502).send('image unavailable')}
}
