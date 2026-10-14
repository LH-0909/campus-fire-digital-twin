import {spaces,spaceById,exits} from './building.js';
import {findRoute} from './state.js';
import {edgePolyline,polylineLength} from './navigation.js';

export function layerVisibility(layer,student=false){
 if(student)return {fire:true,smoke:true,people:true,routes:layer!=='student-no-route',markers:false,field:null};
 return {
  fire:layer!=='people',smoke:['smoke','heat','overview'].includes(layer),
  people:layer!=='smoke',routes:layer==='routes',markers:layer==='people',
  field:layer==='smoke'?'smoke':layer==='heat'?'risk':null,
 };
}
export function visiblePeople(twin,mode,floor){
 return twin.agents.filter(a=>!a.escaped&&(['building','exterior'].includes(mode)||a.floor===floor||a.edge?.kind==='stairs'&&[spaceById[a.edge.from]?.floor,spaceById[a.edge.to]?.floor].includes(floor)));
}
export function routeOptions(origin,twin){
 const recommended=findRoute(origin,twin)?.at(-1);
 return exits.map(exit=>{
  const blocked=twin.blocked.includes(exit.id);
  const path=blocked?null:findRoute(origin,{...twin,blocked:[...twin.blocked,...exits.filter(e=>e.id!==exit.id).map(e=>e.id)]});
  const length=path?path.slice(1).reduce((sum,id,i)=>sum+polylineLength(edgePolyline(path[i],id)),0):null;
  return {id:exit.id,name:exit.name,blocked,path,length,recommended:exit.id===recommended,risk:path?Math.max(...path.map(id=>twin.fields[id].risk)):null};
 });
}
export function smokeSummary(twin,floor){
 const zones=spaces.filter(n=>n.floor===floor&&(n.kind==='room'||n.kind==='corridor'));
 const smoky=zones.filter(n=>twin.fields[n.id].smoke>.015);
 const peak=zones.reduce((a,b)=>twin.fields[a.id].smoke>twin.fields[b.id].smoke?a:b);
 return {count:smoky.length,peak:peak.name,value:twin.fields[peak.id].smoke};
}
