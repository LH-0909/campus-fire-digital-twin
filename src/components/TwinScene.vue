<script setup>
import {onMounted,onBeforeUnmount,ref,watch,computed} from 'vue';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {spaces,spaceById} from '../twin/building.js';
import {findRoute,nearestDoor,nearbyStair} from '../twin/state.js';
import {createStudentController} from '../twin/student-controller.js';
import {layerVisibility,visiblePeople,routeOptions,smokeSummary} from '../twin/layers.js';
import {edgePolyline} from '../twin/navigation.js';
import {applyArchitecturalMaterials,disposeArchitecturalTextures} from '../twin/materials.js';
import {assetUrl} from '../urls.js';
import {createCampus} from '../twin/campus.js';
import {createCrowd} from '../twin/crowd.js';
import {createFireSmoke} from '../twin/effects.js';
const props=defineProps({twin:Object,floor:Number,mode:String,layer:String,replay:Object,selectedSpace:String,studentView:{type:String,default:'third'},showGuide:{type:Boolean,default:true},modelUrl:{type:String,default:()=>assetUrl('/models/dormitory.glb')}});
const emit=defineEmits(['select','loaded','error','action','notice','update:studentView','update:showGuide','focus-floor']);const host=ref(),loading=ref(true),error=ref('');
let renderer,composer,ao,scene,camera,controls,model,frame,observer,environment,skyHDR,pmrem,ambient,sun,crowd,effects,heatGroup,fireLabel,campus,guidanceDepth;
let last=0,token=0,routeKey='',ready=false,visibilityKey='',destroyed=false;
const levels=[],labels=[],plaques=[],picking=[],interiorLights=[];
const routes=ref([]),pickedExit=ref(''),personId=ref(''),following=ref(false),peopleList=ref([]),diagnostic=ref({count:0,peak:'',value:0}),context=ref({door:null,stair:null}),cameraDistance=ref(2.7);
const trackedPerson=computed(()=>peopleList.value.find(a=>a.id===Number(personId.value)));
let studentController,markers,markerIds=[],lastDiagnostic=-Infinity,lastRouteRender=-Infinity,focusRing,trail,trailPoints=[],lastTrailTime=-1;
const dummy=new THREE.Object3D(),markerColor=new THREE.Color();
const raycaster=new THREE.Raycaster();let pathObjects=[];
const doors=new Map();
function dispose(object,disposeTextures=true){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 object?.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>materials.add(m));});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(disposeTextures)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();});textures.forEach(t=>t.dispose());
}
function sign(text,position,color='#5fffc2',size=3.6){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle='rgba(2,29,35,.88)';c.fillRect(0,0,512,128);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(3,3,506,122);c.fillStyle=color;c.font='bold 36px Microsoft YaHei';c.textAlign='center';c.fillText(text,256,76);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.position.copy(position);sprite.scale.set(size,size/4,1);scene.add(sprite);labels.push(sprite);return sprite;
}
function semantic(mesh,key){let n=mesh;while(n){if(n.userData[key]!==undefined)return n.userData[key];n=n.parent;}return null;}
function loadModel(url){
 const current=++token;loading.value=true;error.value='';ready=false;
 new GLTFLoader().load(url,gltf=>{
  if(current!==token){dispose(gltf.scene);return;}
  if(model){scene.remove(model);dispose(model);}levels.length=0;doors.clear();
  gltf.scene.updateMatrixWorld(true);const buckets=new Map();
  gltf.scene.traverse(n=>{if(!n.isMesh)return;const floor=semantic(n,'floor')||0,section=semantic(n,'section')||'structure',spaceId=semantic(n,'spaceId'),inspect=spaceId===props.twin.fireSource&&['corridor-wall','room-partition'].includes(section);
   const movingDoor=['door','doorPanel','doorHandle','doorHinge'].includes(n.userData.kind)?spaceId:null;
   const key=`${floor}:${section}:${movingDoor||''}:${inspect?'source':''}:${n.material.uuid}`;
   if(movingDoor&&!doors.has(movingDoor))doors.set(movingDoor,{angle:0,group:new THREE.Group()});
   if(movingDoor&&n.userData.kind==='door')doors.get(movingDoor).angle=n.rotation.y;
   if(!buckets.has(key))buckets.set(key,{floor,section,movingDoor,inspect,material:n.material,geometries:[]});
   buckets.get(key).geometries.push(n.geometry.clone().applyMatrix4(n.matrixWorld));
  });
  const foundFloors=new Set([...buckets.values()].map(b=>b.floor));
  if(![1,2,3,4,5,6].every(f=>foundFloors.has(f))){dispose(gltf.scene);error.value='模型缺少 floor=1…6 楼层语义，请先绑定建筑空间';loading.value=false;emit('error',error.value);return;}
  model=new THREE.Group();model.name='Dormitory architectural mesh';
  for(const b of buckets.values()){
   const geometry=mergeGeometries(b.geometries,false);b.geometries.forEach(g=>g.dispose());const material=b.material.clone();applyArchitecturalMaterials(material);
   const mesh=new THREE.Mesh(geometry,material);mesh.userData={floor:b.floor,section:b.section,inspect:b.inspect,spaceId:b.movingDoor,kind:b.movingDoor?'door':null};mesh.castShadow=true;mesh.receiveShadow=true;
   if(b.movingDoor){const r=spaceById[b.movingDoor],door=doors.get(b.movingDoor);geometry.translate(-(r.x-.59),0,-r.side*1.2);door.group.position.set(r.x-.59,0,r.side*1.2);door.group.add(mesh);}else model.add(mesh);
   levels.push(mesh);
  }
  doors.forEach(door=>model.add(door.group));dispose(gltf.scene,false);scene.add(model);visibilityKey='';setView();loading.value=false;ready=true;emit('loaded',{semantic:true});
 },undefined,()=>{if(current!==token)return;loading.value=false;error.value='建筑模型加载失败，请检查GLB文件';emit('error',error.value);});
}
function setView(){
 if(!camera)return;controls.enabled=props.mode!=='student';const y=(props.floor-1)*3.3;
 camera.near=props.mode==='student'?.07:.2;camera.fov=props.mode==='student'?68:39;camera.updateProjectionMatrix();
 if(props.mode!=='student'){
  if(props.mode==='floor'){camera.position.set(29,y+30,36);controls.target.set(0,y+.4,0);}
  else if(props.mode==='top'){camera.position.set(0,y+59,.01);controls.target.set(0,y,0);}
  else if(props.mode==='exterior'){camera.position.set(41,27,-43);controls.target.set(0,9,0);}
  else {camera.position.set(39,27,43);controls.target.set(0,8,0);}
  controls.update();
 }
 visibilityKey='';updateVisibility();routeKey='';
}
function updateVisibility(){
 const activeFloor=props.mode==='student'?props.twin.student.floor:props.floor,key=[props.mode,activeFloor,props.twin.student.escaped].join(':');if(key===visibilityKey)return;visibilityKey=key;
 const cut=props.mode==='floor'||props.mode==='top',overview=props.mode==='building';
 const horizontal=new THREE.Plane(new THREE.Vector3(0,-1,0),(activeFloor-1)*3.3+1.3),section=new THREE.Plane(new THREE.Vector3(0,0,-1),1.04);
 levels.forEach(mesh=>{
  const {floor:f,section:part}=mesh.userData;
  mesh.visible=props.mode==='student'?f>=activeFloor-1&&f<=activeFloor+1:overview?f<=6:props.mode==='exterior'?true:f<=activeFloor;
  if(overview&&['front-facade','balcony','ceiling'].includes(part))mesh.visible=false;
  if(props.mode==='student'&&f===activeFloor+1)mesh.visible=['floor','ceiling'].includes(part);
  if(props.mode==='student'&&f===activeFloor-1)mesh.visible=['stairs','stair-envelope','floor','ceiling'].includes(part);
  const planes=cut?[horizontal]:overview?[section]:[];
  if(overview&&mesh.userData.inspect)planes.push(new THREE.Plane(new THREE.Vector3(0,-1,0),(f-1)*3.3+1.1));
  if(overview&&part==='stair-envelope')planes.push(new THREE.Plane(new THREE.Vector3(-1,0,0),24.0));
  mesh.material.clippingPlanes=planes;mesh.material.clipShadows=true;
  if(mesh.material.name!=='glass'){mesh.material.opacity=1;mesh.material.transparent=false;}
 });
 ao.normalMaterial.clippingPlanes=cut?[horizontal]:overview?[section]:[];ao.normalMaterial.needsUpdate=true;ao.blendIntensity=props.mode==='student'?.85:.65;
 labels.forEach(l=>l.visible=props.mode!=='student');
 plaques.forEach(m=>{const f=m.userData.floor;m.visible=(cut&&f===activeFloor)||(props.mode==='student'&&f===activeFloor);m.position.set(m.userData.x,(f-1)*3.3+(cut?.13:1.8),cut?m.userData.z:m.userData.side*1.08);m.rotation.set(cut?-Math.PI/2:0,cut?0:m.userData.side===1?Math.PI:0,0);});
 campus.visible=props.mode!=='student'||props.twin.student.escaped;ambient.intensity=props.mode==='student'?.8:.65;sun.intensity=props.mode==='student'?1.1:2.3;
 interiorLights.forEach((light,i)=>{if(props.mode==='student'){light.position.set(-17.5+i*7,(activeFloor-1)*3.3+2.91,0);light.intensity=24;light.distance=14;}else{light.position.set(0,i*3.3+2.88,0);light.intensity=120;light.distance=34;}});
 renderer.toneMappingExposure=props.mode==='student'?1.12:1.02;
}
function createAnnotations(){
 heatGroup=new THREE.Group();heatGroup.renderOrder=2;scene.add(heatGroup);
 for(const n of spaces.filter(n=>n.kind==='corridor'||n.kind==='room')){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(n.kind==='room'?3.9:4.1,n.kind==='room'?6.4:2.3),new THREE.MeshBasicMaterial({color:0x22ffbc,transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(n.x,n.y+.065,n.z);m.userData={id:n.id,floor:n.floor};heatGroup.add(m);
 }
 for(const n of spaces.filter(n=>n.kind==='room')){const m=new THREE.Mesh(new THREE.PlaneGeometry(4.1,6.7),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(n.x,n.y+.1,n.z);m.userData=n;scene.add(m);picking.push(m);}
 for(const n of spaces.filter(n=>n.kind==='exit'))sign(`${n.name} · 安全区`,new THREE.Vector3(n.x,1.8,n.z),'#5fffc2',4.5);
 fireLabel=sign('302宿舍 · 起火点',new THREE.Vector3(-14.7,9,-4.6),'#ff655e',5.3);
 for(const r of spaces.filter(n=>n.kind==='room')){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#383f42';ctx.fillRect(0,0,128,64);ctx.fillStyle='#e9edf0';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(String(r.number),64,46);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.46,.23),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));plaque.userData={floor:r.floor,x:r.x-.85,z:r.z,side:r.side};scene.add(plaque);plaques.push(plaque);
 }
}
function clearPaths(){pathObjects.forEach(o=>{scene.remove(o);dispose(o);});pathObjects=[];routeKey='';}
function renderPath(twin,now){
 const student=props.mode==='student',policy=layerVisibility(props.layer,student);
 if(!policy.routes||props.mode==='exterior'){if(pathObjects.length)clearPaths();return;}
 const origin=student?twin.student.node:props.selectedSpace||`F${props.floor}-C1`;
 const basis=[origin,props.mode,props.floor,props.layer,twin.blocked.join(','),pickedExit.value].join(':');
 if(now-lastRouteRender<800&&routeKey.startsWith(basis+'|'))return;
 lastRouteRender=now;
 let paths=[];
 if(student){const p=findRoute(origin,{...props.twin,fields:twin.fields,blocked:twin.blocked});if(p)paths=[{path:p,color:0x44eaae}];}
 else {
  routes.value=routeOptions(origin,{...props.twin,fields:twin.fields,blocked:twin.blocked});
  const recommended=routes.value.find(r=>r.recommended&&r.path),chosen=routes.value.find(r=>r.id===pickedExit.value&&r.path);
  if(recommended)paths.push({path:recommended.path,color:0x44eaae});
  if(chosen&&chosen.id!==recommended?.id)paths.push({path:chosen.path,color:0x44b9ff});
  if(pickedExit.value&&!chosen)pickedExit.value='';
 }
 const key=basis+'|'+JSON.stringify(paths);if(key===routeKey)return;clearPaths();routeKey=key;
 for(const {path,color} of paths){
  const group=new THREE.Group();group.renderOrder=20;scene.add(group);pathObjects.push(group);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.94,depthWrite:false,depthTest:student,side:THREE.DoubleSide});
  const linePoints=[];
  for(let i=1;i<path.length;i++){
   const a=spaceById[path[i-1]],b=spaceById[path[i]];
   if(student&&a.floor!==twin.student.floor)continue;
   const points=edgePolyline(a,b);
   for(const p of points)linePoints.push(new THREE.Vector3(p.x,p.y+.14,p.z));
   for(let segment=1;segment<points.length;segment++){
    const start=points[segment-1],end=points[segment],dx=end.x-start.x,dz=end.z-start.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    if(student&&Math.abs(end.y-twin.student.y)>1.8)continue;
    for(let d=.3;d<len;d+=1.35){if(student&&Math.hypot(start.x+dx*d/len-twin.student.x,start.z+dz*d/len-twin.student.z)>11)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.24,0,-.25,0,0,.05,.24,0,-.25,.24,0,-.25,0,0,.26,-.24,0,-.25],3));geometry.computeVertexNormals();const arrow=new THREE.Mesh(geometry,mat);arrow.rotation.y=angle;arrow.position.set(start.x+dx*d/len,start.y+(end.y-start.y)*d/len+.14,start.z+dz*d/len);group.add(arrow);}
   }
  }
  if(linePoints.length>1){group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints),new THREE.LineBasicMaterial({color,depthTest:student})));}

  if(!student&&linePoints.length>1){const curve=new THREE.CurvePath();for(let i=1;i<linePoints.length;i++)if(linePoints[i].distanceTo(linePoints[i-1])>.001)curve.add(new THREE.LineCurve3(linePoints[i-1],linePoints[i]));const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,linePoints.length*3),.055,5,false),mat);group.add(tube);}
 }
}
function updatePeople(twin,now){
 const active=props.layer==='people'&&props.mode!=='student',people=visiblePeople(twin,props.mode,props.floor);
 markers.visible=active;markers.count=active?Math.min(1024,people.length):0;markerIds=[];
 if(active){
  people.slice(0,1024).forEach((a,i)=>{dummy.position.set(a.x,a.y+1.95,a.z);dummy.scale.setScalar(a.id===Number(personId.value)?1.7:1);dummy.updateMatrix();markers.setMatrixAt(i,dummy.matrix);markers.setColorAt(i,markerColor.setHex(a.trapped?0xff6262:twin.fields[a.node]?.risk>.25?0xffbd51:0x39d8ff));markerIds.push(a.id);});markers.instanceMatrix.needsUpdate=true;if(markers.instanceColor)markers.instanceColor.needsUpdate=true;
 }
 const a=twin.agents.find(a=>a.id===Number(personId.value)&&!a.escaped);
 focusRing.visible=active&&!!a;trail.visible=active&&!!a;
 if(a&&active){
  if(following.value&&props.mode==='floor'&&(props.floor!==a.floor||props.selectedSpace!==a.node))emit('focus-floor',a.floor,a.node);
  focusRing.position.set(a.x,a.y+.1,a.z);
  if(lastTrailTime!==twin.time){lastTrailTime=twin.time;trailPoints.push(new THREE.Vector3(a.x,a.y+.13,a.z));if(trailPoints.length>80)trailPoints.shift();trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry().setFromPoints(trailPoints);}
  if(following.value){const next=new THREE.Vector3(a.x,a.y+.8,a.z),delta=next.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(next);}
 }else if(following.value){following.value=false;}
 if(now-lastDiagnostic>500){lastDiagnostic=now;peopleList.value=twin.agents.map(a=>({id:a.id,floor:a.floor,node:a.node,escaped:a.escaped,trapped:a.trapped,x:a.x,z:a.z}));diagnostic.value=props.layer==='smoke'?smokeSummary(twin,props.floor):{count:people.length};context.value={door:nearestDoor(props.twin),stair:nearbyStair(props.twin)};}
}
function focusPerson(){
 const a=props.twin.agents.find(a=>a.id===Number(personId.value)&&!a.escaped);if(!a)return;
 emit('focus-floor',a.floor,a.node);trailPoints=[];lastTrailTime=-1;controls.target.set(a.x,a.y+.8,a.z);camera.position.set(a.x+16,a.y+19,a.z+22);controls.update();following.value=true;
}
function updateStudentCamera(dt){
 const st=props.twin.student,third=props.studentView==='third',pitch=studentController.pitch;
 const forward=new THREE.Vector3(Math.cos(st.heading)*Math.cos(pitch),Math.sin(pitch),Math.sin(st.heading)*Math.cos(pitch));
 const target=new THREE.Vector3(st.x,st.y+(st.crouching?1.02:1.48),st.z);
 if(third){
  const desired=target.clone().addScaledVector(forward,-studentController.distance).add(new THREE.Vector3(0,.38,0));
  const delta=desired.clone().sub(target),length=delta.length();
  raycaster.set(target,delta.normalize());raycaster.near=.02;raycaster.far=length;
  const hit=raycaster.intersectObjects(levels.filter(m=>m.visible&&m.material.name!=='glass'),false)[0];
  if(hit)desired.copy(target).addScaledVector(delta,Math.max(.12,hit.distance-.16));
  camera.position.copy(desired);camera.lookAt(target.clone().addScaledVector(forward,3));cameraDistance.value=camera.position.distanceTo(target);
 }else {camera.position.set(st.x,st.y+(st.crouching?1.05:1.7),st.z);camera.lookAt(camera.position.clone().add(forward));cameraDistance.value=0;}
}
function draw(now,dt){
 if(props.mode==='student'){studentController.update(dt);updateStudentCamera(dt);}
 const policy=layerVisibility(props.layer,props.mode==='student');
 // Diagnostic colors and ground guidance remain legible without ambient-occlusion blending.
 ao.enabled=!policy.routes&&!policy.field;
 const twin=props.replay||props.twin,source=spaceById[twin.fireSource||props.twin.fireSource],field=twin.fields[source.id],fireVisible=props.mode==='building'||props.mode==='exterior'||source.floor===props.floor;
 fireLabel.visible=policy.fire&&fireVisible&&field.fire>.02&&props.mode!=='student';fireLabel.position.set(source.x,source.y+3,source.z);
 if(fireLabel.userData.source!==source.id){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='rgba(45,12,24,.9)';c.fillRect(0,0,512,128);c.strokeStyle='#ff655e';c.lineWidth=3;c.strokeRect(3,3,506,122);c.fillStyle='#ffb0a0';c.font='bold 36px Microsoft YaHei';c.textAlign='center';c.fillText(`${source.name} · 起火点`,256,76);fireLabel.material.map.dispose();const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;fireLabel.material.map=map;fireLabel.userData.source=source.id;}
 effects.update({...twin,fireSource:source.id},{mode:props.mode,floor:props.mode==='student'?twin.student.floor:props.floor,layer:props.layer,camera});
 effects.objects[0].visible=effects.objects[0].visible&&policy.fire;effects.objects[1].visible=effects.objects[1].visible&&policy.smoke;
 doors.forEach((door,id)=>{const angle=twin.closedDoors?.includes(id)?-door.angle:0;door.group.rotation.y+= (angle-door.group.rotation.y)*Math.min(1,dt*7);});
 heatGroup.visible=!!policy.field;heatGroup.children.forEach(m=>{const f=twin.fields[m.userData.id];m.visible=m.userData.floor===props.floor;const value=policy.field==='smoke'?f.smoke:Math.min(1,f.risk+f.density*.35);m.material.color.setHSL((1-value)*.55,.95,.5);m.material.opacity=policy.field==='smoke'?.15+value*.65:.36;});
 crowd.group.visible=policy.people;crowd.update(twin,{mode:props.mode,floor:props.floor,layer:props.layer,now,camera,includePlayer:props.mode==='student'&&props.studentView==='third'&&cameraDistance.value>.55,walkTime:studentController.walkTime});renderPath(twin,now);updatePeople(twin,now);
 if(props.mode==='student'){
  const local=twin.fields[props.twin.student.node];scene.fog=new THREE.FogExp2(0x747b7c,.008+Math.min(.09,local.smoke*.12));updateVisibility();
 }else scene.fog=new THREE.FogExp2(0x101e2b,.0045);
}
function click(e){
 if(props.mode==='student')return;
 const r=host.value.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
 if(props.layer==='people'){const hit=raycaster.intersectObject(markers)[0];if(hit){personId.value=String(markerIds[hit.instanceId]);focusPerson();}return;}
 const hit=raycaster.intersectObjects(picking).find(h=>h.object.userData.floor===props.floor);if(hit)emit('select',hit.object.userData.id);
}
function hold(e,key){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);studentController?.setKey(key,true);}
function release(key){studentController?.setKey(key,false);}
function renderFrame(dt){
 const studentGuidance=props.mode==='student'&&pathObjects.length>0;
 if(!studentGuidance){composer.render(dt);return;}
 // Postprocessing swaps targets with different depth attachments. Rebuild the
 // screen depth before guidance so floor arrows respect architecture and people.
 pathObjects.forEach(o=>o.visible=false);composer.render(dt);pathObjects.forEach(o=>o.visible=true);
 const overlay=[heatGroup,...effects.objects,...labels,...pathObjects,...picking,markers,focusRing,trail];
 const flags=overlay.map(o=>o.visible),background=scene.background,autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate;
 renderer.setRenderTarget(null);renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.clearDepth();scene.background=null;
 overlay.forEach(o=>o.visible=false);scene.overrideMaterial=guidanceDepth;renderer.render(scene,camera);scene.overrideMaterial=null;
 overlay.forEach((o,i)=>o.visible=flags[i]);
 const children=scene.children.map(o=>[o,o.visible]);children.forEach(([o])=>o.visible=pathObjects.includes(o));
 renderer.render(scene,camera);children.forEach(([o,visible])=>o.visible=visible);
 scene.background=background;renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;
}
function resize(){if(!renderer)return;const {clientWidth:w,clientHeight:h}=host.value;renderer.setSize(w,h);composer?.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
onMounted(()=>{
 try{
  scene=new THREE.Scene();scene.background=new THREE.Color(0x101e2b);camera=new THREE.PerspectiveCamera(39,1,.2,300);
  guidanceDepth=new THREE.MeshBasicMaterial({colorWrite:false,depthTest:true,depthWrite:true,side:THREE.DoubleSide});
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.localClippingEnabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.value.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','六层宿舍数字孪生三维场景');
  ambient=new THREE.HemisphereLight(0xd3e1ef,0x54514a,1.15);scene.add(ambient);
  sun=new THREE.DirectionalLight(0xffe2b8,2.2);sun.position.set(-34,45,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.near=.5;sun.shadow.camera.far=140;sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xafcce8,.7);fill.position.set(40,18,-35);scene.add(fill);
  for(let i=0;i<6;i++){const light=new THREE.PointLight(0xfff0d8,24,14,2);scene.add(light);interiorLights.push(light);}
  pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.4;room.dispose();
  new RGBELoader().load(assetUrl('/assets/materials/campus-dusk-1k.hdr'),hdr=>{if(destroyed){hdr.dispose();return;}hdr.mapping=THREE.EquirectangularReflectionMapping;skyHDR=hdr;const next=pmrem.fromEquirectangular(hdr);environment.dispose();environment=next;scene.environment=next.texture;scene.environmentIntensity=.7;scene.background=hdr;scene.backgroundIntensity=.35;scene.backgroundBlurriness=.06;},undefined,()=>{});
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=10;controls.maxDistance=115;controls.addEventListener('start',()=>{following.value=false;});
  campus=createCampus(scene);crowd=createCrowd(scene);effects=createFireSmoke(scene);createAnnotations();
  markers=new THREE.InstancedMesh(new THREE.SphereGeometry(.15,8,6),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}),1024);markers.frustumCulled=false;markers.renderOrder=8;markers.count=0;scene.add(markers);
  focusRing=new THREE.Mesh(new THREE.RingGeometry(.42,.52,32),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,side:THREE.DoubleSide}));focusRing.rotation.x=-Math.PI/2;focusRing.renderOrder=8;scene.add(focusRing);
  trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x55dfff,depthTest:false,transparent:true,opacity:.8}));trail.renderOrder=7;scene.add(trail);
  studentController=createStudentController(renderer.domElement,{getTwin:()=>props.twin,isActive:()=>props.mode==='student',onAction:type=>emit('action',type),onView:()=>emit('update:studentView',props.studentView==='third'?'first':'third'),onGuide:()=>emit('update:showGuide',!props.showGuide),onNotice:message=>emit('notice',message)});
  const target=new THREE.WebGLRenderTarget(512,512,{type:THREE.HalfFloatType,samples:4});composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.55,thickness:.3,distanceFallOff:1,scale:1,samples:8,screenSpaceRadius:false},{radius:3,samples:8});ao.blendIntensity=.65;
  const renderAO=ao.render.bind(ao);ao.render=(...args)=>{const omitted=[heatGroup,...effects.objects,...labels,...pathObjects,...picking,markers,focusRing,trail],flags=omitted.map(o=>o.visible);omitted.forEach(o=>o.visible=false);try{renderAO(...args);}finally{omitted.forEach((o,i)=>o.visible=flags[i]);}};
  composer.addPass(ao);composer.addPass(new OutputPass());resize();observer=new ResizeObserver(resize);observer.observe(host.value);loadModel(props.modelUrl);
  renderer.domElement.addEventListener('click',click);
  const animate=now=>{frame=requestAnimationFrame(animate);const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(ready)draw(now,dt);if(controls.enabled)controls.update();renderFrame(dt);};frame=requestAnimationFrame(animate);
 }catch(e){error.value='当前浏览器无法初始化WebGL：'+e.message;loading.value=false;emit('error',error.value);}
});
watch(()=>[props.mode,props.floor],setView);watch(()=>props.layer,()=>{lastDiagnostic=-Infinity;lastRouteRender=-Infinity;following.value=false;});watch(()=>props.studentView,()=>{studentController?.clear();});watch(()=>props.twin.time,t=>{if(t===0){personId.value='';following.value=false;trailPoints=[];lastRouteRender=-Infinity;}});watch(()=>props.modelUrl,loadModel);
onBeforeUnmount(()=>{destroyed=true;token++;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();studentController?.dispose();crowd?.dispose();effects?.dispose();dispose(scene);disposeArchitecturalTextures();guidanceDepth?.dispose();ao?.dispose();composer?.dispose();environment?.dispose();skyHDR?.dispose();pmrem?.dispose();renderer?.dispose();});
</script>
<template>
 <div ref="host" class="twin-viewport">
  <div v-if="loading" class="scene-message">正在加载宿舍建筑模型…</div><div v-if="error" class="scene-message scene-error">{{error}}</div>
  <div v-if="!loading&&mode!=='student'&&['smoke','people','routes'].includes(layer)" class="layer-inspector" @pointerdown.stop @wheel.stop>
   <template v-if="layer==='smoke'"><h3>烟气分布 · {{floor}}F</h3><div class="smoke-scale"/><div class="scale-labels"><span>0 无烟</span><span>0.5</span><span>1 高浓度</span></div><p>峰值 {{diagnostic.value?.toFixed(3)}} · {{diagnostic.peak}}</p><small>{{diagnostic.count?`${diagnostic.count} 个空间已检测到烟气`:'当前无烟气，启动演练后观察扩散'}}</small><small>软件浓度指数 · 随演练状态更新</small></template>
   <template v-else-if="layer==='people'"><h3>人员定位 <b>{{diagnostic.count}} 人</b></h3><div class="person-legend"><span>● 正常</span><span>● 风险</span><span>● 无路径</span></div><select v-model="personId" aria-label="定位人员" @change="focusPerson"><option value="">点击标记或选择人员</option><option v-for="a in peopleList.filter(a=>!a.escaped)" :key="a.id" :value="String(a.id)">#{{a.id}} · {{a.floor}}F · {{a.trapped?'暂无路径':spaceById[a.node]?.name}}</option></select><template v-if="trackedPerson"><p>#{{trackedPerson.id}} · {{trackedPerson.floor}}F · {{trackedPerson.escaped?'已撤离':trackedPerson.trapped?'暂无路径':twin.running?'正在疏散':twin.time?'演练已暂停':'待演练'}}</p><small>X {{trackedPerson.x.toFixed(1)}} / Z {{trackedPerson.z.toFixed(1)}} m</small><button v-if="!trackedPerson.escaped" @click="following=!following">{{following?'停止跟踪':'继续跟踪'}}</button></template><small v-else>亮点对应实际人员位置，可跟踪移动轨迹</small></template>
   <template v-else><h3>安全路线 · {{spaceById[selectedSpace]?.name||`${floor}F 走廊`}}</h3><small>绿色推荐 · 蓝色备选 · 含楼梯跨层路径</small><div class="route-options"><button v-for="r in routes" :key="r.id" :disabled="!r.path" :class="{recommended:r.recommended,chosen:r.id===pickedExit}" :aria-pressed="r.id===pickedExit" @click="pickedExit=r.id;lastRouteRender=-Infinity"><span>{{r.name}} {{r.recommended?'· 推荐':''}}</span><b>{{r.blocked?'已封闭':!r.path?'暂无路径':`${Math.round(r.length)} m`}}</b></button></div><small>{{routes.some(r=>r.path)?'点击出口比较路线，封闭出口后自动重算':'暂无安全通路，请检查风险与出口状态'}}</small></template>
  </div>
  <template v-if="mode==='student'&&!loading">
   <div class="student-view-controls" @pointerdown.stop><button :class="{active:studentView==='first'}" :aria-pressed="studentView==='first'" @click="emit('update:studentView','first')">第一人称</button><button :class="{active:studentView==='third'}" :aria-pressed="studentView==='third'" @click="emit('update:studentView','third')">第三人称</button><button :aria-pressed="showGuide" @click="emit('update:showGuide',!showGuide)">{{showGuide?'隐藏引导':'显示引导'}}</button></div>
   <div class="student-crosshair" v-if="studentView==='first'" aria-hidden="true">+</div>
   <div class="student-interaction" @pointerdown.stop><template v-if="twin.student.stair">正在{{twin.student.stair.toFloor>twin.student.stair.fromFloor?'上':'下'}}楼 · 前往 {{twin.student.stair.toFloor}}F</template><template v-else-if="context.stair"><span>{{context.stair.name}}</span><button :disabled="twin.student.floor===1" @click="studentController.interact(-1)">E 下楼</button><button :disabled="twin.student.floor===6" @click="studentController.interact(1)">上楼</button></template><template v-else-if="context.door"><span>{{context.door.name}}房门</span><button @click="emit('action','door')">E {{twin.closedDoors.includes(context.door.id)?'打开':'关闭'}}</button></template><template v-else>{{twin.student.obstructed?'前方有墙体或家具，请调整方向':'按住画面拖动环视 · V 切换视角'}}</template></div>
   <div class="student-movement-pad" @pointerdown.stop><button aria-label="持续前进" @pointerdown="hold($event,'w')" @pointerup="release('w')" @pointercancel="release('w')" @lostpointercapture="release('w')">↑</button><button aria-label="持续向左平移" @pointerdown="hold($event,'a')" @pointerup="release('a')" @pointercancel="release('a')" @lostpointercapture="release('a')">←</button><button aria-label="持续后退" @pointerdown="hold($event,'s')" @pointerup="release('s')" @pointercancel="release('s')" @lostpointercapture="release('s')">↓</button><button aria-label="持续向右平移" @pointerdown="hold($event,'d')" @pointerup="release('d')" @pointercancel="release('d')" @lostpointercapture="release('d')">→</button></div>
   <div v-if="!twin.time" class="exploration-note">自由探索 · 开始演练后计时与评分</div>
  </template>
 </div>
</template>
