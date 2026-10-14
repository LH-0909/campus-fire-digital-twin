// Public static hosting has no server identity or shared private data.
// This adapter is included only by the explicit public-demo build.
export function createPublicDemoApi({session,local,random=Math.random,now=Date.now}={}){
 let user=null,challenge=null,sequence=0;const memory=new Map();
 const read=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')??fallback;}catch{return fallback;}};
 const write=(storage,key,value)=>{try{storage?.setItem(key,JSON.stringify(value));}catch{/* Storage is optional in private browsing. */}};
 user=read(session,'campus-public-persona',null)||read(local,'campus-public-persona',null);
 return async(path,body)=>{
  if(path==='/api/auth/session'){if(!user)throw new Error('请选择演示角色');return {user};}
  if(path==='/api/auth/captcha'){
   const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   const answer=Array.from({length:4},()=>alphabet[Math.floor(random()*alphabet.length)]).join('');
   challenge={id:`public-demo-${++sequence}`,answer,expires:now()+300000};
   const letters=[...answer].map((letter,i)=>`<text x="${17+i*27}" y="34" transform="rotate(${Math.round(random()*16-8)} ${17+i*27} 34)">${letter}</text>`).join('');
   const lines=Array.from({length:7},()=>`<path d="M${Math.round(random()*126)} ${Math.round(random()*48)}L${Math.round(random()*126)} ${Math.round(random()*48)}" stroke="#a7b9ed"/>`).join('');
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="126" height="50" viewBox="0 0 126 50"><rect width="126" height="50" rx="4" fill="#edf3ff"/>${lines}<g font-family="Arial,sans-serif" font-size="27" font-weight="bold" fill="#255fd1">${letters}</g></svg>`;
   return {id:challenge.id,image:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`};
  }
  if(path==='/api/auth/login'){
   if(!['teacher','student','admin'].includes(body?.role))throw new Error('请选择教师、学生或管理员入口');
   if(!body.demo){
    if(!challenge||body.captchaId!==challenge.id||challenge.expires<now())throw new Error('验证码已失效，请刷新');
    const valid=String(body.captcha||'').trim().toUpperCase()===challenge.answer;challenge=null;
    if(!valid)throw new Error('验证码错误，请重新输入');
    if(String(body.username||'').trim()!==body.role||body.password!=='Campus@2026')throw new Error('请使用对应入口的演示账号 teacher / student / admin，密码 Campus@2026');
   }
   user={id:`demo-${body.role}`,role:body.role,name:{teacher:'演示教师',student:'演示学生',admin:'演示管理员'}[body.role]};
   write(body.remember?local:session,'campus-public-persona',user);write(body.remember?session:local,'campus-public-persona',null);return {user};
  }
  if(path==='/api/auth/logout'){user=null;write(session,'campus-public-persona',null);write(local,'campus-public-persona',null);return {ok:true};}
  if(path==='/api/records'){
   if(!user)throw new Error('请先进入演示');
   const key=`campus-public-records-${user.role}`,records=read(local,key,memory.get(key)||[]);
   if(body){const next=[body,...records].slice(0,30);memory.set(key,next);write(local,key,next);return {ok:true};}
   return {records};
  }
  throw new Error('公开演示不提供此服务器接口');
 };
}
