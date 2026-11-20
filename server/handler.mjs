const MIME = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml',json:'application/json'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
export async function handle(request, env = {}, assets = {}) {
  const url=new URL(request.url);
  if(url.pathname==='/api/status') return json({mapsConfigured:!!env.GOOGLE_MAPS_API_KEY});
  if(url.pathname==='/api/map') {
    if(request.method!=='POST')return json({error:'Use POST to load a map.'},405);
    const origin=request.headers.get('Origin');if(origin && origin!==url.origin)return json({error:'Request origin is not allowed.'},403);
    if(Number(request.headers.get('Content-Length'))>4096)return json({error:'The map request is too large.'},413);
    let data;try {const body=await request.text();if(body.length>4096)return json({error:'The map request is too large.'},413);data=JSON.parse(body);}catch{return json({error:'Enter a map location.'},400);}
    if(!data || typeof data!=='object' || Array.isArray(data))return json({error:'Enter a map location.'},400);
    const key=env.GOOGLE_MAPS_API_KEY || data.key;
    if(!key || typeof key!=='string' || !/^[\w-]{15,256}$/.test(key))return json({error:'Add a valid Google Maps Static API key.'},400);
    if(typeof data.location!=='string' || !data.location.trim() || data.location.length>200)return json({error:'Enter an address or latitude, longitude.'},400);
    if(!Number.isInteger(data.zoom)||data.zoom<1||data.zoom>21||!['satellite','hybrid','roadmap'].includes(data.type))return json({error:'Choose a valid zoom and map type.'},400);
    const target=new URL('https://maps.googleapis.com/maps/api/staticmap');
    target.search=new URLSearchParams({center:data.location.trim(),zoom:String(data.zoom),size:'640x480',scale:'2',maptype:data.type,format:'png',key}).toString();
    try {
      const response=await fetch(target,{signal:AbortSignal.timeout(20000),headers:{'Accept':'image/png'}});
      if(!response.ok || !response.headers.get('Content-Type')?.startsWith('image/'))return json({error:'Google Maps could not load. Check the key, Maps Static API access and billing.'},502);
      return new Response(response.body,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }catch{return json({error:'Google Maps is unavailable. Retry or upload an image.'},502);}
  }
  if(url.pathname==='/terms')return new Response('<!doctype html><title>PlanScan — Terms</title><main style="max-width:700px;margin:60px auto;font:16px/1.6 system-ui"><h1>PlanScan</h1><p>Planning estimates are based on the durations you enter. Uploaded plans and stations are stored on your device. Save a project file for a portable copy.</p><p>Google Maps features are subject to the <a href="https://maps.google.com/help/terms_maps.html">Google Maps/Google Earth Additional Terms of Service</a> and <a href="https://www.google.com/policies/privacy/">Google Privacy Policy</a>. Map requests send the chosen location to Google. API keys supplied in the map dialog are used only for the request and are not saved in projects.</p><a href="/">Return to planner</a></main>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname;
  const asset=assets[path];if(asset===undefined)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':MIME[path.split('.').pop()]||'text/plain; charset=utf-8','Cache-Control':path.startsWith('/vendor/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
