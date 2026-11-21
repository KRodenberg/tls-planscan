const MIME={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml',json:'application/json'};
const SIX_ROOT='https://maps.six.nsw.gov.au/arcgis/rest/services/public/';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
const PORTAL_ITEM_ID='c04ce33be7a04a7884f786f5beb20b19';
const PORTAL_ITEM_URL='https://portal.spatial.nsw.gov.au/portal/home/item.html?id='+PORTAL_ITEM_ID;
const IMAGERY_SERVICE='https://portal.spatial.nsw.gov.au/aid/tile/rest/services/NSWWebImagery/MapServer';
const IMAGERY_ATTRIBUTION='NSW DCS Spatial Services; SPOT Image (Geoimage GeoHD) © Airbus DS 2025 — DCCEEW';
async function mapRequest(request){
 if(request.method!=='POST')return json({error:'Use POST to open imagery.'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(Number(request.headers.get('Content-Length'))>4096)return json({error:'The map request is too large.'},413);
 let data;try{const body=await request.text();if(body.length>4096)return json({error:'The map request is too large.'},413);data=JSON.parse(body);}catch{return json({error:'Enter a map location.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Enter a map location.'},400);
 const {latitude,longitude,widthMetres}=data;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -39||latitude> -28||longitude<140||longitude>160)return json({error:'Enter a location within NSW: latitude −39 to −28, longitude 140 to 160.'},400);
 if(!Number.isFinite(widthMetres)||widthMetres<25||widthMetres>20000)return json({error:'Choose an initial map width from 25 to 20,000 metres.'},400);
 return json({latitude,longitude,widthMetres,metadata:'/api/six/metadata',portalItemId:PORTAL_ITEM_ID,portalItemUrl:PORTAL_ITEM_URL,serviceUrl:IMAGERY_SERVICE,title:'NSW Imagery Basemap',attribution:IMAGERY_ATTRIBUTION});
}
async function imageryMetadata(){
 try{
  const response=await fetch(IMAGERY_SERVICE+'?f=pjson',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();
  const data=await response.json(),info=data.tileInfo;
  if(data.error||!info||(info.spatialReference?.latestWkid||info.spatialReference?.wkid)!==3857||!Array.isArray(info.lods)||!info.lods.length)throw new Error();
  return json({...data,portalItemId:PORTAL_ITEM_ID,serviceUrl:IMAGERY_SERVICE,attribution:IMAGERY_ATTRIBUTION});
 }catch{return json({error:'NSW Imagery Basemap settings could not load. Retry the map.'},502);}
}
async function imageryTile(url){
 const level=url.searchParams.get('level'),row=url.searchParams.get('row'),column=url.searchParams.get('column');
 if(!/^(?:[0-9]|1[0-9]|2[0-3])$/.test(level||'')||![row,column].every(value=>/^\d{1,8}$/.test(value||'')&&Number(value)<2**Number(level)))return json({error:'Choose a valid imagery tile.'},400);
 const target=IMAGERY_SERVICE+`/tile/${Number(level)}/${Number(row)}/${Number(column)}`;
 try{
  const response=await fetch(target,{signal:AbortSignal.timeout(20000)}),type=response.headers.get('Content-Type');if(!response.ok||!/^image\/(png|jpeg)/.test(type||''))throw new Error();
  const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)throw new Error();
  return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'An imagery tile could not load. Retry the map.'},502);}
}
async function searchAddresses(url){
 const query=(url.searchParams.get('q')||'').trim();if(query.length<5||query.length>150)return json({error:'Enter at least five characters of an NSW address.'},400);
 const target=new URL(SIX_ROOT+'NSW_Query/MapServer/find');target.search=new URLSearchParams({f:'json',searchText:query,searchFields:'address',layers:'0',contains:'true',sr:'7844',returnGeometry:'true'}).toString();
 try{const response=await fetch(target,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();const data=await response.json();if(data.error)throw new Error();return json({results:(data.results||[]).filter(r=>Number.isFinite(r.geometry?.x)&&Number.isFinite(r.geometry?.y)).slice(0,12).map(r=>({address:String(r.value||r.attributes?.address||''),latitude:r.geometry.y,longitude:r.geometry.x}))});}
 catch{return json({error:'Address search is unavailable. Enter latitude and longitude instead.'},502);}
}
export async function handle(request,env={},assets={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/status')return json({mapProvider:'nsw-imagery',portalItemId:PORTAL_ITEM_ID,mapMode:'live'});
 if(url.pathname==='/api/six/map')return mapRequest(request);
 if(url.pathname==='/api/six/metadata')return request.method==='GET'?imageryMetadata():json({error:'Use GET to read map settings.'},405);
 if(url.pathname==='/api/six/tile')return request.method==='GET'?imageryTile(url):json({error:'Use GET to load an imagery tile.'},405);
 if(url.pathname==='/api/six/search')return request.method==='GET'?searchAddresses(url):json({error:'Use GET to search addresses.'},405);
 if(url.pathname==='/terms')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PlanScan — Sources and privacy</title><main style="max-width:700px;margin:60px auto;padding:20px;font:16px/1.6 system-ui"><h1>Sources and privacy</h1><p>Uploaded plans and project drafts are stored on your device. Save a project file for a portable copy. Estimates use your scan, movement and target durations.</p><p>Basemap: NSW Imagery Basemap, portal item c04ce33be7a04a7884f786f5beb20b19. NSW DCS Spatial Services; SPOT Image (Geoimage GeoHD) © Airbus DS 2025, provided by DCCEEW. The app loads imagery tiles live as you pan and zoom and uses an MGA2020 working grid. Project files retain map settings, view, stations and uploaded images; the basemap is fetched when reopened.</p><p><a href="https://maps.six.nsw.gov.au/">SIX Maps</a> · <a href="https://www.spatial.nsw.gov.au/">NSW Spatial Services</a></p><p>MGA2020 coordinates remain anchored to the project grid as the view changes. A standalone uploaded image has local coordinates until a location reference is supplied. Source map accuracy and resolution limit coordinate accuracy.</p><a href="/">Return to planner</a></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const path=url.pathname==='/'?'/index.html':url.pathname,asset=assets[path];if(asset===undefined)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':MIME[path.split('.').pop()]||'text/plain; charset=utf-8','Cache-Control':path.startsWith('/vendor/')&&path!=='/vendor/map.mjs'?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
