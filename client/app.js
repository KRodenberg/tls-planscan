import {DENSITIES,LIMITS,COLORS,uid,stationLabel,parseDuration,inputDuration,formatDuration,estimate,newProject,addStation,deleteStation,snapshot,serializable,normalizeProject,coordinateFactor,stationCoordinates,coordinateToPixel,updateStationCoordinates,niceScale,newOverlay,overlayPointToWorld,calibrateOverlay,validPosition,positionBounds,imageryExportExtent,projectForMapSnapshot,linkDistance,formatDistance} from './core.mjs';
import {createQA,saveQA,downloadFile} from './export.mjs';
import {loadSixBasemap,createLiveBasemap,PORTAL_ITEM_ID,IMAGERY_SERVICE,IMAGERY_ATTRIBUTION} from '/vendor/map.mjs?v=2';

const $ = id => document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project=newProject(true), tool='scan', density='medium', selected=null, linkStart=null, scalePoints=[], pointer=null;
let past=[],future=[],view={x:0,y:0,scale:1},fitMode=true,fitScale=1,saveTimer,toastTimer,db;
let liveEngine=null,liveEnginePromise=null,liveEngineKey=null,liveEngineFailed=false;
let invalidTimes=new Set(),restoreComplete=false,modalCleanup=null,localEdits=false;

function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function announce(message){$('announcements').textContent=message;}
function setSaveState(text,ok=true){$('save-state').innerHTML=`${icon(ok?'check':'info')}<span>${escapeHTML(text)}</span>`;}
async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('tls-planscan',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function storeValue(mode,value){return new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode);const store=tx.objectStore('projects');const req=mode==='readwrite'?store.put(value,'current'):store.get('current');tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);});}
function saveDraft(){localEdits=true;if(!restoreComplete)return;setSaveState('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{db||=await openDB();await storeValue('readwrite',serializable(project));setSaveState('Saved on this device');}catch{setSaveState('Save a project file',false);}},250);}
function historyPush(before){past.push(before);if(past.length>40)past.shift();future=[];}
function commit(mutator,{fit=false,list=true}={}){const before=snapshot(project);try{mutator(project);}catch(error){project=before;throw error;}historyPush(before);updateStationCoordinates(project);project.updatedAt=new Date().toISOString();if(!project.stations.some(s=>s.id===selected))selected=null;render(list);if(fit)fitPlan();saveDraft();}
function undo(){if(!past.length)return;future.push(snapshot(project));project=past.pop();selected=null;invalidTimes.clear();render();fitPlan();saveDraft();announce('Undone.');}
function redo(){if(!future.length)return;past.push(snapshot(project));project=future.pop();selected=null;invalidTimes.clear();render();fitPlan();saveDraft();announce('Redone.');}

function isLiveMap(){return project.underlay?.kind==='six'&&project.underlay.map?.live;}
function upgradeMap(next){if(next.underlay?.kind==='six'){const u=next.underlay;u.map={...u.map,live:true,portalItemId:PORTAL_ITEM_ID,serviceUrl:IMAGERY_SERVICE};delete u.map.wmts;u.dataUrl=null;u.name='NSW Imagery Basemap';u.source=IMAGERY_ATTRIBUTION;}return next;}
function imageSource(){const u=project.underlay;return u?.kind==='sample'?'/assets/sample-plan.svg':u?.kind==='blank'?'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E':u?.dataUrl||'';}
function mapViewport(){const u=project.underlay,{width,height}=stageSize(),e=u.georeference.extent,m=u.metresPerPixel;return {easting:e.xmin+(width/2-view.x)/view.scale*m,northing:e.ymax-(height/2-view.y)/view.scale*m,resolution:m/view.scale,width,height};}
function mapFeedback(state){$('map-feedback').hidden=!state.loading&&!state.failed;const text=state.failed?'Imagery unavailable':state.loading?'Loading imagery…':'';if($('map-feedback-text').textContent!==text)$('map-feedback-text').textContent=text;$('retry-map').hidden=!state.failed;}
function syncLiveMap(){
 const target=$('live-basemap');target.hidden=!isLiveMap();$('canvas-stage').classList.toggle('has-live-map',!!isLiveMap());
 if(!isLiveMap()){liveEngineKey=null;liveEngine?.dispose();liveEngine=null;liveEnginePromise=null;liveEngineFailed=false;target.replaceChildren();$('map-feedback').hidden=true;return;}
 project.mapView=mapViewport();const key=`${project.id}:${project.underlay.georeference.epsg}:${PORTAL_ITEM_ID}`;
 if(key!==liveEngineKey){liveEngineKey=key;liveEngine?.dispose();liveEngine=null;liveEnginePromise=null;liveEngineFailed=false;target.replaceChildren();}
 if(!liveEnginePromise&&!liveEngineFailed){
  const mount=document.createElement('div');mount.style.cssText='width:100%;height:100%';mount.dataset.liveImagery='true';target.replaceChildren(mount);mapFeedback({loading:true,failed:false});
  liveEnginePromise=createLiveBasemap({target:mount,epsg:project.underlay.georeference.epsg,onState:state=>{if(key===liveEngineKey)mapFeedback(state);}}).then(engine=>{if(key!==liveEngineKey){engine.dispose();return null;}liveEngine=engine;const v=mapViewport();engine.setViewport({center:[v.easting,v.northing],resolution:v.resolution});return engine;}).catch(()=>{if(key===liveEngineKey){liveEngineFailed=true;liveEnginePromise=null;mapFeedback({loading:false,failed:true});}return null;});
 }
 if(liveEngine){const v=project.mapView;liveEngine.setViewport({center:[v.easting,v.northing],resolution:v.resolution});}
}
$('retry-map').onclick=()=>{if(liveEngine)liveEngine.retry();else{liveEngineFailed=false;syncLiveMap();}};
function restoreMapView(saved){if(!isLiveMap()||!saved)return;const u=project.underlay,e=u.georeference.extent,m=u.metresPerPixel,size=stageSize();view.scale=m/saved.resolution;view.x=size.width/2-(saved.easting-e.xmin)/m*view.scale;view.y=size.height/2-(e.ymax-saved.northing)/m*view.scale;fitMode=false;renderCanvas();}
function setTool(next){if(next==='scale'&&project.underlay?.georeference&&!project.overlay){toast('Basemap scale is set by its MGA2020 grid. Adjust image size in overlay settings.');return;}tool=next;linkStart=null;scalePoints=[];renderTools();renderCanvas();if(next==='scale'&&project.underlay)notice(project.overlay?'Select two points on the uploaded image.':'Select two points with a known distance.');else notice(null);}
function renderTools(){document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-density]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.density===density)));$('canvas-stage').dataset.mode=tool;const label={select:'Select and move',scan:`Place scan · ${density[0].toUpperCase()+density.slice(1)}`,target:'Place target',link:linkStart?'Select second station':'Link two stations',scale:'Set scale · two points',pan:'Pan plan',overlay:'Move image overlay'}[tool];$('tool-status').innerHTML=tool==='scan'?`<span class="density-dot ${density}"></span>${label}`:label;}
function notice(text,action){const el=$('canvas-notice');el.hidden=!text;el.replaceChildren();if(text){el.append(document.createTextNode(text));if(action){const b=document.createElement('button');b.className='text-button';b.textContent=action.label;b.onclick=action.run;el.append(b);}}}
function render(list=true){
 const e=estimate(project),u=project.underlay;
 if(document.activeElement!==$('project-title'))$('project-title').value=project.title;
 $('sample-badge').hidden=!project.sample;
 $('underlay-name').textContent=u?.name||'No underlay';$('underlay-detail').textContent=u?(isLiveMap()?'Live imagery · MGA2020':`${u.width} × ${u.height} px${u.page?` · Page ${u.page}`:''}`):'PDF, PNG, JPG or WEBP';
 $('scale-status').classList.toggle('unscaled',!u?.metresPerPixel);$('scale-status').innerHTML=`${icon(u?.metresPerPixel?'check':'ruler')}${u?.metresPerPixel?'To scale':'Not to scale'}`;
 $('rotate-plan').disabled=!u||u.kind==='six';$('calibrate-plan').disabled=!u;
 for(const d of DENSITIES){const input=$(`time-${d}`);if(document.activeElement!==input&&!invalidTimes.has(d))input.value=inputDuration(project.profiles[d]);input.setAttribute('aria-invalid',String(invalidTimes.has(d)));$(`count-${d}`).textContent=e.counts[d];$(`subtotal-${d}`).textContent=formatDuration(e.subtotals[d]);}
 for(const [key,id,seconds] of [['setup','setup-time',project.setupSeconds],['target','target-time',project.targetSeconds]]){if(document.activeElement!==$(id)&&!invalidTimes.has(key))$(id).value=inputDuration(seconds);$(id).setAttribute('aria-invalid',String(invalidTimes.has(key)));}
 $('setup-time').setAttribute('aria-invalid',String(invalidTimes.has('setup')));$('time-error').hidden=!invalidTimes.size;$('export-plan').disabled=!!invalidTimes.size||!u;
 $('estimate-count').textContent=`${e.count} station${e.count===1?'':'s'}`;$('estimate-total').textContent=formatDuration(e.total);$('estimate-detail').textContent=invalidTimes.size?'Check duration fields · last valid estimate':[`${formatDuration(e.scan)} scans`,e.setup?`${formatDuration(e.setup)} move / setup`:null,e.targets?`${formatDuration(e.target)} targets (${e.targets})`:null].filter(Boolean).join(' + ');
 $('mobile-estimate').textContent=formatDuration(e.total);$('station-count').textContent=e.count+e.targets;
 $('status-left').textContent=`${e.count} stations${e.targets?` · ${e.targets} targets`:''} · ${project.links.length} links`;
 $('status-scale').textContent=u?.metresPerPixel?(u.georeference?`MGA2020 · Zone ${u.georeference.zone}`:'Scale set · metres'):'Not to scale';
 $('plan-badge').textContent=u?.kind==='sample'?'SAMPLE FLOOR PLAN':u?.name||'NEW PLAN';$('plan-revision').textContent=`REV ${project.revision}`;
 $('show-labels').checked=project.display.labels;$('show-links').checked=project.display.links;$('marker-size').value=project.display.markerSize*100;
 $('undo').disabled=!past.length;$('redo').disabled=!future.length;
 $('canvas-empty').hidden=!!u;
 $('overlay-controls').hidden=!project.overlay;$('overlay-tool').hidden=!project.overlay;$('overlay-name').textContent=project.overlay?`${project.overlay.name}${project.overlay.calibrated?'':' · image scale not set'}`:'';$('calibrate-plan').textContent=project.overlay?'Set image scale':'Set scale';$('aerial-attribution').hidden=u?.kind!=='six';
 if(list)renderList();renderSelection();renderTools();renderCanvas();
}
function renderList(){
 const list=$('station-list');list.replaceChildren();$('station-empty').hidden=!!project.stations.length;
 for(const station of project.stations){
  const li=document.createElement('li');li.className=`station-item${station.id===selected?' selected':''}`;
  const button=document.createElement('button');button.className='station-row';button.setAttribute('aria-label',`${station.kind==='target'?'Target':'Station'} ${stationLabel(station)}, ${station.density} density`);button.setAttribute('aria-pressed',String(station.id===selected));
  const c=stationCoordinates(project,station),f=coordinateFactor(project.underlay);
  const coordinates=c?`${c.easting.toFixed(2)} E, ${c.northing.toFixed(2)} N`:project.underlay?.metresPerPixel?`${(station.x*f).toFixed(1)}, ${(station.y*f).toFixed(1)} m`:'';
  button.innerHTML=`${station.kind==='target'?icon('target'):`<span class="density-dot ${station.density}"></span>`}<span class="station-number">${stationLabel(station)}</span><span class="station-density">${station.kind==='target'?'Target':station.density[0].toUpperCase()+station.density.slice(1)}</span><span class="station-coordinate">${coordinates}</span>`;
  button.onclick=()=>{selected=station.id;setTool('select');render();};li.append(button);list.append(li);
 }
}
function renderSelection(){
 const station=project.stations.find(s=>s.id===selected);$('selection-panel').hidden=!station;if(!station)return;
 $('selection-title').textContent=`${station.kind==='target'?'Target':'Station'} ${stationLabel(station)}`;
 const u=project.underlay,c=stationCoordinates(project,station),f=coordinateFactor(u),unit=u.metresPerPixel?'m':'px';
 $('coordinate-x-label').textContent=c?'Easting':'X';$('coordinate-y-label').textContent=c?'Northing':'Y';
 $('coordinate-unit').textContent=unit;document.querySelectorAll('.coordinate-unit').forEach(el=>el.textContent=unit);
 $('coordinate-reference').textContent=c?`MGA2020 · Zone ${c.zone} · EPSG:${c.epsg}`:'Local image coordinates';
 for(const axis of ['x','y']){const input=$(`station-${axis}`),extent=u.georeference?.extent;
  if(document.activeElement!==input)input.value=(c?(axis==='x'?c.easting:c.northing):station[axis]*f).toFixed(c||u.metresPerPixel?2:1);
  input.min=isLiveMap()?(axis==='x'?100000:0):extent?(axis==='x'?extent.xmin:extent.ymin):0;input.max=isLiveMap()?(axis==='x'?900000:10000000):extent?(axis==='x'?extent.xmax:extent.ymax):u[axis==='x'?'width':'height']*f;
 }
 $('selection-density').value=station.density;$('selection-density').disabled=station.kind==='target';if(document.activeElement!==$('station-note'))$('station-note').value=station.note;
}
function node(name,attrs={}){const el=document.createElementNS(svgNS,name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
function renderCanvas(){
 const u=project.underlay;syncLiveMap();const vp=$('viewport');vp.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.scale})`);$('paper').style.display=isLiveMap()?'none':'';$('underlay-image').style.display=isLiveMap()?'none':'';$('overlay-clip').setAttribute('clip-path',isLiveMap()?'none':'url(#image-clip)');$('paper').setAttribute('width',u?.width||0);$('paper').setAttribute('height',u?.height||0);
 $('image-clip-rect').setAttribute('width',u?.width||0);$('image-clip-rect').setAttribute('height',u?.height||0);
 const overlay=project.overlay,layer=$('image-overlay');layer.style.display=overlay?'':'none';
 if(overlay){const height=overlay.size*overlay.height/overlay.width;layer.setAttribute('transform',`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${overlay.size/2} ${height/2})`);layer.setAttribute('opacity',overlay.opacity);const image=$('overlay-image');if(image.getAttribute('href')!==overlay.dataUrl)image.setAttribute('href',overlay.dataUrl);image.setAttribute('width',overlay.size);image.setAttribute('height',height);const outline=$('overlay-outline');outline.setAttribute('width',overlay.size);outline.setAttribute('height',height);outline.setAttribute('stroke-width',2/view.scale);outline.style.display=tool==='overlay'?'':'none';}
 const bar=niceScale(u?.metresPerPixel,130/view.scale);$('canvas-scale').hidden=!u;$('scale-bar').hidden=!bar;$('scale-missing').hidden=!!bar;$('canvas-set-scale').hidden=!!bar;if(bar){$('scale-bar-line').style.width=`${bar.pixels*view.scale}px`;$('scale-bar-label').textContent=bar.label;}
 const img=$('underlay-image'),src=imageSource();if(isLiveMap())img.removeAttribute('href');else if(img.getAttribute('href')!==src)img.setAttribute('href',src);img.setAttribute('width',u?.width||0);img.setAttribute('height',u?.height||0);
 const links=$('plan-links');links.replaceChildren();
 if(project.display.links)for(const link of project.links){
  const a=project.stations.find(s=>s.id===link.from),b=project.stations.find(s=>s.id===link.to);if(!a||!b)continue;
  links.append(node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#7f9dc9','stroke-width':1.2/view.scale,'stroke-dasharray':`${4/view.scale} ${4/view.scale}`,opacity:.8}));
  const text=formatDistance(linkDistance(project,link)),width=text.length*7+12,label=node('g',{class:'link-distance',role:'img','aria-label':`${stationLabel(a)} to ${stationLabel(b)}: ${text}`,transform:`translate(${(a.x+b.x)/2} ${(a.y+b.y)/2}) scale(${1/view.scale})`,'data-link-id':link.id});
  label.append(node('rect',{x:-width/2,y:-10,width,height:20,rx:4,fill:'white',stroke:'#d3dae3','stroke-width':.7}));const value=node('text',{x:0,y:4,'text-anchor':'middle',fill:'#34495e','font-family':'Arial,sans-serif','font-size':12,'font-weight':500,class:'link-distance-label'});value.textContent=text;label.append(value);links.append(label);
 }
 const stations=$('plan-stations');stations.replaceChildren();const r=project.display.markerSize/view.scale;
 for(const s of project.stations){const g=node('g',{class:'station-marker','data-station-id':s.id,transform:`translate(${s.x} ${s.y}) scale(${r})`,'aria-selected':s.id===selected||s.id===linkStart?'true':'false'});const title=node('title');title.textContent=`${s.kind==='target'?'Target':'Station'} ${stationLabel(s)}${s.note?` — ${s.note}`:''}`;g.append(title,node('circle',{class:'selection-ring',r:22,fill:'#dbe8ff','fill-opacity':.9,stroke:'#285cda','stroke-width':1.5}));const color=COLORS[s.kind==='target'?'target':s.density];
 if(s.kind==='target')g.append(node('circle',{class:'marker-shape',r:9,fill:'white',stroke:color,'stroke-width':2.5}),node('circle',{r:3.2,fill:color}));else g.append(node('path',{class:'marker-shape',d:'M0-12 12 9H-12Z',fill:color,stroke:'white','stroke-width':1.8,'stroke-linejoin':'round'}));
 if(project.display.labels){const label=stationLabel(s),width=Math.max(27,label.length*7+8);g.append(node('rect',{x:-width/2,y:12,width,height:17,rx:3,fill:'white',stroke:'#dbe2eb','stroke-width':.7}));const text=node('text',{x:0,y:24,'text-anchor':'middle',fill:'#263b53','font-family':'Arial,sans-serif','font-size':11,'font-weight':600});text.textContent=label;g.append(text);}stations.append(g);}
 const marks=$('calibration-marks');marks.replaceChildren();scalePoints.forEach(pt=>marks.append(node('circle',{cx:pt.x,cy:pt.y,r:5/view.scale,class:'scale-dot','stroke-width':2/view.scale})));if(scalePoints.length===2)marks.prepend(node('line',{x1:scalePoints[0].x,y1:scalePoints[0].y,x2:scalePoints[1].x,y2:scalePoints[1].y,class:'scale-line','stroke-width':2/view.scale}));
 $('zoom-level').value=fitMode?'Fit':`${Math.round(view.scale*100)}%`;
 $('zoom-level').title=`${Math.round(view.scale*100)}% image scale`;
}
function stageSize(){const r=$('canvas-stage').getBoundingClientRect();return{width:r.width,height:r.height};}
function fitPlan(){
 const u=project.underlay;if(!u){renderCanvas();return;}const{width,height}=stageSize();if(width<1||height<1)return;
 if(isLiveMap()){
  const e=(project.stations.length||project.overlay)?imageryExportExtent(project):u.georeference.extent,m=u.metresPerPixel,resolution=Math.max((e.xmax-e.xmin)/width,(e.ymax-e.ymin)/height),cx=(e.xmin+e.xmax)/2,cy=(e.ymin+e.ymax)/2;
  fitScale=m/resolution;view={scale:fitScale,x:width/2-(cx-u.georeference.extent.xmin)/m*fitScale,y:height/2-(u.georeference.extent.ymax-cy)/m*fitScale};
 }else{const pad=width<600?34:96;fitScale=Math.max(.01,Math.min((width-pad)/u.width,(height-(width<600?140:132))/u.height));view={scale:fitScale,x:(width-u.width*fitScale)/2,y:(height-u.height*fitScale)/2-4};}
 fitMode=true;renderCanvas();
}
function zoom(factor,point){if(!project.underlay)return;const size=stageSize();const p=point||{x:size.width/2,y:size.height/2};const next=isLiveMap()?Math.max(project.underlay.metresPerPixel/1000,Math.min(project.underlay.metresPerPixel/.015,view.scale*factor)):Math.max(fitScale*.25,Math.min(fitScale*16,view.scale*factor));view.x=p.x-(p.x-view.x)*next/view.scale;view.y=p.y-(p.y-view.y)*next/view.scale;view.scale=next;fitMode=false;renderCanvas();if(isLiveMap())saveDraft();}
function worldPoint(e){const rect=$('plan-svg').getBoundingClientRect();return{x:(e.clientX-rect.left-view.x)/view.scale,y:(e.clientY-rect.top-view.y)/view.scale};}
function inPlan(pt){return validPosition(project,pt.x,pt.y);}
function canPlace(){if(!project.underlay){$('underlay-input').click();return false;}return true;}
function place(pt,kind='scan'){if(!canPlace()||!inPlan(pt))return;let s;try{commit(p=>{s=addStation(p,pt.x,pt.y,kind,density);});}catch(error){toast(error.message,true);return;}selected=s.id;render();announce(`${kind==='scan'?'Station':'Target'} ${stationLabel(s)} added. ${formatDuration(estimate(project).total)} estimated.`);}

$('plan-svg').addEventListener('pointerdown',e=>{
 if(pointer || (e.button!==0&&e.button!==1))return;const id=e.target.closest('[data-station-id]')?.dataset.stationId;
 const pan=tool==='pan'||e.button===1||spaceHeld;
 pointer={pointerId:e.pointerId,id,mayPan:isLiveMap()&&!id&&['scan','target','select','link'].includes(tool),overlay:tool==='overlay'&&!!project.overlay,pan,startX:e.clientX,startY:e.clientY,startView:{...view},before:snapshot(project),moved:false,point:worldPoint(e)};
 if(id&&!pan&&!pointer.overlay){selected=id;render();}
 $('plan-svg').setPointerCapture(e.pointerId);e.preventDefault();
});
$('plan-svg').addEventListener('pointermove',e=>{
 if(!pointer||pointer.pointerId!==e.pointerId)return;const dx=e.clientX-pointer.startX,dy=e.clientY-pointer.startY;if(Math.abs(dx)+Math.abs(dy)>4)pointer.moved=true;
 if(pointer.mayPan&&pointer.moved)pointer.pan=true;
 if(pointer.pan){view.x=pointer.startView.x+dx;view.y=pointer.startView.y+dy;fitMode=false;renderCanvas();return;}
 if(pointer.overlay&&pointer.moved){const limitX=isLiveMap()?1e9:project.underlay.width*20,limitY=isLiveMap()?1e9:project.underlay.height*20;project.overlay.x=Math.max(-limitX,Math.min(limitX,pointer.before.overlay.x+dx/view.scale));project.overlay.y=Math.max(-limitY,Math.min(limitY,pointer.before.overlay.y+dy/view.scale));renderCanvas();return;}
 if(pointer.id&&pointer.moved&&['select','scan','target'].includes(tool)){const s=project.stations.find(s=>s.id===pointer.id),start=pointer.before.stations.find(s=>s.id===pointer.id);if(s){s.x=Math.max(positionBounds(project).xmin,Math.min(positionBounds(project).xmax,start.x+dx/view.scale));s.y=Math.max(positionBounds(project).ymin,Math.min(positionBounds(project).ymax,start.y+dy/view.scale));updateStationCoordinates(project);renderCanvas();renderSelection();}}
});
$('plan-svg').addEventListener('pointerup',e=>{
 if(!pointer||pointer.pointerId!==e.pointerId)return;const current=pointer;pointer=null;if($('plan-svg').hasPointerCapture(e.pointerId))$('plan-svg').releasePointerCapture(e.pointerId);
 if(current.moved){if(current.pan){if(isLiveMap())saveDraft();return;}if(current.overlay){historyPush(current.before);render();saveDraft();return;}if(current.id&&!current.pan&&['select','scan','target'].includes(tool)){historyPush(current.before);render();saveDraft();}return;}
 if(current.pan)return;const pt=worldPoint(e);
 if(current.id){if(tool==='link'){if(!linkStart){linkStart=current.id;notice('Select the second station.');}else if(linkStart!==current.id){const from=linkStart,to=current.id;toggleLink(from,to);linkStart=null;notice(null);}renderTools();renderCanvas();}return;}
 if(tool==='select'){selected=null;render();return;}
 if(tool==='scan'||tool==='target'){place(pt,tool==='target'?'target':'scan');return;}
 if(tool==='scale'&&canPlace()&&inPlan(pt)){scalePoints.push(pt);renderCanvas();if(scalePoints.length===2)calibrationDialog();else notice('Select the second point.');}
});
function cancelPointer(e){if(!pointer||(e?.pointerId!==undefined&&e.pointerId!==pointer.pointerId))return;const current=pointer;pointer=null;if(current.pan)view=current.startView;else if(current.id||current.overlay)project=current.before;if($('plan-svg').hasPointerCapture(current.pointerId))$('plan-svg').releasePointerCapture(current.pointerId);render();}
$('plan-svg').addEventListener('pointercancel',cancelPointer);
$('plan-svg').addEventListener('lostpointercapture',cancelPointer);
window.addEventListener('blur',()=>{spaceHeld=false;cancelPointer();});
$('canvas-stage').addEventListener('wheel',e=>{e.preventDefault();const r=$('canvas-stage').getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
let spaceHeld=false;
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('modal').open){selected=null;setTool('select');toggleSettings(false);render();return;}
 if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('modal').open)return;
 if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if(e.key.toLowerCase()==='y'){e.preventDefault();redo();}if(e.key.toLowerCase()==='s'){e.preventDefault();saveProject();}if(e.key.toLowerCase()==='o'){e.preventDefault();$('project-input').click();}return;}
 const keys={v:'select',s:'scan',t:'target',l:'link',c:'scale',h:'pan'};if(keys[e.key.toLowerCase()])setTool(keys[e.key.toLowerCase()]);
 if(e.key.toLowerCase()==='f'){fitPlan();if(isLiveMap())saveDraft();}if(e.key==='?')openHelp();
 if(e.key===' '&&!e.target.closest('button,a,summary')){spaceHeld=true;e.preventDefault();}
 if(['Delete','Backspace'].includes(e.key)&&selected){e.preventDefault();removeSelected();}
 if(e.key.startsWith('Arrow')&&selected){e.preventDefault();const step=(e.shiftKey?10:1)/view.scale;commit(p=>{const s=p.stations.find(s=>s.id===selected);s.x=Math.max(positionBounds(p).xmin,Math.min(positionBounds(p).xmax,s.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));s.y=Math.max(positionBounds(p).ymin,Math.min(positionBounds(p).ymax,s.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));});}
});
document.addEventListener('keyup',e=>{if(e.key===' ')spaceHeld=false;});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.querySelectorAll('[data-density]').forEach(b=>b.onclick=()=>{density=b.dataset.density;const s=project.stations.find(s=>s.id===selected);if(tool==='select'&&s?.kind==='scan')commit(p=>p.stations.find(s=>s.id===selected).density=density);else setTool('scan');renderTools();});
for(const key of [...DENSITIES,'setup','target']){
 const input=$(key==='setup'?'setup-time':key==='target'?'target-time':`time-${key}`),field=key==='setup'?'setupSeconds':'targetSeconds';
 input.addEventListener('input',()=>{const value=parseDuration(input.value,['setup','target'].includes(key));if(value===null)invalidTimes.add(key);else{invalidTimes.delete(key);if(DENSITIES.includes(key)){if(project.profiles[key]!==value)commit(p=>p.profiles[key]=value);}else if(project[field]!==value)commit(p=>p[field]=value);}render(false);});
 input.addEventListener('blur',()=>{if(!invalidTimes.has(key))input.value=inputDuration(DENSITIES.includes(key)?project.profiles[key]:project[field]);});
}
$('project-title').addEventListener('input',()=>{project.title=$('project-title').value||'Untitled plan';saveDraft();});
$('project-title').addEventListener('blur',()=>{if(!$('project-title').value.trim()){$('project-title').value='Untitled plan';project.title='Untitled plan';}});
$('undo').onclick=undo;$('redo').onclick=redo;$('fit-plan').onclick=()=>{fitPlan();if(isLiveMap())saveDraft();};$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);
function addAtCenter(kind='scan'){if(!canPlace())return;const size=stageSize();place({x:Math.max(positionBounds(project).xmin,Math.min(positionBounds(project).xmax,(size.width/2-view.x)/view.scale)),y:Math.max(positionBounds(project).ymin,Math.min(positionBounds(project).ymax,(size.height/2-view.y)/view.scale))},kind);setTool('select');}
$('add-center').onclick=()=>addAtCenter();$('add-target').onclick=()=>addAtCenter('target');
function removeSelected(){if(!selected)return;const label=stationLabel(project.stations.find(s=>s.id===selected));commit(p=>deleteStation(p,selected));announce(`Station ${label} deleted. Undo is available.`);}
$('delete-selected').onclick=removeSelected;
$('selection-density').onchange=()=>commit(p=>p.stations.find(s=>s.id===selected).density=$('selection-density').value);
for(const axis of ['x','y'])$(`station-${axis}`).onchange=()=>{
 const input=$(`station-${axis}`),value=Number(input.value),pixel=coordinateToPixel(project.underlay,axis,value),max=project.underlay[axis==='x'?'width':'height'];
 const bounds=positionBounds(project);if(!input.value||!Number.isFinite(pixel)||pixel<bounds[axis==='x'?'xmin':'ymin']||pixel>bounds[axis==='x'?'xmax':'ymax']){toast('Enter a coordinate within the plan.',true);input.blur();renderSelection();return;}
 commit(p=>p.stations.find(s=>s.id===selected)[axis]=pixel);
};
$('station-note').onchange=()=>{if(selected)commit(p=>p.stations.find(s=>s.id===selected).note=$('station-note').value);};
$('show-labels').onchange=()=>commit(p=>p.display.labels=$('show-labels').checked);$('show-links').onchange=()=>commit(p=>p.display.links=$('show-links').checked);$('marker-size').onchange=()=>commit(p=>p.display.markerSize=Number($('marker-size').value)/100);
$('calibrate-plan').onclick=()=>calibrationDialog(true);$('canvas-set-scale').onclick=()=>calibrationDialog(true);
function toggleSettings(open){
 const panel=$('settings-panel'),wasOpen=panel.classList.contains('open');
 panel.classList.toggle('open',open);$('sidebar-backdrop').hidden=!open;$('open-settings').setAttribute('aria-expanded',String(open));
 const mobile=matchMedia('(max-width:760px)').matches;
 document.querySelector('.app-header').inert=open&&mobile;document.querySelector('.drawing-workspace').inert=open&&mobile;
 if(open&&mobile){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');$('close-settings').focus();}
 else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(wasOpen&&mobile)$('open-settings').focus();}
}
$('settings-panel').addEventListener('keydown',e=>{
 if(e.key!=='Tab'||!e.currentTarget.classList.contains('open')||!matchMedia('(max-width:760px)').matches)return;
 const fields=[...e.currentTarget.querySelectorAll('button,input,select,summary,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
 const first=fields[0],last=fields.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
matchMedia('(max-width:760px)').addEventListener('change',()=>toggleSettings(false));
$('open-settings').onclick=()=>toggleSettings(!$('settings-panel').classList.contains('open'));$('close-settings').onclick=() =>toggleSettings(false);$('sidebar-backdrop').onclick=()=>toggleSettings(false);

function showModal(title,html,onSubmit){if($('modal').open)$('modal').close();if(modalCleanup){modalCleanup();modalCleanup=null;}$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal').showModal();const form=$('modal-body').querySelector('form');if(form&&onSubmit)form.onsubmit=async e=>{e.preventDefault();try{await onSubmit(new FormData(form),form);}catch(err){const output=form.querySelector('.modal-error');if(output){output.hidden=false;output.textContent=err.message;}else toast(err.message,true);}};$('modal-body').querySelector('[data-cancel]')?.addEventListener('click',()=>$('modal').close());}
$('close-modal').onclick=()=>$('modal').close();$('modal').addEventListener('close',()=>{if($('modal').open)return;if(modalCleanup){modalCleanup();modalCleanup=null;}if(tool==='scale'){scalePoints=[];renderCanvas();notice('Select two points with a known distance.');}});$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.x||e.clientX>r.right||e.clientY<r.y||e.clientY>r.bottom)$('modal').close();}});
function formError(){return '<p class="modal-error" role="alert" hidden></p>';}
function actions(label='Save'){return `<div class="modal-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">${label}</button></div>`;}
function confirm(title,copy,action,label='Continue'){showModal(title,`<form class="modal-form"><p class="modal-copy">${escapeHTML(copy)}</p>${actions(label)}</form>`,()=>{$('modal').close();action();});}
function calibrationDialog(manual=false){
 const u=project.underlay;if(!u)return;const overlay=u.georeference?project.overlay:null;
 if(u.georeference&&!overlay){toast('Basemap scale is set by its MGA2020 grid.');return;}
 const image=overlay||u,points=manual?[{x:0,y:0},{x:image.width,y:0}]:scalePoints;
 if(!manual&&Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)<2){scalePoints=[];toast('Select two different points.',true);renderCanvas();return;}
 const coordinates=manual?`<p class="form-hint">Enter two image points in pixels, then their known separation in metres.</p><div class="form-row">${['x','y'].map(axis=>`<label>Point A ${axis.toUpperCase()} (px)<input name="a-${axis}" type="number" min="0" max="${axis==='x'?image.width:image.height}" value="0" step="any" required></label>`).join('')}</div><div class="form-row">${['x','y'].map(axis=>`<label>Point B ${axis.toUpperCase()} (px)<input name="b-${axis}" type="number" min="0" max="${axis==='x'?image.width:image.height}" value="${axis==='x'?image.width:0}" step="any" required></label>`).join('')}</div><button type="button" class="text-button" id="pick-scale-points">Pick points on plan</button>`:'';
 showModal(overlay?'Set image scale':'Set scale',`<form class="modal-form">${coordinates}<label>Known distance (m)<input name="distance" type="number" min="0.001" max="1000000" step="any" required placeholder="e.g. 10"></label>${formError()}${actions('Apply scale')}</form>`,data=>{
  let selectedPoints=manual?['a','b'].map(key=>({x:Number(data.get(`${key}-x`)),y:Number(data.get(`${key}-y`))})):points;
  if(manual&&overlay)selectedPoints=selectedPoints.map(point=>overlayPointToWorld(overlay,point));
  const pixels=Math.hypot(selectedPoints[1].x-selectedPoints[0].x,selectedPoints[1].y-selectedPoints[0].y),value=Number(data.get('distance')),mpp=value/pixels;
  if(!Number.isFinite(mpp)||pixels<2||mpp<=0||mpp>100000)throw new Error('Use different points and a distance greater than zero.');
  commit(p=>{if(overlay)p.overlay=calibrateOverlay(p.underlay,p.overlay,selectedPoints,value);else{p.underlay.metresPerPixel=mpp;p.underlay.unit='m';}});$('modal').close();setTool('select');toast(overlay?'Image scale set.':'Scale calibrated.');
 });
 if(manual)$('pick-scale-points').onclick=()=>{$('modal').close();setTool('scale');toggleSettings(false);};
}
function toggleLink(from,to){
 const existing=project.links.find(l=>(l.from===from&&l.to===to)||(l.from===to&&l.to===from));
 if(!existing&&project.links.length>=LIMITS.links){toast('This plan has reached its link limit.',true);return;}
 commit(p=>{if(existing)p.links=p.links.filter(l=>l.id!==existing.id);else p.links.push({id:uid(),from,to});});
 announce(existing?'Link removed.':'Link added.');
}
$('edit-links').onclick=()=>{
 const station=project.stations.find(s=>s.id===selected);if(!station)return;
 const others=project.stations.filter(s=>s.id!==selected);
 showModal(`Links for ${stationLabel(station)}`,`<div class="link-editor">${others.length?others.map(s=>`<label><input type="checkbox" data-link-to="${escapeHTML(s.id)}" ${project.links.some(l=>(l.from===selected&&l.to===s.id)||(l.to===selected&&l.from===s.id))?'checked':''}>${s.kind==='target'?'Target':'Station'} ${stationLabel(s)}</label>`).join(''):'<p class="form-hint">Add another station or target to create a link.</p>'}</div>`);
 $('modal-body').querySelectorAll('[data-link-to]').forEach(input=>input.onchange=()=>toggleLink(station.id,input.dataset.linkTo));
};
$('project-details').onclick=()=>showModal('Project details',`<form class="modal-form"><label>Project name<input name="title" value="${escapeHTML(project.title)}" maxlength="100" required></label><label>Site / location<input name="site" value="${escapeHTML(project.site)}" maxlength="200"></label><label>Revision<input name="revision" value="${escapeHTML(project.revision)}" maxlength="20" required></label>${actions()}</form>`,data=>{commit(p=>{p.title=data.get('title').trim()||'Untitled plan';p.site=data.get('site');p.revision=data.get('revision');});$('modal').close();});
$('clear-stations').onclick=()=>{if(!project.stations.length)return;confirm('Clear all stations?',`${project.stations.length} stations and targets will be removed. You can undo this.`,()=>commit(p=>{p.stations=[];p.links=[];}),'Clear stations');};
function replaceProject(next){upgradeMap(next);const savedView=next.mapView;commit(()=>{project=next;selected=null;invalidTimes.clear();notice(null);},{fit:true});restoreMapView(savedView);}
$('new-project').onclick=()=>confirm('Start a new plan?','This replaces the current device draft. Save a project file to keep a separate copy. You can undo this.',()=>replaceProject(newProject()),'New plan');
$('load-sample').onclick=()=>replaceProject(newProject(true));
function saveProject(){if(invalidTimes.size){toast('Correct the duration fields before saving.',true);return;}downloadFile(JSON.stringify(serializable(project),null,2),`${safeName(project.title)}.planscan.json`,'application/json');toast('Project downloaded.');}
function safeName(name){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'scan-plan';}
$('save-project').onclick=saveProject;$('open-project').onclick=()=>$('project-input').click();
$('project-input').onchange=async e=>{const file=e.target.files[0];if(file)await loadProject(file);e.target.value='';};
async function loadProject(file){try{if(file.size>LIMITS.projectBytes)throw new Error('Choose a project smaller than 96 MB.');const raw=JSON.parse(await file.text());let next;if([2,3,4].includes(raw.version))next=normalizeProject(raw);else if(Array.isArray(raw.objects))next=importLegacy(raw);else throw new Error('Choose a PlanScan project file.');replaceProject(next);toast([2,3,4].includes(raw.version)?'Project opened.':'Legacy plan imported. Review scan times and links.');toggleSettings(false);}catch(err){toast(err instanceof SyntaxError?'This file is not a valid PlanScan project.':err.message,true);}}
function importLegacy(raw){const bg=raw.backgroundImage;if(!bg||!/^data:image\/(?:png|jpeg|webp);base64,/.test(bg.src||''))throw new Error('This legacy template has no supported underlay image.');const p=newProject();p.title='Imported plan';p.underlay={kind:'image',name:'Legacy underlay',width:bg.width,height:bg.height,dataUrl:bg.src,metresPerPixel:null,unit:'m',source:'Legacy template',page:null};const angle=(bg.angle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),used=new Set();for(const o of raw.objects){if(o.type!=='group')continue;const objects=o.objects||[],tri=objects.some(x=>x.type==='triangle'),target=objects.some(x=>x.type==='circle');if(!tri&&!target)continue;const dx=o.left-(bg.left||0),dy=o.top-(bg.top||0),x=(c*dx+s*dy)/(bg.scaleX||1)+(bg.originX==='center'?bg.width/2:0),y=(-s*dx+c*dy)/(bg.scaleY||1)+(bg.originY==='center'?bg.height/2:0);const st=addStation(p,Math.max(0,Math.min(bg.width,x)),Math.max(0,Math.min(bg.height,y)),target?'target':'scan',o.fill==='#5FFBF1'?'low':o.fill==='#ec74ff'?'high':'medium',{autoLink:false});const label=Number(String(objects.find(x=>x.text)?.text||'').replace(/\D/g,''));if(label>0&&!used.has(`${st.kind}:${label}`))st.number=label;used.add(`${st.kind}:${st.number}`);}p.nextStationNumber=Math.max(1,...p.stations.filter(s=>s.kind==='scan').map(s=>s.number+1));p.nextTargetNumber=Math.max(1,...p.stations.filter(s=>s.kind==='target').map(s=>s.number+1));return normalizeProject(p);}

['upload-plan','empty-upload'].forEach(id=>$(id).onclick=()=>$('underlay-input').click());
$('underlay-input').onchange=async e=>{const file=e.target.files[0];if(file)await loadUnderlay(file);e.target.value='';};
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('The file could not be read.'));r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('The image could not be read. Choose PNG, JPG or WEBP.'));img.src=src;});}
async function applyUnderlay(underlay,{overlayImage=null}={}){
 if(underlay.dataUrl?.length>LIMITS.dataUrlCharacters)throw new Error('This underlay exceeds the saved-project image limit. Use a smaller image.');
 const run=()=>{commit(p=>{p.underlay=underlay;p.overlay=overlayImage?newOverlay(underlay,overlayImage):null;p.stations=[];p.links=[];p.sample=false;},{fit:true});setTool('scan');toggleSettings(false);if(overlayImage)openOverlaySettings();};
 if(project.stations.length)confirm('Replace underlay?','Existing stations will be cleared. You can undo this.',run,'Replace underlay');else run();
}
function chooseImagePlacement(image){
 showModal('Place uploaded plan',`<form class="modal-form"><p class="modal-copy">${escapeHTML(image.name)}</p><label>Background<select name="background"><option value="blank">Blank canvas</option><option value="aerial" ${project.underlay?.kind==='six'?'selected':''}>NSW Imagery Basemap</option></select></label><p class="form-hint">A basemap overlay can be moved, rotated, resized and faded to align with the site.</p>${formError()}${actions('Place image')}</form>`,async data=>{
  $('modal').close();if(data.get('background')==='blank'){await applyUnderlay(image);return;}
  if(project.underlay?.kind!=='six'){openMap(image);return;}
  const place=()=>{commit(p=>{p.overlay=newOverlay(p.underlay,image);if(isLiveMap()){const size=stageSize();p.overlay.x=(size.width/2-view.x)/view.scale-p.overlay.size/2;p.overlay.y=(size.height/2-view.y)/view.scale-p.overlay.size*p.overlay.height/p.overlay.width/2;}});toggleSettings(false);openOverlaySettings();};
  if(project.overlay)confirm('Replace image overlay?','The existing image overlay will be replaced. Stations will stay in place. You can undo this.',place,'Replace image');else place();
 });
}
function openOverlaySettings(){
 const o=project.overlay,u=project.underlay;if(!o||!u)return;const f=coordinateFactor(u);
 showModal('Adjust image overlay',`<form class="modal-form"><p class="secondary">${escapeHTML(o.name)}</p><div class="form-row"><label>Left (m)<input name="x" type="number" step="any" value="${(o.x*f).toFixed(3)}" required></label><label>Top (m)<input name="y" type="number" step="any" value="${(o.y*f).toFixed(3)}" required></label></div><div class="form-row"><label>Image width (m)<input name="size" type="number" step="any" min="0.001" value="${(o.size*f).toFixed(3)}" required></label><label>Rotation (degrees)<input name="rotation" type="number" step="any" min="-360" max="360" value="${o.rotation}" required></label></div><label>Opacity (%)<input name="opacity" type="number" min="0" max="100" step="1" value="${Math.round(o.opacity*100)}" required></label><button type="button" class="text-button" id="move-overlay">Move image on plan</button>${formError()}${actions('Apply image')}</form>`,data=>{
  const x=Number(data.get('x'))/f,y=Number(data.get('y'))/f,size=Number(data.get('size'))/f,rotation=Number(data.get('rotation')),opacity=Number(data.get('opacity'))/100;
  if(![x,y,size,rotation,opacity].every(Number.isFinite)||size<=0||size>u.width*20||Math.abs(x)>(isLiveMap()?1e9:u.width*20)||Math.abs(y)>(isLiveMap()?1e9:u.height*20)||opacity<0||opacity>1)throw new Error('Enter a valid image position, width and opacity.');
  commit(p=>Object.assign(p.overlay,{x,y,size,rotation,opacity,calibrated:p.overlay.calibrated||Math.abs(p.overlay.size-size)>.01}));$('modal').close();
 });
 $('move-overlay').onclick=()=>{$('modal').close();toggleSettings(false);setTool('overlay');};
}
$('adjust-overlay').onclick=openOverlaySettings;
$('remove-overlay').onclick=()=>confirm('Remove image overlay?','The basemap and stations will stay in place. You can undo this.',()=>{commit(p=>p.overlay=null);setTool('select');},'Remove image');
async function loadUnderlay(file){try{if(file.size>LIMITS.uploadBytes)throw new Error('Choose a file smaller than 25 MB.');if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){await loadPDF(file);return;}if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PDF, PNG, JPG or WEBP file.');const src=await fileData(file),image=await loadImage(src);if(image.width>16000||image.height>16000||image.width*image.height>48000000)throw new Error('Use an image under 48 megapixels and 16,000 px per side.');chooseImagePlacement({kind:'image',name:file.name,width:image.width,height:image.height,dataUrl:src,metresPerPixel:null,unit:'m',source:file.name,page:null});}catch(err){toast(err.message,true);}}
async function loadPDF(file){
 toast('Opening PDF…');const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
 const loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 const pdf=await loadingTask.promise;
 let disposed=false,ticket=0,rendered=null;
 showModal('Choose PDF page',`<form class="modal-form"><p class="secondary">${escapeHTML(file.name)}</p><label>Page (1–${pdf.numPages})<input name="page" id="pdf-page-number" type="number" min="1" max="${pdf.numPages}" value="1" required></label><div class="export-preview" id="pdf-preview">Loading page…</div>${formError()}${actions('Use page')}</form>`,async(data,form)=>{
  const pageNumber=Number(data.get('page'));if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>pdf.numPages)throw new Error('Choose a page within this PDF.');
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const result=rendered?.page===pageNumber?rendered:await drawPage(pageNumber);if(disposed)return;$('modal').close();chooseImagePlacement({kind:'pdf',name:file.name,width:result.width,height:result.height,dataUrl:result.src,metresPerPixel:null,unit:'m',source:file.name,page:pageNumber});}
  finally{button.disabled=false;}
 });
 modalCleanup=()=>{disposed=true;ticket++;loadingTask.destroy().catch(()=>{});};
 async function drawPage(number){
  const current=++ticket,page=await pdf.getPage(number),base=page.getViewport({scale:1}),v=page.getViewport({scale:Math.min(2.5,2800/Math.max(base.width,base.height))}),canvas=document.createElement('canvas');
  canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
  const result={page:number,width:canvas.width,height:canvas.height,src:canvas.toDataURL('image/png')};
  if(!disposed&&current===ticket){rendered=result;const img=document.createElement('img');img.src=result.src;img.alt=`PDF page ${number} preview`;$('pdf-preview')?.replaceChildren(img);}
  return result;
 }
 $('pdf-page-number').onchange=async()=>{const n=Number($('pdf-page-number').value);if(Number.isInteger(n)&&n>=1&&n<=pdf.numPages)try{await drawPage(n);}catch{if(!disposed)toast('This PDF page could not be rendered.',true);}};
 try{await drawPage(1);}catch(error){if(!disposed){$('modal').close();throw error;}}
}
$('rotate-plan').onclick=async()=>{const u=project.underlay;if(!u||u.kind==='six')return;try{const image=await loadImage(imageSource()),canvas=document.createElement('canvas');canvas.width=u.height;canvas.height=u.width;const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0,u.width,u.height);const mime=u.dataUrl?.startsWith('data:image/jpeg')?'image/jpeg':u.dataUrl?.startsWith('data:image/webp')?'image/webp':'image/png';const src=canvas.toDataURL(mime,.97);if(src.length>LIMITS.dataUrlCharacters)throw new Error('The rotated image exceeds the project limit. Use a smaller image.');commit(p=>{const width=p.underlay.width,height=p.underlay.height;p.underlay={...p.underlay,kind:'image',width:height,height:width,dataUrl:src};for(const s of p.stations){const x=s.x;s.x=height-s.y;s.y=x;}},{fit:true});toast('Plan rotated.');}catch(err){toast(err.message,true);}};

['six-map','empty-map'].forEach(id=>$(id).onclick=()=>openMap());
function openMap(overlayImage=null){
 const controller=new AbortController(),map=project.underlay?.kind==='six'?project.underlay.map:null;
 showModal('NSW Imagery Basemap',`<form class="modal-form"><div class="address-search"><label>NSW address<input id="aerial-address" maxlength="150" placeholder="Street number, street and suburb" autocomplete="off"></label><button class="button" type="button" id="find-address">Find address</button></div><label id="address-results-label" hidden>Choose address<select id="address-results"></select></label><p class="form-hint" id="address-status" role="status"></p><div class="form-row"><label>Latitude (GDA2020)<input name="latitude" type="number" step="any" min="-39" max="-28" value="${map?.latitude||-33.8568}" required></label><label>Longitude (GDA2020)<input name="longitude" type="number" step="any" min="140" max="160" value="${map?.longitude||151.2153}" required></label></div><label>Initial view width (m)<input name="widthMetres" type="number" min="25" max="20000" step="any" value="${map?.widthMetres||500}" required></label><p class="form-hint">Live NSW imagery. Pan and zoom to explore. Stations use MGA2020 coordinates.</p>${formError()}${actions('Load basemap')}</form>`,async(data,form)=>{
  const button=form.querySelector('[type=submit]');button.disabled=true;button.innerHTML='<span class="loading-spinner"></span>Loading basemap…';
  try{
   const params={latitude:Number(data.get('latitude')),longitude:Number(data.get('longitude')),widthMetres:Number(data.get('widthMetres'))};
   const result=await loadSixBasemap(params,{signal:controller.signal});if(!form.isConnected||!$('modal').open)return;
   const underlay={kind:'six',name:'NSW Imagery Basemap',width:result.width,height:result.height,dataUrl:null,metresPerPixel:result.metresPerPixel,unit:'m',source:IMAGERY_ATTRIBUTION,page:null,map:{...params,live:true,portalItemId:PORTAL_ITEM_ID,serviceUrl:IMAGERY_SERVICE},georeference:result.georeference};
   // Use the project validator for provider metadata before changing the current plan.
   const checked=normalizeProject({...newProject(),underlay}).underlay;
   const previous=project.underlay;
   const sameArea=previous?.kind==='six'&&previous.width===checked.width&&previous.height===checked.height&&JSON.stringify(previous.georeference)===JSON.stringify(checked.georeference);
   $('modal').close();if(sameArea&&!overlayImage){commit(p=>p.underlay=checked,{fit:true});toggleSettings(false);}else await applyUnderlay(checked,{overlayImage});
  }finally{button.disabled=false;button.textContent='Load basemap';}
 });
 modalCleanup=()=>controller.abort();
 let searchTicket=0,results=[];
 $('find-address').onclick=async()=>{
  const query=$('aerial-address').value.trim(),ticket=++searchTicket,button=$('find-address');button.disabled=true;$('address-status').textContent='Searching…';
  try{const response=await fetch('/api/six/search?q='+encodeURIComponent(query),{signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error);if(controller.signal.aborted||ticket!==searchTicket||!$('address-results'))return;results=data.results;
   const select=$('address-results');select.replaceChildren();results.forEach((result,index)=>{const option=document.createElement('option');option.value=index;option.textContent=result.address;select.append(option);});$('address-results-label').hidden=!results.length;$('address-status').textContent=results.length?'':'No matching address. Try a full address or enter coordinates.';if(results.length)select.onchange();
  }catch(error){if(!controller.signal.aborted&&$('address-status'))$('address-status').textContent=error.message;}finally{button.disabled=false;}
 };
 $('address-results').onchange=()=>{const result=results[Number($('address-results').value)];if(result){$('modal-body').querySelector('[name=latitude]').value=result.latitude;$('modal-body').querySelector('[name=longitude]').value=result.longitude;}};
}

$('export-plan').onclick=openExport;
async function openExport(){if(invalidTimes.size){toast('Correct the duration fields before exporting.',true);return;}if(!project.underlay)return;if(!isLiveMap()&&!imageSource())return;
 let qaProjectPromise;
 async function qaProject(){
  if(!qaProjectPromise){const saved=snapshot(project);qaProjectPromise=!isLiveMap()?Promise.resolve(saved):(async()=>{const engine=liveEngine||await liveEnginePromise;if(!engine)throw new Error('Imagery is unavailable. Retry the map before exporting.');const frame=await engine.snapshot(imageryExportExtent(saved));return projectForMapSnapshot(saved,frame);})();}
  return qaProjectPromise;
 }

 showModal('Export QA plan',`<form class="modal-form"><div class="form-row"><label>Format<select name="format"><option value="pdf">PDF</option><option value="png">PNG image</option></select></label><label>Paper<select name="paper"><option value="a4">A4</option><option value="a3">A3</option></select></label></div><label>Orientation<select name="orientation"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><div class="export-preview" id="qa-preview"><span class="secondary">Preparing preview…</span></div><div class="export-summary"><span>${estimate(project).count} stations</span><span>${formatDuration(estimate(project).total)}</span><span>Rev ${escapeHTML(project.revision)}</span></div>${isLiveMap()?'<p class="form-hint">Export fits all stations and the uploaded overlay.</p>':''}${!project.underlay.metresPerPixel?'<p class="form-hint">Not to scale · set a known distance to add a scale bar.</p>':''}${formError()}${actions('Download')}</form>`,async(data,form)=>{const b=form.querySelector('[type=submit]');b.disabled=true;try{project.output={paper:data.get('paper'),orientation:data.get('orientation'),format:data.get('format')};saveDraft();const output=await createQA(await qaProject(),{orientation:data.get('orientation'),paper:data.get('paper')});await saveQA(output,project,{format:data.get('format'),orientation:data.get('orientation'),paper:data.get('paper')});$('modal').close();toast('QA plan downloaded.');}finally{b.disabled=false;}});
 for(const [key,value] of Object.entries(project.output))$('modal-body').querySelector(`[name=${key}]`).value=value;
 let latest=0;modalCleanup=()=>{latest++;};async function preview(){const ticket=++latest;try{const form=$('modal-body').querySelector('form');if(!form)return;const data=new FormData(form),output=await createQA(await qaProject(),{orientation:data.get('orientation'),paper:data.get('paper'),preview:true});if(ticket!==latest||!$('qa-preview'))return;const img=document.createElement('img');img.src=output.toDataURL('image/png');img.alt='QA plan preview with station IDs, scale, legend and estimate';$('qa-preview').replaceChildren(img);}catch(err){if(ticket===latest&&$('qa-preview'))$('qa-preview').textContent=err.message;}}
 $('modal-body').querySelectorAll('select').forEach(s=>s.onchange=preview);preview();
}
function openHelp(){showModal('Plan controls',`<div class="shortcut-list"><span>Select / move</span><kbd>V</kbd><span>Place scan / target</span><kbd>S / T</kbd><span>Link stations / set scale</span><kbd>L / C</kbd><span>Pan</span><kbd>H or Space</kbd><span>Fit plan</span><kbd>F</kbd><span>Move selected station</span><kbd>Arrow keys</kbd><span>Delete selected station</span><kbd>Delete</kbd><span>Undo / redo</span><kbd>Ctrl Z / Ctrl Shift Z</kbd><span>Save / open project</span><kbd>Ctrl S / Ctrl O</kbd></div><p class="help-footer">Choose a density, then click the plan to place a scan. Use the station list to select and edit coordinates.<br><br>Time estimates include profile durations, move / setup per scan, and target scan time per target.<br><a href="/terms" target="_blank" rel="noopener">Sources & privacy</a></p>`);}
$('show-help').onclick=openHelp;
const stage=$('canvas-stage');
stage.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';stage.classList.add('file-drop-active');});stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('file-drop-active');});stage.addEventListener('drop',async e=>{e.preventDefault();stage.classList.remove('file-drop-active');const file=e.dataTransfer.files[0];if(file){if(/\.(?:json|txt|planscan)$/i.test(file.name))await loadProject(file);else await loadUnderlay(file);}});
new ResizeObserver(()=>{if(fitMode)fitPlan();else renderCanvas();}).observe(stage);
render();fitPlan();
(async()=>{try{db=await openDB();const saved=await storeValue('readonly');if(saved&&!localEdits){project=upgradeMap(normalizeProject(saved));const savedView=project.mapView;render();fitPlan();restoreMapView(savedView);}setSaveState(saved?'Restored from this device':'Sample project');}catch{setSaveState('Save a project file',false);}restoreComplete=true;if(localEdits)saveDraft();})();
