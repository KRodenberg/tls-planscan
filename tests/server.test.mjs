import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/handler.mjs';
const request=(body,headers={})=>new Request('https://planscan.example/api/map',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const valid={location:'-33.8568, 151.2153',zoom:19,type:'hybrid',key:'example-test-key-12345'};

test('status exposes configuration availability without returning the key',async()=>{
 const response=await handle(new Request('https://planscan.example/api/status'),{GOOGLE_MAPS_API_KEY:valid.key});
 assert.deepEqual(await response.json(),{mapsConfigured:true});assert.equal(response.headers.get('cache-control'),'no-store');
});
test('map endpoint rejects invalid bodies, durations and cross-origin requests',async()=>{
 for(const data of [null,[],false,{}, {...valid,location:''},{...valid,zoom:22},{...valid,type:'unknown'}]){
  const response=await handle(request(data));assert.equal(response.status,400);assert.ok((await response.json()).error);
 }
 assert.equal((await handle(request(valid,{Origin:'https://other.example'}))).status,403);
 assert.equal((await handle(request({...valid,location:'a'.repeat(5000)}))).status,413);
 assert.equal((await handle(new Request('https://planscan.example/api/map'))).status,405);
});
test('map endpoint proxies imagery without caching or exposing the API key',async t=>{
 let target;
 t.mock.method(globalThis,'fetch',async url=>{target=new URL(url);return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});});
 const response=await handle(request({...valid,key:undefined}),{GOOGLE_MAPS_API_KEY:valid.key});
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('content-type'),'image/png');
 assert.equal(target.origin,'https://maps.googleapis.com');assert.equal(target.searchParams.get('center'),valid.location);assert.equal(target.searchParams.get('key'),valid.key);
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[137,80,78,71]);
});
test('provider errors and network failures return a useful message without credentials',async t=>{
 for(const mode of ['denied','network']){
  t.mock.method(globalThis,'fetch',async()=>{if(mode==='network')throw new Error(valid.key);return new Response(valid.key,{status:403});});
  const response=await handle(request(valid));assert.equal(response.status,502);assert.ok(!(await response.text()).includes(valid.key));
 }
});
test('static assets support HEAD, reject writes and report missing paths',async()=>{
 const assets={'/index.html':'<h1>PlanScan</h1>','/app.js':'export {}'};
 const root=await handle(new Request('https://planscan.example/'),{},assets);assert.equal(root.status,200);assert.match(root.headers.get('content-type'),/text\/html/);
 const head=await handle(new Request('https://planscan.example/app.js',{method:'HEAD'}),{},assets);assert.equal(await head.text(),'');assert.equal(head.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await handle(new Request('https://planscan.example/missing'),{},assets)).status,404);
 assert.equal((await handle(new Request('https://planscan.example/',{method:'POST'}),{},assets)).status,405);
});
