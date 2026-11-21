import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/handler.mjs';
const valid={latitude:-33.8568,longitude:151.2153,widthMetres:500};
const request=(body,headers={})=>new Request('https://planscan.example/api/six/aerial',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const metadata={href:'http://maps.six.nsw.gov.au/arcgis/rest/directories/arcgisoutput/public/aerial.jpg',width:1600,height:1200,extent:{xmin:334000,ymin:6252000,xmax:334800,ymax:6252600,spatialReference:{wkid:7856}}};
test('status identifies the aerial provider',async()=>{assert.deepEqual(await(await handle(new Request('https://planscan.example/api/status'))).json(),{aerialProvider:'six'});});
test('aerial endpoint rejects invalid bodies, coverage and cross-origin requests',async()=>{
 for(const data of [null,[],false,{}, {...valid,latitude:0},{...valid,longitude:190},{...valid,widthMetres:0}])assert.equal((await handle(request(data))).status,400);
 assert.equal((await handle(request(valid,{Origin:'https://other.example'}))).status,403);
 assert.equal((await handle(request({...valid,extra:'a'.repeat(5000)}))).status,413);
 assert.equal((await handle(new Request('https://planscan.example/api/six/aerial'))).status,405);
});
test('SIX imagery requests MGA2020 and returns the actual projected image extent',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(new URL(url));return calls.length===1?Response.json(metadata):new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}});});
 const response=await handle(request(valid));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(calls[0].searchParams.get('imageSR'),'7856');assert.equal(calls[0].searchParams.get('bboxSR'),'7844');assert.equal(calls[1].protocol,'https:');assert.equal(calls[1].searchParams.get('f'),'image');assert.equal(calls[1].searchParams.get('bboxSR'),'7856');assert.equal(calls[1].searchParams.get('bbox'),'334000,6252000,334800,6252600');
 const g=JSON.parse(response.headers.get('X-PlanScan-Georeference'));assert.equal(g.zone,56);assert.equal(g.extent.xmin,metadata.extent.xmin);assert.equal(g.width,1600);
});
test('provider errors and incorrect projected extents are recoverable',async t=>{
 for(const data of [{error:{code:500}},{...metadata,extent:{...metadata.extent,spatialReference:{wkid:3857}}},{...metadata,extent:{...metadata.extent,xmin:Infinity}}]){
  t.mock.method(globalThis,'fetch',async()=>Response.json(data));const response=await handle(request(valid));assert.equal(response.status,502);assert.match((await response.json()).error,/SIX Maps/);
 }
});
test('address search uses SIX find and returns GDA2020 points',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(new URL(url).searchParams.get('sr'),'7844');return Response.json({results:[{value:'1 TEST STREET SYDNEY',geometry:{x:151.2,y:-33.8}}]});});
 const response=await handle(new Request('https://planscan.example/api/six/search?q=1%20TEST'));assert.deepEqual((await response.json()).results,[{address:'1 TEST STREET SYDNEY',latitude:-33.8,longitude:151.2}]);
});
test('static assets support HEAD, reject writes and report missing paths',async()=>{
 const assets={'/index.html':'<h1>PlanScan</h1>','/app.js':'export {}'};
 assert.equal((await handle(new Request('https://planscan.example/'),{},assets)).status,200);
 const head=await handle(new Request('https://planscan.example/app.js',{method:'HEAD'}),{},assets);assert.equal(await head.text(),'');
 assert.equal((await handle(new Request('https://planscan.example/missing'),{},assets)).status,404);
 assert.equal((await handle(new Request('https://planscan.example/',{method:'POST'}),{},assets)).status,405);
});
