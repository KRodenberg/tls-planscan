import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createNodeServer} from '../server/node.mjs';
import {handle} from '../server/handler.mjs';

const assets={'/index.html':'<h1>PlanScan</h1>','/vendor/map.mjs':'export {}'};
async function serve(t,env={},handler=(request,settings)=>handle(request,settings,assets)){
 const server=createNodeServer(handler,env);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return `http://127.0.0.1:${server.address().port}`;
}
const mapBody=JSON.stringify({latitude:-33.8568,longitude:151.2153,widthMetres:500});
test('Node server serves assets, HEAD and the health endpoint over HTTP',async t=>{
 const url=await serve(t),page=await fetch(url);assert.equal(page.status,200);assert.equal(await page.text(),assets['/index.html']);assert.match(page.headers.get('content-type'),/text\/html/);
 const head=await fetch(url+'/vendor/map.mjs',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('cache-control'),'no-cache');
 assert.equal((await(await fetch(url+'/api/status')).json()).mapMode,'live');assert.equal((await fetch(url+'/missing')).status,404);
});
test('Node server passes POST bodies and enforces same-origin map requests',async t=>{
 const url=await serve(t),request=origin=>fetch(url+'/api/six/map',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:mapBody});
 const response=await request(url);assert.equal(response.status,200);assert.equal((await response.json()).title,'NSW Imagery Basemap');assert.equal((await request('https://other.example')).status,403);
});
test('trusted HTTPS proxy headers preserve the external origin only when enabled',async t=>{
 const headers={Origin:'https://planscan.example','X-Forwarded-Proto':'https','X-Forwarded-Host':'planscan.example'};
 const direct=await serve(t),proxy=await serve(t,{TRUST_PROXY:'1'});
 for(const [url,status] of [[direct,403],[proxy,200]])assert.equal((await fetch(url+'/api/six/map',{method:'POST',headers,body:mapBody})).status,status);
});
test('oversized fixed and chunked request bodies return 413 without invoking the app',async t=>{
 let calls=0;const url=await serve(t,{},()=>{calls++;return new Response('ok');});
 assert.equal((await fetch(url,{method:'POST',body:'a'.repeat(5000)})).status,413);
 const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('a'.repeat(3000)));controller.enqueue(new TextEncoder().encode('b'.repeat(3000)));controller.close();}});
 assert.equal((await fetch(url,{method:'POST',body,duplex:'half'})).status,413);assert.equal(calls,0);
});
test('unexpected adapter errors return a generic response and keep the server available',async t=>{
 t.mock.method(console,'error',()=>{});let fail=true;const url=await serve(t,{},()=>{if(fail)throw Error('Internal details');return new Response('recovered');});
 const response=await fetch(url);assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/Internal details/);fail=false;assert.equal(await(await fetch(url)).text(),'recovered');
});
