import {createServer} from 'node:http';
import {handle} from '../server/handler.mjs';
import {loadAssets} from './build.mjs';
const port=Number(process.env.PORT)||4173;
createServer(async(req,res)=>{
 try{const buffers=[];for await(const chunk of req)buffers.push(chunk);const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});const response=await handle(request,process.env,await loadAssets());res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
 catch(e){console.error(e);res.writeHead(500);res.end('Preview server error');}
}).listen(port,'127.0.0.1',()=>console.log(`PlanScan: http://127.0.0.1:${port}`));
