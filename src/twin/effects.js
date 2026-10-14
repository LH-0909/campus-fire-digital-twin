import * as THREE from 'three';
import {spaces,spaceById} from './building.js';

// The particles are a visualisation of Twin State, not a CFD solver.
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(3.1,7.7);a*=.5;}return v;}
`;
export function createFireSmoke(scene) {
  const fire=new THREE.Group();scene.add(fire);
  const fireGeometry=new THREE.BoxGeometry(1,1,1);
  const flameMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,
    uniforms:{time:{value:0},strength:{value:0},cameraLocal:{value:new THREE.Vector3()}},
    vertexShader:`uniform vec3 cameraLocal;varying vec3 origin,ray;void main(){origin=cameraLocal;ray=position-origin;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time,strength;varying vec3 origin,ray;${noise}
    float flame(vec3 p){float y=p.y+.5;float n=fbm(p.xz*6.+vec2(p.y*4.-time*1.9,p.y*3.-time*2.4));
      vec2 sway=vec2(sin(y*4.-time*2.),cos(y*3.+time))*y*.065;
      float radius=(1.-y)*.31+.035;
      float body=1.-smoothstep(radius-.06,radius+.12,length(p.xz+sway)+(n-.5)*.16);
      float edgeFade=1.-smoothstep(.34,.48,max(abs(p.x),abs(p.z)));
      return body*edgeFade*(.35+.65*n)*(1.-smoothstep(.62,.98,y+n*.14))*smoothstep(0.,.16,y);}
    void main(){vec3 dir=normalize(ray),inv=1./dir;vec3 lo=(-vec3(.5)-origin)*inv,hi=(vec3(.5)-origin)*inv;
      vec3 mn=min(lo,hi),mx=max(lo,hi);float start=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z));
      if(end<=start)discard;vec4 sum=vec4(0.);float stepSize=(end-start)/32.;
      for(int i=0;i<32;i++){vec3 p=origin+dir*(start+(float(i)+.5)*stepSize);float d=flame(p)*strength;
        float h=clamp(1.-(p.y+.5)*1.65,0.,1.);vec3 col=mix(vec3(1.,.12,.007),vec3(1.,.65,.11),h);col=mix(col,vec3(1.,.9,.47),pow(h,5.));
        float alpha=1.-exp(-d*stepSize*5.);sum.rgb+=(1.-sum.a)*col*alpha;sum.a+=(1.-sum.a)*alpha;}
      if(sum.a<.005)discard;gl_FragColor=vec4(sum.rgb/max(sum.a,.001)*1.35,sum.a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const flameMesh=new THREE.Mesh(fireGeometry,flameMaterial);flameMesh.position.y=1.5;flameMesh.scale.set(1.6,2.95,1.5);flameMesh.frustumCulled=false;fire.add(flameMesh);
  const fireLight=new THREE.PointLight(0xff8b32,0,12,2);scene.add(fireLight);
  const zones=spaces.filter(s=>s.kind==='room'||s.kind==='corridor');
  const count=zones.length*4,geo=new THREE.PlaneGeometry(2,2);
  const density=new Float32Array(count),seed=new Float32Array(count);
  for(let i=0;i<count;i++)seed[i]=i*.719;
  geo.setAttribute('smokeAlpha',new THREE.InstancedBufferAttribute(density,1));
  geo.setAttribute('smokeSeed',new THREE.InstancedBufferAttribute(seed,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0}},
    vertexShader:`attribute float smokeAlpha,smokeSeed;varying vec2 vUv;varying float vAlpha,vSeed;void main(){
      vUv=uv;vAlpha=smokeAlpha;vSeed=smokeSeed;
      vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
      center.xy+=position.xy*size;gl_Position=projectionMatrix*center;
    }`,
    fragmentShader:`uniform float time;varying vec2 vUv;varying float vAlpha,vSeed;${noise}
    void main(){vec2 p=vUv*2.-1.;float turbulent=fbm(vUv*4.+vec2(vSeed-time*.06,-time*.12));
      float edge=1.-smoothstep(.30,1.,length(p+vec2((turbulent-.5)*.4,0.)));
      float a=edge*smoothstep(.15,.7,turbulent)*vAlpha;
      if(a<.004)discard;vec3 c=mix(vec3(.14,.16,.18),vec3(.38,.39,.39),turbulent);
      gl_FragColor=vec4(c,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const smoke=new THREE.InstancedMesh(geo,material,count);smoke.frustumCulled=false;smoke.renderOrder=8;
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(smoke);
  const dummy=new THREE.Object3D();
  return {
    objects:[fire,smoke],
    update(twin,{mode,floor,layer,camera}) {
      const source=spaceById[twin.fireSource]||spaceById.R302,f=twin.fields[source.id];
      const visible=mode==='building'||mode==='exterior'||source.floor===(mode==='student'?twin.student.floor:floor);
      const time=twin.time||0;
      const fireZ=source.kind==='room'?source.side*2.4:source.z;
      fire.visible=visible&&f.fire>.01&&(mode==='student'||layer!=='people');fire.position.set(source.x,source.y,fireZ);
      fire.scale.set(1+f.fire*.45,.65+f.fire*.38,1+f.fire*.35);
      flameMaterial.uniforms.time.value=time;flameMaterial.uniforms.strength.value=Math.min(1,f.fire*3);
      if(camera){fire.updateMatrixWorld(true);flameMaterial.uniforms.cameraLocal.value.copy(camera.position);flameMesh.worldToLocal(flameMaterial.uniforms.cameraLocal.value);}
      fireLight.position.set(source.x,source.y+1.4,fireZ);fireLight.intensity=fire.visible?18*f.fire*(.94+Math.sin(time*9)*.06):0;
      material.uniforms.time.value=time;smoke.visible=layer!=='people';
      zones.forEach((zone,z)=>{
        const local=twin.fields[zone.id],show=(mode==='building'||mode==='exterior'||zone.floor===(mode==='student'?twin.student.floor:floor))&&local.smoke>.015;
        for(let j=0;j<4;j++){
          const i=z*4+j,phase=(time*.028+j*.25+z*.17)%1;
          const width=zone.kind==='room'?1.75:2.2;
          dummy.position.set(zone.x+Math.sin(z*17+j*11+phase)*width,zone.y+1.75+phase*.9,zone.z+Math.cos(z*13+j*7)* (zone.kind==='room'?2.1:.5));
          dummy.scale.set(width*(.72+phase*.4),.62+phase*.4,1);dummy.updateMatrix();smoke.setMatrixAt(i,dummy.matrix);
          density[i]=show?Math.min(.72,local.smoke*.72)*(j===0?1:.75):0;
        }
      });
      smoke.instanceMatrix.needsUpdate=true;geo.attributes.smokeAlpha.needsUpdate=true;
    },
    dispose(){scene.remove(fire,smoke,fireLight);fireGeometry.dispose();flameMaterial.dispose();geo.dispose();material.dispose();}
  };
}
