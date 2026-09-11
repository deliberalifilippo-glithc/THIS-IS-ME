const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/\s+/g,' ').trim();
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return''}};
const uniq=rows=>{const seen=new Set();return rows.filter(x=>{const k=x.image||x.thumbnail||'';if(!k||seen.has(k))return false;seen.add(k);return true})};
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

async function bingPages(q){
  const u='https://www.bing.com/search?'+new URLSearchParams({q:`"${q}"`,cc:'it',setlang:'it',count:'10'});
  const r=await fetch(u,{headers:{'User-Agent':UA,'Accept-Language':'it-IT,it;q=0.9,en;q=0.7'}});if(!r.ok)return[];
  const html=await r.text(),out=[];
  for(const b of html.split(/<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>/i).slice(1)){
    const a=b.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;
    const link=a[1].replace(/&amp;/g,'&');if(!/^https?:\/\//i.test(link)||/bing\.com/i.test(link))continue;
    out.push({title:clean(a[2]),link});if(out.length>=8)break;
  }
  return out;
}

async function googlePages(q){
  const u='https://www.google.com/search?'+new URLSearchParams({q:`"${q}"`,hl:'it',num:'10',filter:'0'});
  const r=await fetch(u,{headers:{'User-Agent':UA,'Accept-Language':'it-IT,it;q=0.9,en;q=0.7'}});if(!r.ok)return[];
  const html=await r.text(),out=[],re=/<a[^>]+href="([^"]+)"[^>]*>[\s\S]{0,300}?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi;let m;
  while((m=re.exec(html))&&out.length<8){let link=m[1].replace(/&amp;/g,'&');if(link.startsWith('/url?')){try{const p=new URL('https://google.com'+link);link=p.searchParams.get('q')||p.searchParams.get('url')||''}catch(e){}}if(!/^https?:\/\//i.test(link)||/google\.|gstatic\./i.test(link))continue;out.push({title:clean(m[2]),link})}
  return out;
}

function abs(base,u=''){try{return new URL(u,base).href}catch(e){return''}}
function metaImage(html,base){
  const pats=[
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for(const p of pats){const m=html.match(p);if(m?.[1]){const u=abs(base,m[1].replace(/&amp;/g,'&'));if(/^https?:\/\//i.test(u))return u}}
  const imgs=[...html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)].slice(0,20).map(m=>abs(base,m[1]));
  return imgs.find(u=>/^https?:\/\//i.test(u)&&!/(logo|icon|avatar|sprite|pixel|tracking)/i.test(u))||'';
}

async function imageFromPage(row){
  try{
    const r=await fetch(row.link,{headers:{'User-Agent':UA,'Accept-Language':'it-IT,it;q=0.9,en;q=0.7'},redirect:'follow',signal:AbortSignal.timeout(4200)});if(!r.ok)return null;
    const ct=r.headers.get('content-type')||'';if(!/text\/html/i.test(ct))return null;
    const html=(await r.text()).slice(0,900000),img=metaImage(html,r.url||row.link);if(!img)return null;
    return{title:row.title||host(row.link),image:img,thumbnail:img,page:r.url||row.link,source:host(r.url||row.link)};
  }catch(e){return null}
}

async function pageImageSearch(q){
  let pages=[];try{pages=await bingPages(q)}catch(e){}if(pages.length<2){try{pages=[...pages,...await googlePages(q)]}catch(e){}}
  const seen=new Set();pages=pages.filter(x=>x.link&&!seen.has(x.link)&&(seen.add(x.link),true)).slice(0,8);
  const rows=(await Promise.all(pages.map(imageFromPage))).filter(Boolean);
  return uniq(rows);
}

export default async function handler(req,res){
  const q=String(req.query?.q||'').trim();if(!q)return res.status(400).json({error:'missing query'});

  try{
    const key=process.env.SERPAPI_API_KEY||process.env.SERPAPI_KEY;
    if(key){
      const p=new URLSearchParams({engine:'google_images',q:`"${q}"`,api_key:key,hl:'it',gl:'it',safe:'active',ijn:'0'}),r=await fetch('https://serpapi.com/search.json?'+p);
      if(r.ok){const d=await r.json(),rows=uniq((d.images_results||[]).slice(0,16).map(x=>({title:clean(x.title),image:x.original||x.thumbnail||'',thumbnail:x.thumbnail||x.original||'',page:x.link||x.source||'',source:clean(x.source||'')})));if(rows.length){res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');return res.status(200).json({provider:'google-images',results:rows.slice(0,12)})}}
    }
  }catch(e){}

  try{
    const rows=await pageImageSearch(q);if(rows.length){res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');return res.status(200).json({provider:'public-web-pages',results:rows.slice(0,10)})}
  }catch(e){}

  try{
    const endpoint='https://commons.wikimedia.org/w/api.php',p=new URLSearchParams({action:'query',generator:'search',gsrsearch:`"${q}"`,gsrnamespace:'6',gsrlimit:'18',prop:'imageinfo',iiprop:'url|mime',iiurlwidth:'900',format:'json',origin:'*'}),r=await fetch(endpoint+'?'+p);
    if(r.ok){const d=await r.json(),rows=uniq(Object.values(d.query?.pages||{}).map(pg=>{const ii=pg.imageinfo?.[0]||{};return{title:clean((pg.title||'').replace(/^File:/,'')),image:ii.thumburl||ii.url||'',thumbnail:ii.thumburl||ii.url||'',page:`https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title||'')}`,source:'Wikimedia Commons'}}));res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');return res.status(200).json({provider:'wikimedia-commons',results:rows.slice(0,12)})}
  }catch(e){}

  return res.status(200).json({provider:'none',results:[]});
}
