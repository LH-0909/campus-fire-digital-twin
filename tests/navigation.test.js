import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {connections,spaceById} from '../src/twin/building.js';
import {navigationPoint,edgePolyline,polylineLength,samplePolyline} from '../src/twin/navigation.js';
import {createTwin,tick,moveStudent,snapshot,useStairs} from '../src/twin/state.js';
import {buildDormitory} from '../src/twin/model.js';

const xyz=p=>[p.x,p.y,p.z];
test('all physical graph routes are symmetric with exact semantic landing endpoints',()=>{
 for(const e of connections){
  const forward=edgePolyline(e.a,e.b),backward=edgePolyline(e.b,e.a);
  assert.deepEqual(forward,[...backward].reverse());
  assert.deepEqual(xyz(samplePolyline(forward,0)),xyz(navigationPoint(e.a)));
  assert.deepEqual(xyz(samplePolyline(forward,1)),xyz(navigationPoint(e.b)));
  assert.ok(Math.abs(e.length-polylineLength(forward))<1e-8);
  for(let i=0;i<=20;i++)assert.ok(Object.values(samplePolyline(forward,i/20)).every(Number.isFinite));
 }
});
test('stair descent follows two flights and the half landing, without teleporting',()=>{
 const points=edgePolyline('F3-SW','F2-SW');
 assert.ok(polylineLength(points)>11);
 assert.ok(points.some(p=>p.x<-23)&&points.some(p=>p.x>-23));
 assert.ok(points.some(p=>Math.abs(p.y-4.95)<1e-8));
 const s=createTwin({count:1}),a=s.agents[0],start=navigationPoint('F3-SW');
 Object.assign(a,start,{node:'F3-SW',path:['F3-SW','F2-SW','F1-SW','EXIT-W'],edge:null,progress:0});s.running=true;s.lastRoute=0;
 tick(s,.2);assert.ok(a.y>6.5);assert.ok(Math.hypot(a.x-start.x,a.y-start.y,a.z-start.z)<.3);
});
test('student descends continuously to the physical lower landing',()=>{
 const s=createTwin({count:1});s.running=true;Object.assign(s.student,navigationPoint('F3-SW'),{node:'F3-SW'});
 assert.equal(useStairs(s,-1),null);assert.ok(s.student.stair);
 let previous=xyz(s.student),samples=0;
 while(s.student.stair&&samples++<500){moveStudent(s,0,0,.05);const current=xyz(s.student);assert.ok(Math.hypot(...current.map((v,i)=>v-previous[i]))<.08);previous=current;}
 assert.ok(samples>150&&samples<500);assert.equal(s.student.floor,2);
 assert.deepEqual(xyz(s.student),xyz(navigationPoint('F2-SW')));
});
test('closed door blocks first-person room entry and snapshots preserve door/source state',()=>{
 const s=createTwin({count:1});s.running=true;s.closedDoors=['R302'];
 for(let i=0;i<50;i++)moveStudent(s,0,-1,.04);
 assert.ok(s.student.z>=-1.05);
 const shot=snapshot(s);s.closedDoors=[];s.fireSource='R303';
 assert.deepEqual(shot.closedDoors,['R302']);assert.equal(shot.fireSource,'R302');
});
test('physical evacuation centre lines clear solid architecture at torso height',()=>{
 const model=buildDormitory();model.updateMatrixWorld(true);
 const meshes=[];model.traverse(n=>{if(n.isMesh&&!['glass','fireGlass'].includes(n.material.name))meshes.push(n);});
 const ray=new THREE.Raycaster();
 for(const e of connections){const points=edgePolyline(e.a,e.b);
  for(let i=1;i<points.length;i++){
   const start=new THREE.Vector3(points[i-1].x,points[i-1].y+1.4,points[i-1].z),end=new THREE.Vector3(points[i].x,points[i].y+1.4,points[i].z),delta=end.sub(start),length=delta.length();
   ray.set(start,delta.normalize());ray.near=.025;ray.far=Math.max(.026,length-.025);
   assert.equal(ray.intersectObjects(meshes,false).length,0,`${e.a} → ${e.b}, segment ${i}`);
  }
 }
 const geos=new Set(),mats=new Set();model.traverse(n=>{if(n.geometry)geos.add(n.geometry);if(n.material)mats.add(n.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
});
