import * as THREE from 'three';
import {buildDormitory} from './model.js';
import {rooms} from './building.js';

let cache;
// Reuse the architectural source for collision, rather than inventing narrow
// walking strips. The grid limits each query to nearby walls and furnishings.
function index(){
 if(cache)return cache;
 const root=buildDormitory(),grid=new Map(),doors=[];root.updateMatrixWorld(true);
 const box=new THREE.Box3();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let floor=mesh.userData.floor,parent=mesh.parent;while(!floor&&parent){floor=parent.userData.floor;parent=parent.parent;}
  const {kind,section}=mesh.userData;
  if(kind==='door'){doors.push({floor,spaceId:mesh.userData.spaceId,x:mesh.position.x,z:mesh.position.z,y:mesh.position.y,angle:mesh.rotation.y,w:.96,d:.056,h:2.18});return;}
  if(!['wall','column','furnishing','fireSafetyCabinet','doorFrame'].includes(kind)&&section!=='balcony')return;
  if(['balconySlab','balconyFloor'].includes(kind))return;
  mesh.geometry.computeBoundingBox();box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  if(box.max.y-box.min.y<.06)return;
  const b={minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z};
  for(let x=Math.floor(b.minX/2);x<=Math.floor(b.maxX/2);x++)for(let z=Math.floor(b.minZ/2);z<=Math.floor(b.maxZ/2);z++){
   const key=`${floor}:${x}:${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);
  }
 });
 const geometries=new Set(),materials=new Set();root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 cache={grid,doors};return cache;
}
function circleBox(x,z,r,b){const dx=x-Math.max(b.minX,Math.min(x,b.maxX)),dz=z-Math.max(b.minZ,Math.min(z,b.maxZ));return dx*dx+dz*dz<r*r;}
export function canOccupyStudent(s,x,z){
 const st=s.student,{grid,doors}=index(),radius=.18,height=st.crouching?1.08:1.68,near=new Set();
 for(let gx=Math.floor((x-radius)/2);gx<=Math.floor((x+radius)/2);gx++)for(let gz=Math.floor((z-radius)/2);gz<=Math.floor((z+radius)/2);gz++)for(const b of grid.get(`${st.floor}:${gx}:${gz}`)||[])near.add(b);
 for(const b of near)if(b.minY<st.y+height&&b.maxY>st.y+.12&&circleBox(x,z,radius,b))return false;
 for(const door of doors){
  if(door.floor!==st.floor)continue;
  const room=rooms.find(r=>r.id===door.spaceId),closed=s.closedDoors.includes(door.spaceId);
  const cx=closed?room.x-.11:door.x,cz=closed?room.side*1.2:door.z,angle=closed?0:door.angle;
  if(Math.hypot(x-cx,z-cz)>1)continue;
  const dx=x-cx,dz=z-cz,localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
  if(circleBox(localX,localZ,radius,{minX:-door.w/2,maxX:door.w/2,minZ:-door.d/2,maxZ:door.d/2}))return false;
 }
 return true;
}
