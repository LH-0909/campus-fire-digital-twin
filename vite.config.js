import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import {createAuth} from './server/auth.mjs';
function localApi(){let auth;return {name:'campus-local-api',configureServer(server){auth=createAuth();server.middlewares.use(auth.handle);server.httpServer?.once('close',()=>auth.close());}};}
export default defineConfig({base:process.env.VITE_BASE_PATH||'/', plugins: [vue(),localApi()],build:{rollupOptions:{output:{manualChunks:{three:['three','three/examples/jsm/controls/OrbitControls.js','three/examples/jsm/loaders/GLTFLoader.js'],charts:['echarts/core','echarts/charts','echarts/components','echarts/renderers']}}}} });
