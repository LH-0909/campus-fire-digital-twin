import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createOutdoorMaterial } from './materials.js';

function seededRandom(seed = 37) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}

function metricBox(width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i));
    if (ny > .5) uv.setXY(i, position.getX(i), position.getZ(i));
    else if (nx > .5) uv.setXY(i, position.getZ(i), position.getY(i));
    else uv.setXY(i, position.getX(i), position.getY(i));
  }
  return geometry;
}

function leafGeometry() {
  // Curved broad leaves have a rib and tapered tips. A leaf is a small surface,
  // not an opaque sphere, so gaps and branches remain visible in the canopy.
  const positions = [];
  const rib = [0, 0, .08];
  const edge = [[0, -.58, 0], [.34, 0, .035], [0, .58, 0], [-.34, 0, .035]];
  for (let i = 0; i < edge.length; i++) positions.push(...rib, ...edge[i], ...edge[(i + 1) % edge.length]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Metric surrounding campus scenery. This is explicitly a plausible context,
 * independent of the dormitory's semantic evacuation spaces and IFC geometry.
 * Returns the added group; it has no timers or animation loop.
 */
export function createCampus(scene) {
  const root = new THREE.Group();
  root.name = 'CampusContext';
  root.userData = { kind: 'context', surveyed: false, units: 'm' };
  scene.add(root);
  const random = seededRandom();
  const chunks = new Map();
  const materials = {
    ground: new THREE.MeshStandardMaterial({ color: 0x263d31, roughness: 1 }),
    road: createOutdoorMaterial('road'),
    paving: createOutdoorMaterial('paving'),
    facade: createOutdoorMaterial('facade'),
    roof: new THREE.MeshStandardMaterial({ color: 0x4b5055, roughness: .9 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x8c9296, roughness: .9 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3b4147, roughness: .42, metalness: .5 }),
    window: new THREE.MeshStandardMaterial({ color: 0x203039, roughness: .28, metalness: .3 }),
    warmWindow: new THREE.MeshStandardMaterial({ color: 0x75644c, emissive: 0xd6aa6c, emissiveIntensity: .27, roughness: .38 }),
    coolWindow: new THREE.MeshStandardMaterial({ color: 0x566b70, emissive: 0x81989c, emissiveIntensity: .14, roughness: .35 }),
    marking: new THREE.MeshStandardMaterial({ color: 0x909c9d, roughness: .92 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x353b29, roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x484130, roughness: .96 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe8be, emissive: 0xffc87d, emissiveIntensity: 1.1 }),
  };
  function addGeometry(geometry, matrix, kind) {
    geometry.applyMatrix4(matrix);
    if (!chunks.has(kind)) chunks.set(kind, []);
    chunks.get(kind).push(geometry);
  }
  const temp = new THREE.Object3D();
  function box(w, h, d, x, y, z, kind, rotation = 0) {
    temp.position.set(x, y, z); temp.rotation.set(0, rotation, 0); temp.scale.set(1, 1, 1); temp.updateMatrix();
    addGeometry(metricBox(w, h, d), temp.matrix, kind);
  }
  function limb(a, b, bottomRadius, topRadius) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(topRadius, bottomRadius, direction.length(), 8, 1);
    temp.position.copy(a).add(b).multiplyScalar(.5);
    temp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    temp.scale.set(1, 1, 1); temp.updateMatrix(); addGeometry(g, temp.matrix, 'trunk');
  }

  box(240, .3, 200, 0, -.44, -10, 'ground');
  // The building and exits rest on one coherent paved precinct.
  box(62, .12, 35, 0, -.23, -.7, 'paving');
  box(180, .08, 9, 0, -.18, 23, 'road');
  box(6.5, .08, 135, -36, -.18, -27, 'road');
  box(6.5, .08, 135, 36, -.18, -27, 'road');
  box(155, .08, 6, 0, -.18, -25, 'road');
  box(160, .13, 3.2, 0, -.17, 16.7, 'paving');
  box(160, .13, 2.8, 0, -.17, 29.2, 'paving');
  for (const z of [18.5, 27.6]) box(160, .17, .22, 0, -.07, z, 'edge');
  for (const x of [-39.4, -32.6, 32.6, 39.4]) box(.2, .17, 125, x, -.07, -26, 'edge');
  // Low contrast road paint, crossings and parking bays; no luminous grid.
  for (let x = -73; x < 74; x += 8) box(3, .007, .10, x, -.133, 23, 'marking');
  for (const x of [-36, 36]) for (let z = -23; z <= 21; z += 1.6) if (z > 17) box(5.3, .007, .55, x, -.13, z, 'marking');
  for (let i = 0; i < 10; i++) {
    const x = -20 + i * 4.2;
    box(.09, .007, 5, x, -.13, -21, 'marking');
    box(4.2, .007, .09, x + 2.1, -.13, -23.5, 'marking');
  }

  function contextBuilding(x, z, width, depth, floors, variant) {
    const h = floors * 3.25;
    box(width, h, depth, x, h / 2 -.18, z, 'facade');
    box(width + .7, .35, depth + .7, x, h + .08, z, 'edge');
    box(width -.7, .06, depth -.7, x, h + .28, z, 'roof');
    // Recessed window bands and mullions retain depth at oblique views.
    const bays = Math.floor((width - 2) / 3.5);
    for (let f = 0; f < floors; f++) {
      const y = f * 3.25 + 1.65;
      box(width + .14, .18, depth + .14, x, f * 3.25 + .2, z, 'edge');
      for (let i = 0; i < bays; i++) for (const side of [-1, 1]) {
        const wx = x - width / 2 + 2 + i * (width - 4) / Math.max(1, bays - 1);
        const wz = z + side * (depth / 2 + .022);
        box(2.25, 1.6, .05, wx, y, wz, 'frame');
        const probability = random();
        const windowKind = probability < .12 ? 'warmWindow' : probability < .24 ? 'coolWindow' : 'window';
        box(2.08, 1.43, .04, wx, y, wz + side * .018, windowKind);
        box(.045, 1.43, .06, wx, y, wz + side * .055, 'frame');
        box(2.36, .10, .19, wx, y -.85, wz, 'edge');
      }
      for (const side of [-1, 1]) for (let i = 0; i < Math.floor(depth / 4); i++) {
        const wz = z - depth / 2 + 2 + i * 4;
        box(.06, 1.55, 1.9, x + side * (width / 2 + .026), y, wz, 'window');
      }
    }
    const entranceX = x + (variant % 2 ? width * .12 : -width * .12);
    box(3.2, 2.5, .10, entranceX, 1.13, z + depth / 2 + .07, 'window');
    box(4.5, .18, 2.4, entranceX, 2.53, z + depth / 2 + 1.1, 'edge');
    for (const dx of [-1.8, 1.8]) box(.16, 2.5, .16, entranceX + dx, 1.08, z + depth / 2 + 1.9, 'frame');
    for (let i = 0; i < 3; i++) box(4.6, .10, 1.1 - i * .22, entranceX, -.08 + i * .1, z + depth / 2 + 2, 'paving');
    for (let i = 0; i < 3; i++) {
      box(1.7, .7, 1.3, x - width * .28 + i * width * .24, h + .63, z + depth * .22, 'roof');
      box(2.1, .08, 1.7, x - width * .28 + i * width * .24, h + 1.0, z + depth * .22, 'edge');
    }
  }
  [[-58, -6, 24, 20, 5], [61, -8, 28, 18, 5], [-56, -53, 30, 19, 4], [-11, -52, 38, 22, 5], [44, -57, 32, 24, 4], [-84, -46, 22, 35, 6], [84, -48, 24, 31, 5], [-55, 50, 32, 20, 4]].forEach((p, i) => contextBuilding(...p, i));

  // Furnished paved edges bring human-scale detail to the campus precinct.
  for (const x of [-24, 0, 24]) {
    box(2.1, .10, .52, x, .44, 16.3, 'trunk');
    for (const dx of [-.8, .8]) box(.09, .44, .40, x + dx, .19, 16.3, 'frame');
    box(2.1, .52, .07, x, .77, 16.0, 'trunk');
  }
  for (const x of [-28, -12, 12, 28]) {
    box(.13, 4.3, .13, x, 2.05, 18.0, 'frame');
    box(.8, .10, .28, x + .29, 4.19, 18.0, 'frame');
    box(.55, .04, .21, x + .29, 4.12, 18.0, 'lamp');
  }

  const treePositions = [];
  for (const z of [-33, 34]) for (let x = -73; x <= 73; x += 12.2) treePositions.push([x + (random() - .5) * 2, z + (random() - .5) * 2, 6.3 + random() * 2.3]);
  for (const x of [-44, 44]) for (let z = -19; z <= 14; z += 10.6) treePositions.push([x + (random() - .5) * 1.5, z, 5.7 + random() * 1.4]);
  for (const x of [-27, -15, 0, 15, 27]) treePositions.push([x, 13.9, 4.4 + random() * .7]);
  const leavesPerTree = 600;
  const leafCount = treePositions.length * leavesPerTree;
  const leafMaterials = [0x25402c, 0x34553a, 0x466649].map(color => new THREE.MeshStandardMaterial({ color, roughness: .88, side: THREE.DoubleSide }));
  const geometry = leafGeometry();
  const leafMeshes = leafMaterials.map(m => new THREE.InstancedMesh(geometry, m, Math.ceil(leafCount / 3)));
  const counts = [0, 0, 0];
  const leaf = new THREE.Object3D();
  for (const [x, z, height] of treePositions) {
    const crownY = height * .75;
    const crownRadius = height * .32;
    const origin = new THREE.Vector3(x, -.16, z);
    const fork = new THREE.Vector3(x + (random() - .5) * .25, height * .48, z + (random() - .5) * .18);
    limb(origin, fork, .17 + height * .009, .085);
    const endpoints = [];
    for (let b = 0; b < 10; b++) {
      const angle = b / 10 * Math.PI * 2 + random() * .4;
      const radius = crownRadius * (.57 + random() * .42);
      const tip = new THREE.Vector3(x + Math.cos(angle) * radius, crownY + (random() - .45) * height * .24, z + Math.sin(angle) * radius);
      const elbow = fork.clone().lerp(tip, .55); elbow.y += .22;
      limb(fork, elbow, .045 + random() * .025, .025);
      limb(elbow, tip, .025, .008);
      endpoints.push(tip);
      for (let s = 0; s < 3; s++) {
        const twig = tip.clone().add(new THREE.Vector3((random() - .5) * .7, .3 + random() * .45, (random() - .5) * .7));
        limb(elbow.clone().lerp(tip, .6), twig, .011, .003);
      }
    }
    box(.9, .03, .9, x, -.13, z, 'soil');
    for (let i = 0; i < leavesPerTree; i++) {
      const anchor = endpoints[i % endpoints.length];
      // More foliage around branch ends, with irregular layered silhouettes.
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * crownRadius * .59;
      leaf.position.set(anchor.x + Math.cos(angle) * radius, anchor.y + (random() - .45) * crownRadius * .85, anchor.z + Math.sin(angle) * radius);
      leaf.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const scale = .27 + random() * .22;
      leaf.scale.set(scale, scale * (1.1 + random() * .25), scale);
      leaf.updateMatrix();
      const color = i % 3; leafMeshes[color].setMatrixAt(counts[color]++, leaf.matrix);
    }
  }
  for (let i = 0; i < leafMeshes.length; i++) {
    const mesh = leafMeshes[i]; mesh.name = `CampusFoliage_${i}`; mesh.count = counts[i]; mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }

  for (const [kind, geometries] of chunks) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, materials[kind]);
    mesh.name = `Campus_${kind}`;
    mesh.receiveShadow = true;
    mesh.castShadow = ['facade', 'roof', 'edge', 'frame', 'trunk'].includes(kind);
    root.add(mesh);
  }
  return root;
}
