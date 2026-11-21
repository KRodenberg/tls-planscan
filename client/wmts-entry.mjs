import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import WMTS,{optionsFromCapabilities} from 'ol/source/WMTS.js';
import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import TileState from 'ol/TileState.js';
import {register} from 'ol/proj/proj4.js';
import {get as getProjection} from 'ol/proj.js';
import proj4 from 'proj4';

export function mgaViewDefinition(latitude,longitude,widthMetres,width=1600,height=1200){
 const zone=Math.floor((longitude+180)/6)+1,epsg=7800+zone,code=`EPSG:${epsg}`;
 proj4.defs('EPSG:7844','+proj=longlat +ellps=GRS80 +no_defs +type=crs');
 proj4.defs(code,`+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs +type=crs`);
 const center=proj4('EPSG:7844',code,[longitude,latitude]),resolution=widthMetres/width;
 return {zone,epsg,code,center,resolution,width,height,extent:{xmin:center[0]-widthMetres/2,ymin:center[1]-height*resolution/2,xmax:center[0]+widthMetres/2,ymax:center[1]+height*resolution/2}};
}

export async function loadSixWmts(params,{signal,onProgress=()=>{}}={}){
 const response=await fetch('/api/six/map',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});
 const manifest=await response.json();if(!response.ok)throw new Error(manifest.error||'SIX Maps could not load.');
 const capabilities=await fetch(manifest.capabilities,{signal});if(!capabilities.ok){const error=await capabilities.json();throw new Error(error.error||'SIX Maps WMTS capabilities could not load.');}
 const description=new WMTSCapabilities().read(await capabilities.text());
 const options=optionsFromCapabilities(description,{layer:manifest.layer,matrixSet:manifest.matrixSet,style:manifest.style,format:'image/png'});
 if(!options||options.layer!=='public_NSW_Base_Map'||options.matrixSet!=='default028mm'||!options.projection.getCode().endsWith('3857'))throw new Error('The SIX Maps WMTS layer or tile grid is unsupported.');
 const definition=mgaViewDefinition(manifest.latitude,manifest.longitude,manifest.widthMetres);
 register(proj4);getProjection(definition.code).setExtent([100000,0,900000,10000000]);
 const controller=new AbortController(),urls=new Set();let map;
 const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 const host=document.createElement('div');host.dataset.wmtsRenderer='true';host.setAttribute('aria-hidden','true');host.inert=true;host.style.cssText=`position:fixed;left:-100000px;top:0;width:${definition.width}px;height:${definition.height}px;pointer-events:none;`;
 document.body.append(host);
 try{
  let loaded=0,started=0,failed=0;
  const source=new WMTS({...options,crossOrigin:'anonymous',transition:0,tileLoadFunction:(tile,url)=>{
   fetch(url,{signal:controller.signal}).then(async result=>{if(!result.ok)throw new Error('WMTS tile unavailable');const objectURL=URL.createObjectURL(await result.blob());urls.add(objectURL);const image=tile.getImage(),release=()=>{URL.revokeObjectURL(objectURL);urls.delete(objectURL);};image.addEventListener('load',release,{once:true});image.addEventListener('error',release,{once:true});image.src=objectURL;}).catch(()=>tile.setState(TileState.ERROR));
  }});
  source.setTileUrlFunction(tileCoord=>{if(!tileCoord)return undefined;const matrix=options.tileGrid.getMatrixIds()[tileCoord[0]];return `/api/six/tile?matrix=${encodeURIComponent(matrix)}&row=${tileCoord[2]}&column=${tileCoord[1]}`;});
  source.on('tileloadstart',()=>{started++;onProgress(`Loading map tiles · ${loaded}/${started}`);});
  source.on('tileloadend',()=>{loaded++;onProgress(`Loading map tiles · ${loaded}/${started}`);});
  source.on('tileloaderror',()=>{failed++;});
  map=new Map({target:host,pixelRatio:1,controls:[],interactions:[],layers:[new TileLayer({source})],view:new View({projection:definition.code,center:definition.center,resolution:definition.resolution,constrainResolution:false})});
  await new Promise((resolve,reject)=>{
   const aborted=()=>finish(new DOMException('Map loading cancelled.','AbortError'));
   const timer=setTimeout(()=>finish(new Error('SIX Maps tiles took too long to load. Retry the basemap.')),45000);
   function finish(error){clearTimeout(timer);controller.signal.removeEventListener('abort',aborted);error?reject(error):resolve();}
   controller.signal.addEventListener('abort',aborted,{once:true});
   map.once('rendercomplete',()=>finish(failed||!loaded?new Error('Some SIX Maps tiles could not load. Retry the basemap.'):null));
   if(controller.signal.aborted){aborted();return;}map.renderSync();
  });
  const canvas=document.createElement('canvas');canvas.width=definition.width;canvas.height=definition.height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  for(const layer of host.querySelectorAll('.ol-layer canvas')){if(!layer.width)continue;context.save();context.globalAlpha=Number(layer.parentNode.style.opacity||1);const transform=layer.style.transform;if(transform&&transform!=='none')context.setTransform(new DOMMatrix(transform));context.drawImage(layer,0,0);context.restore();}
  const [xmin,ymin,xmax,ymax]=map.getView().calculateExtent([canvas.width,canvas.height]);
  return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,metresPerPixel:(xmax-xmin)/canvas.width,georeference:{zone:definition.zone,epsg:definition.epsg,extent:{xmin,ymin,xmax,ymax}},wmts:{capabilitiesUrl:manifest.capabilitiesUrl,layer:manifest.layer,matrixSet:manifest.matrixSet}};
 }finally{controller.abort();signal?.removeEventListener('abort',cancel);map?.setTarget(undefined);map?.dispose();host.remove();for(const url of urls)URL.revokeObjectURL(url);}
}
