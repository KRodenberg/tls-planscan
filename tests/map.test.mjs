import test from 'node:test';
import assert from 'node:assert/strict';
import {mgaViewDefinition,PORTAL_ITEM_ID,IMAGERY_SERVICE,visibleImageryStatus} from '../client/map-entry.mjs';
import {newProject,normalizeProject,serializable,addStation,snapshot,stationCoordinates,imageryExportExtent,projectForMapSnapshot,linkDistance} from '../client/core.mjs';
function liveProject(){const p=newProject(),g=mgaViewDefinition(-33.8568,151.2153,500);p.underlay={kind:'six',name:'NSW Imagery Basemap',width:g.width,height:g.height,dataUrl:null,metresPerPixel:g.resolution,unit:'m',georeference:{zone:g.zone,epsg:g.epsg,extent:g.extent},map:{latitude:-33.8568,longitude:151.2153,widthMetres:500,live:true,portalItemId:PORTAL_ITEM_ID,serviceUrl:IMAGERY_SERVICE}};return p;}
test('live imagery uses a north-up MGA2020 grid with metre resolution',()=>{const g=mgaViewDefinition(-33.8568,151.2153,500);assert.equal(g.epsg,7856);assert.equal(g.resolution,.3125);assert.ok(Math.abs(g.center[0]-334900.57)<.01);assert.ok(Math.abs(g.center[1]-6252288.75)<.01);});
test('MGA2020 zone follows the selected NSW location',()=>{assert.equal(mgaViewDefinition(-33,143,500).epsg,7854);assert.equal(mgaViewDefinition(-33,147,500).epsg,7855);assert.equal(mgaViewDefinition(-31.5,159.1,500).epsg,7857);});
test('live projects retain the exact portal item, service and view without a static basemap image',()=>{
 const p=liveProject();p.mapView={easting:334900,northing:6252289,resolution:.2,width:1000,height:800};addStation(p,800,600);const result=normalizeProject(serializable(p));assert.equal(result.underlay.map.portalItemId,PORTAL_ITEM_ID);assert.equal(result.underlay.map.serviceUrl,IMAGERY_SERVICE);assert.equal(result.underlay.dataUrl,null);assert.deepEqual(result.mapView,p.mapView);
});
test('stations can be placed beyond the initial view while MGA2020 stays fixed during navigation',()=>{
 const p=liveProject(),s=addStation(p,3000,-1200),before=stationCoordinates(p,s);p.mapView={easting:335500,northing:6252600,resolution:.1,width:1200,height:800};const restored=normalizeProject(serializable(p));assert.deepEqual(restored.stations[0].mga2020,before);assert.deepEqual(restored.underlay.georeference,p.underlay.georeference);
});
test('navigation snapshots do not share mutable view settings',()=>{const p=liveProject();p.mapView={easting:334900,northing:6252289,resolution:.2,width:1000,height:800};const before=snapshot(p);p.mapView.resolution=2;assert.equal(before.mapView.resolution,.2);});
test('export bounds include stations outside the initial view and preserve their projected locations',()=>{
 const p=liveProject();addStation(p,3000,-1200);addStation(p,-1000,2000);const bounds=imageryExportExtent(p);for(const s of p.stations){assert.ok(s.mga2020.easting>bounds.xmin&&s.mga2020.easting<bounds.xmax);assert.ok(s.mga2020.northing>bounds.ymin&&s.mga2020.northing<bounds.ymax);}
 const frame={width:1600,height:1200,extent:bounds,dataUrl:'data:image/png;base64,AAAA'},output=projectForMapSnapshot(p,frame);for(let i=0;i<p.stations.length;i++){assert.ok(Math.abs(output.stations[i].mga2020.easting-p.stations[i].mga2020.easting)<1e-8);assert.ok(Math.abs(output.stations[i].mga2020.northing-p.stations[i].mga2020.northing)<1e-8);}assert.ok(Math.abs(linkDistance(output,output.links[0])-linkDistance(p,p.links[0]))<1e-8);assert.equal(p.underlay.dataUrl,null);
});
test('visible imagery suppresses loading and stale tile failures; empty failed views offer retry',()=>{
 for(const loading of [false,true])for(const failed of [false,true])assert.deepEqual(visibleImageryStatus({loading,failed},true),{loading:false,failed:false});
 assert.deepEqual(visibleImageryStatus({loading:true,failed:true},false),{loading:true,failed:false});
 assert.deepEqual(visibleImageryStatus({loading:false,failed:true},false),{loading:false,failed:true});
 assert.deepEqual(visibleImageryStatus({loading:false,failed:false},false),{loading:false,failed:false});
});
test('automatic link distances use the MGA2020 grid independently of the view',()=>{
 const p=liveProject(),a=addStation(p,100,100),b=addStation(p,196,228),distance=50;
 assert.equal(linkDistance(p,p.links[0]),distance);assert.ok(Math.abs(Math.hypot(b.mga2020.easting-a.mga2020.easting,b.mga2020.northing-a.mga2020.northing)-distance)<1e-8);
 p.mapView={easting:335500,northing:6252600,resolution:.1,width:1200,height:800};assert.equal(linkDistance(p,p.links[0]),distance);
});
