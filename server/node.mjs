import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const MAX_BODY_BYTES=4096;
const first=value=>String(value||'').split(',')[0].trim();
function sendError(res,status,error){
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify({error}));
}

export function createNodeServer(fetchHandler,env={}){
 return createServer({requestTimeout:30000,headersTimeout:15000},async(req,res)=>{
  try{
   if(Number(req.headers['content-length'])>MAX_BODY_BYTES){req.resume();sendError(res,413,'The request is too large.');return;}
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size<=MAX_BODY_BYTES)chunks.push(chunk);}
   if(size>MAX_BODY_BYTES){sendError(res,413,'The request is too large.');return;}
   const trustProxy=env.TRUST_PROXY==='1';
   const protocol=trustProxy&&first(req.headers['x-forwarded-proto'])==='https'?'https':'http';
   const host=(trustProxy&&first(req.headers['x-forwarded-host']))||req.headers.host||'localhost';
   const request=new Request(`${protocol}://${host}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await fetchHandler(request,env);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
  }catch(error){
   console.error('PlanScan request failed:',error.message);
   if(res.headersSent)res.destroy();else sendError(res,500,'The request could not be completed.');
  }
 });
}
