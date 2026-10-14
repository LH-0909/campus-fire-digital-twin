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
 await api('/api/auth/logout');await assert.rejects(api('/api/records'));await assert.rejects(api('/api/auth/captcha'));
});
test('public browser records are bounded and separated by persona',async()=>{
 const local=storage(),api=createPublicDemoApi({local});await api('/api/auth/login',{demo:true,role:'teacher'});
 for(let i=0;i<35;i++)await api('/api/records',{id:i});assert.equal((await api('/api/records')).records.length,30);
 await api('/api/auth/login',{demo:true,role:'student'});assert.equal((await api('/api/records')).records.length,0);
 await api('/api/auth/login',{demo:true,role:'teacher'});assert.equal((await api('/api/records')).records[0].id,34);
});
