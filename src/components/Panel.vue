<script setup>defineProps({title:String,tag:String});</script>
<template><section class="panel"><div class="panel-heading"><h2>{{title}}</h2><span v-if="tag">{{tag}}</span><slot name="action"/></div><div class="panel-body"><slot/></div></section></template>
