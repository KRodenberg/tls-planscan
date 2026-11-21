import {chromium} from 'playwright';
import assert from 'node:assert/strict';
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
 assert.deepEqual(errors,[]);console.log('PAGE_ERRORS',errors);
}finally{await b.close();}
