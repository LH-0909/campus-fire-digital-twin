import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDemoApi} from '../src/public-demo.js';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};};
test('public hosting accepts demo personas only and stores no passwords',async()=>{
 const session=storage(),api=createPublicDemoApi({session});
 await assert.rejects(api('/api/auth/session'));
 await assert.rejects(api('/api/auth/login',{username:'teacher',password:'real-secret',role:'teacher'}));
 const {user}=await api('/api/auth/login',{demo:true,role:'student'});assert.equal(user.role,'student');assert.equal(user.password,undefined);
 assert.equal((await createPublicDemoApi({session})('/api/auth/session')).user.role,'student');
 await api('/api/auth/logout');await assert.rejects(api('/api/records'));await assert.rejects(api('/api/private-account'));
});
test('public login form validates demo account, entry role and a single-use captcha',async()=>{
 const session=storage(),api=createPublicDemoApi({session,random:()=>0});
 let challenge=await api('/api/auth/captcha');assert.ok(challenge.image.startsWith('data:image/svg+xml'));
 const credentials={username:'teacher',password:'Campus@2026',role:'teacher',captcha:'AAAA',captchaId:challenge.id};
 await assert.rejects(api('/api/auth/login',{...credentials,captcha:'WRONG'}),/验证码错误/);
 await assert.rejects(api('/api/auth/login',credentials),/验证码已失效/);
 challenge=await api('/api/auth/captcha');credentials.captchaId=challenge.id;
 await assert.rejects(api('/api/auth/login',{...credentials,role:'student'}),/演示账号/);
 challenge=await api('/api/auth/captcha');credentials.captchaId=challenge.id;
 const {user}=await api('/api/auth/login',credentials);assert.equal(user.role,'teacher');assert.equal(user.password,undefined);
 assert.equal(session.getItem('campus-public-persona').includes('Campus@2026'),false);
});
test('public captcha refresh invalidates the previous image and expired challenges',async()=>{
 let time=0;const api=createPublicDemoApi({random:()=>0,now:()=>time});
 const first=await api('/api/auth/captcha'),second=await api('/api/auth/captcha');assert.notEqual(first.id,second.id);
 const credentials={username:'student',password:'Campus@2026',role:'student',captcha:'AAAA'};
 await assert.rejects(api('/api/auth/login',{...credentials,captchaId:first.id}),/失效/);
 time=300001;await assert.rejects(api('/api/auth/login',{...credentials,captchaId:second.id}),/失效/);
});
test('public browser records are bounded and separated by persona',async()=>{
 const local=storage(),api=createPublicDemoApi({local});await api('/api/auth/login',{demo:true,role:'teacher'});
 for(let i=0;i<35;i++)await api('/api/records',{id:i});assert.equal((await api('/api/records')).records.length,30);
 await api('/api/auth/login',{demo:true,role:'student'});assert.equal((await api('/api/records')).records.length,0);
 await api('/api/auth/login',{demo:true,role:'teacher'});assert.equal((await api('/api/records')).records[0].id,34);
});
test('remember me stores only the demo persona and logout clears both stores',async()=>{
 const session=storage(),local=storage(),api=createPublicDemoApi({session,local});
 await api('/api/auth/login',{demo:true,role:'teacher',remember:true});
 assert.equal(JSON.parse(local.getItem('campus-public-persona')).role,'teacher');assert.equal(session.getItem('campus-public-persona'),'null');
 assert.equal((await createPublicDemoApi({local})('/api/auth/session')).user.role,'teacher');
 await api('/api/auth/login',{demo:true,role:'student',remember:false});assert.equal(local.getItem('campus-public-persona'),'null');assert.equal(JSON.parse(session.getItem('campus-public-persona')).role,'student');
 await api('/api/auth/logout');assert.equal(session.getItem('campus-public-persona'),'null');assert.equal(local.getItem('campus-public-persona'),'null');
});
