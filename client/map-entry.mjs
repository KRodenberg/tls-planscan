import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import TileImage from 'ol/source/TileImage.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import TileState from 'ol/TileState.js';
import {register} from 'ol/proj/proj4.js';
import {get as getProjection} from 'ol/proj.js';
import proj4 from 'proj4';

export const PORTAL_ITEM_ID='c04ce33be7a04a7884f786f5beb20b19';
export const IMAGERY_SERVICE='https://portal.spatial.nsw.gov.au/aid/tile/rest/services/NSWWebImagery/MapServer';
export const IMAGERY_ATTRIBUTION='NSW DCS Spatial Services; SPOT Image (Geoimage GeoHD) © Airbus DS 2025 — DCCEEW';
function registerMGA(epsg){
 const zone=epsg-7800,code=`EPSG:${epsg}`;
 proj4.defs('EPSG:7844','+proj=longlat +ellps=GRS80 +no_defs +type=crs');
 proj4.defs(code,`+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs +type=crs`);
 register(proj4);getProjection(code).setExtent([100000,0,900000,10000000]);return code;
}
export function mgaViewDefinition(latitude,longitude,widthMetres,width=1600,height=1200){
 const zone=Math.floor((longitude+180)/6)+1,epsg=7800+zone,code=registerMGA(epsg),center=proj4('EPSG:7844',code,[longitude,latitude]),resolution=widthMetres/width;
 return {zone,epsg,code,center,resolution,width,height,extent:{xmin:center[0]-widthMetres/2,ymin:center[1]-height*resolution/2,xmax:center[0]+widthMetres/2,ymax:center[1]+height*resolution/2}};
}
let metadata;
export async function loadImageryMetadata({signal}={}){
 if(metadata)return metadata;
 const response=await fetch('/api/six/metadata',{signal}),data=await response.json();if(!response.ok)throw new Error(data.error||'NSW imagery settings could not load.');
 const grid=data.tileInfo,lods=grid?.lods;
 if(!grid||!Array.isArray(lods)||!lods.length||(grid.spatialReference?.latestWkid||grid.spatialReference?.wkid)!==3857||![grid.origin?.x,grid.origin?.y,grid.rows,grid.cols].every(Number.isFinite)||grid.rows!==256||grid.cols!==256||!lods.every((lod,index)=>Number.isInteger(lod.level)&&lod.level>=0&&lod.level<=23&&Number.isFinite(lod.resolution)&&lod.resolution>0&&(!index||lod.resolution<lods[index-1].resolution)))throw new Error('The NSW Imagery Basemap tile grid is invalid.');
 metadata=data;return metadata;
}
export async function loadSixBasemap(params,{signal}={}){
 const response=await fetch('/api/six/map',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}),manifest=await response.json();if(!response.ok)throw new Error(manifest.error||'NSW imagery could not load.');
 await loadImageryMetadata({signal});const g=mgaViewDefinition(manifest.latitude,manifest.longitude,manifest.widthMetres);
 return {width:g.width,height:g.height,metresPerPixel:g.resolution,georeference:{zone:g.zone,epsg:g.epsg,extent:g.extent}};
}
function makeSource(config,controller,onState){
 const grid=config.tileInfo,e=config.fullExtent;let active=0;const failures=new Set(),urls=new Set();
 const state=()=>onState({loading:active>0,failed:failures.size>0});
 const source=new TileImage({projection:'EPSG:3857',wrapX:false,crossOrigin:'anonymous',transition:0,
  tileGrid:new TileGrid({origin:[grid.origin.x,grid.origin.y],tileSize:[grid.cols,grid.rows],resolutions:grid.lods.map(l=>l.resolution),...(e?{extent:[e.xmin,e.ymin,e.xmax,e.ymax]}:{})}),
  tileUrlFunction:coord=>coord?`/api/six/tile?level=${grid.lods[coord[0]].level}&row=${coord[2]}&column=${coord[1]}`:undefined,
  tileLoadFunction:(tile,url)=>{fetch(url,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Imagery tile unavailable');const objectURL=URL.createObjectURL(await response.blob());urls.add(objectURL);const image=tile.getImage(),release=()=>{URL.revokeObjectURL(objectURL);urls.delete(objectURL);};image.addEventListener('load',release,{once:true});image.addEventListener('error',release,{once:true});image.src=objectURL;}).catch(()=>tile.setState(TileState.ERROR));}
 });
 source.on('tileloadstart',()=>{active++;state();});source.on('tileloadend',event=>{active=Math.max(0,active-1);failures.delete(event.tile.getKey());state();});source.on('tileloaderror',event=>{active=Math.max(0,active-1);if(!controller.signal.aborted)failures.add(event.tile.getKey());state();});
 return {source,failed:()=>failures.size>0,retry:()=>{failures.clear();source.refresh();state();},dispose:()=>{source.dispose();for(const url of urls)URL.revokeObjectURL(url);urls.clear();}};
}
function copyMapCanvas(map,target){
 const [width,height]=map.getSize(),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,height);
 for(const layer of target.querySelectorAll('.ol-layer canvas')){if(!layer.width)continue;context.save();context.globalAlpha=Number(layer.parentNode.style.opacity||1);if(layer.style.transform&&layer.style.transform!=='none')context.setTransform(new DOMMatrix(layer.style.transform));context.drawImage(layer,0,0);context.restore();}
 const [xmin,ymin,xmax,ymax]=map.getView().calculateExtent([width,height]);return {dataUrl:canvas.toDataURL('image/png'),width,height,extent:{xmin,ymin,xmax,ymax}};
}
export async function createLiveBasemap({target,epsg,onState=()=>{}}){
 const config=await loadImageryMetadata(),controller=new AbortController(),tiles=makeSource(config,controller,onState),code=registerMGA(epsg);
 const map=new Map({target,pixelRatio:1,controls:[],interactions:[],layers:[new TileLayer({source:tiles.source})],view:new View({projection:code,center:[500000,6250000],resolution:1,constrainResolution:false,multiWorld:true})});
 let disposed=false;
 return {
  setViewport({center,resolution}){if(disposed)return;map.updateSize();const view=map.getView(),previous=view.getCenter();if(!previous||Math.abs(previous[0]-center[0])>1e-7||Math.abs(previous[1]-center[1])>1e-7)view.setCenter(center);if(Math.abs(view.getResolution()-resolution)>1e-10)view.setResolution(resolution);map.render();},
  retry(){tiles.retry();},
  async snapshot(extent,{width=1600,height=1200}={}){
   const host=document.createElement('div');host.dataset.imageryExport='true';host.inert=true;host.setAttribute('aria-hidden','true');host.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;pointer-events:none`;document.body.append(host);
   const exportController=new AbortController(),exportTiles=makeSource(config,exportController,()=>{}),center=[(extent.xmin+extent.xmax)/2,(extent.ymin+extent.ymax)/2],resolution=Math.max((extent.xmax-extent.xmin)/width,(extent.ymax-extent.ymin)/height);
   const exportMap=new Map({target:host,pixelRatio:1,controls:[],interactions:[],layers:[new TileLayer({source:exportTiles.source})],view:new View({projection:code,center,resolution,constrainResolution:false,multiWorld:true})});
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Imagery export took too long. Retry the export.')),45000);exportMap.once('rendercomplete',()=>{clearTimeout(timer);exportTiles.failed()?reject(new Error('Some imagery tiles could not load. Retry the export.')):resolve();});exportMap.renderSync();});return copyMapCanvas(exportMap,host);}
   finally{exportController.abort();exportMap.setTarget(undefined);exportMap.dispose();exportTiles.dispose();host.remove();}
  },
  dispose(){disposed=true;controller.abort();map.setTarget(undefined);map.dispose();tiles.dispose();}
 };
}
