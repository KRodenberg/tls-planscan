import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {newProject,serializable} from '../../client/core.mjs';
const b=await chromium.launch({headless:true,args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.PLANSCAN_QA_URL);await p.waitForTimeout(100);
 for(const kind of ['second-pointer','cancel','capture','blur']){
  const marker=p.locator('.station-marker').first();const before=await marker.getAttribute('transform');const pos=await marker.evaluate(el=>{const m=el.getScreenCTM();return{x:m.e,y:m.f};});
  await p.mouse.move(pos.x,pos.y);await p.mouse.down();
  if(kind==='second-pointer'){await p.locator('#plan-svg').dispatchEvent('pointerdown',{pointerId:2,button:0,clientX:pos.x+100,clientY:pos.y+100});await p.locator('#plan-svg').dispatchEvent('pointermove',{pointerId:2,clientX:pos.x+200,clientY:pos.y+200});assert.equal(await marker.getAttribute('transform'),before);}
  await p.mouse.move(pos.x+30,pos.y+20);assert.notEqual(await marker.getAttribute('transform'),before);
  if(kind==='capture')await p.locator('#plan-svg').evaluate(el=>el.releasePointerCapture(1));else if(kind==='blur')await p.evaluate(()=>window.dispatchEvent(new Event('blur')));else await p.locator('#plan-svg').dispatchEvent('pointercancel',{pointerId:1});
  await p.mouse.up();assert.equal(await marker.getAttribute('transform'),before);console.log('PASS pointer',kind);
 }
 const fixture=newProject(true);fixture.underlay={kind:'google',name:'-33.8568, 151.2153',width:1280,height:960,metresPerPixel:.42,unit:'ft',dataUrl:null,source:'Google Maps',page:null,map:{location:'-33.8568, 151.2153',zoom:19,type:'hybrid'}};
 const fixtureFile=process.env.PLANSCAN_QA_DIR+'/map.planscan.json';await writeFile(fixtureFile,JSON.stringify(serializable(fixture)));await p.locator('#project-input').setInputFiles(fixtureFile);await p.waitForFunction(()=>document.querySelector('#underlay-name').textContent==='-33.8568, 151.2153');
 const image=async(width,height)=>Buffer.from(await p.evaluate(({width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c.toDataURL().split(',')[1];},{width,height}),'base64');
 let png=await image(1280,960);await p.route('**/api/map',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
 await p.locator('#google-map').click();await p.locator('[name=key]').fill('example-test-key-12345');await p.getByRole('button',{name:'Load underlay',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('#modal').open);
 const savedPromise=p.waitForEvent('download');await p.locator('#save-project').click();const saved=await savedPromise;const path=process.env.PLANSCAN_QA_DIR+'/map-saved.json';await saved.saveAs(path);const data=JSON.parse(await readFile(path,'utf8'));assert.equal(data.underlay.metresPerPixel,.42);assert.equal(data.underlay.unit,'ft');assert.equal(data.stations.length,12);assert.equal(data.underlay.dataUrl,null);assert.ok(!(await readFile(path,'utf8')).includes('example-test-key'));console.log('PASS map reload preserves scale, stations and excludes imagery/key');
 png=await image(640,480);await p.locator('#google-map').click();await p.getByRole('button',{name:'Load underlay',exact:true}).click();await p.locator('.modal-error').waitFor({state:'visible'});assert.match(await p.locator('.modal-error').textContent(),/dimensions changed/);await p.locator('#close-modal').click();console.log('PASS changed map dimensions require replacement');
 assert.deepEqual(errors,[]);console.log('PAGE_ERRORS',errors);
}finally{await b.close();}
