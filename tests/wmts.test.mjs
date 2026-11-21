import test from 'node:test';
import assert from 'node:assert/strict';
import {mgaViewDefinition} from '../client/wmts-entry.mjs';
import {newProject,normalizeProject,serializable,addStation} from '../client/core.mjs';
test('WMTS rendering uses a north-up MGA2020 grid with metre resolution',()=>{
 const result=mgaViewDefinition(-33.8568,151.2153,500);assert.equal(result.zone,56);assert.equal(result.epsg,7856);assert.equal(result.resolution,.3125);assert.equal(result.extent.xmax-result.extent.xmin,500);assert.equal(result.extent.ymax-result.extent.ymin,375);
 assert.ok(Math.abs(result.center[0]-334900.57)<.01);assert.ok(Math.abs(result.center[1]-6252288.75)<.01);
});
test('MGA2020 zone follows the selected NSW location',()=>{assert.equal(mgaViewDefinition(-33,143,500).epsg,7854);assert.equal(mgaViewDefinition(-33,147,500).epsg,7855);assert.equal(mgaViewDefinition(-31.5,159.1,500).epsg,7857);});
test('saved projects retain the exact WMTS service alongside station coordinates',()=>{
 const p=newProject(),g=mgaViewDefinition(-33.8568,151.2153,500);p.underlay={kind:'six',name:'SIX Maps basemap',width:g.width,height:g.height,dataUrl:'data:image/png;base64,AAAA',metresPerPixel:g.resolution,unit:'m',georeference:{zone:g.zone,epsg:g.epsg,extent:g.extent},map:{latitude:-33.8568,longitude:151.2153,widthMetres:500,wmts:{layer:'public_NSW_Base_Map',matrixSet:'default028mm'}}};
 addStation(p,800,600);const result=normalizeProject(serializable(p));assert.equal(result.underlay.map.wmts.layer,'public_NSW_Base_Map');assert.match(result.underlay.map.wmts.capabilitiesUrl,/NSW_Base_Map\/MapServer\/WMTS\/1.0.0\/WMTSCapabilities\.xml$/);assert.equal(result.stations[0].mga2020.easting,g.center[0]);
});
