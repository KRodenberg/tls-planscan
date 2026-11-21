const MIME={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml',json:'application/json'};
const SIX_ROOT='https://maps.six.nsw.gov.au/arcgis/rest/services/public/';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
const SIX_CAPABILITIES=SIX_ROOT+'NSW_Base_Map/MapServer/WMTS/1.0.0/WMTSCapabilities.xml';
const SIX_LAYER='public_NSW_Base_Map';
async function mapRequest(request){
 if(request.method!=='POST')return json({error:'Use POST to load a basemap.'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(Number(request.headers.get('Content-Length'))>4096)return json({error:'The basemap request is too large.'},413);
 let data;try{const body=await request.text();if(body.length>4096)return json({error:'The basemap request is too large.'},413);data=JSON.parse(body);}catch{return json({error:'Enter a map location.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Enter a map location.'},400);
 const {latitude,longitude,widthMetres}=data;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -39||latitude> -28||longitude<140||longitude>160)return json({error:'Enter a location within NSW: latitude −39 to −28, longitude 140 to 160.'},400);
 if(!Number.isFinite(widthMetres)||widthMetres<25||widthMetres>20000)return json({error:'Choose a map width from 25 to 20,000 metres.'},400);
 return json({latitude,longitude,widthMetres,capabilities:'/api/six/capabilities',capabilitiesUrl:SIX_CAPABILITIES,layer:SIX_LAYER,matrixSet:'default028mm',style:'default'});
}
async function wmtsCapabilities(){
 try{
  const response=await fetch(SIX_CAPABILITIES,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();
  const xml=await response.text();if(xml.length>512*1024||!xml.includes(SIX_LAYER)||!xml.includes('TileMatrixSet'))throw new Error();
  return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'SIX Maps WMTS capabilities could not load. Retry or upload a plan on a blank canvas.'},502);}
}
async function wmtsTile(url){
 const matrix=url.searchParams.get('matrix'),row=url.searchParams.get('row'),column=url.searchParams.get('column');
 if(!/^(?:[0-9]|1[0-9]|2[01])$/.test(matrix||'')||![row,column].every(value=>/^\d{1,7}$/.test(value||'')&&Number(value)<2**Number(matrix)))return json({error:'Choose a valid WMTS tile.'},400);
 const target=SIX_ROOT+`NSW_Base_Map/MapServer/WMTS/tile/1.0.0/${SIX_LAYER}/default/default028mm/${Number(matrix)}/${Number(row)}/${Number(column)}.png`;
 try{
  const response=await fetch(target,{signal:AbortSignal.timeout(20000)});if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/png'))throw new Error();
  const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)throw new Error();
  return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'A SIX Maps WMTS tile could not load. Retry the basemap.'},502);}
}
async function searchAddresses(url){
 const query=(url.searchParams.get('q')||'').trim();if(query.length<5||query.length>150)return json({error:'Enter at least five characters of an NSW address.'},400);
 const target=new URL(SIX_ROOT+'NSW_Query/MapServer/find');target.search=new URLSearchParams({f:'json',searchText:query,searchFields:'address',layers:'0',contains:'true',sr:'7844',returnGeometry:'true'}).toString();
 try{const response=await fetch(target,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();const data=await response.json();if(data.error)throw new Error();return json({results:(data.results||[]).filter(r=>Number.isFinite(r.geometry?.x)&&Number.isFinite(r.geometry?.y)).slice(0,12).map(r=>({address:String(r.value||r.attributes?.address||''),latitude:r.geometry.y,longitude:r.geometry.x}))});}
 catch{return json({error:'Address search is unavailable. Enter latitude and longitude instead.'},502);}
}
export async function handle(request,env={},assets={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/status')return json({mapProvider:'six',mapProtocol:'WMTS',mapLayer:SIX_LAYER});
 if(url.pathname==='/api/six/map')return mapRequest(request);
 if(url.pathname==='/api/six/capabilities')return request.method==='GET'?wmtsCapabilities():json({error:'Use GET to read WMTS capabilities.'},405);
 if(url.pathname==='/api/six/tile')return request.method==='GET'?wmtsTile(url):json({error:'Use GET to load a WMTS tile.'},405);
 if(url.pathname==='/api/six/search')return request.method==='GET'?searchAddresses(url):json({error:'Use GET to search addresses.'},405);
 if(url.pathname==='/terms')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PlanScan — Sources and privacy</title><main style="max-width:700px;margin:60px auto;padding:20px;font:16px/1.6 system-ui"><h1>Sources and privacy</h1><p>Uploaded plans and project drafts are stored on your device. Save a project file for a portable copy. Estimates use your scan, movement and target durations.</p><p>Basemap: SIX Maps NSW Base Map WMTS, NSW Spatial Services. © NSW Government. The app requests the advertised WMTS capabilities and tiles, reprojects them into MGA2020, and includes the rendered basemap and its extent in saved projects.</p><p><a href="https://maps.six.nsw.gov.au/">SIX Maps</a> · <a href="https://www.spatial.nsw.gov.au/">NSW Spatial Services</a></p><p>MGA2020 coordinates are derived from the reprojected basemap extent. A standalone uploaded image has local coordinates until a location reference is supplied. Source map accuracy and resolution limit coordinate accuracy.</p><a href="/">Return to planner</a></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const path=url.pathname==='/'?'/index.html':url.pathname,asset=assets[path];if(asset===undefined)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':MIME[path.split('.').pop()]||'text/plain; charset=utf-8','Cache-Control':path.startsWith('/vendor/')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
