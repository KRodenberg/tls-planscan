import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const port=Number(process.env.PLANSCAN_QA_PORT)||4174;
process.env.PLANSCAN_QA_URL=`http://127.0.0.1:${port}`;
process.env.PLANSCAN_QA_DIR=await mkdtemp(join(tmpdir(),'planscan-browser-'));
const server=spawn(process.execPath,['scripts/dev.mjs'],{
 cwd:fileURLToPath(new URL('..',import.meta.url)),
 env:{...process.env,PORT:String(port)},
 stdio:['ignore','pipe','pipe']
});
let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
let serverError;server.on('error',error=>serverError=error);
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(serverError)throw serverError;
  if(server.exitCode!==null)throw new Error(output||'Preview server exited.');
  try{if((await fetch(process.env.PLANSCAN_QA_URL+'/api/status')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error('Preview server did not start. '+output);
 await import('./browser/workflows.mjs');
 await import('./browser/edges.mjs');
 await import('./browser/aerial.mjs');
 console.log('Browser checks passed. Artifacts:',process.env.PLANSCAN_QA_DIR);
}finally{server.kill();}
