<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as echarts from 'echarts';
import { nodes, edges, createSimulation, ignite, toggleExit, step, score, record } from './simulation.js';
const sim=reactive(createSimulation());
const host=ref(),chartHost=ref(),selected=ref('302'),view=ref('overview');
const evacuated=computed(()=>sim.agents.filter(a=>a.escaped).length);
const trapped=computed(()=>sim.agents.filter(a=>a.trapped&&!a.escaped).length);
const result=computed(()=>score(sim));
const selectedState=computed(()=>sim.states[selected.value]);
const logs=computed(()=>sim.events.slice(-60).reverse());
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let renderer,scene,camera,controls,chart,frame,observer,last=0,accumulator=0;
const regionMeshes=new Map(),people=[],exitMeshes=new Map();let pathLine;
function start(){if(sim.finished)return;sim.running=!sim.running;if(sim.running&&!sim.fireActive)ignite(sim,selected.value==='301'||selected.value==='303'?selected.value:'302');}
function reset(){Object.assign(sim,createSimulation(sim.seed));selected.value='302';}
function finish(){sim.running=false;sim.finished=true;record(sim,'finish','手动结束演练，生成当前结果');}
function exportData(){const blob=new Blob([JSON.stringify({version:'mvp-1',model:'topology-diffusion',seed:sim.seed,states:sim.states,agents:sim.agents,events:sim.events,history:sim.history,score:result.value},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='campus-drill.json';a.click();URL.revokeObjectURL(url);}
function label(text,x,z,color='#c8e9ff'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,56);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));sprite.position.set(x,2.8,z);sprite.scale.set(8,1.5,1);scene.add(sprite);}
function mesh(w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,transparent:true,opacity:.85}));m.position.set(x,y,z);scene.add(m);return m;}
function setView(){if(view.value==='top'){camera.position.set(0,48,.01);}else{camera.position.set(30,32,36);}controls.target.set(0,0,-1);controls.update();}
function resize(){if(!renderer)return;const w=host.value.clientWidth,h=host.value.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();chart?.resize();}
function clickScene(event){const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...regionMeshes.values(),...exitMeshes.values()]);if(hits.length)selected.value=hits[0].object.userData.id;}
function draw(){
  for(const n of nodes){const s=sim.states[n.id],m=regionMeshes.get(n.id)||exitMeshes.get(n.id);m.material.color.setHSL((1-s.risk)*.34,.7,.3);m.material.emissive.setHex(n.id===selected.value?0x16485f:0);if(n.exit&&sim.blocked.includes(n.id))m.material.color.setHex(0xef465e);const hazard=m.userData.hazard;if(hazard){hazard.visible=s.fire>.05;hazard.scale.y=.5+s.fire*3;hazard.material.opacity=.3+s.fire*.5;}}
  people.forEach((m,i)=>{const a=sim.agents[i];m.visible=!a.escaped;m.position.set(a.x,.65,a.z);m.material.color.setHex(a.trapped?0xff506b:i===0?0xffdc77:0x86f2e0);});
  const a=sim.agents.find(p=>!p.escaped&&p.path.length>1);
  if(pathLine){scene.remove(pathLine);pathLine.geometry.dispose();pathLine.material.dispose();pathLine=null;}
  if(a){const points=a.path.map(id=>{const n=nodes.find(n=>n.id===id);return new THREE.Vector3(n.x,.25,n.z);});pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x79ffcf}));scene.add(pathLine);}
}
function animate(now){frame=requestAnimationFrame(animate);const delta=last?Math.min((now-last)/1000,.1):0;last=now;if(sim.running){accumulator+=delta;while(accumulator>=.2){step(sim,.2);accumulator-=.2;}}draw();controls.update();renderer.render(scene,camera);if(!chart.__last||now-chart.__last>1000){chart.__last=now;chart.setOption({xAxis:{data:sim.history.map(p=>clock(p.time))},series:[{data:sim.history.map(p=>p.escaped)},{data:sim.history.map(p=>Math.round(p.smoke*100))}]});}}
onMounted(()=>{
 scene=new THREE.Scene();scene.background=new THREE.Color(0x091625);scene.add(new THREE.HemisphereLight(0xa9daff,0x122438,2.4));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(5,25,10);scene.add(light);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.value.appendChild(renderer.domElement);camera=new THREE.PerspectiveCamera(45,1,.1,200);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;setView();
 const floor=mesh(44,.15,26,0x10263c,0,-.15,-1);scene.add(new THREE.GridHelper(48,24,0x21425c,0x142d43));
 nodes.forEach(n=>{const m=n.room?mesh(10,.25,9,0x267366,n.x,0,n.z):mesh(n.exit?4:6,.2,n.exit?4:3,0x267366,n.x,0,n.z);m.userData.id=n.id;(n.exit?exitMeshes:regionMeshes).set(n.id,m);label(n.name,n.x,n.z);if(n.room){mesh(10,2,.2,0x35506a,n.x,1,n.z-4.5);mesh(.2,2,9,0x35506a,n.x-5,1,n.z);mesh(.2,2,9,0x35506a,n.x+5,1,n.z);const fire=new THREE.Mesh(new THREE.ConeGeometry(.8,2,8),new THREE.MeshBasicMaterial({color:0xff6539,transparent:true,opacity:.6}));fire.position.set(n.x,1.1,n.z);scene.add(fire);m.userData.hazard=fire;}});
 edges.forEach(e=>{const a=nodes.find(n=>n.id===e.a),b=nodes.find(n=>n.id===e.b);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,.12,a.z),new THREE.Vector3(b.x,.12,b.z)]),new THREE.LineBasicMaterial({color:0x355e7e}));scene.add(line);});
 sim.agents.forEach(()=>{const p=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.5,4,8),new THREE.MeshStandardMaterial({color:0x86f2e0}));people.push(p);scene.add(p);});
 renderer.domElement.addEventListener('click',clickScene);chart=echarts.init(chartHost.value);chart.setOption({backgroundColor:'transparent',textStyle:{color:'#91a9be'},tooltip:{trigger:'axis'},legend:{data:['已疏散','最大烟气 %'],textStyle:{color:'#91a9be'},top:0},grid:{left:32,right:32,top:35,bottom:25},xAxis:{type:'category',data:[]},yAxis:[{type:'value',max:36,splitLine:{lineStyle:{color:'#193047'}}},{type:'value',max:100,splitLine:{show:false}}],series:[{name:'已疏散',type:'line',showSymbol:false,lineStyle:{color:'#5ee2bf'},areaStyle:{color:'#5ee2bf',opacity:.1},data:[]},{name:'最大烟气 %',type:'line',yAxisIndex:1,showSymbol:false,lineStyle:{color:'#ffad66'},data:[]}]});observer=new ResizeObserver(resize);observer.observe(host.value);resize();frame=requestAnimationFrame(animate);
});
onBeforeUnmount(()=>{cancelAnimationFrame(frame);observer?.disconnect();renderer?.domElement.removeEventListener('click',clickScene);controls?.dispose();chart?.dispose();scene?.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});renderer?.dispose();});
</script>
<template>
 <div class="app">
  <header><div><span class="eyebrow">CAMPUS EMERGENCY · DIGITAL TWIN</span><h1>校园火灾应急疏散指挥中心</h1></div><div class="status"><i :class="{active:sim.running}"></i>{{sim.finished?'演练已结束':sim.running?'仿真运行中':'待机 / 暂停'}}<strong>{{clock(sim.time)}}</strong></div></header>
  <nav><div class="tabs"><span class="tab active">应急演练</span><span class="tag">教学楼 · 三层示范平面</span><span class="tag">确定性种子 {{sim.seed}}</span></div><div class="actions"><button @click="start" :disabled="sim.finished">{{sim.running?'暂停演练':sim.fireActive?'继续演练':'启动火灾演练'}}</button><button class="secondary" @click="reset">重置</button><button class="secondary" @click="finish" :disabled="sim.finished">结束评分</button><button class="secondary" @click="exportData">导出记录</button></div></nav>
  <main>
   <aside><section><h2>火情态势 <span>LIVE</span></h2><div class="risk-title">{{sim.fireActive?'火灾响应已启动':'场景就绪'}}<small>轻量拓扑扩散模型</small></div><div class="metric-grid"><div><b>{{Math.round(Math.max(...Object.values(sim.states).map(s=>s.smoke))*100)}}<em>%</em></b><label>最大烟气指数</label></div><div><b>{{Math.max(...Object.values(sim.states).map(s=>s.temperature)).toFixed(1)}}<em>℃</em></b><label>最高温度</label></div></div><p class="hint">启动前点击教室可选择火源。颜色表示综合风险，橙色锥体表示火源强度。</p></section>
   <section><h2>区域监测 <span>{{selected}}</span></h2><select v-model="selected"><option v-for="n in nodes" :value="n.id">{{n.name}}</option></select><div class="rows"><div><span>风险指数</span><b>{{selectedState.risk.toFixed(2)}}</b></div><div><span>烟气指数</span><b>{{selectedState.smoke.toFixed(2)}}</b></div><div><span>区域温度</span><b>{{selectedState.temperature.toFixed(1)}} ℃</b></div><div><span>当前人员</span><b>{{selectedState.occupancy}} 人</b></div><div><span>拥堵指数</span><b>{{selectedState.congestion.toFixed(2)}}</b></div></div></section>
   <section><h2>通道控制</h2><button class="exit" v-for="id in ['exitW','exitE']" @click="toggleExit(sim,id)">{{id==='exitW'?'西侧':'东侧'}}出口 <span :class="{danger:sim.blocked.includes(id)}">{{sim.blocked.includes(id)?'已封闭 · 点击恢复':'开放 · 点击封闭'}}</span></button><p class="hint">封闭出口可触发改道；同时封闭两个出口会进入无安全路径状态。</p></section></aside>
   <div class="center"><div class="scene-bar"><span>教学楼 3F / 疏散态势</span><select v-model="view" @change="setView"><option value="overview">斜视全景</option><option value="top">平面俯视</option></select></div><div ref="host" class="viewport"></div><div class="legend"><span><i class="safe"></i>低风险</span><span><i class="warn"></i>高风险</span><span><i class="person"></i>疏散人员</span><span>拖动旋转 · 滚轮缩放 · 点击区域</span></div><div class="chart"><h2>疏散与烟气趋势</h2><div ref="chartHost" class="chart-host"></div></div></div>
   <aside><section><h2>疏散进度 <span>{{(evacuated/36*100).toFixed(0)}}%</span></h2><div class="big-number">{{evacuated}}<small>/ 36 人</small></div><div class="progress"><i :style="{width:evacuated/36*100+'%'}"></i></div><div class="metric-grid"><div><b>{{36-evacuated}}</b><label>尚未疏散</label></div><div><b class="red">{{trapped}}</b><label>暂无安全路径</label></div></div><div class="rows"><div><span>平均完成时间</span><b>{{result.time.toFixed(1)}} s</b></div><div><span>平均等待时间</span><b>{{result.wait.toFixed(1)}} s</b></div><div><span>路径改道次数</span><b>{{sim.agents.reduce((sum,a)=>sum+a.replans,0)}}</b></div></div></section>
   <section><h2>{{sim.finished?'演练评分':'实时评分预览'}} <span>RULES v1</span></h2><div class="score">{{result.total}}<small>/100</small></div><div class="score-row" v-for="(value,key) in result.dimensions"><span>{{ {completion:'完成率 · 40%',efficiency:'时间效率 · 20%',avoidance:'风险规避 · 25%',flow:'通行效率 · 15%'}[key] }}</span><b>{{value.toFixed(0)}}</b></div><p class="hint">规则评分基于完成率、时间、累积风险暴露及等待。当前版本模拟虚拟人员，尚未包含真实用户行为与协同评价。</p></section>
   <section class="review"><h2>复盘建议</h2><p>{{trapped?'存在无安全路径人员，请检查出口封闭与通道危险状态。':result.wait>15?'通道排队明显，建议对比不同出口导流策略。':'保持双出口可用，观察人员分流与风险变化。'}}</p><small>结果用于教学原型展示；火烟参数尚未依据真实建筑实验校准。</small></section></aside>
  </main>
  <footer><h2>演练事件流 <span>{{sim.events.length}} 条完整记录</span></h2><div class="events"><div v-for="(event,i) in logs" :key="sim.events.length-i"><time>{{clock(event.time)}}</time><span class="event-type">{{event.type}}</span><span>{{event.message}}</span></div><p v-if="!logs.length">等待演练启动。完整事件与状态可导出为 JSON。</p></div></footer>
 </div>
</template>
