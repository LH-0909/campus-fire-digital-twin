import * as THREE from 'three';
import { building, rooms } from './building.js';

// Shared metric/semantic model. Its dimensions are assumptions, not a survey.
export function buildDormitory() {
  const root = new THREE.Group();
  root.name = building.id;
  root.userData = { ...building, modelRevision: 'architectural-detail-2' };
  const materials = {
    wall: { color: 0xe6e5df, roughness: .91 }, facade: { color: 0xcfcac0, roughness: .87 },
    concrete: { color: 0xb8bbb7, roughness: .94 }, slab: { color: 0xbfc1bc, roughness: .91 },
    ceiling: { color: 0xebece7, roughness: .96 }, tile: { color: 0xc6cdcb, roughness: .34 },
    roomTile: { color: 0xd2d0c6, roughness: .53 }, wainscot: { color: 0xaebbb7, roughness: .65 },
    skirting: { color: 0x646f6d, roughness: .67 }, trim: { color: 0xa5aba8, roughness: .35, metalness: .7 },
    glass: { color: 0x88a8b5, roughness: .14, metalness: .12, transparent: true, opacity: .32 },
    metal: { color: 0x4c5557, roughness: .51, metalness: .72 }, handrail: { color: 0xc7ceca, roughness: .29, metalness: .82 },
    wood: { color: 0x6e4b32, roughness: .59 }, doorFrame: { color: 0x4a352b, roughness: .62 },
    desk: { color: 0xb19065, roughness: .62 }, mattress: { color: 0xe1ded0, roughness: .98 },
    blanket: { color: 0x637a87, roughness: .97 }, blanketWarm: { color: 0x81746e, roughness: .97 },
    fireRed: { color: 0xa6221e, roughness: .42, metalness: .25 },
    fireGlass: { color: 0x503534, roughness: .17, transparent: true, opacity: .7 },
    sign: { color: 0x199456, roughness: .44, emissive: 0x0b6439, emissiveIntensity: .5 },
    signWhite: { color: 0xe2f1d9, roughness: .72, emissive: 0xb8dcb7, emissiveIntensity: .35 },
    lamp: { color: 0xffefd5, roughness: .35, emissive: 0xffe7bc, emissiveIntensity: 1.8 },
    dark: { color: 0x272d2f, roughness: .82 }, roof: { color: 0x828985, roughness: .94 },
  };
  const mats = Object.fromEntries(Object.entries(materials).map(([name, options]) => {
    const material = new THREE.MeshStandardMaterial(options); material.name = name; return [name, material];
  }));
  const geometries = new Map();
  // UVs describe metres on each face so PBR maps retain a fixed physical scale.
  const boxGeometry = (w, h, d) => {
    const key = `${w},${h},${d}`;
    if (!geometries.has(key)) {
      const geometry = new THREE.BoxGeometry(w, h, d), uv = geometry.attributes.uv;
      [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]].forEach(([us,vs], face) => {
        for (let j=0;j<4;j++) { const i=face*4+j; uv.setXY(i,uv.getX(i)*us,uv.getY(i)*vs); }
      });
      geometries.set(key, geometry);
    }
    return geometries.get(key);
  };
  const box = (g,w,h,d,x,y,z,material='wall',data={}) => {
    const m = new THREE.Mesh(boxGeometry(w,h,d),mats[material]); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true; m.name=data.id||data.kind||material;
    m.userData={section:g.userData.section||'structure',...data}; g.add(m); return m;
  };
  const group = (parent,name,data) => {
    const g=new THREE.Group(); g.name=name; g.userData=data; parent.add(g); return g;
  };
  const angledBeam=(g,a,b,thickness,depth,material,data={}) => {
    const direction=new THREE.Vector3().subVectors(b,a),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);
    const m=box(g,thickness,direction.length(),depth,mid.x,mid.y,mid.z,material,{...data,visualOnly:true});
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()); return m;
  };

  // Three bunk frames/six beds, with ladders and safety rails at actual scale.
  const bunkBed=(g,x,y,z,side,warm) => {
    const data={section:'furniture',kind:'furnishing'};
    for (const level of [.46,1.52]) {
      box(g,.92,.065,1.96,x,y+level,z,'metal',data);
      box(g,.86,.105,1.87,x,y+level+.085,z,'mattress',data);
      box(g,.88,.038,1.24,x,y+level+.156,z+side*.25,warm?'blanketWarm':'blanket',data);
      box(g,.53,.12,.34,x,y+level+.18,z-side*.65,'mattress',data);
      for (const dz of [-.93,.93]) box(g,.9,.032,.032,x,y+level+.24,z+dz,'metal',data);
    }
    for (const dx of [-.45,.45]) {
      for (const dz of [-.94,.94]) box(g,.038,1.93,.038,x+dx,y+1.005,z+dz,'metal',data);
      box(g,.027,.027,1.38,x+dx,y+1.96,z+side*.24,'metal',data);
      for (const dz of [-.35,.89]) box(g,.027,.36,.027,x+dx,y+1.8,z+dz*side,'metal',data);
    }
    for (const dx of [-.22,.22]) box(g,.029,1.53,.029,x+dx,y+.775,z-side*1.015,'metal',data);
    for (let i=0;i<5;i++) box(g,.46,.027,.027,x,y+.27+i*.26,z-side*1.015,'metal',data);
    for (const dz of [-.94,.94]) box(g,.9,.025,.025,x,y+1.96,z+dz,'metal',data);
  };
  const fireCabinet=(g,x,y,z,side) => {
    const data={section:'fixtures',kind:'fireSafetyCabinet'};
    box(g,.77,1.28,.17,x,y+1.16,z,'fireRed',data);
    box(g,.66,1.12,.02,x,y+1.16,z-side*.097,'fireGlass',data);
    box(g,.033,1.08,.025,x,y+1.16,z-side*.115,'fireRed',data);
    box(g,.04,.11,.04,x+.26,y+1.08,z-side*.122,'trim',data);
    box(g,.42,.055,.012,x,y+1.64,z-side*.117,'signWhite',data);
    box(g,.45,.45,.085,x,y+1.31,z-side*.006,'dark',data);
    for (let i=0;i<4;i++) box(g,.03,.38-i*.04,.09,x-.15+i*.1,y+1.3,z-side*.025,'fireRed',data);
    for (const dx of [-.24,.22]) {
      box(g,.115,.34,.1,x+dx,y+.69,z-side*.005,'fireRed',data);
      box(g,.1,.036,.11,x+dx,y+.87,z-side*.005,'metal',data);
      box(g,.06,.055,.04,x+dx,y+.9,z-side*.005,'metal',data);
    }
  };
  const stairTower=(parent,floor,baseY,cx,cz,orientation=0) => {
    const g=group(parent,`Stair_${cx}_${cz}_${floor}`,{floor,section:'stairs',kind:'stairwell'});
    const sin=Math.sin(orientation),cos=Math.cos(orientation);
    const p=(lx,ly,lz)=>new THREE.Vector3(cx+lx*cos+lz*sin,baseY+ly,cz-lx*sin+lz*cos);
    const rect=(w,h,d,lx,ly,lz,material,data={}) => {
      const pos=p(lx,ly,lz),m=box(g,w,h,d,pos.x,pos.y,pos.z,material,{section:'stairs',floor,...data});m.rotation.y=orientation;return m;
    };
    const beam=(a,b,t,d,material,data={})=>angledBeam(g,p(...a),p(...b),t,d,material,{section:'stairs',floor,...data});
    // Two 1.4 m wide flights, 20 x 165 mm risers and a 1.18 m half-landing.
    rect(4.38,.22,1.35,0,-.11,-1.93,'slab',{kind:'stairLanding'});
    const innerSide=cz===0?(cx<0?2.19:-2.19):0;
    if (innerSide) {
      // Side approach floor links the corridor portal to the level landing.
      rect(.75,.22,2.7,Math.sign(innerSide)*1.815,-.11,-.015,'slab',{kind:'stairApproach'});
    } else rect(2,.22,.42,0,-.11,-2.72,'slab',{kind:'stairApproach'});
    if (floor<building.floors) {
      rect(4.38,.22,1.18,0,1.54,2.17,'slab',{kind:'stairLanding'});
      for (let flight=0;flight<2;flight++) {
        const fx=(flight?.77:-.77)+(cz===0?Math.sign(cx)*.12:0);
        for (let tread=0;tread<10;tread++) {
          const sy=(flight*10+tread+1)*.165,sz=flight?1.505-tread*.29:-1.105+tread*.29;
          rect(1.4,.165,.3,fx,sy-.0825,sz,'concrete',{kind:'stairs'});
          rect(1.41,.012,.038,fx,sy+.008,sz+(flight?-.132:.132),'skirting',{kind:'stairNosing'});
        }
        beam(flight?[fx,1.56,1.63]:[fx,-.08,-1.25],flight?[fx,3.21,-1.26]:[fx,1.57,1.64],1.37,.17,'concrete',{kind:'stairStringer'});
        for (const railX of [fx-.64,fx+.64]) {
          const lowZ=flight?1.63:-1.25,highZ=flight?-1.26:1.64,lowY=flight?2.57:.92,highY=flight?4.22:2.57;
          beam([railX,lowY,lowZ],[railX,highY,highZ],.045,.045,'handrail',{kind:'handrail'});
          for (let i=0;i<7;i++) {
            const t=i/6;rect(.025,.88,.025,railX,lowY+(highY-lowY)*t-.45,lowZ+(highZ-lowZ)*t,'handrail',{kind:'baluster'});
          }
        }
      }
      rect(4.36,.04,.045,0,2.61,2.7,'handrail',{kind:'landingRail'});
      for (let i=0;i<26;i++) rect(.025,.92,.025,-2.1+i*.168,2.15,2.7,'handrail',{kind:'baluster'});
    }
    const groundExitSide=cz===0?(cx<0?-2.19:2.19):-2.19;
    for (const sx of [-2.19,2.19]) {
      if (sx===innerSide) {
        // Side entrances connect the east/west stair towers to the main hall.
        rect(.18,3.05,1.555,sx,1.525,-1.8275,'facade',{section:'stair-envelope',kind:'wall'});
        rect(.18,3.05,1.895,sx,1.525,1.9975,'facade',{section:'stair-envelope',kind:'wall'});
        rect(.18,.8,2.1,sx,2.65,0,'facade',{section:'stair-envelope',kind:'wall'});
      } else if (floor===1&&sx===groundExitSide) {
        // Ground-floor exits open from the landing to the building exterior.
        rect(.18,3.05,.05,sx,1.525,-2.58,'facade',{section:'stair-envelope',kind:'wall'});
        rect(.18,3.05,4.25,sx,1.525,.82,'facade',{section:'stair-envelope',kind:'wall'});
        rect(.18,.82,1.25,sx,2.64,-1.93,'facade',{section:'stair-envelope',kind:'wall'});
        rect(.055,.22,.62,sx,2.34,-1.93,'sign',{section:'fixtures',kind:'exitSign'});
      } else rect(.18,3.05,5.55,sx,1.525,.17,'facade',{section:'stair-envelope',kind:'wall'});
      rect(.23,.19,5.62,sx,3.13,.17,'concrete',{section:'stair-envelope',kind:'beam'});
    }
    for (const sz of [-2.6,2.95]) {
      if (sz<0) {
        for (const sx of [-1.6,1.6]) rect(1.2,3.05,.18,sx,1.525,sz,'facade',{section:'stair-envelope',kind:'wall'});
        rect(2,.68,.18,0,2.71,sz,'facade',{section:'stair-envelope',kind:'wall'});
      } else {
        rect(4.38,.93,.18,0,.465,sz,'facade',{section:'stair-envelope',kind:'wall'});
        rect(4.38,.43,.18,0,2.845,sz,'facade',{section:'stair-envelope',kind:'wall'});
        for (const sx of [-1.63,1.63]) rect(1.1,1.7,.18,sx,1.78,sz,'facade',{section:'stair-envelope',kind:'wall'});
        rect(2.12,1.7,.05,0,1.78,sz,'glass',{section:'stair-envelope',kind:'window'});
        for (const sx of [-1.07,0,1.07]) rect(.045,1.77,.12,sx,1.78,sz,'trim',{section:'stair-envelope',kind:'windowFrame'});
        for (const sy of [.92,1.78,2.64]) rect(2.18,.045,.12,0,sy,sz,'trim',{section:'stair-envelope',kind:'windowFrame'});
      }
    }
    rect(.6,.22,.045,0,2.37,-2.7,'sign',{section:'fixtures',kind:'exitSign'});
    rect(.58,.05,.16,0,3.015,-1.95,'lamp',{section:'fixtures',kind:'light'});
  };

  for (let floor=1;floor<=building.floors;floor++) {
    const y=(floor-1)*building.storeyHeight,g=group(root,`Storey_${floor}`,{kind:'storey',floor,elevation:y});
    // Slabs leave a north stairwell opening and side stair voids.
    box(g,42,.23,16.2,0,y-.115,.9,'slab',{section:'floor',kind:'slab',floor});
    box(g,21,.23,1.8,-10.5,y-.115,-8.1,'slab',{section:'floor',kind:'slab',floor});
    box(g,16.8,.23,1.8,12.6,y-.115,-8.1,'slab',{section:'floor',kind:'slab',floor});
    box(g,42,.045,2.4,0,y+.023,0,'tile',{section:'floor',kind:'corridor',floor});
    box(g,4.05,.045,16.2,2.1,y+.023,.9,'tile',{section:'floor',kind:'cross-corridor',floor});
    // White soffits below the floor above provide a real ceiling in first person.
    box(g,42,.026,16.2,0,y-.244,.9,'ceiling',{section:'ceiling',kind:'ceiling',floor});
    box(g,21,.026,1.8,-10.5,y-.244,-8.1,'ceiling',{section:'ceiling',kind:'ceiling',floor});
    box(g,16.8,.026,1.8,12.6,y-.244,-8.1,'ceiling',{section:'ceiling',kind:'ceiling',floor});
    for (const r of rooms.filter(r=>r.floor===floor)) {
      const s=r.side,x=r.x,z=s*4.6,rg=group(g,r.id,{kind:'space',spaceId:r.id,floor,area:r.area});
      const ext=s*8,section=s>0?'front-facade':'back-facade',outside={section,kind:'wall',floor,spaceId:r.id};
      box(rg,4.2,.91,.22,x,y+.455,ext,'facade',outside);
      box(rg,4.2,.43,.22,x,y+2.845,ext,'facade',outside);
      for (const dx of [-1.71,1.71]) box(rg,.78,1.72,.22,x+dx,y+1.77,ext,'facade',outside);
      box(rg,2.63,1.65,.04,x,y+1.77,ext+s*.025,'glass',{...outside,kind:'window'});
      for (const dx of [-1.35,0,1.35]) box(rg,.047,1.76,.13,x+dx,y+1.77,ext,'trim',{...outside,kind:'windowFrame'});
      for (const dy of [.9,1.79,2.64]) box(rg,2.74,.045,.13,x,y+dy,ext,'trim',{...outside,kind:'windowFrame'});
      box(rg,2.88,.075,.35,x,y+.87,ext+s*.04,'concrete',{...outside,kind:'windowSill'});
      box(rg,2.88,.07,.32,x,y+2.67,ext+s*.015,'concrete',{...outside,kind:'windowLintel'});
      box(rg,4.2,.12,.27,x,y+3.065,ext+s*.03,'concrete',{...outside,kind:'facadeBand'});
      box(rg,.22,3.05,.28,x-2.1,y+1.525,ext,'concrete',{...outside,kind:'column'});
      box(rg,4.05,.028,6.6,x,y+.025,z,'roomTile',{section:'floor',kind:'roomFloor'});
      box(rg,.16,3.05,6.8,x-2.1,y+1.525,z,'wall',{section:'room-partition',kind:'wall'});
      box(rg,.032,.13,6.55,x-1.998,y+.092,z,'skirting',{section:'room-partition',kind:'skirting'});
      const corridor={section:'corridor-wall',kind:'wall'};
      for (const [w,dx] of [[1.5,-1.35],[1.7,1.25]]) {
        box(rg,w,3.05,.19,x+dx,y+1.525,s*1.2,'wall',corridor);
        box(rg,w,1.04,.024,x+dx,y+.56,s*1.087,'wainscot',{...corridor,kind:'wallFinish'});
        box(rg,w,.13,.035,x+dx,y+.1,s*1.071,'skirting',{...corridor,kind:'skirting'});
        box(rg,w,.022,.033,x+dx,y+1.091,s*1.071,'skirting',{...corridor,kind:'dadoTrim'});
      }
      box(rg,1,.82,.19,x-.1,y+2.64,s*1.2,'wall',corridor);
      const doorData={section:'corridor-wall',kind:'door',spaceId:r.id,floor};
      for (const dx of [-.625,.425]) box(rg,.065,2.28,.25,x+dx,y+1.145,s*1.2,'doorFrame',{...doorData,kind:'doorFrame'});
      box(rg,1.115,.065,.25,x-.1,y+2.253,s*1.2,'doorFrame',{...doorData,kind:'doorFrame'});
      box(rg,1.1,.034,.32,x-.1,y+.045,s*1.2,'concrete',{...doorData,kind:'doorThreshold'});
      // Evacuation starts with doors open; the central room-to-corridor route
      // remains clear instead of agents visibly walking through a closed leaf.
      const angle=1.22+(r.number%3)*.055;
      const doorX=x-.59+.48*Math.cos(angle),doorZ=s*(1.2+.48*Math.sin(angle));
      const door=box(rg,.96,2.18,.056,doorX,y+1.119,doorZ,'wood',doorData);door.rotation.y=-s*angle;
      const dp=(dx,dy,dz)=>({x:doorX+dx*Math.cos(angle)+dz*Math.sin(-s*angle),y:y+dy,z:doorZ+dx*Math.sin(s*angle)+dz*Math.cos(angle)});
      for (const h of [.59,1.46]) {
        const p=dp(0,h,-s*.034),panel=box(rg,.77,.59,.012,p.x,p.y,p.z,'doorFrame',{...doorData,kind:'doorPanel'});panel.rotation.y=-s*angle;
      }
      const hp=dp(.35,1.055,-s*.06),handle=box(rg,.11,.025,.035,hp.x,hp.y,hp.z,'handrail',{...doorData,kind:'doorHandle'});handle.rotation.y=-s*angle;
      for (const h of [.37,1.16,1.91]) { const p=dp(-.47,h,0);box(rg,.024,.095,.045,p.x,p.y,p.z,'metal',{...doorData,kind:'doorHinge'}); }
      bunkBed(rg,x-1.43,y,s*3.2,s,r.number%3===0);
      bunkBed(rg,x-1.43,y,s*5.54,s,r.number%2===0);
      bunkBed(rg,x+1.43,y,s*4.45,s,r.number%3===1);
      const furniture={section:'furniture',kind:'furnishing'};
      box(rg,1.32,2.2,.58,x+.02,y+1.11,s*7.46,'desk',furniture);
      for (const dx of [-.32,.32]) {
        box(rg,.59,2.08,.025,x+dx+.02,y+1.12,s*7.15,'wood',furniture);
        box(rg,.024,.115,.032,x+dx+.21,y+1.19,s*7.122,'handrail',furniture);
      }
      box(rg,.59,.067,1.32,x+1.35,y+.77,s*6.56,'desk',furniture);
      for (const dx of [-.23,.23]) for (const dz of [-.56,.56]) box(rg,.035,.72,.035,x+1.35+dx,y+.38,s*6.56+dz,'metal',furniture);
      box(rg,.42,.04,.44,x+.86,y+.445,s*6.5,'desk',furniture);
      for (const dx of [-.18,.18]) for (const dz of [-.18,.18]) box(rg,.029,.42,.029,x+.86+dx,y+.225,s*6.5+dz,'metal',furniture);
      box(rg,.036,.28,.4,x+.65,y+.65,s*6.5,'desk',furniture);
      box(rg,.8,.48,.34,x+1.51,y+.51,ext+s*.33,'concrete',{...outside,kind:'airConditioner'});
      for (let i=0;i<6;i++) box(rg,.68,.017,.022,x+1.51,y+.31+i*.066,ext+s*.516,'trim',{...outside,kind:'airConditionerLouvre'});
    }
    for (const x of [-21,21]) {
      for (const z of [-4.6,4.6]) box(g,.22,3.05,6.8,x,y+1.525,z,'wall',{section:'room-partition',kind:'wall',floor});
      box(g,.26,.77,2.4,x,y+2.665,0,'concrete',{section:'structure',kind:'beam',floor});
    }
    for (const side of [-1,1]) {
      const section=side>0?'front-facade':'back-facade';
      box(g,42.2,.2,.3,0,y+3.14,side*8.05,'concrete',{section,kind:'beam',floor});
      box(g,42.2,.16,.32,0,y+.09,side*8.08,'concrete',{section,kind:'facadeBand',floor});
    }
    // Slender, dense stainless balcony railings rather than a sparse toy fence.
    box(g,48,.18,1.48,0,y-.065,9.57,'concrete',{section:'balcony',kind:'balconySlab',floor});
    box(g,48,.025,1.39,0,y+.035,9.57,'tile',{section:'balcony',kind:'balconyFloor',floor});
    const railSpans=floor===1?[[23.7,-12.2],[19.5,14.3]]:[[48.1,0]];
    for (const [width,x] of railSpans) {
      box(g,width,.052,.052,x,y+1.1,10.26,'handrail',{section:'balcony',kind:'handrail',floor});
      box(g,width,.032,.032,x,y+.19,10.26,'handrail',{section:'balcony',kind:'rail',floor});
    }
    for (let x=-23.8;x<=23.9;x+=.16) if (floor!==1||x<-.35||x>4.55) box(g,.02,.88,.02,x,y+.635,10.26,'handrail',{section:'balcony',kind:'baluster',floor});
    for (let x=-23.9;x<=24;x+=4.2) {
      if (floor===1&&x>-.35&&x<4.55) continue;
      box(g,.24,3.3,.3,x,y+1.51,10.25,'concrete',{section:'balcony',kind:'column',floor});
      box(g,.045,1.1,.045,x,y+.59,10.26,'handrail',{section:'balcony',kind:'railPost',floor});
    }
    for (const x of [-20.25,20.25]) for (const z of [-1.22,1.22]) box(g,.19,3.05,.3,x,y+1.525,z,'concrete',{section:'structure',kind:'column',floor});
    stairTower(g,floor,y,-23,0);stairTower(g,floor,y,23,0);stairTower(g,floor,y,2.1,-10,Math.PI);
    // Corridor services and luminaires have separate housings and diffusers.
    box(g,40.5,.045,.045,0,y+2.96,-.78,'fireRed',{section:'fixtures',kind:'sprinklerPipe',floor});
    box(g,40.5,.034,.036,0,y+2.985,.75,'trim',{section:'fixtures',kind:'electricalConduit',floor});
    for (let i=0;i<10;i++) {
      const x=-18.9+i*4.2;
      box(g,1.2,.08,.24,x,y+3.002,0,'trim',{section:'fixtures',kind:'lightHousing',floor});
      for (const dz of [-.065,.065]) box(g,1.1,.048,.042,x,y+2.947,dz,'lamp',{section:'fixtures',kind:'light',floor});
      box(g,.045,.07,.045,x,y+2.91,-.78,'metal',{section:'fixtures',kind:'sprinklerHead',floor});
    }
    for (const [x,side] of [[-16.3,-1],[-4.05,1],[8.1,-1],[18.05,1]]) fireCabinet(g,x,y,side*1.13,side);
    for (const x of [-19.4,-6.3,6.3,19.4]) {
      box(g,.76,.27,.048,x,y+2.3,-1.085,'sign',{section:'fixtures',kind:'exitSign',floor});
      box(g,.045,.19,.015,x+.12,y+2.3,-1.053,'signWhite',{section:'fixtures',kind:'exitPictogram',floor});
      box(g,.19,.027,.015,x-.17,y+2.3,-1.053,'signWhite',{section:'fixtures',kind:'exitPictogram',floor});
      box(g,.2,.07,.06,x,y+.24,-1.057,'sign',{section:'fixtures',kind:'lowExitSign',floor});
    }
  }
  const ry=building.floors*building.storeyHeight,roof=group(root,'Roof',{kind:'roof',floor:7,section:'roof'});
  box(roof,48,.25,18,0,ry+.025,0,'slab',{kind:'roofSlab'});
  box(roof,47.5,.038,17.5,0,ry+.173,0,'roof',{kind:'roofMembrane'});
  box(roof,48,.028,18,0,ry-.244,0,'ceiling',{section:'ceiling',kind:'ceiling'});
  for (const z of [-8.9,8.9]) {
    box(roof,48,.65,.2,0,ry+.45,z,'facade',{kind:'roofParapet'});
    box(roof,48.1,.065,.31,0,ry+.806,z,'concrete',{kind:'parapetCoping'});
  }
  for (const x of [-23.9,23.9]) {
    box(roof,.2,.65,18,x,ry+.45,0,'facade',{kind:'roofParapet'});
    box(roof,.31,.065,18.1,x,ry+.806,0,'concrete',{kind:'parapetCoping'});
  }
  for (const [x,z] of [[-23,0],[23,0],[2.1,-10]]) {
    box(roof,4.64,.21,5.75,x,ry+.045,z,'concrete',{kind:'stairRoof'});
    box(roof,2.1,.65,2.9,x,ry+.485,z,'facade',{kind:'stairHeadroom'});
    box(roof,2.35,.16,3.15,x,ry+.89,z,'concrete',{kind:'stairHeadroomRoof'});
  }
  for (let i=0;i<5;i++) {
    const x=-13.8+i*6.2;
    box(roof,2.1,.22,1.65,x,ry+.3,4.3,'concrete',{kind:'equipmentPlinth'});
    box(roof,1.65,.8,1.2,x,ry+.81,4.3,'trim',{kind:'roofAirConditioner'});
    for (let j=0;j<8;j++) box(roof,1.5,.023,.025,x,ry+.48+j*.085,4.922,'dark',{kind:'equipmentLouvre'});
    box(roof,.27,.65,.27,x+.95,ry+.52,4.3,'trim',{kind:'equipmentPipe'});
  }
  for (const x of [-18,-7,8,18]) {
    box(roof,.65,.55,.65,x,ry+.45,-4.6,'facade',{kind:'ventilationShaft'});
    box(roof,.84,.08,.84,x,ry+.79,-4.6,'concrete',{kind:'ventilationCap'});
  }
  const entrance=group(root,'Entrance',{floor:1,section:'structure',kind:'entrance'});
  box(entrance,4.8,.18,2.6,2.1,3.08,10.17,'concrete',{kind:'entranceCanopy'});
  for (const x of [-.08,4.28]) box(entrance,.22,3,.22,x,1.45,11.28,'concrete',{kind:'column'});
  for (let i=0;i<5;i++) box(entrance,4.8,.12,.28,2.1,-.06-i*.12,11.54+i*.28,'concrete',{kind:'entranceStep'});
  return root;
}
