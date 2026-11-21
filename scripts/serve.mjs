import worker from '../dist/server/index.js';
import {createNodeServer} from '../server/node.mjs';

const port=Number(process.env.PORT||4173),host=process.env.HOST||'0.0.0.0';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
const server=createNodeServer(worker.fetch,process.env);
server.on('error',error=>{console.error('PlanScan server failed:',error.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`PlanScan listening on ${host}:${port}`));

let stopping=false;
function shutdown(){
 if(stopping)return;stopping=true;
 server.close(()=>process.exit(0));
 setTimeout(()=>{server.closeAllConnections();process.exit(0);},10000).unref();
}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
