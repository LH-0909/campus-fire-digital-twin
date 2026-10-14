import { building, spaceById } from './building.js';

const coordinate = point => ({ x: point.x, y: point.y, z: point.z });
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const resolveNode = value => {
  const node = typeof value === 'string' ? spaceById[value] : value;
  if (!node || ![node.x, node.y, node.z].every(Number.isFinite)) throw new Error('Navigation requires a finite building node');
  return node;
};
const northTower = node => node.id?.endsWith('-SN') || node.kind === 'stairs' && node.z < -4;

// The semantic stair node denotes the whole tower. Its physical standing point
// is on the storey landing, rather than the void between the two flights.
export function navigationPoint(value) {
  const node = resolveNode(value);
  if (node.kind !== 'stairs') return node;
  return { ...node, z: node.z + (northTower(node) ? 1.93 : -1.93) };
}

function cleanPoints(points) {
  return points.map(coordinate).filter((point, i, all) => !i || distance(point, all[i - 1]) > 1e-9);
}
function localPoint(tower, x, y, z) {
  // The north tower is turned 180 degrees; all model group transforms are zero.
  const sign = northTower(tower) ? -1 : 1;
  return { x: tower.x + x * sign, y, z: tower.z + z * sign };
}

function descendingFlights(upper, lower) {
  const offset = northTower(upper) ? 0 : Math.sign(upper.x) * .12;
  const upperFlight = .77 + offset, lowerFlight = -.77 + offset;
  const u = upper.y, l = lower.y, mid = (u + l) / 2;
  const p = (x, y, z) => localPoint(upper, x, y, z);
  return [
    navigationPoint(upper),
    p(upperFlight, u, -1.93),
    p(upperFlight, u, -1.255),
    p(upperFlight, mid, 1.655),
    p(upperFlight, mid, 2.17),
    p(lowerFlight, mid, 2.17),
    p(lowerFlight, mid, 1.655),
    p(lowerFlight, l, -1.255),
    p(lowerFlight, l, -1.93),
    navigationPoint(lower),
  ];
}

function corridorToTower(corridor, tower) {
  const start = navigationPoint(corridor), end = navigationPoint(tower);
  if (northTower(tower)) return [start, end];
  // Follow the side approach slab before turning into the landing. This strip
  // clears the main end wall and the outer edge of the adjacent stair flight.
  const approachX = tower.x - Math.sign(tower.x) * 1.62;
  return [start, { x: approachX, y: tower.y, z: 0 }, { x: approachX, y: tower.y, z: end.z }, end];
}

function towerToExit(tower, exit) {
  const start = navigationPoint(tower);
  if (northTower(tower)) {
    // Exit through the east side of the landing, behind the main north facade,
    // then follow the exterior of the tower. The tower's far window is closed.
    const outsideZ = tower.z + 1.5;
    return [
      start,
      { x: tower.x, y: tower.y, z: outsideZ },
      { x: tower.x + 2.19, y: tower.y, z: outsideZ },
      { x: tower.x + 2.6, y: tower.y, z: outsideZ },
      { x: tower.x + 2.6, y: exit.y, z: exit.z },
      navigationPoint(exit),
    ];
  }
  return [start, { x: tower.x + Math.sign(tower.x) * 2.19, y: tower.y, z: start.z }, navigationPoint(exit)];
}

/** Physical, metric centreline of a semantic graph edge. Reversed edges return
 * exactly the reversed polyline so capacity and travel lengths stay symmetric.
 */
export function edgePolyline(fromValue, toValue) {
  const from = resolveNode(fromValue), to = resolveNode(toValue);
  let points;
  if (from.kind === 'stairs' && to.kind === 'stairs' && from.floor !== to.floor) {
    if (Math.abs(from.x - to.x) > 1e-6 || Math.abs(from.z - to.z) > 1e-6) throw new Error('A stair edge must remain in one tower');
    if (Math.abs(from.floor - to.floor) !== 1 || Math.abs(Math.abs(from.y - to.y) - building.storeyHeight) > 1e-6) throw new Error('A stair edge must connect adjacent storeys');
    points = from.y > to.y ? descendingFlights(from, to) : descendingFlights(to, from).reverse();
  } else if (from.kind === 'corridor' && to.kind === 'stairs') points = corridorToTower(from, to);
  else if (from.kind === 'stairs' && to.kind === 'corridor') points = corridorToTower(to, from).reverse();
  else if (from.kind === 'stairs' && to.kind === 'exit') points = towerToExit(from, to);
  else if (from.kind === 'exit' && to.kind === 'stairs') points = towerToExit(to, from).reverse();
  else points = [navigationPoint(from), navigationPoint(to)];
  return cleanPoints(points);
}

export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

export function bindNavigationEdges(edges) {
  for(const edge of edges){edge.polyline=edgePolyline(edge.a,edge.b);edge.length=polylineLength(edge.polyline);}
}

/** Sample by travelled distance, with exact endpoints and a planar heading.
 * Positions remain continuous at turns and during both flights of a staircase.
 */
export function samplePolyline(points, t) {
  if (!Array.isArray(points) || !points.length) throw new Error('Cannot sample an empty navigation polyline');
  if (!Number.isFinite(t)) throw new Error('Navigation progress must be finite');
  const total = polylineLength(points);
  const headingFor = i => {
    i = Math.min(i, points.length - 1);
    const delta = j => ({ x: points[j].x - points[j - 1].x, z: points[j].z - points[j - 1].z });
    const current = i > 0 ? delta(i) : { x: 0, z: 0 };
    if (Math.hypot(current.x, current.z) > 1e-9) return Math.atan2(current.z, current.x);
    for (let j = i + 1; j < points.length; j++) { const d = delta(j); if (Math.hypot(d.x, d.z) > 1e-9) return Math.atan2(d.z, d.x); }
    for (let j = i - 1; j > 0; j--) { const d = delta(j); if (Math.hypot(d.x, d.z) > 1e-9) return Math.atan2(d.z, d.x); }
    return 0;
  };
  if (t <= 0 || total <= 1e-9) return { ...coordinate(points[0]), heading: headingFor(1) };
  if (t >= 1) return { ...coordinate(points.at(-1)), heading: headingFor(points.length - 1) };
  let remaining = t * total;
  for (let i = 1; i < points.length; i++) {
    const length = distance(points[i - 1], points[i]);
    if (length <= 1e-9) continue;
    if (remaining <= length) {
      const ratio = remaining / length, a = points[i - 1], b = points[i];
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio, z: a.z + (b.z - a.z) * ratio, heading: headingFor(i) };
    }
    remaining -= length;
  }
  return { ...coordinate(points.at(-1)), heading: headingFor(points.length - 1) };
}
