function cleanHtml(s=''){
  return String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
function resolveDuckUrl(href=''){
  let u=String(href).replace(/&amp;/g,'&');
  try{if(u.startsWith('//'))u='https:'+u;if(u.startsWith('/'))u='https://duckduckgo.com'+u;const p=new URL(u),d=p.searchParams.get('uddg');return d?decodeURIComponent(d):p.href}catch(e){return u}
}
function parseDuck(html=''){
  const out=[];const blocks=html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/i).slice(1);
  for(const block of blocks){const a=block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;const sm=block.match(/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);const link=resolveDuckUrl(a[1]);if(!/^https?:\/\//i.test(link)||/duckduckgo\.com/i.test(link))continue;let displayed='';try{displayed=new URL(link).hostname.replace(/^www\./,'')}catch(e){}out.push({title:cleanHtml(a[2]),link,snippet:cleanHtml(sm?.[1]||''),displayed_link:displayed})}
  return out;
}
async function duckSearch(query){
  const url='https://html.duckduckgo.com/html/?'+new URLSearchParams({q:query,kl:'it-it',kp:'1'});const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'it-IT,it;q=0.9,en;q=0.7'}});if(!r.ok)throw new Error('duckduckgo unavailable');return parseDuck(await r.text());
}
function parseJinaMarkdown(text=''){
  const lines=String(text).split(/\r?\n/),out=[];
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^\s*[-*]?\s*\[([^\]]{2,180})\]\((https?:\/\/[^)]+)\)\s*$/);
    if(!m)continue;const title=m[1].replace(/[*_`]/g,'').trim(),link=m[2].trim();
    if(/google\.|gstatic\.|youtube\.com\/results|accounts\.google/i.test(link))continue;
    let snippet='';for(let j=i+1;j<Math.min(lines.length,i+5);j++){const s=lines[j].trim();if(!s||/^\[/.test(s)||/^[-#]/.test(s))continue;snippet=s.replace(/[*_`]/g,'').slice(0,320);break}
    let displayed='';try{displayed=new URL(link).hostname.replace(/^www\./,'')}catch(e){}
    out.push({title,link,snippet,displayed_link:displayed});
  }
  const seen=new Set();return out.filter(x=>!seen.has(x.link)&&(seen.add(x.link),true));
}
async function jinaReaderSearch(q){
  const target='https://www.google.com/search?'+new URLSearchParams({q:`"${q}"`,hl:'it',num:'10'});
  const r=await fetch('https://r.jina.ai/'+target,{headers:{'Accept':'text/plain','X-Timeout':'12'}});if(!r.ok)throw new Error('jina reader unavailable');return parseJinaMarkdown(await r.text());
}
async function serpSearch(q,key){
  const params=new URLSearchParams({engine:'google',q:`"${q}"`,api_key:key,num:'10',hl:'it',gl:'it',safe:'active'});const r=await fetch(`https://serpapi.com/search.json?${params}`);if(!r.ok)throw new Error('serpapi unavailable');const data=await r.json();return(data.organic_results||[]).slice(0,10).map(x=>({title:x.title||'',link:x.link||'',snippet:x.snippet||'',displayed_link:x.displayed_link||''}));
}
export default async function handler(req,res){
  const q=String(req.query?.q||'').trim();if(!q)return res.status(400).json({error:'missing query'});
  try{
    const key=process.env.SERPAPI_API_KEY||process.env.SERPAPI_KEY;let provider='none',rows=[];
    if(key){try{rows=await serpSearch(q,key);provider='serpapi-google'}catch(e){}}
    if(!rows.length){try{rows=await jinaReaderSearch(q);provider='jina-google'}catch(e){}}
    if(!rows.length){const batches=[];try{batches.push(...await duckSearch(`"${q}"`))}catch(e){}if(batches.length<6){try{batches.push(...await duckSearch(q))}catch(e){}}const seen=new Set();rows=batches.filter(x=>x.link&&!seen.has(x.link)&&(seen.add(x.link),true)).slice(0,12);provider='duckduckgo'}
    res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=600');return res.status(200).json({provider,results:rows.slice(0,12)});
  }catch(e){return res.status(502).json({error:'search failed',results:[]})}
}
