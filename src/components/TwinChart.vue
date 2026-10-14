<script setup>
import {onMounted,onBeforeUnmount,ref,watch} from 'vue';
import * as echarts from 'echarts/core';
import {LineChart,BarChart,PieChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
echarts.use([LineChart,BarChart,PieChart,GridComponent,TooltipComponent,LegendComponent,CanvasRenderer]);
const props=defineProps({kind:String,data:Array,value:Number});const host=ref();let chart,observer;
function draw(){if(!chart)return;const base={backgroundColor:'transparent',animation:false,textStyle:{color:'#b6d1e6',fontFamily:'Microsoft YaHei'},tooltip:{trigger:'axis'},grid:{left:38,right:18,top:35,bottom:26},legend:{top:0,textStyle:{color:'#bed9ee',fontSize:10}},xAxis:{type:'category',data:(props.data||[]).map(p=>`${Math.floor(p.time/60)}:${String(Math.floor(p.time%60)).padStart(2,'0')}`),axisLine:{lineStyle:{color:'#21536d'}},axisLabel:{fontSize:9}},yAxis:{type:'value',splitLine:{lineStyle:{color:'#143c55'}},axisLabel:{fontSize:9}}};
if(props.kind==='donut'){chart.setOption({animation:false,tooltip:{trigger:'item'},series:[{type:'pie',radius:['64%','82%'],center:['50%','50%'],label:{show:false},itemStyle:{borderColor:'#062238',borderWidth:3},data:[{name:'已完成',value:props.value||0,itemStyle:{color:'#2eecb5'}},{name:'未完成',value:100-(props.value||0),itemStyle:{color:'#174968'}}]}]},true);return;}
if(props.kind==='environment'){base.yAxis=[base.yAxis,{type:'value',splitLine:{show:false},axisLabel:{fontSize:9}}];base.series=[{name:'烟气指数',type:'line',showSymbol:false,data:(props.data||[]).map(p=>p.smoke),lineStyle:{color:'#ff6572',width:2}},{name:'温度 (℃)',yAxisIndex:1,type:'line',showSymbol:false,data:(props.data||[]).map(p=>p.temperature),lineStyle:{color:'#ffba5b',width:2}}];}
else if(props.kind==='comparison'){base.xAxis.data=(props.data?.[0]?.history||[]).map(p=>Math.round(p.time/60*10)/10);base.series=(props.data||[]).map((p,i)=>({name:i?'方案B · 动态分流':'方案A · 就近疏散',type:'line',showSymbol:false,data:p.history.map(h=>[Math.round(h.time/60*10)/10,h.escaped]),lineStyle:{color:i?'#38e5b1':'#39b6ff',width:2},areaStyle:{opacity:.1}}));base.xAxis.type='value';base.xAxis.name='时间 (min)';}
else{base.series=[{name:'在楼人数',type:'line',showSymbol:false,data:(props.data||[]).map(p=>286-p.escaped),lineStyle:{color:'#29b6ff',width:2}},{name:'已疏散人数',type:'line',showSymbol:false,data:(props.data||[]).map(p=>p.escaped),lineStyle:{color:'#24e6b0',width:2}},{name:'暂无路径人数',type:'line',showSymbol:false,data:(props.data||[]).map(p=>p.trapped),lineStyle:{color:'#ff5c70',width:2}}];}
chart.setOption(base,true);}
onMounted(()=>{observer=new ResizeObserver(()=>{if(!chart&&host.value.clientWidth&&host.value.clientHeight){chart=echarts.init(host.value);draw();}else chart?.resize();});observer.observe(host.value);});watch(()=>[props.data,props.value,props.kind],draw,{deep:true});onBeforeUnmount(()=>{observer?.disconnect();chart?.dispose();});
</script>
<template><div ref="host" class="twin-chart"></div></template>
