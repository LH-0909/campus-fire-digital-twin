import { building,spaces,spaceById,adjacent,rooms,exits,connections } from './building.js';
import {navigationPoint,edgePolyline,polylineLength,samplePolyline,bindNavigationEdges} from './navigation.js';
import {canOccupyStudent} from './collision.js';
bindNavigationEdges(connections);
const passages=connections.filter(e=>e.kind!=='stairs'&&e.kind!=='door'&&(spaceById[e.a].kind==='stairs'||spaceById[e.b].kind==='stairs'||e.kind==='exit'));
function nearPolyline(x,z,points,radius=.36){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<radius)return true;}return false;}
const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,x));
export function event(state,type,message) { state.events.push({time:state.time,type,message}); }
export function createTwin({seed=42,count=286,source='R302',strategy='balanced'}={}) {
  let random=seed>>>0;const rand=()=>((random=(1664525*random+1013904223)>>>0)/4294967296);
  return {version:'twin-state/1',buildingId:building.id,seed,time:0,running:false,finished:false,
    fireSource:source,strategy,blocked:[],closedDoors:[],events:[],history:[],snapshots:[],
    dataSource:'software',fds:null,lastSnapshot:-1,lastRoute:-1,
    fields:Object.fromEntries(spaces.map(s=>[s.id,{fire:0,smoke:0,temperature:22,risk:0,occupancy:0,density:0}])),
    agents:Array.from({length:count},(_,i)=>{const room=rooms[(i*7)%rooms.length];return {id:i+1,originFloor:room.floor,node:room.id,x:room.x+(rand()-.5),y:room.y,z:room.z+(rand()-.5),floor:room.floor,speed:.95+rand()*.5,path:[],edge:null,progress:0,escaped:false,trapped:false,wait:0,exposure:0,exitTime:null,replans:0};}),
    student:{node:'F3-C1',x:-14.7,y:6.6,z:0,floor:3,heading:Math.PI,health:100,crouching:false,towel:false,escaped:false,actions:[],exposure:0},
  };
}
export function startTwin(s) { if(s.finished)return; s.running=!s.running;if(s.running&&!s.events.length)event(s,'火警触发',`${spaceById[s.fireSource].name}发生火情，软件仿真启动`); }
export function toggleExit(s,id) {if(!exits.some(n=>n.id===id))throw new Error('未知出口');s.blocked=s.blocked.includes(id)?s.blocked.filter(x=>x!==id):[...s.blocked,id];s.lastRoute=-1;event(s,'出口切换',`${spaceById[id].name}${s.blocked.includes(id)?'已封闭':'恢复通行'}`);}
export function findRoute(start,s,preferred=null) {
  if(!spaceById[start])return null;
  const destinations=exits.filter(n=>!s.blocked.includes(n.id));
  const open=new Set([start]),g={[start]:0},parent={};
  const h=id=>destinations.length?Math.min(...destinations.map(n=>Math.hypot(n.x-spaceById[id].x,n.y-spaceById[id].y,n.z-spaceById[id].z))):0;
  while(open.size) {
    let current=[...open].reduce((a,b)=>g[a]+h(a)<g[b]+h(b)?a:b);
    if(destinations.some(n=>n.id===current)) {const path=[current];while(parent[current]){current=parent[current];path.unshift(current);}return path;}
    open.delete(current);
    for(const {to,edge} of adjacent[current]) {
      const f=s.fields[to];if(s.blocked.includes(to)||f.fire>.85||f.temperature>95||f.smoke>.9)continue;
      const penalty=s.strategy==='balanced'?1+4*f.risk+2.5*f.density:1+3*f.risk;
      const preference=preferred&&spaceById[to].kind==='exit'&&to!==preferred?25:0;
      const cost=edge.length*penalty+preference+(s.closedDoors.includes(to)&&edge.kind==='door'?4:0);
      const candidate=g[current]+cost;
      if(g[to]===undefined||candidate<g[to]){g[to]=candidate;parent[to]=current;open.add(to);}
    }
  }
  return null;
}
export function fdsAt(frames,time) {
  if(!frames.length)return null;
  let a=frames[0],b=frames.at(-1);
  for(let i=1;i<frames.length;i++)if(frames[i].time>=time){a=frames[i-1];b=frames[i];break;}
  if(time<=frames[0].time)return frames[0].fields;
  if(time>=frames.at(-1).time)return frames.at(-1).fields;
  const w=(time-a.time)/(b.time-a.time||1),result={};
  for(const id of Object.keys(a.fields)){const aa=a.fields[id],bb=b.fields[id]||aa;result[id]={temperature:aa.temperature+(bb.temperature-aa.temperature)*w,smoke:aa.smoke+(bb.smoke-aa.smoke)*w,fire:aa.fire+(bb.fire-aa.fire)*w};}return result;
}
export function snapshot(s) {return {time:s.time,fireSource:s.fireSource,closedDoors:[...s.closedDoors],fields:JSON.parse(JSON.stringify(s.fields)),agents:s.agents.map(a=>({...a,path:[...a.path],edge:a.edge?{...a.edge,polyline:a.edge.polyline?.map(p=>({...p}))}:null})),student:JSON.parse(JSON.stringify(s.student)),blocked:[...s.blocked]};}
export function tick(s,dt=.2) {
  if(!s.running||s.finished||!Number.isFinite(dt)||dt<=0)return;
  if(dt>.2){for(let left=dt;left>1e-8&&!s.finished;left-=.2)tick(s,Math.min(.2,left));return;}
  s.time+=dt;
  const old=Object.fromEntries(Object.entries(s.fields).map(([id,f])=>[id,{...f}]));
  const external=s.dataSource==='fds'?fdsAt(s.fds.frames,s.time):null;
  const occupancy={};s.agents.forEach(a=>{if(!a.escaped)occupancy[a.node]=(occupancy[a.node]||0)+1;});
  for(const n of spaces) {
    const f=s.fields[n.id],o=old[n.id];
    if(external){const v=external[n.id]||{fire:0,smoke:0,temperature:22};Object.assign(f,v);}
    else {
      const source=n.id===s.fireSource;
      const doorFactor=s.closedDoors.includes(n.id)?.08:1;
      let smoke=0,heat=0;
      for(const {to,edge} of adjacent[n.id]) {
        const rate=edge.kind==='stairs'?(spaceById[to].floor<n.floor?.022:.005):edge.kind==='door'?.013:.027;
        const df=s.closedDoors.includes(to)?.08:doorFactor;
        smoke+=rate*df*(old[to].smoke-o.smoke);
        heat+=.015*df*(old[to].fire-o.fire);
      }
      const suppression=s.student.actions.filter(a=>a.type==='extinguisher'&&s.time-a.time<20).length;
      f.fire=clamp(o.fire+dt*(source?.006*(1-suppression*.9):Math.max(0,heat-.002)));
      if(source&&s.time<.3)f.fire=.12;
      f.smoke=clamp(o.smoke+dt*(smoke+(source?.012*f.fire:0)-(n.kind==='exit'?.018:.0007)*o.smoke));
      f.temperature=22+f.fire*110+f.smoke*45;
    }
    f.occupancy=occupancy[n.id]||0;f.density=f.occupancy/n.area;
    f.risk=clamp(.3*f.fire+.35*f.smoke+.25*clamp((f.temperature-22)/90)+.1*clamp(f.density/2));
  }
  const replan=s.time-s.lastRoute>=1;
  if(replan)s.lastRoute=s.time;
  const routeCache=new Map(),active={};
  s.agents.forEach(a=>{if(a.edge)active[a.edge.key]=(active[a.edge.key]||0)+1;});
  for(const a of s.agents) {
    if(a.escaped)continue;
    const from=s.fields[a.node],to=a.edge?s.fields[a.edge.to]:from;
    a.exposure+=dt*(from.risk+(to.risk-from.risk)*a.progress);
    if(!a.edge&&(replan||!a.path.length||a.trapped||s.blocked.includes(a.path.at(-1)))) {
      if(!routeCache.has(a.node))routeCache.set(a.node,findRoute(a.node,s));
      const path=routeCache.get(a.node);
      if(!path){if(!a.trapped)event(s,'路径预警',`人员${a.id}暂无安全路径`);a.trapped=true;a.path=[];a.wait+=dt;continue;}
      if(a.trapped||(a.path.length&&path.at(-1)!==a.path.at(-1)))a.replans++;
      a.trapped=false;a.path=[...path];
    }
    if(!a.edge) {
      if(a.path.length===1&&spaceById[a.node].kind==='exit'){a.escaped=true;a.exitTime=s.time;continue;}
      if(a.path.length<2){a.wait+=dt;continue;}
      const link=adjacent[a.node].find(v=>v.to===a.path[1]);
      if(active[link.edge.key]>=link.edge.capacity){a.wait+=dt;continue;}
      active[link.edge.key]=(active[link.edge.key]||0)+1;
      a.edge={from:a.node,to:link.to,key:link.edge.key,length:link.edge.length,kind:link.edge.kind,polyline:link.edge.a===a.node?link.edge.polyline:[...link.edge.polyline].reverse()};a.progress=0;
    }
    const hazard=s.fields[a.edge.to];
    const movement=a.speed*(a.edge.kind==='stairs'?.62:1)*(1-.45*hazard.smoke);
    if(s.blocked.includes(a.edge.to)||hazard.temperature>95||hazard.smoke>.9||hazard.fire>.85)a.edge.returning=true;
    a.progress=clamp(a.progress+dt*movement/a.edge.length*(a.edge.returning?-1:1));
    const p=spaceById[a.edge.from],q=spaceById[a.edge.to];
    const position=samplePolyline(a.edge.polyline||edgePolyline(p,q),a.progress);
    Object.assign(a,position);a.floor=a.progress<.5?p.floor:q.floor;
    if(a.edge.returning&&a.progress<=0){active[a.edge.key]--;a.edge=null;a.path=[];a.replans++;}
    else if(a.progress>=1) {
      const edgeKey=a.edge.key;
      a.node=a.edge.to;a.path=a.path.slice(1);
      a.edge=null;active[edgeKey]--;
    }
  }
  const st=s.student,local=s.fields[st.node];
  if(!st.escaped&&local){const factor=(st.crouching?.45:1)*(st.towel?.7:1);st.exposure+=local.risk*factor*dt;st.health=Math.max(0,100-st.exposure*1.2);}
  if(s.time-s.lastSnapshot>=2||s.lastSnapshot<0) {
    s.lastSnapshot=s.time;
    s.history.push({time:s.time,escaped:s.agents.filter(a=>a.escaped).length,trapped:s.agents.filter(a=>a.trapped).length,smoke:Math.max(...Object.values(s.fields).map(f=>f.smoke)),temperature:Math.max(...Object.values(s.fields).map(f=>f.temperature))});
    // 600 seconds at a two-second cadence. Export preserves complete events.
    s.snapshots.push(snapshot(s));if(s.snapshots.length>301)s.snapshots.shift();
  }
  if(s.agents.every(a=>a.escaped)&&(!st.participating||st.escaped||st.health<=0)||s.time>=600) {s.running=false;s.finished=true;event(s,'演练结束',`已疏散${s.agents.filter(a=>a.escaped).length}/${s.agents.length}人`);s.snapshots.push(snapshot(s));}
}
export function metrics(s) {
  const count=s.agents.length,escaped=s.agents.filter(a=>a.escaped),trapped=s.agents.filter(a=>a.trapped&&!a.escaped).length;
  const avg=key=>count?s.agents.reduce((n,a)=>n+a[key],0)/count:0;
  const completion=count?escaped.length/count:0;
  const time=escaped.length?escaped.reduce((n,a)=>n+a.exitTime,0)/escaped.length:0;
  const effective=count?s.agents.reduce((n,a)=>n+(a.exitTime??600),0)/count:600;
  const dimensions={completion:completion*100,efficiency:clamp(1-effective/600)*100,avoidance:clamp(1-avg('exposure')/120)*100*completion,flow:clamp(1-avg('wait')/240)*100*completion};
  const score=.4*dimensions.completion+.2*dimensions.efficiency+.25*dimensions.avoidance+.15*dimensions.flow;
  const floors=Array.from({length:6},(_,i)=>{const floor=i+1,agents=s.agents.filter(a=>a.originFloor===floor);const f=spaces.filter(n=>n.floor===floor).map(n=>s.fields[n.id]);return {floor,risk:Math.max(...f.map(n=>n.risk)),smoke:Math.max(...f.map(n=>n.smoke)),temperature:Math.max(...f.map(n=>n.temperature)),occupancy:s.agents.filter(a=>a.floor===floor&&!a.escaped).length,total:agents.length,escaped:agents.filter(a=>a.escaped).length};});
  return {count,escaped:escaped.length,trapped,remaining:count-escaped.length,completion,time,wait:avg('wait'),exposure:avg('exposure'),score,dimensions,floors};
}
export function nearestDoor(s,range=1.8) {
 const st=s.student;
 return rooms.filter(r=>r.floor===st.floor&&Math.hypot(st.x-(r.x-.11),st.z-r.side*1.2)<range).sort((a,b)=>Math.hypot(st.x-a.x,st.z-a.side*1.2)-Math.hypot(st.x-b.x,st.z-b.side*1.2))[0]||null;
}
export function nearbyStair(s) {
 const st=s.student;
 return spaces.find(n=>{const p=navigationPoint(n);return n.floor===st.floor&&n.kind==='stairs'&&Math.hypot(st.x-p.x,st.z-p.z)<1.15;})||null;
}
export function studentCanMove(s){return !s.finished&&!s.student.escaped&&s.student.health>0&&(s.running||s.time===0);}
export function useStairs(s,direction=-1){
 const st=s.student,stair=nearbyStair(s);
 if(!studentCanMove(s))return '请继续演练后移动';
 if(st.stair)return '正在通过楼梯';
 if(!stair)return '请先靠近楼梯平台';
 const toFloor=st.floor+(direction>0?1:-1);
 if(toFloor<1||toFloor>building.floors)return direction>0?'已到达顶层':'已到达一楼，请前往出口';
 const target=spaceById[`F${toFloor}-S${stair.id.at(-1)}`],polyline=[{x:st.x,y:st.y,z:st.z},...edgePolyline(stair,target)];
 st.stair={fromFloor:st.floor,toFloor,key:stair.id.at(-1),polyline,elapsed:0,duration:polylineLength(polyline)/1.05};
 if(s.running)event(s,'进入楼梯',`学生沿${stair.name}${direction>0?'上行':'下行'}`);
 return null;
}
export function studentAction(s,type,targetId=null) {
 const st=s.student;
 if(!studentCanMove(s))return '请启动或继续演练后操作';
 if(type==='crouch'){
  if(st.crouching&&!canOccupyStudent({...s,student:{...st,crouching:false}},st.x,st.z))return '上方空间不足，请先离开障碍物再站立';
  st.crouching=!st.crouching;
 }
 if(type==='towel')st.towel=!st.towel;
 let message;
 if(type==='door') {
  const door=targetId?rooms.find(r=>r.id===targetId&&r.floor===st.floor&&Math.hypot(st.x-(r.x-.11),st.z-r.side*1.2)<1.8):nearestDoor(s);
  if(!door)return '请先靠近房门（1.8米内）';
  const closing=!s.closedDoors.includes(door.id);
  if(closing&&Math.abs(st.x-(door.x-.11))<.7&&Math.abs(st.z-door.side*1.2)<.23)return '请先离开门扇范围再关门';
  s.closedDoors=closing?[...s.closedDoors,door.id]:s.closedDoors.filter(id=>id!==door.id);
  s.lastRoute=-1;message=`${closing?'关闭':'打开'}${door.name}房门`;
 }
 if(type==='extinguisher') {
  if(st.floor!==spaceById[s.fireSource].floor||Math.hypot(st.x-spaceById[s.fireSource].x,st.z-spaceById[s.fireSource].z)>7)return '灭火器操作需要靠近火源（7米内）';
  if(st.actions.some(a=>a.type==='extinguisher'&&s.time-a.time<10))return '灭火器正在冷却，请等待10秒';
  if(s.dataSource==='fds')message='使用灭火器（外部场数据保持文件驱动）';
 }
 // Exploration has no exposure or score; only drill actions count.
 if(s.running){st.actions.push({time:s.time,type});event(s,'学生操作',message||{crouch:st.crouching?'弯腰低姿前进':'恢复站立',towel:st.towel?'使用湿毛巾防护':'移除湿毛巾',extinguisher:'使用灭火器',help:'呼救并提醒附近同学'}[type]||type);}
 return null;
}
export function moveStudent(s,dx,dz,dt) {
 const st=s.student;if(!studentCanMove(s)||!Number.isFinite(dt)||dt<=0)return;
 if(st.stair){
  const t=st.stair;t.elapsed=Math.min(t.duration,t.elapsed+dt);
  const progress=t.elapsed/t.duration,point=samplePolyline(t.polyline,progress);
  Object.assign(st,{x:point.x,y:point.y,z:point.z,bodyHeading:point.heading,moving:true});
  if(progress>=1){st.floor=t.toFloor;st.node=`F${st.floor}-S${t.key}`;st.stair=null;if(s.running)event(s,'到达楼层',`学生到达${st.floor}F`);}
  return;
 }
 const distance=Math.hypot(dx,dz)*dt;
 if(distance>.1){const count=Math.ceil(distance/.1);for(let i=0;i<count;i++)moveStudent(s,dx,dz,dt/count);return;}
 const x=st.x+dx*dt,z=st.z+dz*dt;
 function walkable(px,pz){
  const corridor=(Math.abs(pz)<=1.02&&Math.abs(px)<=21.48)||(Math.abs(px-2.1)<1.5&&pz>=-8.18&&pz<=10.2);
  const room=rooms.some(r=>r.floor===st.floor&&Math.abs(px-r.x)<1.98&&Math.abs(pz-r.z)<3.24);
  const door=rooms.some(r=>r.floor===st.floor&&!s.closedDoors.includes(r.id)&&Math.abs(px-(r.x-.11))<.43&&r.side*pz>=.9&&r.side*pz<1.6);
  const walkway=passages.some(e=>spaceById[e.a].floor===st.floor&&spaceById[e.b].floor===st.floor&&nearPolyline(px,pz,e.polyline,.5));
  return (corridor||room||door||walkway)&&canOccupyStudent(s,px,pz);
 }
 const beforeX=st.x,beforeZ=st.z;
 if(walkable(x,z)){st.x=x;st.z=z;}else {if(walkable(x,st.z))st.x=x;if(walkable(st.x,z))st.z=z;}
 st.moving=Math.hypot(st.x-beforeX,st.z-beforeZ)>.0001;st.obstructed=distance>.001&&!st.moving;
 if(st.moving)st.bodyHeading=Math.atan2(st.z-beforeZ,st.x-beforeX);
 st.node=spaces.filter(n=>n.floor===st.floor&&n.kind!=='exit').reduce((a,b)=>{const p=navigationPoint(a),q=navigationPoint(b);return Math.hypot(p.x-st.x,p.z-st.z)<Math.hypot(q.x-st.x,q.z-st.z)?a:b;}).id;
 if(s.running&&st.floor===1&&exits.some(exit=>!s.blocked.includes(exit.id)&&Math.hypot(st.x-exit.x,st.z-exit.z)<.8)){st.escaped=true;event(s,'学生完成','学生到达楼外安全区域');}
}
export function compareStrategies(options={}) {
  const run=strategy=>{const s=createTwin({...options,strategy});s.running=true;while(!s.finished)tick(s,1);const m=metrics(s);return {strategy,time:m.time,completion:m.completion,score:m.score,wait:m.wait,history:s.history,peakDensity:Math.max(...s.snapshots.map(p=>Math.max(...Object.values(p.fields).map(f=>f.density)))),exposure:m.exposure};};
  return [run('nearest'),run('balanced')];
}
