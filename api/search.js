function text(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function host(link=''){try{return new URL(link).hostname.replace(/^www\./,'')}catch(e){return''}}
function unique(rows){const seen=new Set();return rows.filter(x=>x.link&&/^https?:\/\//i.test(x.link)&&!seen.has(x.link)&&(seen.add(x.link),true))}

async function bingHtml(query){
  const u='https://www.bing.com/search?'+new URLSearchParams({q:query,cc:'it',setlang:'it',count:'12'});
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'it-IT,it;q=0.9,en;q=0.7'}});
  if(!r.ok)throw new Error('bing unavailable');const html=await r.text(),out=[];
  const blocks=html.split(/<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>/i).slice(1);
  for(const b of blocks){const a=b.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;const link=a[1].replace(/&amp;/g,'&');if(!/^https?:\/\//i.test(link)||/bing\.com/i.test(link))continue;const p=b.match(/<p[^>]*>([\s\S]*?)<\/p>/i);out.push({title:text(a[2]),link,snippet:text(p?.[1]||''),displayed_link:host(link)})}
  return unique(out).slice(0,12)
}

async function googleHtml(query){
  const u='https://www.google.com/search?'+new URLSearchParams({q:query,hl:'it',num:'12',filter:'0'});
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'it-IT,it;q=0.9,en;q=0.7'}});
  if(!r.ok)throw new Error('google unavailable');const html=await r.text(),out=[];
  const re=/<a[^>]+href="([^"]+)"[^>]*>[\s\S]{0,300}?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi;let m;
  while((m=re.exec(html))&&out.length<14){let link=m[1].replace(/&amp;/g,'&');if(link.startsWith('/url?')){try{const p=new URL('https://google.com'+link);link=p.searchParams.get('q')||p.searchParams.get('url')||''}catch(e){}}if(!/^https?:\/\//i.test(link)||/google\.|gstatic\./i.test(link))continue;const around=html.slice(re.lastIndex,Math.min(html.length,re.lastIndex+900)),sm=around.match(/<(?:div|span)[^>]*>([^<>]{30,420})<\/(?:div|span)>/i);out.push({title:text(m[2]),link,snippet:text(sm?.[1]||''),displayed_link:host(link)})}
  return unique(out).slice(0,12)
}

async function serp(q,key){const p=new URLSearchParams({engine:'google',q:`"${q}"`,api_key:key,num:'12',hl:'it',gl:'it',safe:'active'}),r=await fetch('https://serpapi.com/search.json?'+p);if(!r.ok)throw new Error('serpapi unavailable');const d=await r.json();return(d.organic_results||[]).map(x=>({title:x.title||'',link:x.link||'',snippet:x.snippet||'',displayed_link:x.displayed_link||host(x.link||'')})).slice(0,12)}

async function realSearch(q){
  const key=process.env.SERPAPI_API_KEY||process.env.SERPAPI_KEY;
  if(key){try{const rows=await serp(q,key);if(rows.length)return{provider:'serpapi-google',rows}}catch(e){}}
  const queries=[`"${q}"`,q];
  for(const query of queries){try{const rows=await bingHtml(query);if(rows.length>=2)return{provider:'bing-web',rows}}catch(e){}}
  for(const query of queries){try{const rows=await googleHtml(query);if(rows.length>=2)return{provider:'google-web',rows}}catch(e){}}
  return{provider:'none',rows:[]}
}

export default async function handler(req,res){
  const q=String(req.query?.q||'').trim();if(!q)return res.status(400).json({error:'missing query'});
  try{const {provider,rows}=await realSearch(q);res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');return res.status(200).json({provider,results:rows})}catch(e){return res.status(502).json({error:'search failed',results:[]})}
}
