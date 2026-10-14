import {spaceById} from './building.js';
// Canonical fire-field interchange. FDS raw output needs the included converter.
export function parseFieldCsv(text) {
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#'));
  if(lines.length<2)throw new Error('CSV至少需要表头和一行数据');
  if(lines.length>100000)throw new Error('CSV最多100000行');
  const header=lines[0].split(',').map(x=>x.trim());
  const required=['time','space_id','temperature_c','smoke_index'];
  if(required.some(x=>!header.includes(x)))throw new Error('表头必须包含 time,space_id,temperature_c,smoke_index');
  const frames=new Map();
  lines.slice(1).forEach((line,index)=>{
    const values=line.split(',').map(x=>x.trim());const row=Object.fromEntries(header.map((k,i)=>[k,values[i]]));
    const time=Number(row.time),temperature=Number(row.temperature_c),smoke=Number(row.smoke_index),fire=row.fire_index===undefined?0:Number(row.fire_index);
    if(!spaceById[row.space_id])throw new Error(`第${index+2}行空间ID不存在：${row.space_id}`);
    if([row.time,row.temperature_c,row.smoke_index].some(x=>x===undefined||x==='')||![time,temperature,smoke,fire].every(Number.isFinite)||time<0||temperature< -50||temperature>2000||smoke<0||smoke>1||fire<0||fire>1)throw new Error(`第${index+2}行数值或单位不合法`);
    if(!frames.has(time))frames.set(time,{time,fields:{}});
    if(frames.get(time).fields[row.space_id])throw new Error(`第${index+2}行时间与空间重复`);
    frames.get(time).fields[row.space_id]={temperature,smoke,fire};
  });
  const sorted=[...frames.values()].sort((a,b)=>a.time-b.time);
  // Each device must exist in every frame, so interpolation never fabricates gaps.
  const keys=Object.keys(sorted[0].fields).sort().join(',');
  if(sorted.some(f=>Object.keys(f.fields).sort().join(',')!==keys))throw new Error('各时间帧的空间集合必须一致');
  return {frames:sorted,spaceCount:Object.keys(sorted[0].fields).length,duration:sorted.at(-1).time};
}
export function applyTwinMessage(state,input) {
  if(!input||input.version!=='twin-state/1'||input.buildingId!==state.buildingId)throw new Error('消息版本或建筑ID不匹配');
  if(!input.fields||typeof input.fields!=='object')throw new Error('消息缺少fields');
  const update={};
  for(const [id,value] of Object.entries(input.fields)) {
    if(!spaceById[id])throw new Error(`未知空间：${id}`);
    if(!value||typeof value!=='object')throw new Error('场值格式不合法');
    update[id]={};
    for(const [key,n] of Object.entries(value)) {
      if(!['temperature','smoke','fire'].includes(key)||typeof n!=='number'||!Number.isFinite(n)||((key==='smoke'||key==='fire')&&(n<0||n>1))||(key==='temperature'&&(n< -50||n>2000)))throw new Error(`场值不合法：${key}`);
      update[id][key]=n;
    }
  }
  Object.entries(update).forEach(([id,v])=>Object.assign(state.fields[id],v));
}
export const interfaceContract={version:'twin-state/1',buildingId:'dorm-01',transport:'WebSocket JSON / MQTT bridge',topic:'campus/dorm-01/twin/state',fields:{R302:{temperature:68,smoke:.35,fire:.2}}};
