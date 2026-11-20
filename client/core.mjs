export const DENSITIES = ['low', 'medium', 'high'];
export const LIMITS = Object.freeze({ uploadBytes:25*1024*1024, dataUrlCharacters:48*1024*1024, projectBytes:96*1024*1024, stations:10000, links:20000, number:999999 });
export const COLORS = { low: '#087f6b', medium: '#285cda', high: '#8250b8', target: '#a34d16' };
export const uid = () => crypto.randomUUID();
export const stationLabel = s => `${s.kind === 'target' ? 'T' : ''}${String(s.number).padStart(3, '0')}`;
export function parseDuration(value, allowZero = false) {
  const text = String(value).trim();
  if (!/^\d{1,4}(?::[0-5]\d)?$/.test(text)) return null;
  const [minutes, seconds = '0'] = text.split(':');
  const total = Number(minutes) * 60 + Number(seconds);
  return total > 0 || (allowZero && total === 0) ? total : null;
}
export function inputDuration(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.round(seconds % 60);
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`, s && `${s} sec`].filter(Boolean).join(' ') || '0 min';
}
export function estimate(project) {
  const counts = Object.fromEntries(DENSITIES.map(d => [d, project.stations.filter(s => s.kind === 'scan' && s.density === d).length]));
  const subtotals = Object.fromEntries(DENSITIES.map(d => [d, counts[d] * project.profiles[d]]));
  const count = Object.values(counts).reduce((a, b) => a + b, 0);
  const scan = Object.values(subtotals).reduce((a, b) => a + b, 0);
  const setup = count * project.setupSeconds;
  return { counts, subtotals, count, targets: project.stations.filter(s => s.kind === 'target').length, scan, setup, total: scan + setup };
}
export function newProject(sample = false) {
  const project = { version: 2, id: uid(), title: sample ? 'Warehouse survey' : 'Untitled plan', site: '', revision: '01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), profiles: { low: 120, medium: 180, high: 240 }, setupSeconds: 0, nextStationNumber: 1, nextTargetNumber: 1, stations: [], links: [], underlay: null, display: { labels: true, markerSize: 1, links: true }, output: { paper:'a4', orientation:'landscape', format:'pdf' }, sample };
  if (sample) {
    project.underlay = { kind: 'sample', name: 'Sample floor plan', width: 1400, height: 900, dataUrl: null, metresPerPixel: 0.025, unit: 'm', source: 'Illustrative sample', page: null };
    const points = [[225,225,'medium'],[480,225,'medium'],[750,225,'high'],[1000,225,'low'],[1180,225,'low'],[225,485,'medium'],[480,485,'high'],[750,485,'medium'],[1065,485,'low'],[1180,705,'high'],[750,705,'medium'],[375,705,'medium']];
    points.forEach(([x,y,density]) => addStation(project, x, y, 'scan', density));
    [[0,1],[1,2],[2,3],[3,4],[1,6],[6,7],[7,8],[7,10],[10,9],[10,11],[6,5]].forEach(([a,b]) => project.links.push({id:uid(), from:project.stations[a].id, to:project.stations[b].id}));
  }
  return project;
}
export function addStation(project, x, y, kind = 'scan', density = 'medium') {
  if (!project.underlay || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > project.underlay.width || y > project.underlay.height || !['scan','target'].includes(kind) || !DENSITIES.includes(density)) throw new Error('Choose a position within the plan.');
  if (project.stations.length >= LIMITS.stations || (kind === 'target' ? project.nextTargetNumber : project.nextStationNumber) > LIMITS.number) throw new Error('This plan has reached its station limit.');
  const number = kind === 'target' ? project.nextTargetNumber++ : project.nextStationNumber++;
  const station = { id: uid(), number, kind, density, x, y, note: '' };
  project.stations.push(station); return station;
}
export function deleteStation(project, id) { project.stations = project.stations.filter(s => s.id !== id); project.links = project.links.filter(l => l.from !== id && l.to !== id); }
export function snapshot(project) { return { ...project, profiles: {...project.profiles}, display: {...project.display}, output: {...project.output}, underlay: project.underlay ? {...project.underlay, ...(project.underlay.map ? {map:{...project.underlay.map}} : {})} : null, stations: project.stations.map(s => ({...s})), links: project.links.map(l => ({...l})) }; }
export function serializable(project) {
  const data = snapshot(project);
  if (data.underlay?.kind === 'google') data.underlay.dataUrl = null;
  return data;
}
const fail = message => { throw new Error(message); };
const textValue = (value, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
export function normalizeProject(raw) {
  if (!raw || raw.version !== 2 || !Array.isArray(raw.stations) || !Array.isArray(raw.links)) fail('Choose a PlanScan project (.planscan.json).');
  if (raw.stations.length > LIMITS.stations || raw.links.length > LIMITS.links) fail('This project exceeds the station or link limit.');
  const p = newProject(); p.id = textValue(raw.id) || uid(); p.title = textValue(raw.title, 100) || 'Untitled plan'; p.site = textValue(raw.site); p.revision = textValue(raw.revision, 20) || '01'; p.sample = !!raw.sample;
  for (const key of ['createdAt','updatedAt']) if (typeof raw[key] === 'string' && Number.isFinite(Date.parse(raw[key]))) p[key] = new Date(raw[key]).toISOString();
  for (const d of DENSITIES) { const value = raw.profiles?.[d]; if (!Number.isInteger(value) || value < 1 || value > 599999) fail('The project contains an invalid scan duration.'); p.profiles[d] = value; }
  if (!Number.isInteger(raw.setupSeconds) || raw.setupSeconds < 0 || raw.setupSeconds > 599999) fail('The project contains an invalid setup duration.');
  p.setupSeconds = raw.setupSeconds;
  if (raw.underlay) {
    const u = raw.underlay;
    if (!['sample','image','pdf','google'].includes(u.kind) || !Number.isFinite(u.width) || !Number.isFinite(u.height) || u.width < 1 || u.height < 1 || u.width > 20000 || u.height > 20000) fail('The project contains an invalid underlay.');
    const dataUrl = typeof u.dataUrl === 'string' ? u.dataUrl : null;
    if (['image','pdf'].includes(u.kind) && (!dataUrl || !/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUrl) || dataUrl.length > LIMITS.dataUrlCharacters)) fail('The project underlay image is missing, unsupported or too large.');
    if (u.metresPerPixel != null && (!Number.isFinite(u.metresPerPixel) || u.metresPerPixel <= 0 || u.metresPerPixel > 100000)) fail('The project contains an invalid scale.');
    p.underlay = { kind:u.kind, name:textValue(u.name), width:u.width, height:u.height, dataUrl: ['image','pdf'].includes(u.kind) ? dataUrl : null, metresPerPixel:u.metresPerPixel ?? null, unit:u.unit === 'ft' ? 'ft' : 'm', source:textValue(u.source), page:Number.isInteger(u.page) ? u.page : null };
    if (u.kind === 'sample') Object.assign(p.underlay, {width:1400,height:900});
    if (u.kind === 'google') p.underlay.map = { location:textValue(u.map?.location), zoom:Math.max(1,Math.min(21,Math.round(u.map?.zoom || 19))), type:['satellite','hybrid','roadmap'].includes(u.map?.type)?u.map.type:'hybrid' };
  }
  const ids = new Set(), numbers = new Set();
  for (const s of raw.stations) {
    if (!s || !['scan','target'].includes(s.kind) || !DENSITIES.includes(s.density) || !Number.isInteger(s.number) || s.number < 1 || s.number > LIMITS.number || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !p.underlay || s.x < 0 || s.y < 0 || s.x > p.underlay.width || s.y > p.underlay.height) fail('The project contains an invalid station.');
    if (typeof s.id !== 'string' || !s.id.trim() || s.id.length > 200) fail('The project contains an invalid station ID.');
    const id = s.id;
    if (ids.has(id) || numbers.has(`${s.kind}:${s.number}`)) fail('The project has duplicate station IDs.');
    ids.add(id); numbers.add(`${s.kind}:${s.number}`);
    p.stations.push({id,number:s.number,kind:s.kind,density:s.density,x:s.x,y:s.y,note:textValue(s.note,500)});
  }
  p.nextStationNumber = Math.max(Number.isInteger(raw.nextStationNumber) && raw.nextStationNumber <= LIMITS.number+1 ? raw.nextStationNumber : 1, 1, ...p.stations.filter(s=>s.kind==='scan').map(s=>s.number+1));
  p.nextTargetNumber = Math.max(Number.isInteger(raw.nextTargetNumber) && raw.nextTargetNumber <= LIMITS.number+1 ? raw.nextTargetNumber : 1, 1, ...p.stations.filter(s=>s.kind==='target').map(s=>s.number+1));
  const pairs = new Set();
  const linkIds = new Set();
  for (const l of raw.links) {
    if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to) fail('The project contains an invalid station link.');
    const pair=JSON.stringify([l.from,l.to].sort());
    if (pairs.has(pair)) continue;
    const id=textValue(l.id) || uid();
    if(linkIds.has(id)) fail('The project has duplicate link IDs.');
    p.links.push({id,from:l.from,to:l.to});pairs.add(pair);linkIds.add(id);
  }
  p.display = {labels:raw.display?.labels!==false,links:raw.display?.links!==false,markerSize:Math.max(0.6,Math.min(2,Number(raw.display?.markerSize)||1))};
  p.output = {paper:raw.output?.paper==='a3'?'a3':'a4',orientation:raw.output?.orientation==='portrait'?'portrait':'landscape',format:raw.output?.format==='png'?'png':'pdf'};
  return p;
}
export function coordinateFactor(underlay) { return underlay?.metresPerPixel ? underlay.metresPerPixel * (underlay.unit === 'ft' ? 1 / .3048 : 1) : 1; }
export function restoreMapUnderlay(previous, loaded) {
  if (previous.width !== loaded.width || previous.height !== loaded.height) throw new Error('The reloaded map dimensions changed. Replace the underlay to use this map.');
  return {...loaded,metresPerPixel:previous.metresPerPixel,unit:previous.unit};
}
export function metresPerPixel(latitude, zoom, scale = 2) { return 40075016.686 * Math.cos(latitude * Math.PI / 180) / (256 * 2 ** zoom * scale); }
export function niceScale(mpp, maxPixels = 150, unit = 'm') {
  if (!mpp) return null;
  const conversion=unit==='ft'?3.280839895:1, limit=mpp*maxPixels*conversion, power=10**Math.floor(Math.log10(limit));
  const value=[1,2,5,10].map(n=>n*power).filter(n=>n<=limit).pop() || power/2;
  return {value,pixels:value/conversion/mpp,label:`${Number(value.toPrecision(3))} ${unit}`};
}
