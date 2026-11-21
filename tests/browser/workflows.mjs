import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
const dir=process.env.PLANSCAN_QA_DIR;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Australia/Sydney'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();console.log('PASS',name);};
const count=async()=>Number(await page.locator('#station-count').textContent());
const download=async(action,name)=>{const waiting=page.waitForEvent('download');await action();const file=await waiting;const path=dir+'/'+name;await file.saveAs(path);return path;};
try{
 await page.goto(process.env.PLANSCAN_QA_URL);await page.waitForFunction(()=>!document.querySelector('#save-state').textContent.includes('Saved on this device'));
 await check('live durations, invalid input and setup allowance',async()=>{
  assert.equal(await page.locator('#estimate-total').textContent(),'36 min');
  await page.locator('#time-low').fill('5');assert.equal(await page.locator('#estimate-total').textContent(),'45 min');
  await page.locator('#time-low').fill('abc');assert.equal(await page.locator('#export-plan').isDisabled(),true);assert.equal(await page.locator('#estimate-total').textContent(),'45 min');
  await page.locator('#time-low').fill('02:00');await page.locator('#setup-time').fill('00:30');assert.equal(await page.locator('#estimate-total').textContent(),'42 min');await page.locator('#setup-time').blur();
 });
 await check('keyboard adds targets and edits links',async()=>{
  await page.locator('#add-target').focus();await page.keyboard.press('Space');assert.equal(await count(),13);
  await page.locator('#edit-links').click();const box=page.locator('[data-link-to]').first();await box.check();assert.match(await page.locator('#status-left').textContent(),/12 links/);await box.uncheck();await page.locator('#close-modal').click();
 });
 await check('keyboard calibration in metres',async()=>{
  await page.locator('#calibrate-plan').click();await page.locator('[name=distance]').fill('1400');await page.getByRole('button',{name:'Apply scale',exact:true}).click();
  assert.equal(await page.locator('#coordinate-unit').textContent(),'m');await page.locator('#station-x').fill('123');await page.locator('#station-x').press('Tab');
 });
 let savedPath;
 await check('project saves all assumptions and retains identity',async()=>{
  savedPath=await download(()=>page.locator('#save-project').click(),'roundtrip.planscan.json');
  const saved=JSON.parse(await readFile(savedPath,'utf8'));assert.equal(saved.stations.length,13);assert.equal(saved.underlay.unit,'m');assert.ok(Math.abs(saved.stations.at(-1).x-123)<1e-8);assert.equal(saved.setupSeconds,30);
 });
 await check('clear and undo retain original station IDs',async()=>{
  await page.locator('#clear-stations').click();await page.getByRole('button',{name:'Clear stations',exact:true}).last().click();assert.equal(await count(),0);await page.locator('#plan-svg').focus();await page.keyboard.press('Control+z');assert.equal(await count(),13);
 });
 await check('draft recovery survives reload',async()=>{
  await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('Saved on this device'));await page.reload();await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('Restored'));assert.equal(await count(),13);assert.equal(await page.locator('#setup-time').inputValue(),'00:30');
 });
 await check('saved project opens after starting another plan',async()=>{
  await page.locator('#new-project').click();await page.locator('#modal').getByRole('button',{name:'New plan',exact:true}).click();assert.equal(await count(),0);await page.locator('#project-input').setInputFiles(savedPath);await page.waitForFunction(()=>document.querySelector('#station-count').textContent==='13');
 });
 await check('PNG upload and rotation preserve geometry through undo',async()=>{
  const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,600);x.strokeRect(30,30,840,540);return c.toDataURL().split(',')[1];});
  const file=dir+'/underlay.png';await writeFile(file,Buffer.from(bytes,'base64'));await page.locator('#underlay-input').setInputFiles(file);await page.getByRole('button',{name:'Place image',exact:true}).click();await page.getByRole('button',{name:'Replace underlay',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#underlay-detail').textContent.includes('900 × 600'));
  await page.locator('#add-center').click();assert.equal(await count(),1);await page.locator('#rotate-plan').click();await page.waitForFunction(()=>document.querySelector('#underlay-detail').textContent.includes('600 × 900'));assert.equal(await count(),1);await page.locator('#undo').click();assert.match(await page.locator('#underlay-detail').textContent(),/900 × 600/);
 });
 await check('multi-page PDF explicitly imports the selected page',async()=>{
  const bytes=await page.evaluate(()=>{const p=new window.jspdf.jsPDF();p.text('FIRST PAGE',20,20);p.addPage('a4','landscape');p.text('SECOND PAGE',20,20);return [...new Uint8Array(p.output('arraybuffer'))];});
  const file=dir+'/two-pages.pdf';await writeFile(file,Buffer.from(bytes));await page.locator('#underlay-input').setInputFiles(file);await page.getByRole('heading',{name:'Choose PDF page'}).waitFor();await page.locator('#pdf-page-number').fill('2');await page.locator('#pdf-page-number').press('Tab');await page.getByAltText('PDF page 2 preview').waitFor();await page.getByRole('button',{name:'Use page',exact:true}).click();await page.getByRole('button',{name:'Place image',exact:true}).click();await page.getByRole('button',{name:'Replace underlay',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#underlay-detail').textContent.includes('Page 2'));
 });
 await page.locator('#add-center').click();
 await check('portrait PDF and PNG exports download and remember paper choices',async()=>{
  await page.locator('#export-plan').click();await page.locator('[name=orientation]').selectOption('portrait');await page.locator('[name=paper]').selectOption('a3');await page.locator('#qa-preview img').waitFor();await page.screenshot({path:dir+'/export.png'});const path=await download(()=>page.getByRole('button',{name:'Download',exact:true}).click(),'qa.pdf');assert.equal((await readFile(path)).subarray(0,5).toString(),'%PDF-');
  await page.locator('#export-plan').click();assert.equal(await page.locator('[name=paper]').inputValue(),'a3');assert.equal(await page.locator('[name=orientation]').inputValue(),'portrait');await page.locator('[name=format]').selectOption('png');const png=await download(()=>page.getByRole('button',{name:'Download',exact:true}).click(),'qa.png');assert.equal((await readFile(png)).subarray(1,4).toString(),'PNG');
 });
 await check('aerial provider errors remain actionable',async()=>{
  await page.route('**/api/six/aerial',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'SIX Maps aerial imagery could not load.'})}));
  await page.locator('#six-map').click();await page.getByRole('button',{name:'Load aerial',exact:true}).click();await page.locator('.modal-error').waitFor({state:'visible'});assert.match(await page.locator('.modal-error').textContent(),/SIX Maps/);assert.equal(await page.getByRole('button',{name:'Load aerial',exact:true}).isEnabled(),true);await page.locator('#close-modal').click();
 });
 await page.screenshot({path:dir+'/desktop.png'});
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await writeFile(dir+'/accessibility.json',JSON.stringify(axe.violations,null,2));assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);console.log('PASS desktop accessibility');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.screenshot({path:dir+`/phone-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#open-settings').click();assert.equal(await page.locator('.drawing-workspace').evaluate(el=>el.inert),true);await page.screenshot({path:dir+`/phone-${width}-settings.png`});const mobileAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(mobileAxe.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);await page.keyboard.press('Escape');assert.equal(await page.locator('.drawing-workspace').evaluate(el=>el.inert),false);console.log('PASS phone layout, focus and accessibility',width);
 }
 console.log('PAGE_ERRORS',errors);assert.deepEqual(errors,[]);
 await writeFile(dir+'/summary.json',JSON.stringify({errors,accessibilityViolations:axe.violations.map(v=>v.id),result:'passed'},null,2));
}finally{await browser.close();}
