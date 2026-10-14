import * as THREE from 'three';

// The GLB stores metric UVs (one UV unit is one metre). These photographic
// CC0 maps keep surface detail at the same physical scale across every mesh.
const textures = new Map();
const loader = new THREE.TextureLoader();
const base = `${import.meta.env?.BASE_URL||'/'}assets/materials/`;

function texture(asset, map, metres, { rotation = 0 } = {}) {
  const key = `${asset}:${map}:${metres}:${rotation}`;
  if (!textures.has(key)) {
    const t = loader.load(`${base}${asset}-${map}.jpg`);
    t.name = key;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / metres, 1 / metres);
    t.center.set(.5, .5);
    t.rotation = rotation;
    t.anisotropy = 8;
    t.colorSpace = map === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    textures.set(key, t);
  }
  return textures.get(key);
}

function pbr(material, asset, metres, { color = 0xffffff, roughness = .9, normal = .3, rotation = 0, desaturate = 0, paint = 0 } = {}) {
  material.color.set(color);
  material.map = texture(asset, 'diff', metres, { rotation });
  material.normalMap = texture(asset, 'normal', metres, { rotation });
  material.roughnessMap = texture(asset, 'roughness', metres, { rotation });
  material.normalScale.set(normal, normal);
  material.roughness = roughness;
  material.metalness = 0;
  if (desaturate||paint) {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `vec3 paintBase=diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${desaturate.toFixed(3)});\ndiffuseColor.rgb=mix(diffuseColor.rgb,paintBase,${paint.toFixed(3)});`);
    };
    material.customProgramCacheKey = () => `surface-coating-${desaturate}-${paint}`;
  }
}

/** Apply browser-loaded photographic PBR maps to a cloned GLB material. */
export function applyArchitecturalMaterials(material) {
  const name = material.name;
  material.envMapIntensity = .7;
  // Opaque walls are retained; section cuts, rather than transparency, reveal rooms.
  if (!['glass', 'fireGlass'].includes(name)) {
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
  }
  switch (name) {
    case 'wall':
    case 'ceiling':
      pbr(material, 'white_plaster_02', 1, { color: name === 'ceiling' ? 0xe8e8e3 : 0xf6f3ed, normal: .12, paint:name==='ceiling'?.65:.44 });
      break;
    case 'facade':
      pbr(material, 'white_plaster_02', 1, { color: 0xe3e3de, normal: .16, paint:.55 });
      break;
    case 'concrete':
    case 'slab':
    case 'roof':
      pbr(material, 'concrete_wall_006', 2, { color: name === 'roof' ? 0x8e9293 : 0xe5e3dd, normal: .3, desaturate: .75 });
      break;
    case 'tile':
      // The source tile grid is diagonal. Rotating all three maps aligns the
      // grout with the corridor axes, with approximately 0.6 m ceramic tiles.
      pbr(material, 'interior_tiles', 1.7, { normal: .27, roughness: .44, rotation: Math.PI / 4, desaturate: .8 });
      break;
    case 'roomTile':
      pbr(material, 'interior_tiles', 1.7, { color: 0xe6e3d9, normal: .18, roughness: .75, rotation: Math.PI / 4, desaturate: .65 });
      break;
    case 'wainscot':
      pbr(material, 'white_plaster_02', 1, { color: 0xacb7b1, normal: .1, roughness: .73 });
      break;
    case 'wood':
    case 'desk':
    case 'doorFrame':
      pbr(material, 'fine_grained_wood', .6, { color: name === 'wood' ? 0x7b5030 : name === 'doorFrame' ? 0x533b2a : 0xcba478, normal: .2, roughness: .63 });
      break;
    case 'skirting':
      pbr(material, 'concrete_wall_006', 2, { color: 0x666d70, normal: .1, roughness: .7, desaturate: 1 });
      break;
    case 'trim':
    case 'metal':
    case 'handrail':
      material.color.set(name === 'metal' ? 0x555f63 : name === 'handrail' ? 0xaaaeb0 : 0x657079);
      material.metalness = name === 'handrail' ? .88 : .68;
      material.roughness = name === 'handrail' ? .26 : .43;
      material.envMapIntensity = 1;
      break;
    case 'glass':
      material.color.set(0x8ca5ab);
      material.transparent = true;
      material.opacity = .24;
      material.depthWrite = false;
      material.metalness = .28;
      material.roughness = .13;
      material.envMapIntensity = 1.3;
      break;
    case 'fireGlass':
      material.color.set(0x839b9d);
      material.transparent = true;
      material.opacity = .25;
      material.depthWrite = false;
      material.metalness = .15;
      material.roughness = .19;
      break;
    case 'lamp':
      material.color.set(0xfff7df);
      material.emissive.set(0xffd49a);
      material.emissiveIntensity = 1.8;
      material.roughness = .35;
      break;
    case 'sign':
      material.color.set(0x167b45);
      material.emissive.set(0x0e8d43);
      material.emissiveIntensity = .45;
      material.roughness = .5;
      break;
    case 'signWhite':
      material.color.set(0xd5efdc);
      material.emissive.set(0x8ab89c);
      material.emissiveIntensity = .35;
      break;
    case 'fireRed':
      material.color.set(0x9c2925);
      material.metalness = .25;
      material.roughness = .46;
      break;
    default:
      material.roughness = Math.max(material.roughness, .72);
      break;
  }
  material.needsUpdate = true;
  return material;
}

export function createOutdoorMaterial(kind) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  material.name = `campus-${kind}`;
  if (kind === 'road') pbr(material, 'asphalt_02', 3, { color: 0x878d95, normal: .38 });
  else if (kind === 'paving') pbr(material, 'concrete_pavement', 1.8, { color: 0xa2a7aa, normal: .28, desaturate: .9 });
  else pbr(material, 'grey_plaster', 1, { color: 0xa1a2a0, normal: .2, desaturate: .65 });
  return material;
}

/** Call after all objects sharing these maps have been removed from the scene. */
export function disposeArchitecturalTextures() {
  for (const t of textures.values()) t.dispose();
  textures.clear();
}
