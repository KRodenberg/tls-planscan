import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handle} from '../server/handler.mjs';
const valid={latitude:-33.8568,longitude:151.2153,widthMetres:500};
const request=(body,headers={})=>new Request('https://planscan.example/api/six/map',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const capabilities='https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Base_Map/MapServer/WMTS/1.0.0/WMTSCapabilities.xml';
test('status identifies the specified WMTS basemap provider and layer',async()=>{assert.deepEqual(await(await handle(new Request('https://planscan.example/api/status'))).json(),{mapProvider:'six',mapProtocol:'WMTS',mapLayer:'public_NSW_Base_Map'});});
test('map endpoint rejects invalid bodies, coverage and cross-origin requests',async()=>{
 for(const data of [null,[],false,{}, {...valid,latitude:0},{...valid,longitude:190},{...valid,widthMetres:0}])assert.equal((await handle(request(data))).status,400);
 assert.equal((await handle(request(valid,{Origin:'https://other.example'}))).status,403);assert.equal((await handle(request({...valid,extra:'a'.repeat(5000)}))).status,413);
 assert.equal((await handle(new Request('https://planscan.example/api/six/map'))).status,405);
});
test('map configuration selects the user-specified capabilities, layer and tile matrix',async()=>{
 const response=await handle(request(valid));assert.equal(response.status,200);const data=await response.json();assert.equal(data.capabilitiesUrl,capabilities);assert.equal(data.layer,'public_NSW_Base_Map');assert.equal(data.matrixSet,'default028mm');assert.equal(data.widthMetres,500);assert.equal(data.capabilities,'/api/six/capabilities');
});
test('capabilities proxy reads the exact supplied XML resource',async t=>{
 const xml=await readFile(new URL('./fixtures/six-wmts-capabilities.xml',import.meta.url),'utf8');
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(String(url),capabilities);return new Response(xml);});
 const response=await handle(new Request('https://planscan.example/api/six/capabilities'));assert.equal(response.status,200);assert.equal(await response.text(),xml);assert.match(response.headers.get('content-type'),/xml/);
});
test('tile proxy requests the advertised WMTS layer and default028mm grid',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(String(url),'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Base_Map/MapServer/WMTS/tile/1.0.0/public_NSW_Base_Map/default/default028mm/19/314600/482367.png');return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});});
 const response=await handle(new Request('https://planscan.example/api/six/tile?matrix=19&row=314600&column=482367'));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal((await response.arrayBuffer()).byteLength,4);
});
test('invalid tile indices cannot form arbitrary upstream URLs',async()=>{
 for(const query of ['matrix=22&row=1&column=1','matrix=0&row=1&column=0','matrix=19&row=-1&column=1','matrix=../&row=1&column=1','matrix=19&row=1&column=https://other.example'])assert.equal((await handle(new Request('https://planscan.example/api/six/tile?'+query))).status,400);
});
test('missing WMTS capabilities and tiles produce recoverable errors',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('Unavailable',{status:503}));
 for(const path of ['/api/six/capabilities','/api/six/tile?matrix=19&row=314600&column=482367']){const response=await handle(new Request('https://planscan.example'+path));assert.equal(response.status,502);assert.match((await response.json()).error,/SIX Maps/);}
});
test('address search uses SIX find and returns GDA2020 points',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(new URL(url).searchParams.get('sr'),'7844');return Response.json({results:[{value:'1 TEST STREET SYDNEY',geometry:{x:151.2,y:-33.8}}]});});
 const response=await handle(new Request('https://planscan.example/api/six/search?q=1%20TEST'));assert.deepEqual((await response.json()).results,[{address:'1 TEST STREET SYDNEY',latitude:-33.8,longitude:151.2}]);
});
test('static assets support HEAD, reject writes and report missing paths',async()=>{
 const assets={'/index.html':'<h1>PlanScan</h1>','/app.js':'export {}'};assert.equal((await handle(new Request('https://planscan.example/'),{},assets)).status,200);
 const head=await handle(new Request('https://planscan.example/app.js',{method:'HEAD'}),{},assets);assert.equal(await head.text(),'');assert.equal((await handle(new Request('https://planscan.example/missing'),{},assets)).status,404);assert.equal((await handle(new Request('https://planscan.example/',{method:'POST'}),{},assets)).status,405);
});
