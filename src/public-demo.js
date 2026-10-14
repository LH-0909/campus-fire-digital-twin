// Public static hosting has no server identity or shared private data.
// This adapter is included only by the explicit public-demo build.
export function createPublicDemoApi({session,local}={}){
 let user=null;const memory=new Map();
 const read=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')??fallback;}catch{return fallback;}};
 const write=(storage,key,value)=>{try{storage?.setItem(key,JSON.stringify(value));}catch{/* Storage is optional in private browsing. */}};
 user=read(session,'campus-public-persona',null);
 return async(path,body)=>{
  if(path==='/api/auth/session'){if(!user)throw new Error('请选择演示角色');return {user};}
  if(path==='/api/auth/login'){
   if(!body?.demo||!['teacher','student','admin'].includes(body.role))throw new Error('公开演示仅支持角色体验，不接受真实账号密码');
   user={id:`demo-${body.role}`,role:body.role,name:{teacher:'演示教师',student:'演示学生',admin:'演示管理员'}[body.role]};write(session,'campus-public-persona',user);return {user};
  }
  if(path==='/api/auth/logout'){user=null;write(session,'campus-public-persona',null);return {ok:true};}
  if(path==='/api/records'){
   if(!user)throw new Error('请先进入演示');
   const key=`campus-public-records-${user.role}`,records=read(local,key,memory.get(key)||[]);
   if(body){const next=[body,...records].slice(0,30);memory.set(key,next);write(local,key,next);return {ok:true};}
   return {records};
  }
  throw new Error('公开演示不提供此服务器接口');
 };
}
