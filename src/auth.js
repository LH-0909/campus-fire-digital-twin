import {createPublicDemoApi} from './public-demo.js';
export const isPublicDemo=import.meta.env?.VITE_PUBLIC_DEMO==='true';
let publicApi;
export async function api(path,body){
 if(isPublicDemo){
  if(!publicApi){let session,local;try{session=window.sessionStorage;local=window.localStorage;}catch{}publicApi=createPublicDemoApi({session,local});}
  return publicApi(path,body);
 }
 const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw new Error(result.error||'接口请求失败');return result;
}
