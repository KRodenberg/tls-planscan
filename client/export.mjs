import {COLORS,DENSITIES,estimate,formatDuration,inputDuration,stationLabel,niceScale} from './core.mjs';
export function downloadFile(content,name,type='application/octet-stream') {
  const blob=content instanceof Blob?content:new Blob([content],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The underlay could not be rendered. Reload it and retry.'));image.src=src;});}
function fitText(ctx,text,maxWidth){let result=String(text);while(result.length>1&&ctx.measureText(result).width>maxWidth)result=result.slice(0,-2)+'…';return result;}
export async function createQA(project,{orientation='landscape',paper='a4',preview=false}={}) {
  const u=project.underlay;if(!u)throw new Error('Add an underlay before exporting.');
  const source=u.kind==='sample'?'/assets/sample-plan.svg':u.dataUrl;if(!source)throw new Error('Reload the map before exporting.');
  const image=await loadImage(source),canvas=document.createElement('canvas');
  const ratio=paper==='a3'?420/297:297/210;
  canvas.width=preview?1200:2400;canvas.height=Math.round(canvas.width*(orientation==='portrait'?ratio:1/ratio));
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,k=W/2400,m=85*k;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.textBaseline='alphabetic';
  ctx.font=`600 ${40*k}px Arial,sans-serif`;ctx.fillStyle='#253c57';ctx.fillText(fitText(ctx,project.title,W-2*m-320*k),m,82*k);
  ctx.font=`${23*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';ctx.fillText(fitText(ctx,[project.site,`Revision ${project.revision}`,new Intl.DateTimeFormat('en-AU',{day:'2-digit',month:'short',year:'numeric'}).format(new Date())].filter(Boolean).join('  ·  '),W-2*m),m,122*k);
  ctx.font=`600 ${24*k}px Arial,sans-serif`;ctx.textAlign='right';ctx.fillStyle='#285cda';ctx.fillText('PlanScan',W-m,80*k);ctx.font=`${18*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';ctx.fillText('SCAN STATION PLAN',W-m,117*k);ctx.textAlign='left';
  ctx.strokeStyle='#dce3eb';ctx.lineWidth=k;ctx.beginPath();ctx.moveTo(m,150*k);ctx.lineTo(W-m,150*k);ctx.stroke();
  const top=180*k,bottom=H-350*k,availableW=W-2*m,availableH=bottom-top;
  const scale=Math.min(availableW/u.width,availableH/u.height),x=(W-u.width*scale)/2,y=top+(availableH-u.height*scale)/2;
  ctx.drawImage(image,x,y,u.width*scale,u.height*scale);
  const at=s=>({x:x+s.x*scale,y:y+s.y*scale});
  if(project.display.links){ctx.strokeStyle='#849fc8';ctx.lineWidth=2*k;ctx.setLineDash([7*k,6*k]);for(const l of project.links){const a=project.stations.find(s=>s.id===l.from),b=project.stations.find(s=>s.id===l.to);if(!a||!b)continue;const A=at(a),B=at(b);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();}ctx.setLineDash([]);}
  const r=17*k*project.display.markerSize;
  for(const station of project.stations){const p=at(station),color=COLORS[station.kind==='target'?'target':station.density];ctx.fillStyle=color;ctx.strokeStyle='#fff';ctx.lineWidth=2.5*k;
    if(station.kind==='target'){ctx.beginPath();ctx.arc(p.x,p.y,r*.75,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.strokeStyle=color;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,r*.25,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
    else{ctx.beginPath();ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y+r*.8);ctx.lineTo(p.x-r,p.y+r*.8);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.font=`600 ${22*k*project.display.markerSize}px Arial,sans-serif`;const label=stationLabel(station),tw=ctx.measureText(label).width;ctx.fillStyle='white';ctx.fillRect(p.x-tw/2-4*k,p.y+r+3*k,tw+8*k,27*k*project.display.markerSize);ctx.textAlign='center';ctx.fillStyle='#263b53';ctx.fillText(label,p.x,p.y+r+24*k*project.display.markerSize);ctx.textAlign='left';
  }
  const bar=niceScale(u.metresPerPixel,210*k/scale,u.unit);
  if(bar){const by=H-312*k,bx=m,bw=bar.pixels*scale;ctx.strokeStyle='#53657a';ctx.lineWidth=2*k;ctx.beginPath();ctx.moveTo(bx,by-5*k);ctx.lineTo(bx,by+5*k);ctx.moveTo(bx,by);ctx.lineTo(bx+bw,by);ctx.moveTo(bx+bw,by-5*k);ctx.lineTo(bx+bw,by+5*k);ctx.stroke();ctx.font=`${20*k}px Arial,sans-serif`;ctx.fillStyle='#53657a';ctx.fillText(bar.label,bx+bw+15*k,by+7*k);}
  ctx.font=`${19*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';ctx.textAlign='right';ctx.fillText(u.metresPerPixel?'Scale calibrated':'Uncalibrated — no measured scale',W-m,H-305*k);ctx.textAlign='left';
  ctx.strokeStyle='#dce3eb';ctx.lineWidth=k;ctx.beginPath();ctx.moveTo(m,H-277*k);ctx.lineTo(W-m,H-277*k);ctx.stroke();
  const e=estimate(project),column=(W-2*m)/4;
  for(let i=0;i<3;i++){const d=DENSITIES[i],cx=m+i*column;ctx.fillStyle=COLORS[d];ctx.beginPath();ctx.arc(cx+5*k,H-235*k,5*k,0,Math.PI*2);ctx.fill();ctx.font=`600 ${23*k}px Arial,sans-serif`;ctx.fillStyle='#334b65';ctx.fillText(d[0].toUpperCase()+d.slice(1),cx+20*k,H-228*k);ctx.font=`${23*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';ctx.fillText(`${e.counts[d]} × ${inputDuration(project.profiles[d])}`,cx,H-190*k);ctx.font=`600 ${23*k}px Arial,sans-serif`;ctx.fillStyle='#334b65';ctx.fillText(formatDuration(e.subtotals[d]),cx,H-153*k);}
  ctx.fillStyle='#334b65';ctx.font=`600 ${23*k}px Arial,sans-serif`;ctx.fillText('Estimated time',m+column*3,H-228*k);ctx.font=`600 ${32*k}px Arial,sans-serif`;ctx.fillStyle='#285cda';ctx.fillText(formatDuration(e.total),m+column*3,H-184*k);ctx.font=`${19*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';ctx.fillText(`${e.count} stations${e.targets?` · ${e.targets} targets`:''}`,m+column*3,H-151*k);
  ctx.strokeStyle='#dce3eb';ctx.beginPath();ctx.moveTo(m,H-122*k);ctx.lineTo(W-m,H-122*k);ctx.stroke();ctx.font=`${18*k}px Arial,sans-serif`;ctx.fillStyle='#66778a';
  const setup=project.setupSeconds?`Move / setup: ${inputDuration(project.setupSeconds)} per scan · ${formatDuration(e.setup)} total`:'Move / setup excluded';ctx.fillText(setup,m,H-86*k);
  const note=[project.sample?'Illustrative sample':null,u.kind==='google'?'Google Maps':u.name,u.page?`Page ${u.page}`:null].filter(Boolean).join(' · ');ctx.fillText(fitText(ctx,note,W-2*m),m,H-49*k);
  return canvas;
}
export async function saveQA(canvas,project,{format='pdf',paper='a4',orientation='landscape'}={}){
  const basename=(project.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'scan-plan')+`-qa-rev-${project.revision.replace(/[^a-z0-9]/gi,'')||'01'}`;
  if(format==='png'){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('The image could not be exported.');downloadFile(blob,basename+'.png');return;}
  if(!window.jspdf?.jsPDF)throw new Error('PDF export is unavailable. Refresh and retry.');
  const pdf=new window.jspdf.jsPDF({orientation,unit:'mm',format:paper,compress:true});
  pdf.setProperties({title:project.title,subject:`Scan plan · Revision ${project.revision}`,creator:'PlanScan'});
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight());
  downloadFile(pdf.output('blob'),basename+'.pdf');
}
