<script setup>
import {computed} from 'vue';
import {PersonOutline,ShieldCheckmarkOutline,LocationOutline,DesktopOutline,EyeOffOutline} from '@vicons/ionicons5';
import {BusinessOutline,Flame,People,Walk,TimeOutline,ShieldCheckmark,AlertCircle,LayersOutline,MapOutline,StatsChart,CalendarOutline,SettingsOutline,Play,Pause,DownloadOutline,Add,ArrowBack,ChevronForward,ChevronBack,NotificationsOutline,PersonCircle,SearchOutline,ExitOutline,WaterOutline,MedkitOutline,EyeOutline,HomeOutline,DocumentTextOutline,CloudOutline,Close,CheckmarkCircle,ExpandOutline,SpeedometerOutline,RadioOutline,HelpBuoyOutline,LockClosedOutline,RefreshOutline,ArrowForward} from '@vicons/ionicons5';
const props=defineProps({name:String});
const icons={building:BusinessOutline,fire:Flame,people:People,walk:Walk,time:TimeOutline,shield:ShieldCheckmark,alert:AlertCircle,layers:LayersOutline,map:MapOutline,chart:StatsChart,calendar:CalendarOutline,settings:SettingsOutline,play:Play,pause:Pause,download:DownloadOutline,add:Add,back:ArrowBack,next:ChevronForward,prev:ChevronBack,bell:NotificationsOutline,user:PersonCircle,search:SearchOutline,exit:ExitOutline,water:WaterOutline,health:MedkitOutline,eye:EyeOutline,home:HomeOutline,report:DocumentTextOutline,cloud:CloudOutline,close:Close,check:CheckmarkCircle,expand:ExpandOutline,speed:SpeedometerOutline,radio:RadioOutline,help:HelpBuoyOutline};
Object.assign(icons,{lock:LockClosedOutline,refresh:RefreshOutline,forward:ArrowForward});
Object.assign(icons,{person:PersonOutline,shieldOutline:ShieldCheckmarkOutline,pin:LocationOutline,desktop:DesktopOutline,eyeoff:EyeOffOutline});
const component=computed(()=>icons[props.name]||MapOutline);
</script>
<template><component :is="component" class="icon" aria-hidden="true"/></template>
