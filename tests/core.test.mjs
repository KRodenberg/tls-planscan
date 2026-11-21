import test from 'node:test';import assert from 'node:assert/strict';
import {LIMITS,newProject,addStation,deleteStation,estimate,parseDuration,formatDuration,serializable,normalizeProject,linkDistance,formatDistance} from '../client/core.mjs';
test('profile edits immediately change the calculated estimate; targets do not count',()=>{const p=newProject(true);assert.equal(estimate(p).total,2160);p.profiles.low=300;assert.equal(estimate(p).total,2700);addStation(p,100,100,'target');assert.equal(estimate(p).count,12);p.setupSeconds=60;assert.equal(estimate(p).total,3420);});
test('invalid durations cannot enter the estimate; plain numbers mean minutes',()=>{assert.equal(parseDuration('5'),300);assert.equal(parseDuration('02:30'),150);for(const text of ['abc','-2','02:99','', '0'])assert.equal(parseDuration(text),null);assert.equal(parseDuration('00:00',true),0);assert.equal(formatDuration(14*3600),'14 h');assert.equal(formatDuration(2*86400+3600),'2 d 1 h');});
test('deleting and replacing preserves unique monotonic station labels',()=>{const p=newProject(true);const deleted=p.stations[1];deleteStation(p,deleted.id);const station=addStation(p,200,200);assert.equal(station.number,13);assert.equal(new Set(p.stations.map(s=>s.number)).size,p.stations.length);assert.ok(!p.links.some(l=>l.from===deleted.id||l.to===deleted.id));});
test('project round trip retains all assumptions, stations, links and next number',()=>{const p=newProject(true);p.profiles.low=300;p.setupSeconds=45;deleteStation(p,p.stations[4].id);const restored=normalizeProject(JSON.parse(JSON.stringify(serializable(p))));assert.deepEqual(estimate(restored),estimate(p));assert.deepEqual(restored.profiles,p.profiles);assert.equal(restored.underlay.metresPerPixel,p.underlay.metresPerPixel);assert.equal(restored.stations[0].id,p.stations[0].id);assert.equal(addStation(restored,200,200).number,13);});
test('duplicate station numbers and invalid coordinates are rejected',()=>{const p=newProject(true);p.stations[1].number=p.stations[0].number;assert.throws(()=>normalizeProject(p),/duplicate/);p.stations[1].number=2;p.stations[0].x=-1;assert.throws(()=>normalizeProject(p),/invalid station/);});
test('aerial imagery and MGA2020 metadata persist in saved projects',()=>{const p=newProject(true);p.underlay={...p.underlay,kind:'six',dataUrl:'data:image/jpeg;base64,AAAA',map:{latitude:-33.85,longitude:151.21,widthMetres:500},georeference:{zone:56,epsg:7856,extent:{xmin:334000,ymin:6252000,xmax:334700,ymax:6252450}}};const saved=serializable(p),restored=normalizeProject(saved);assert.equal(restored.underlay.dataUrl,p.underlay.dataUrl);assert.deepEqual(restored.underlay.georeference,p.underlay.georeference);assert.ok(restored.stations[0].mga2020);});
test('an image at the 25 MiB upload boundary fits the encoded and project limits',()=>{const p=newProject(true);p.underlay={...p.underlay,kind:'image',dataUrl:'data:image/png;base64,'+'A'.repeat(Math.ceil(LIMITS.uploadBytes/3)*4)};const serialized=JSON.stringify(serializable(p));assert.ok(Buffer.byteLength(serialized)<LIMITS.projectBytes);const restored=normalizeProject(JSON.parse(serialized));assert.equal(restored.underlay.dataUrl.length,p.underlay.dataUrl.length);assert.deepEqual(estimate(restored),estimate(p));});
test('new scans link to the previous scan, skipping targets and deleted scans',()=>{
 const p=newProject(true);p.stations=[];p.links=[];
 const a=addStation(p,100,100);addStation(p,110,100,'target');const b=addStation(p,200,200);addStation(p,210,200,'target');const c=addStation(p,300,300);
 assert.deepEqual(p.links.map(({from,to})=>[from,to]),[[a.id,b.id],[b.id,c.id]]);
 deleteStation(p,c.id);const d=addStation(p,400,400);assert.deepEqual(p.links.map(({from,to})=>[from,to]),[[a.id,b.id],[b.id,d.id]]);
 const restored=normalizeProject(serializable(p));assert.deepEqual(restored.links,p.links);
});
test('link distances follow station movement and calibration and report unscaled plans',()=>{
 const p=newProject(true);p.stations=[];p.links=[];p.underlay.metresPerPixel=.5;
 addStation(p,10,10);const b=addStation(p,16,18),link=p.links[0];assert.equal(linkDistance(p,link),5);assert.equal(formatDistance(5),'5 m');
 b.x=10;assert.equal(linkDistance(p,link),4);p.underlay.metresPerPixel=2;assert.equal(linkDistance(p,link),16);
 p.underlay.metresPerPixel=null;assert.equal(linkDistance(p,link),null);assert.equal(formatDistance(linkDistance(p,link)),'Not to scale');
});
test('sample connections retain their authored layout and a full link list rejects station creation atomically',()=>{
 const p=newProject(true);assert.equal(p.links.length,11);const stations=p.stations.length,next=p.nextStationNumber;
 p.links=Array.from({length:LIMITS.links},()=>p.links[0]);assert.throws(()=>addStation(p,100,100),/link limit/);assert.equal(p.stations.length,stations);assert.equal(p.nextStationNumber,next);
});
