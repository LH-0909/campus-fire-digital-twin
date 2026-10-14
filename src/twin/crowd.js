import * as THREE from 'three';
import { spaceById } from './building.js';

// Metric adult proportions. Every part is instanced; the simulation remains the
// source of position, floor, exposure and route, rather than the animation.
const MAX_PEOPLE = 1024;
const UP = new THREE.Vector3(0, 1, 0);
const CLOTH = [0xd2d0c9, 0x9cabb5, 0x536477, 0x526663, 0xaca399, 0x737079, 0xc0b6a7, 0x454c58];
const TROUSERS = [0x293744, 0x42464b, 0x55595c, 0x363841];
const SKIN = [0xc8a184, 0xdbb495, 0xb28a6d, 0xcfa98b];
const HAIR = [0x231e1b, 0x2f251e, 0x181a1b, 0x403126];
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

function shirtGeometry(segments = 16) {
  const rings = [[0, .153, .09], [.06, .159, .105], [.25, .174, .113], [.405, .204, .107], [.45, .181, .092], [.48, .075, .06]];
  const positions = [], uv = [], indices = [];
  for (let r = 0; r < rings.length; r++) {
    const [y, width, depth] = rings[r];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      positions.push(Math.cos(a) * width, y, Math.sin(a) * depth);
      uv.push(i / segments, y / .48);
      if (r && i) {
        const b = r * (segments + 1) + i;
        indices.push(b - 1, b, b - segments - 2, b, b - segments - 1, b - segments - 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createCrowd(scene) {
  const group = new THREE.Group(); group.name = 'ArticulatedStudentCrowd';
  scene.add(group);
  const geometries = new Set(), materials = new Set(), parts = {};
  const ownGeometry = g => { geometries.add(g); return g; };
  const ownMaterial = opts => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, ...opts });
    materials.add(material); return material;
  };
  const sphere = ownGeometry(new THREE.SphereGeometry(1, 12, 9));
  const sphereFar = ownGeometry(new THREE.SphereGeometry(1, 8, 6));
  const limb = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const limbFar = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 6));
  const shoe = ownGeometry(new THREE.CapsuleGeometry(.5, .9, 3, 10));
  const shoeFar = ownGeometry(new THREE.CapsuleGeometry(.5, .9, 2, 6));
  const shirt = ownGeometry(shirtGeometry());
  const shirtFar = ownGeometry(shirtGeometry(8));
  const collar = ownGeometry(new THREE.TorusGeometry(.061, .013, 5, 12));
  const ring = ownGeometry(new THREE.RingGeometry(.225, .255, 24));
  const fabric = ownMaterial({ roughness: .98 });
  const skin = ownMaterial({ roughness: .64 });
  const hair = ownMaterial({ roughness: .86 });
  const dark = ownMaterial({ color: 0x292c30, roughness: .94 });
  const shoes = ownMaterial({ color: 0x353c42, roughness: .8 });
  const soles = ownMaterial({ color: 0x9fa3a2, roughness: 1 });
  const eye = ownMaterial({ color: 0x282220, roughness: .6 });
  const risk = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide });
  materials.add(risk);
  function part(name, geometry, material, multiplier = 1) {
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_PEOPLE * multiplier);
    mesh.name = `student-${name}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = name !== 'risk'; mesh.receiveShadow = false;
    mesh.frustumCulled = false; mesh.count = 0;
    const low = geometry === sphere ? sphereFar : geometry === limb ? limbFar : geometry === shoe ? shoeFar : geometry === shirt ? shirtFar : geometry;
    group.add(mesh); parts[name] = { mesh, cursor: 0, high: geometry, low };
  }
  part('shirt', shirt, fabric); part('neck', limb, skin); part('head', sphere, skin);
  part('hair', sphere, hair); part('long-hair', sphere, hair);
  part('ears', sphere, skin, 2); part('eyes', sphere, eye, 2); part('nose', sphere, skin);
  part('collar', collar, fabric); part('waist', sphere, fabric);
  part('upper-arms', limb, fabric, 2); part('lower-arms', limb, fabric, 2);
  part('hands', sphere, skin, 2); part('cuffs', limb, fabric, 2);
  part('thighs', limb, fabric, 2); part('shins', limb, fabric, 2);
  part('knees', sphere, fabric, 2); part('shoes', shoe, shoes, 2); part('soles', shoe, soles, 2);
  part('backpack', sphere, dark); part('straps', limb, dark, 2); part('bag-seam', limb, dark);
  part('risk', ring, risk);

  const base = new THREE.Matrix4(), upperBody = new THREE.Matrix4(), local = new THREE.Matrix4(), world = new THREE.Matrix4();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), direction = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), rotation = new THREE.Quaternion(), yaw = new THREE.Quaternion();
  const color = new THREE.Color(), pointA = new THREE.Vector3(), pointB = new THREE.Vector3();
  const tracking = new Map();
  let disposed = false, lastFrame = -Infinity, lastMode = '', lastFloor = -1, lastLayer = '';
  const zero = new THREE.Vector3(), axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);

  function emit(name, parent, x, y, z, sx, sy, sz, tint, rotationAxis = null, angle = 0) {
    const p = parts[name], index = p.cursor++;
    position.set(x, y, z); scale.set(sx, sy, sz);
    if (rotationAxis) quaternion.setFromAxisAngle(rotationAxis, angle); else quaternion.identity();
    local.compose(position, quaternion, scale); world.multiplyMatrices(parent, local);
    p.mesh.setMatrixAt(index, world);
    if (tint !== undefined) p.mesh.setColorAt(index, color.setHex(tint));
  }
  function segment(name, parent, a, b, radiusX, radiusZ, tint) {
    const p = parts[name], index = p.cursor++;
    direction.subVectors(b, a); const length = direction.length();
    quaternion.setFromUnitVectors(UP, direction.normalize());
    position.addVectors(a, b).multiplyScalar(.5); scale.set(radiusX, length, radiusZ);
    local.compose(position, quaternion, scale); world.multiplyMatrices(parent, local);
    p.mesh.setMatrixAt(index, world);
    if (tint !== undefined) p.mesh.setColorAt(index, color.setHex(tint));
  }

  function update(twin, { mode = 'building', floor = 3, now = 0, camera, layer = 'people', includePlayer=false, walkTime=0 } = {}) {
    if (disposed || !twin?.agents) return;
    const activeFloor = mode === 'student' ? twin.student?.floor || floor : floor;
    // Updating an entire articulated crowd at 30 Hz is sufficient. The render
    // loop and the authoritative simulation continue at their own frequencies.
    if (now - lastFrame < 32 && mode === lastMode && activeFloor === lastFloor && layer === lastLayer) return;
    lastFrame = now; lastMode = mode; lastFloor = activeFloor; lastLayer = layer;
    Object.values(parts).forEach(p => { p.cursor = 0; p.mesh.geometry = mode === 'student' ? p.high : p.low; });
    const time = Number.isFinite(twin.time) ? twin.time : now * .001;
    const agents = twin.agents.slice(0, MAX_PEOPLE-1);
    if(includePlayer)agents.push({...twin.student,id:0,player:true,heading:twin.student.bodyHeading??twin.student.heading});
    for (const a of agents) {
      if (a.escaped || (mode !== 'building' && mode !== 'exterior' && a.floor !== activeFloor)) continue;
      const id = a.id || 0, field = twin.fields?.[a.node] || {};
      const smoke = Number(field.smoke) || 0;
      const bend = a.player&&a.crouching?.75:clamp((smoke - .035) * 1.45, 0, .58);
      const walking = a.player?a.moving:Boolean(a.edge)&&!a.trapped;
      const gait = walking ? Math.sin((a.player?walkTime:time) * 6.8 + id * .73) : 0;
      let record = tracking.get(id);
      if (!record) { record = { x: a.x, z: a.z, heading: ((id * 127) % 360) * Math.PI / 180 }; tracking.set(id, record); }
      const target = a.edge && spaceById[a.edge.to];
      const dx = target ? target.x - a.x : a.x - record.x, dz = target ? target.z - a.z : a.z - record.z;
      if ((a.edge||a.player) && Number.isFinite(a.heading)) record.heading = Math.PI / 2 - a.heading;
      else if (dx * dx + dz * dz > .0025) record.heading = Math.atan2(dx, dz);
      record.x = a.x; record.z = a.z;
      const stature = .94 + (id % 9) * .013;
      const shoulderWidth = id % 5 === 0 ? .92 : 1;
      yaw.setFromAxisAngle(axisY, record.heading);
      position.set(a.x, a.y + .045, a.z); scale.set(stature * shoulderWidth, stature, stature);
      base.compose(position, yaw, scale);
      const hipHeight = .89 - bend * .235 + (walking ? Math.abs(gait) * .012 : 0);
      position.set(0, hipHeight, 0); rotation.setFromAxisAngle(axisX, bend);
      upperBody.compose(position, rotation, scale.set(1, 1, 1)); upperBody.premultiply(base);
      const clothColor = a.player?0x2789c9:CLOTH[id % CLOTH.length], pantsColor = TROUSERS[(id * 3) % TROUSERS.length];
      const skinColor = SKIN[id % SKIN.length], hairColor = HAIR[id % HAIR.length];
      emit('shirt', upperBody, 0, .01, 0, 1, 1, 1, clothColor);
      emit('waist', base, 0, hipHeight + .015, 0, .154, .125, .098, pantsColor);
      emit('neck', upperBody, 0, .525, 0, .052, .085, .046, skinColor);
      emit('collar', upperBody, 0, .48, .002, 1, .8, 1, clothColor, axisX, -Math.PI / 2);
      emit('head', upperBody, 0, .675, .015, .112, .142, .105, skinColor);
      emit('hair', upperBody, 0, .751, -.013, .115, .079, .107, hairColor);
      if (id % 5 === 0) emit('long-hair', upperBody, 0, .625, -.082, .104, .18, .037, hairColor);
      const cameraDistance = camera ? Math.hypot(camera.position.x - a.x, camera.position.y - a.y, camera.position.z - a.z) : 50;
      // Tiny face parts are rendered only where a camera can resolve them.
      if (mode === 'student' && cameraDistance < 14) {
        for (const side of [-1, 1]) {
          emit('ears', upperBody, side * .114, .669, -.002, .019, .029, .014, skinColor);
          emit('eyes', upperBody, side * .039, .694, .105, .007, .005, .003);
        }
        emit('nose', upperBody, 0, .669, .119, .014, .025, .021, skinColor);
      }
      for (const side of [-1, 1]) {
        const swing = gait * (side === -1 ? 1 : -1);
        const thighAngle = swing * (bend ? .26 : .39) + bend * 1.05;
        const shinAngle = thighAngle - bend * 1.82 - (walking ? Math.max(0, -swing) * .42 : 0);
        const hip = [.095 * side, hipHeight - .025, 0];
        const knee = [hip[0], hip[1] - Math.cos(thighAngle) * .395, Math.sin(thighAngle) * .395];
        const ankle = [hip[0], Math.max(.063, knee[1] - Math.cos(shinAngle) * .405), knee[2] + Math.sin(shinAngle) * .405];
        segment('thighs', base, pointA.set(...hip), pointB.set(...knee), .078, .085, pantsColor);
        segment('shins', base, pointA.set(...knee), pointB.set(...ankle), .057, .064, pantsColor);
        emit('knees', base, ...knee, .078, .087, .08, pantsColor);
        emit('shoes', base, ankle[0], ankle[1] - .025, ankle[2] + .041, .145, .17, .085, undefined, axisX, Math.PI / 2);
        emit('soles', base, ankle[0], ankle[1] - .052, ankle[2] + .041, .15, .174, .015, undefined, axisX, Math.PI / 2);

        const protecting = (smoke > .15||a.player&&a.towel) && side === 1;
        const armSwing = -swing * .055;
        const shoulder = [.197 * side, .418, 0];
        const elbow = protecting ? [.22 * side, .19, .18] : [.225 * side, .145, armSwing];
        const wrist = protecting ? [.044 * side, .585, .134] : [.218 * side, -.102, armSwing + .04];
        segment('upper-arms', upperBody, pointA.set(...shoulder), pointB.set(...elbow), .06, .065, clothColor);
        segment('lower-arms', upperBody, pointA.set(...elbow), pointB.set(...wrist), .044, .049, clothColor);
        emit('cuffs', upperBody, wrist[0], wrist[1] + .012, wrist[2], .046, .026, .047, clothColor);
        emit('hands', upperBody, wrist[0], wrist[1] - (protecting ? 0 : .043), wrist[2] + (protecting ? .006 : 0), .035, .054, .027, skinColor, axisX, protecting ? Math.PI / 2 : .1);
        if (id % 4 !== 0||a.player) segment('straps', upperBody, pointA.set(side * .112, .435, .11), pointB.set(side * .108, .16, .116), .012, .012);
      }
      if (id % 4 !== 0||a.player) {
        emit('backpack', upperBody, 0, .265, -.158, .139, .215, .07);
        segment('bag-seam', upperBody, pointA.set(-.115, .225, -.211), pointB.set(.115, .225, -.211), .006, .006);
      }
      if ((field.risk || 0) > .22 || a.trapped||a.player) {
        const tint = a.player?0x35caff:a.trapped ? 0xdb5550 : field.risk > .5 ? 0xd87551 : 0xbb9b62;
        emit('risk', base, 0, .014, 0, 1, 1, 1, tint, axisX, -Math.PI / 2);
      }
    }
    Object.values(parts).forEach(p => {
      p.mesh.count = p.cursor; p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    });
  }
  function dispose() {
    if (disposed) return; disposed = true;
    scene.remove(group); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    Object.values(parts).forEach(p => p.mesh.dispose()); tracking.clear();
  }
  return { update, dispose, group };
}
