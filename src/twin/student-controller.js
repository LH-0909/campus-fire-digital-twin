import {moveStudent,nearestDoor,nearbyStair,useStairs,studentCanMove} from './state.js';

export function movementIntent(keys,heading,{crouching=false,smoke=0}={}){
 const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
 const side=(keys.has('d')?1:0)-(keys.has('a')?1:0),length=Math.hypot(forward,side)||1;
 const speed=(crouching?.9:keys.has('shift')?2.8:1.65)*(1-Math.min(.45,smoke*.45));
 return {x:(Math.cos(heading)*forward-Math.sin(heading)*side)/length*speed,z:(Math.sin(heading)*forward+Math.cos(heading)*side)/length*speed};
}

export function createStudentController(canvas,{getTwin,isActive,onAction,onView,onGuide,onNotice}){
 const keys=new Set();let pointer=null,pitch=-.06,distance=2.7,walkTime=0,disposed=false;
 const setKey=(key,pressed)=>pressed?keys.add(key):keys.delete(key);
 const editable=e=>['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable;
 function keydown(e){
  if(!isActive()||editable(e))return;
  const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','c','f','e','v','r'].includes(key))e.preventDefault();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key))keys.add(key);
  if(e.repeat)return;
  if(key==='v')onView();if(key==='r')onGuide();
  if(key==='c')onAction('crouch');if(key==='f')onAction('towel');
  if(key==='e')interact();
 }
 function interact(direction){
  const s=getTwin();
  if(direction!==undefined||nearbyStair(s)){const error=useStairs(s,direction??-1);if(error)onNotice(error);}
  else onAction('door');
 }
 const keyup=e=>keys.delete(e.key.toLowerCase());
 const clear=()=>{keys.clear();pointer=null;};
 function down(e){if(!isActive()||e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 function drag(e){
  if(!pointer||pointer.id!==e.pointerId||!isActive())return;
  getTwin().student.heading+=(e.clientX-pointer.x)*.004;
  pitch=Math.max(-.6,Math.min(.65,pitch-(e.clientY-pointer.y)*.003));
  pointer.x=e.clientX;pointer.y=e.clientY;
 }
 const up=()=>{pointer=null;};
 function wheel(e){if(!isActive())return;e.preventDefault();distance=Math.max(1.2,Math.min(4.5,distance+e.deltaY*.002));}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',drag);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
 return {
  setKey,clear,interact,
  get pitch(){return pitch;},get distance(){return distance;},get walkTime(){return walkTime;},
  update(dt){
   if(disposed||!isActive()){clear();return;}
   const s=getTwin(),st=s.student;
   if(keys.has('arrowleft'))st.heading-=dt*1.6;if(keys.has('arrowright'))st.heading+=dt*1.6;
   const input=movementIntent(keys,st.heading,{crouching:st.crouching,smoke:s.fields[st.node]?.smoke||0});
   if(!studentCanMove(s)){st.moving=false;return;}
   moveStudent(s,input.x,input.z,dt);
   if(st.moving)walkTime+=dt*(keys.has('shift')?1.45:1);
  },
  dispose(){disposed=true;clear();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',drag);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);},
 };
}
