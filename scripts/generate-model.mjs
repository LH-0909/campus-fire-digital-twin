import fs from 'node:fs/promises';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildDormitory } from '../src/twin/model.js';
import { building,spaces,connections } from '../src/twin/building.js';
import {bindNavigationEdges} from '../src/twin/navigation.js';
bindNavigationEdges(connections);
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});}
};
await fs.mkdir('public/models',{recursive:true});
const root=buildDormitory();
const components=[];
root.updateMatrixWorld(true);
root.traverse(n=>{
  if(!n.isMesh)return;
  let parent=n.parent,spaceId=n.userData.spaceId||null,floor=n.userData.floor,section=n.userData.section;
  while(parent){spaceId ||= parent.userData.spaceId;floor ||= parent.userData.floor;section ||= parent.userData.section;parent=parent.parent;}
  const p=n.geometry.parameters;
  const component={id:`component-${components.length+1}`,name:n.name,spaceId,floor:Math.min(floor||1,6),width:p.width,height:p.height,depth:p.depth,matrix:n.matrixWorld.toArray(),material:n.material.name,kind:n.userData.kind,section,visualOnly:!!n.userData.visualOnly};
  // Non-box trim is tessellated rather than silently inventing dimensions.
  if(![p.width,p.height,p.depth].every(Number.isFinite)){
    component.vertices=Array.from(n.geometry.attributes.position.array);
    component.indices=n.geometry.index?Array.from(n.geometry.index.array):Array.from({length:n.geometry.attributes.position.count},(_,i)=>i);
  }
  components.push(component);
});
const data=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
await fs.writeFile('public/models/dormitory.glb',Buffer.from(data));
await fs.writeFile('public/models/building.json',JSON.stringify({building,spaces,connections},null,2));
await fs.mkdir('artifacts/model-source',{recursive:true});
await fs.writeFile('artifacts/model-source/components.json',JSON.stringify(components));
console.log(`GLB saved: ${(data.byteLength/1048576).toFixed(2)} MB, ${spaces.length} semantic spaces, ${connections.length} connections`);
