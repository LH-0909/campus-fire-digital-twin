<script setup>
import {onMounted,ref,watch} from 'vue';
import {spaces,rooms,spaceById} from '../twin/building.js';
import {findRoute} from '../twin/state.js';
const props=defineProps({twin:Object,floor:Number});const emit=defineEmits(['select']);const canvas=ref();
function draw(){const c=canvas.value;if(!c)return;const ctx=c.getContext('2d');c.width=700;c.height=330;const scale=12,px=x=>350+x*scale,pz=z=>165+z*scale;ctx.fillStyle='#06253b';ctx.fillRect(0,0,700,330);
ctx.fillStyle='#234556';ctx.strokeStyle='#6b94a4';ctx.lineWidth=2;ctx.fillRect(px(-24),pz(-9),48*scale,18*scale);ctx.strokeRect(px(-24),pz(-9),48*scale,18*scale);
for(const r of rooms.filter(r=>r.floor===props.floor)){ctx.fillStyle=props.twin.fields[r.id].risk>.15?'#663341':'#29485b';ctx.fillRect(px(r.x-2),pz(r.z-3.3),4*scale,6.6*scale);ctx.strokeStyle='#57788e';ctx.strokeRect(px(r.x-2),pz(r.z-3.3),4*scale,6.6*scale);ctx.fillStyle='#99b8cc';ctx.font='14px Microsoft YaHei';ctx.textAlign='center';ctx.fillText(String(r.number),px(r.x),pz(r.z)+4);}
ctx.fillStyle='#194258';ctx.fillRect(px(-21),pz(-1.2),42*scale,2.4*scale);ctx.fillRect(px(.1),pz(-9),4*scale,18*scale);
const path=findRoute(props.twin.student.floor===props.floor?props.twin.student.node:`F${props.floor}-C1`,props.twin);
if(path){ctx.strokeStyle='#3effba';ctx.lineWidth=5;ctx.setLineDash([12,7]);ctx.beginPath();let started=false;for(const id of path){const n=spaceById[id];if(n.floor!==props.floor)continue;if(!started){ctx.moveTo(px(n.x),pz(n.z));started=true;}else ctx.lineTo(px(n.x),pz(n.z));}ctx.stroke();ctx.setLineDash([]);}
const st=props.twin.student;if(st.floor===props.floor){ctx.beginPath();ctx.fillStyle='#49c5ff';ctx.shadowBlur=15;ctx.shadowColor='#23abff';ctx.arc(px(st.x),pz(st.z),8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
const fire=spaceById[props.twin.fireSource];if(fire.floor===props.floor){ctx.fillStyle='#ff694e';ctx.fillRect(px(fire.x)-9,pz(fire.z)-10,18,20);ctx.font='bold 19px Microsoft YaHei';ctx.fillText('火',px(fire.x),pz(fire.z)+7);}
for(const n of spaces.filter(n=>n.kind==='stairs'&&n.floor===props.floor)){ctx.fillStyle='#19d99c';ctx.fillRect(px(n.x)-11,pz(n.z)-11,22,22);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('E',px(n.x),pz(n.z)+6);}
}
function click(e){const r=canvas.value.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*700-350)/12,z=((e.clientY-r.top)/r.height*330-165)/12;const room=rooms.find(n=>n.floor===props.floor&&Math.abs(n.x-x)<2&&Math.abs(n.z-z)<3.4);if(room)emit('select',room.id);}
onMounted(draw);watch(()=>[props.floor,props.twin.time,props.twin.blocked.join(',')],draw);
</script>
<template><canvas ref="canvas" class="floor-map" @click="click" aria-label="宿舍楼层平面导航图"></canvas></template>
