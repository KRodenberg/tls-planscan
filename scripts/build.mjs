import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('..',import.meta.url));
let wmtsBundle,wmtsStamp;
async function loadWmtsBundle(){
 const entry=join(root,'client/wmts-entry.mjs'),stamp=(await stat(entry)).mtimeMs;
 if(!wmtsBundle||wmtsStamp!==stamp){wmtsStamp=stamp;wmtsBundle=build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline'}).then(result=>result.outputFiles[0].text);}
 return wmtsBundle;
}
export async function loadAssets(){
 const assets={};
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else assets['/'+relative(join(root,'client'),path).replaceAll('\\','/')]=await readFile(path,'utf8');}}
 await walk(join(root,'client'));
 assets['/vendor/wmts.mjs']=await loadWmtsBundle();
 for(const [name,path] of Object.entries({'pdf.mjs':'pdfjs-dist/build/pdf.min.mjs','pdf.worker.mjs':'pdfjs-dist/build/pdf.worker.min.mjs','jspdf.js':'jspdf/dist/jspdf.umd.min.js'}))assets['/vendor/'+name]=await readFile(join(root,'node_modules',path),'utf8');
 return assets;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const assets=await loadAssets();const handler=(await readFile(join(root,'server/handler.mjs'),'utf8')).replace('export async function handle','async function handle');
 await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/.openai'),{recursive:true});
 await writeFile(join(root,'dist/server/index.js'),`const ASSETS=${JSON.stringify(assets)};\n${handler}\nexport default {fetch(request,env,ctx){return handle(request,env,ASSETS)}};\n`);
 try{await copyFile(join(root,'.openai/hosting.json'),join(root,'dist/.openai/hosting.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 console.log(`Built ${Object.keys(assets).length} assets into dist/server/index.js`);
}
