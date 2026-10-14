import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
export const demoAccounts=[{username:'teacher',name:'演练教师',role:'teacher'},{username:'student',name:'演练学员',role:'student'},{username:'admin',name:'系统管理员',role:'admin'}];
const hashToken=t=>createHash('sha256').update(t).digest('hex');
export function createAuth({dbPath=path.resolve('.local/campus.sqlite')}={}) {
 if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
 const db=new DatabaseSync(dbPath);
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, role TEXT, salt TEXT, password_hash TEXT); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, username TEXT, expires INTEGER); CREATE TABLE IF NOT EXISTS drill_records (id INTEGER PRIMARY KEY, username TEXT, body TEXT);');
 for(const account of demoAccounts){if(!db.prepare('SELECT username FROM users WHERE username=?').get(account.username)){const salt=randomBytes(16).toString('hex'),hash=scryptSync('Campus@2026',salt,64).toString('hex');db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(account.username,account.name,account.role,salt,hash);}}
 const failures=new Map();
 const challenges=new Map();
 function session(req){const raw=(req.headers.cookie||'').split(';').find(c=>c.trim().startsWith('campus_session='))?.trim().slice('campus_session='.length);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const row=db.prepare('SELECT u.username,u.name,u.role,s.expires FROM sessions s JOIN users u ON u.username=s.username WHERE s.token_hash=?').get(hashToken(raw));return row&&row.expires>Date.now()?row:null;}
 const response=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>250000)throw new Error('请求体过大');}return JSON.parse(text||'{}');}
 async function handle(req,res,next) {
  const url=new URL(req.url,'http://localhost'),route=url.pathname;if(!route.startsWith('/api/')){next?.();return;}
  try {
   if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json'))return response(res,415,{error:'仅支持JSON请求'});
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return response(res,403,{error:'请求来源不允许'});
   }
   if(route==='/api/auth/session'&&req.method==='GET'){const user=session(req);return response(res,user?200:401,user?{user:{username:user.username,name:user.name,role:user.role}}:{error:'请登录'});}
   if(route==='/api/auth/captcha'&&req.method==='GET'){
    const id=randomBytes(16).toString('hex'),alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';let code='';for(let i=0;i<4;i++)code+=alphabet[randomBytes(1)[0]%alphabet.length];
    for(const [key,v] of challenges)if(v.expires<Date.now())challenges.delete(key);
    if(challenges.size>1000)challenges.clear();challenges.set(id,{hash:hashToken(code),expires:Date.now()+300000});
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="54"><rect width="150" height="54" rx="3" fill="#e6efff"/><path d="M0 17L150 36M0 41L150 11M15 0L132 54" stroke="#afc7ff" fill="none"/><text x="75" y="39" font-family="monospace" font-weight="bold" font-style="italic" font-size="33" letter-spacing="5" text-anchor="middle" fill="#3e53cf">${code}</text></svg>`;
    return response(res,200,{id,image:`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`});
   }
   if(route==='/api/auth/login'&&req.method==='POST'){
    const input=await body(req);if(typeof input.username!=='string'||typeof input.password!=='string'||input.username.length>64||input.password.length>256)return response(res,400,{error:'账号或密码格式不正确'});
    // Public demo accounts are intentional local training identities. Their
    // explicit demo button can authenticate without solving the visual captcha.
    if(!(input.demo===true&&demoAccounts.some(a=>a.username===input.username))){const challenge=challenges.get(input.captchaId);challenges.delete(input.captchaId);if(!challenge||challenge.expires<Date.now()||hashToken(String(input.captcha||'').toUpperCase())!==challenge.hash)return response(res,400,{error:'验证码不正确或已过期'});}
    const key=`${req.socket.remoteAddress}:${input.username}`,attempt=failures.get(key);
    if(attempt&&attempt.count>=5&&Date.now()-attempt.last<60000)return response(res,429,{error:'尝试次数较多，请1分钟后重试'});
    const user=db.prepare('SELECT * FROM users WHERE username=?').get(input.username);
    const salt=user?.salt||'00000000000000000000000000000000';const actual=scryptSync(input.password,salt,64),expected=Buffer.from(user?.password_hash||'00'.repeat(64),'hex');
    if(!user||!timingSafeEqual(actual,expected)||(input.role&&input.role!==user.role)){failures.set(key,{count:(attempt?.count||0)+1,last:Date.now()});return response(res,401,{error:'账号、密码或入口角色不正确'});}
    failures.delete(key);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const token=randomBytes(32).toString('hex'),ttl=input.remember?30*86400:8*3600;
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token),user.username,Date.now()+ttl*1000);
    res.setHeader('Set-Cookie',`campus_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${req.socket.encrypted?'; Secure':''}`);
    return response(res,200,{user:{username:user.username,name:user.name,role:user.role}});
   }
   if(route==='/api/auth/logout'&&req.method==='POST'){const raw=(req.headers.cookie||'').split(';').find(c=>c.trim().startsWith('campus_session='))?.trim().slice(15);if(raw)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(raw));res.setHeader('Set-Cookie','campus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return response(res,200,{ok:true});}
   const user=session(req);if(!user)return response(res,401,{error:'会话已失效，请重新登录'});
   if(route==='/api/records'&&req.method==='GET'){const rows=user.role==='student'?db.prepare('SELECT body FROM drill_records WHERE username=? ORDER BY id DESC LIMIT 30').all(user.username):db.prepare('SELECT body FROM drill_records ORDER BY id DESC LIMIT 30').all();return response(res,200,{records:rows.map(r=>JSON.parse(r.body))});}
   if(route==='/api/records'&&req.method==='POST'){
     const record=await body(req);
     if(typeof record.name!=='string'||record.name.length>100||!record.metrics||!Number.isFinite(record.score)||record.score<0||record.score>100)return response(res,400,{error:'演练记录不合法'});
     record.id=Date.now();record.username=user.username;db.prepare('INSERT INTO drill_records VALUES(?,?,?)').run(record.id,user.username,JSON.stringify(record));return response(res,200,{record});
   }
   return response(res,404,{error:'接口不存在'});
  }catch(e){return response(res,400,{error:e instanceof SyntaxError?'请求格式不正确':e.message});}
 }
 return {handle,db,session,close:()=>db.close()};
}
