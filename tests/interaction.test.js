import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTwin,moveStudent,studentAction,useStairs,nearbyStair,nearestDoor,toggleExit,tick} from '../src/twin/state.js';
import {navigationPoint} from '../src/twin/navigation.js';
import {canOccupyStudent} from '../src/twin/collision.js';
import {movementIntent} from '../src/twin/student-controller.js';
import {layerVisibility,routeOptions,smokeSummary,visiblePeople} from '../src/twin/layers.js';
import {createCrowd} from '../src/twin/crowd.js';

test('diagnostic layers have distinct smoke, marker and route visibility',()=>{
 const smoke=layerVisibility('smoke'),people=layerVisibility('people'),routes=layerVisibility('routes');
 assert.equal(smoke.people,false);assert.equal(smoke.field,'smoke');assert.equal(smoke.routes,false);
 assert.equal(people.smoke,false);assert.equal(people.markers,true);assert.equal(people.routes,false);
 assert.equal(routes.smoke,false);assert.equal(routes.routes,true);assert.equal(routes.markers,false);
 assert.equal(layerVisibility('student-no-route',true).routes,false);
});
test('route comparison reaches each requested exit and removes blocked alternatives',()=>{
 const s=createTwin();const options=routeOptions('R302',s);
 assert.equal(options.length,4);assert.equal(options.filter(r=>r.recommended).length,1);
 for(const r of options){assert.equal(r.path.at(-1),r.id);assert.ok(r.length>30);}
 toggleExit(s,options.find(r=>r.recommended).id);
 const revised=routeOptions('R302',s);assert.equal(revised.filter(r=>r.recommended).length,1);
 assert.equal(revised.find(r=>r.blocked).path,null);
 s.blocked=options.map(r=>r.id);assert.ok(routeOptions('R302',s).every(r=>r.path===null));
});
test('smoke summary is zero before ignition and follows simulated or imported fields',()=>{
 const s=createTwin();assert.equal(smokeSummary(s,3).value,0);assert.equal(smokeSummary(s,3).count,0);
 s.fields.R302.smoke=.48;const summary=smokeSummary(s,3);assert.equal(summary.value,.48);assert.equal(summary.count,1);assert.ok(summary.peak.includes('302'));
});
test('localization excludes escaped people and includes people crossing a stair floor',()=>{
 const s=createTwin({count:3});s.agents[0].escaped=true;
 Object.assign(s.agents[1],{floor:2,edge:{kind:'stairs',from:'F3-SW',to:'F2-SW'}});s.agents[2].floor=5;
 assert.deepEqual(visiblePeople(s,'floor',3).map(a=>a.id),[2]);assert.equal(visiblePeople(s,'building',3).length,2);
});
test('diagonal speed is normalized, crouch and smoke slow movement, sprint is bounded',()=>{
 const diagonal=movementIntent(new Set(['w','d']),.4),forward=movementIntent(new Set(['w']),.4);
 assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-Math.hypot(forward.x,forward.z))<1e-9);
 assert.ok(Math.hypot(...Object.values(movementIntent(new Set(['w']),0,{crouching:true})))<1);
 assert.equal(movementIntent(new Set(['w','shift']),0).x,2.8);
 assert.ok(movementIntent(new Set(['w']),0,{smoke:1}).x<forward.x);
});
test('pre-drill exploration enters rooms without exposure or score and paused drill freezes',()=>{
 const s=createTwin();moveStudent(s,0,-1.65,2);assert.equal(s.student.node,'R302');assert.ok(s.student.z<-3);
 studentAction(s,'crouch');assert.equal(s.student.crouching,true);assert.equal(s.student.actions.length,0);assert.equal(s.student.exposure,0);assert.equal(s.time,0);
 s.running=true;tick(s,.2);s.running=false;const {x,z}=s.student;moveStudent(s,1,0,1);assert.equal(s.student.x,x);assert.equal(s.student.z,z);
});
test('architectural collision blocks furniture, walls and closed door without tunneling',()=>{
 const s=createTwin();assert.equal(canOccupyStudent(s,-14.7,0),true);
 assert.equal(canOccupyStudent(s,-13.3,1.2),false);
 studentAction(s,'door');assert.deepEqual(s.closedDoors,['R302']);moveStudent(s,0,-20,1);assert.ok(s.student.z>=-1.05);
 studentAction(s,'door');moveStudent(s,0,-1.5,2);assert.ok(s.student.z<-2.5);
 // A free part of the room is wider than the former 0.86m movement strip.
 let available=false;for(let x=-16.3;x<-13.2;x+=.15)for(let z=-2;z>-7.5;z-=.2)if(Math.abs(x+14.7)>1&&canOccupyStudent(s,x,z))available=true;assert.ok(available);
});
test('doors operate at any nearby room, require proximity, and cannot close on student',()=>{
 const s=createTwin();Object.assign(s.student,{x:-10.5,z:0,node:'F3-C2'});assert.equal(nearestDoor(s).id,'R303');assert.equal(studentAction(s,'door'),null);assert.ok(s.closedDoors.includes('R303'));
 Object.assign(s.student,{z:-1.2,x:-10.61});s.closedDoors=[];assert.ok(studentAction(s,'door').includes('离开'));assert.equal(s.closedDoors.length,0);
 s.student.z=-6;assert.ok(studentAction(s,'door').includes('靠近'));
});
test('stairs wait for a choice, ascend and descend continuously with exact endpoints',()=>{
 const s=createTwin();Object.assign(s.student,navigationPoint('F3-SW'),{node:'F3-SW'});moveStudent(s,0,0,.1);assert.equal(s.student.stair,undefined);assert.ok(nearbyStair(s));
 assert.equal(useStairs(s,1),null);for(let i=0;i<400&&s.student.stair;i++)moveStudent(s,0,0,.05);
 assert.equal(s.student.floor,4);assert.equal(s.student.y,9.899999999999999);
 assert.equal(useStairs(s,-1),null);for(let i=0;i<400&&s.student.stair;i++)moveStudent(s,0,0,.05);assert.equal(s.student.floor,3);assert.equal(s.student.y,6.6);
});
test('third-person adds exactly one controllable avatar; first-person hides it',()=>{
 const scene=new THREE.Scene(),crowd=createCrowd(scene),s=createTwin({count:1});s.agents[0].floor=1;
 crowd.update(s,{mode:'student',floor:3,includePlayer:true,now:100});assert.equal(crowd.group.getObjectByName('student-shirt').count,1);
 crowd.update(s,{mode:'student',floor:3,includePlayer:false,now:200});assert.equal(crowd.group.getObjectByName('student-shirt').count,0);crowd.dispose();
});
test('active student drill continues after virtual crowd has evacuated',()=>{
 const s=createTwin({count:1});s.running=true;s.agents[0].escaped=true;s.student.participating=true;tick(s,.2);assert.equal(s.finished,false);
 s.student.escaped=true;tick(s,.2);assert.equal(s.finished,true);
});
