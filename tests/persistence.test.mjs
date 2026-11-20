import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,addStation,snapshot,serializable,normalizeProject,coordinateFactor,restoreMapUnderlay,LIMITS} from '../client/core.mjs';

test('round trip preserves project timestamps, output choices and link identity',()=>{
 const p=newProject(true);p.createdAt='2025-02-03T04:05:06.000Z';p.updatedAt='2026-11-20T01:02:03.000Z';p.output={paper:'a3',orientation:'portrait',format:'png'};
 const restored=normalizeProject(serializable(p));
 assert.equal(restored.createdAt,p.createdAt);assert.equal(restored.updatedAt,p.updatedAt);
 assert.deepEqual(restored.output,p.output);assert.deepEqual(restored.links,p.links);
});
test('older version 2 projects receive default output settings',()=>{
 const p=newProject(true);delete p.output;assert.deepEqual(normalizeProject(p).output,{paper:'a4',orientation:'landscape',format:'pdf'});
});
test('station IDs cannot be truncated into collisions or sever link endpoints',()=>{
 for(const id of ['',null,' '.repeat(3),'x'.repeat(201)]){
  const p=newProject(true);p.stations[0].id=id;assert.throws(()=>normalizeProject(p),/invalid station ID/);
 }
 const p=newProject(true);p.stations[0]=null;assert.throws(()=>normalizeProject(p),/invalid station/);
});
test('missing link endpoints are reported instead of silently discarded',()=>{
 const p=newProject(true);p.links[0].to='missing';assert.throws(()=>normalizeProject(p),/invalid station link/);
});
test('malformed counters cannot create invalid or reused station numbers',()=>{
 for(const nextStationNumber of [-10,Infinity,1e20]){
  const p=newProject(true);p.nextStationNumber=nextStationNumber;const restored=normalizeProject(p);
  assert.equal(addStation(restored,50,50).number,13);
 }
 const p=newProject(true);p.nextStationNumber=LIMITS.number+1;assert.throws(()=>addStation(p,50,50),/station limit/);
});
test('coordinates use the calibrated distance unit',()=>{
 assert.equal(coordinateFactor(null),1);assert.equal(coordinateFactor({metresPerPixel:null,unit:'ft'}),1);
 assert.ok(Math.abs(coordinateFactor({metresPerPixel:.3048,unit:'ft'})-1)<1e-12);
 assert.equal(coordinateFactor({metresPerPixel:.025,unit:'m'}),.025);
});
test('reloading map imagery preserves manually calibrated scale and feet',()=>{
 const previous={width:1280,height:960,metresPerPixel:.42,unit:'ft'};
 const loaded={width:1280,height:960,metresPerPixel:.15,unit:'m',dataUrl:'new imagery'};
 assert.deepEqual(restoreMapUnderlay(previous,loaded),{...loaded,metresPerPixel:.42,unit:'ft'});
 assert.throws(()=>restoreMapUnderlay(previous,{...loaded,width:640}),/dimensions changed/);
});
test('undo snapshots isolate nested map metadata and output settings',()=>{
 const p=newProject(true);p.underlay.map={location:'Sydney',zoom:19};const before=snapshot(p);
 p.underlay.map.zoom=20;p.output.paper='a3';assert.equal(before.underlay.map.zoom,19);assert.equal(before.output.paper,'a4');
});
test('station placement rejects invalid geometry before advancing the counter',()=>{
 const p=newProject(true),counter=p.nextStationNumber;
 assert.throws(()=>addStation(p,-1,20),/within the plan/);assert.equal(p.nextStationNumber,counter);
});
