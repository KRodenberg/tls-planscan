const MIME={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml',json:'application/json'};
const SIX_ROOT='https://maps.six.nsw.gov.au/arcgis/rest/services/public/';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
async function aerial(request){
 if(request.method!=='POST')return json({error:'Use POST to load an aerial.'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(Number(request.headers.get('Content-Length'))>4096)return json({error:'The aerial request is too large.'},413);
 let data;try{const body=await request.text();if(body.length>4096)return json({error:'The aerial request is too large.'},413);data=JSON.parse(body);}catch{return json({error:'Enter an aerial location.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Enter an aerial location.'},400);
 const {latitude,longitude,widthMetres}=data;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -39||latitude> -28||longitude<140||longitude>160)return json({error:'Enter a location within NSW: latitude −39 to −28, longitude 140 to 160.'},400);
 if(!Number.isFinite(widthMetres)||widthMetres<25||widthMetres>20000)return json({error:'Choose an aerial width from 25 to 20,000 metres.'},400);
 const zone=Math.floor((longitude+180)/6)+1,epsg=7800+zone;
 const halfLat=widthMetres*.75/2/111320,halfLon=widthMetres/2/(111320*Math.cos(latitude*Math.PI/180));
 const target=new URL(SIX_ROOT+'NSW_Imagery/MapServer/export');
 target.search=new URLSearchParams({f:'json',bbox:[longitude-halfLon,latitude-halfLat,longitude+halfLon,latitude+halfLat].join(','),bboxSR:'7844',imageSR:String(epsg),size:'1600,1200',format:'jpg',dpi:'96',transparent:'false'}).toString();
 try{
  const response=await fetch(target,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Provider error');
  const metadata=await response.json(),e=metadata.extent;
  if(metadata.error||!e||!['xmin','ymin','xmax','ymax'].every(k=>Number.isFinite(e[k]))||e.xmax<=e.xmin||e.ymax<=e.ymin||(e.spatialReference?.latestWkid||e.spatialReference?.wkid)!==epsg||!Number.isInteger(metadata.width)||!Number.isInteger(metadata.height)||metadata.width<1||metadata.height<1||metadata.width>4096||metadata.height>4096)throw new Error('Invalid provider extent');
  // SIX's temporary href may be unavailable publicly. Export the validated extent directly.
  const imageURL=new URL(target);imageURL.searchParams.set('f','image');imageURL.searchParams.set('bbox',[e.xmin,e.ymin,e.xmax,e.ymax].join(','));imageURL.searchParams.set('bboxSR',String(epsg));imageURL.searchParams.set('size',`${metadata.width},${metadata.height}`);
  const image=await fetch(imageURL,{signal:AbortSignal.timeout(30000)});
  if(!image.ok||!image.headers.get('Content-Type')?.startsWith('image/'))throw new Error('Invalid provider image');
  const bytes=await image.arrayBuffer();if(bytes.byteLength>16*1024*1024)throw new Error('Provider image too large');
  return new Response(bytes,{headers:{'Content-Type':image.headers.get('Content-Type'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-PlanScan-Georeference':JSON.stringify({zone,epsg,width:metadata.width,height:metadata.height,extent:{xmin:e.xmin,ymin:e.ymin,xmax:e.xmax,ymax:e.ymax}})}});
 }catch{return json({error:'SIX Maps aerial imagery could not load. Retry, choose another location, or upload a plan on a blank canvas.'},502);}
}
async function searchAddresses(url){
 const query=(url.searchParams.get('q')||'').trim();if(query.length<5||query.length>150)return json({error:'Enter at least five characters of an NSW address.'},400);
 const target=new URL(SIX_ROOT+'NSW_Query/MapServer/find');target.search=new URLSearchParams({f:'json',searchText:query,searchFields:'address',layers:'0',contains:'true',sr:'7844',returnGeometry:'true'}).toString();
 try{const response=await fetch(target,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();const data=await response.json();if(data.error)throw new Error();return json({results:(data.results||[]).filter(r=>Number.isFinite(r.geometry?.x)&&Number.isFinite(r.geometry?.y)).slice(0,12).map(r=>({address:String(r.value||r.attributes?.address||''),latitude:r.geometry.y,longitude:r.geometry.x}))});}
 catch{return json({error:'Address search is unavailable. Enter latitude and longitude instead.'},502);}
}
export async function handle(request,env={},assets={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/status')return json({aerialProvider:'six'});
 if(url.pathname==='/api/six/aerial')return aerial(request);
 if(url.pathname==='/api/six/search')return request.method==='GET'?searchAddresses(url):json({error:'Use GET to search addresses.'},405);
 if(url.pathname==='/terms')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PlanScan — Sources and privacy</title><main style="max-width:700px;margin:60px auto;padding:20px;font:16px/1.6 system-ui"><h1>Sources and privacy</h1><p>Uploaded plans and project drafts are stored on your device. Save a project file for a portable copy. Estimates use your scan, movement and target durations.</p><p>Aerial imagery: SIX Maps, NSW Spatial Services. © NSW Government; imagery includes external suppliers. Location requests are sent to the public SIX Maps imagery service. Imagery and its MGA2020 extent are included in saved projects.</p><p><a href="https://maps.six.nsw.gov.au/">SIX Maps</a> · <a href="https://www.spatial.nsw.gov.au/">NSW Spatial Services</a></p><p>MGA2020 coordinates are derived from the returned aerial extent. A standalone uploaded image has local coordinates until a location reference is supplied. Imagery alignment and resolution limit coordinate accuracy.</p><a href="/">Return to planner</a></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const path=url.pathname==='/'?'/index.html':url.pathname,asset=assets[path];if(asset===undefined)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':MIME[path.split('.').pop()]||'text/plain; charset=utf-8','Cache-Control':path.startsWith('/vendor/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
