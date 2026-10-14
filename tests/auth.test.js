import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createAuth} from '../server/auth.mjs';
test('authentication, role matching, HttpOnly session and logout work end to end',async()=>{
 const auth=createAuth({dbPath:':memory:'}),server=http.createServer((req,res)=>auth.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 try {
  assert.equal((await fetch(base+'/api/records')).status,401);
  const challenge=await (await fetch(base+'/api/auth/captcha')).json();assert.ok(challenge.id&&challenge.image.startsWith('data:image/svg+xml;'));
  assert.equal((await post('/api/auth/login',{username:'teacher',password:'Campus@2026',role:'teacher',captcha:'WRONG',captchaId:challenge.id})).status,400);
  assert.equal((await post('/api/auth/login',{username:'teacher',password:'wrong',role:'teacher',demo:true})).status,401);
  assert.equal((await post('/api/auth/login',{username:'teacher',password:'Campus@2026',role:'student',demo:true})).status,401);
  const result=await post('/api/auth/login',{username:'teacher',password:'Campus@2026',role:'teacher',demo:true});assert.equal(result.status,200);
  const setCookie=result.headers.get('set-cookie');assert.ok(setCookie.includes('HttpOnly')&&setCookie.includes('SameSite=Strict'));const cookie=setCookie.split(';')[0];
  assert.equal((await fetch(base+'/api/auth/session',{headers:{Cookie:cookie}})).status,200);
  const write=await post('/api/records',{name:'测试演练',score:80,metrics:{completion:1}},cookie);assert.equal(write.status,200);
  const list=await (await fetch(base+'/api/records',{headers:{Cookie:cookie}})).json();assert.equal(list.records.length,1);
  assert.equal((await post('/api/auth/logout',{},cookie)).status,200);assert.equal((await fetch(base+'/api/auth/session',{headers:{Cookie:cookie}})).status,401);
  const user=auth.db.prepare('SELECT password_hash FROM users WHERE username=?').get('teacher');assert.notEqual(user.password_hash,'Campus@2026');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));auth.close();}
});
test('API rejects cross origin mutation and limits login failures',async()=>{
 const auth=createAuth({dbPath:':memory:'}),server=http.createServer((req,res)=>auth.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403);let result;for(let i=0;i<6;i++)result=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'student',password:'wrong',demo:true})});assert.equal(result.status,429);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));auth.close();}
});
