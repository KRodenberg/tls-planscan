import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,addStation,estimate,serializable,normalizeProject,stationCoordinates,coordinateToPixel,updateStationCoordinates,newOverlay,snapshot,niceScale,calibrateOverlay,overlayPointToWorld} from '../client/core.mjs';
const image='data:image/jpeg;base64,AAAA';
function aerial(){const p=newProject();p.underlay={kind:'six',name:'SIX Maps aerial',width:1600,height:1200,dataUrl:image,metresPerPixel:.5,unit:'m',source:'SIX Maps',page:null,map:{latitude:-33.8568,longitude:151.2153,widthMetres:800},georeference:{zone:56,epsg:7856,extent:{xmin:334000,ymin:6252000,xmax:334800,ymax:6252600}}};return p;}
test('MGA2020 coordinates follow image placement and northing decreases down the image',()=>{
 const p=aerial(),s=addStation(p,200,100);assert.deepEqual(s.mga2020,{zone:56,epsg:7856,easting:334100,northing:6252550});
 s.x=600;s.y=500;updateStationCoordinates(p);assert.equal(s.mga2020.easting,334300);assert.equal(s.mga2020.northing,6252350);
 assert.equal(coordinateToPixel(p.underlay,'x',334300),600);assert.equal(coordinateToPixel(p.underlay,'y',6252350),500);
});
test('standalone image scale does not invent MGA2020 coordinates',()=>{const p=newProject(true);assert.equal(stationCoordinates(p,p.stations[0]),null);assert.ok(!serializable(p).stations[0].mga2020);});
test('target scan time is multiplied by target count and included immediately',()=>{
 const p=aerial();addStation(p,10,10);addStation(p,20,20,'target');addStation(p,30,30,'target');p.setupSeconds=30;p.targetSeconds=45;
 assert.deepEqual({total:estimate(p).total,target:estimate(p).target,targets:estimate(p).targets},{total:300,target:90,targets:2});
 p.targetSeconds=90;assert.equal(estimate(p).total,390);p.stations=p.stations.filter(s=>s.kind==='scan');assert.equal(estimate(p).total,210);
});
test('image overlay, targets, projected extent and coordinates survive a project round trip',()=>{
 const p=aerial();p.targetSeconds=45;addStation(p,300,400);p.overlay=newOverlay(p.underlay,{kind:'image',name:'Floor plan',width:800,height:400,dataUrl:image,page:null});p.overlay.rotation=30;p.overlay.opacity=.4;
 const restored=normalizeProject(serializable(p));assert.deepEqual(restored.overlay,p.overlay);assert.deepEqual(restored.stations,p.stations);assert.equal(restored.targetSeconds,45);assert.equal(restored.underlay.metresPerPixel,.5);
 const before=snapshot(p);p.underlay.georeference.extent.xmin++;p.overlay.x++;assert.notEqual(before.overlay.x,p.overlay.x);assert.notEqual(before.underlay.georeference.extent.xmin,p.underlay.georeference.extent.xmin);
});
test('old projects migrate to the new model with zero target allowance',()=>{const p=newProject(true);p.version=2;delete p.targetSeconds;delete p.overlay;const result=normalizeProject(p);assert.equal(result.version,4);assert.equal(result.targetSeconds,0);assert.equal(result.overlay,null);});
test('invalid target times, projected extents and image transforms are rejected',()=>{
 const p=aerial();p.targetSeconds=-1;assert.throws(()=>normalizeProject(p),/target scan duration/);p.targetSeconds=0;p.underlay.georeference.epsg=3857;assert.throws(()=>normalizeProject(p),/MGA2020 extent/);p.underlay.georeference.epsg=7856;
 p.overlay=newOverlay(p.underlay,{kind:'image',name:'plan',width:800,height:400,dataUrl:image});p.overlay.size=-1;assert.throws(()=>normalizeProject(p),/invalid image overlay/);
});
test('metre scale bars follow physical map scale and available pixels',()=>{assert.deepEqual(niceScale(.5,130),{value:50,pixels:100,label:'50 m'});assert.equal(niceScale(null),null);assert.equal(niceScale(.5,65).value,20);});

test('image calibration preserves its first control point and the aerial reference',()=>{const p=aerial(),o=newOverlay(p.underlay,{kind:'image',name:'image',width:800,height:400,dataUrl:image});o.rotation=30;const points=[{x:0,y:0},{x:800,y:0}].map(point=>overlayPointToWorld(o,point)),before=structuredClone(p.underlay.georeference);const result=calibrateOverlay(p.underlay,o,points,100);assert.ok(Math.abs(result.size-200)<1e-9);assert.ok(Math.abs(overlayPointToWorld(result,{x:0,y:0}).x-points[0].x)<1e-9);assert.ok(Math.abs(overlayPointToWorld(result,{x:0,y:0}).y-points[0].y)<1e-9);assert.deepEqual(p.underlay.georeference,before);assert.equal(result.calibrated,true);});
