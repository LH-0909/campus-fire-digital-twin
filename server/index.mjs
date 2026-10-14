import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createAuth} from './auth.mjs';
const auth=createAuth(),root=path.resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json','.csv':'text/csv','.ifc':'application/octet-stream'};
const server=http.createServer((req,res)=>auth.handle(req,res,()=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}));
server.listen(Number(process.env.PORT)||8787,'127.0.0.1',()=>console.log('Campus platform: http://127.0.0.1:8787'));
