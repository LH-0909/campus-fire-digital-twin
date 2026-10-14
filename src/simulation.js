// All coordinates are metres; time is simulation seconds. Teaching prototype, not CFD.
export const nodes = [
  { id:'301', name:'301 教室', x:-12,z:-7, room:true },
  { id:'302', name:'302 教室', x:0,z:-7, room:true },
  { id:'303', name:'303 教室', x:12,z:-7, room:true },
  { id:'west', name:'西侧走廊',x:-12,z:0 },
  { id:'center', name:'中央走廊',x:0,z:0 },
  { id:'east', name:'东侧走廊',x:12,z:0 },
  { id:'exitW',name:'西侧安全出口',x:-18,z:7,exit:true },
  { id:'exitE',name:'东侧安全出口',x:18,z:7,exit:true },
];
export const edges = [['301','west'],['302','center'],['303','east'],['west','center'],['center','east'],['west','exitW'],['east','exitE']].map(([a,b])=>({a,b,width:2,capacity:2}));
const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
const dist = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function route(start, states, blocked = new Set()) {
  if (!byId[start]) return null;
  const exits = nodes.filter(n=>n.exit && !blocked.has(n.id));
  const open = new Set([start]), g = {[start]:0}, parent = {};
  const h = id => exits.length ? Math.min(...exits.map(n=>dist(byId[id],n))) : 0;
  while(open.size) {
    const current = [...open].sort((a,b)=>(g[a]+h(a))-(g[b]+h(b)))[0];
    if(exits.some(n=>n.id===current)) {
      const path=[current]; let cursor=current;
      while(parent[cursor]) { cursor=parent[cursor]; path.unshift(cursor); }
      return path;
    }
    open.delete(current);
    for(const edge of edges.filter(e=>e.a===current || e.b===current)) {
      const next=edge.a===current ? edge.b : edge.a;
      const s=states[next];
      if(blocked.has(next) || (s && (s.fire>=.8 || s.smoke>=.85 || s.temperature>=90))) continue;
      const risk=Math.max(states[current]?.risk||0,s?.risk||0);
      const congestion=s?.congestion||0;
      const cost=dist(byId[current],byId[next])*(1+4*risk+2*congestion);
      if(g[next]===undefined || g[current]+cost < g[next]) {
        g[next]=g[current]+cost; parent[next]=current; open.add(next);
      }
    }
  }
  return null;
}
function rng(seed) { let value=seed>>>0; return ()=>{ value=(1664525*value+1013904223)>>>0; return value/4294967296; }; }
export function createSimulation(seed=42,count=36) {
  const random=rng(seed);
  return { seed,time:0,running:false,finished:false,fireActive:false,fireSource:'302',blocked:[],events:[],history:[],
    states:Object.fromEntries(nodes.map(n=>[n.id,{fire:0,smoke:0,temperature:22,risk:0,congestion:0,occupancy:0}])),
    agents:Array.from({length:count},(_,i)=>{ const n=nodes[i%3]; return {id:i+1,node:n.id,x:n.x+(random()-.5)*2,z:n.z+(random()-.5)*2,speed:1.05+random()*.5,path:[],edge:null,progress:0,escaped:false,trapped:false,exposure:0,wait:0,exitTime:null,replans:0}; }),
  };
}
export function record(sim,type,message,agentId=null) {
  sim.events.push({time:sim.time,type,message,agentId});
}
export function ignite(sim,source='302') {
  if(sim.fireActive) return;
  sim.fireActive=true; sim.fireSource=source; sim.fireTime=sim.time;
  record(sim,'fire',`${byId[source].name}发生火情，启动疏散`);
}
export function toggleExit(sim,id) {
  sim.blocked=sim.blocked.includes(id)?sim.blocked.filter(x=>x!==id):[...sim.blocked,id];
  record(sim,'exit',`${byId[id].name}${sim.blocked.includes(id)?'封闭':'恢复通行'}`);
}
export function step(sim,dt=.2) {
  if(sim.finished || !sim.running || dt<=0) return;
  if(dt>.2) { let remaining=dt; while(remaining>1e-9&&!sim.finished) { const tick=Math.min(.2,remaining);step(sim,tick);remaining-=tick; } return; }
  sim.time+=dt;
  const old=Object.fromEntries(Object.entries(sim.states).map(([id,s])=>[id,{...s}]));
  for(const n of nodes) {
    const s=sim.states[n.id], neighbours=edges.filter(e=>e.a===n.id || e.b===n.id).map(e=>old[e.a===n.id?e.b:e.a]);
    const elapsed=sim.fireActive?sim.time-sim.fireTime:0;
    const source=n.id===sim.fireSource && sim.fireActive;
    // Diffusion along topology: bounded, deterministic and timestep driven.
    s.smoke=Math.max(0,Math.min(1,old[n.id].smoke+dt*(neighbours.reduce((sum,v)=>sum+.035*(v.smoke-old[n.id].smoke),0)+(source ? .014 : 0)-.0015*old[n.id].smoke)));
    s.fire=source?Math.min(1,.15+elapsed*.008):Math.max(0,old[n.id].fire+dt*(neighbours.some(v=>v.fire>.65)?.001:0));
    s.temperature=22+s.fire*75+s.smoke*28;
    s.occupancy=sim.agents.filter(a=>!a.escaped && a.node===n.id).length;
    s.congestion=Math.min(1,s.occupancy/18);
    s.risk=Math.min(1,.35*s.fire+.35*s.smoke+.2*Math.max(0,(s.temperature-22)/80)+.1*s.congestion);
  }
  for(const a of sim.agents) {
    if(a.escaped) continue;
    const s=sim.states[a.node];
    const targetRisk=a.edge?sim.states[a.edge.to].risk:s.risk;
    a.exposure+=dt*(s.risk+(targetRisk-s.risk)*a.progress);
    if(!sim.fireActive) continue;
    if(!a.edge) {
      const next=route(a.node,sim.states,new Set(sim.blocked));
      if(!next) {
        if(!a.trapped) record(sim,'trapped',`人员 ${a.id} 暂无安全路径`,a.id);
        a.trapped=true; a.path=[]; a.wait+=dt; continue;
      }
      const recovered=a.trapped;
      a.trapped=false;
      if(recovered || (a.path.length && a.path.join(',')!==next.join(','))) {
        a.replans++; record(sim,'replan',`人员 ${a.id} 改道至${byId[next.at(-1)].name}`,a.id);
      }
      a.path=next;
      if(next.length===1) { a.escaped=true;a.exitTime=sim.time;record(sim,'escape',`人员 ${a.id} 到达${byId[a.node].name}`,a.id);continue; }
      const target=next[1],key=[a.node,target].sort().join(':');
      // Capacity controls simultaneous occupancy of each passage.
      const active=sim.agents.filter(p=>p.edge?.key===key).length;
      const capacity=edges.find(e=>[e.a,e.b].includes(a.node)&&[e.a,e.b].includes(target)).capacity;
      if(active>=capacity) { a.wait+=dt;continue; }
      a.edge={from:a.node,to:target,key,length:dist(byId[a.node],byId[target])};a.progress=0;
    }
    const targetState=sim.states[a.edge.to];
    if(sim.blocked.includes(a.edge.to) || targetState.smoke>=.85 || targetState.fire>=.8 || targetState.temperature>=90) {
      a.x=byId[a.node].x;a.z=byId[a.node].z;a.edge=null; record(sim,'blocked',`人员 ${a.id} 前方通道失效，返回节点重新规划`,a.id);continue;
    }
    a.progress=Math.min(1,a.progress+dt*a.speed*(1-.45*targetState.smoke)/a.edge.length);
    const from=byId[a.edge.from],to=byId[a.edge.to];
    a.x=from.x+(to.x-from.x)*a.progress;a.z=from.z+(to.z-from.z)*a.progress;
    if(a.progress>=1) {a.node=a.edge.to;a.edge=null;a.path=a.path.slice(1);}
  }
  if(!sim.history.length || sim.time-sim.history.at(-1).time>=1) sim.history.push({time:sim.time,escaped:sim.agents.filter(a=>a.escaped).length,smoke:Math.max(...Object.values(sim.states).map(s=>s.smoke))});
  if(sim.fireActive && (sim.agents.every(a=>a.escaped) || sim.time-(sim.fireTime??sim.time)>=300)) {sim.finished=true;sim.running=false;record(sim,'finish','演练结束，已生成评分与复盘');}
}
export function score(sim) {
  const escaped=sim.agents.filter(a=>a.escaped),count=sim.agents.length;
  const mean=(key)=>count?sim.agents.reduce((sum,a)=>sum+a[key],0)/count:0;
  const completion=count?escaped.length/count:0;
  const time=escaped.length?escaped.reduce((sum,a)=>sum+(a.exitTime-(sim.fireTime||0)),0)/escaped.length:0;
  const effectiveTime=count?sim.agents.reduce((sum,a)=>sum+(a.escaped?a.exitTime-(sim.fireTime??0):300),0)/count:300;
  const dimensions={completion:100*completion,efficiency:Math.max(0,100-effectiveTime/3),avoidance:Math.max(0,100-mean('exposure')*2)*completion,flow:Math.max(0,100-mean('wait')*.8)*completion};
  const total=.4*dimensions.completion+.2*dimensions.efficiency+.25*dimensions.avoidance+.15*dimensions.flow;
  return {total:Math.round(total*10)/10,dimensions,time,exposure:mean('exposure'),wait:mean('wait'),completion};
}
