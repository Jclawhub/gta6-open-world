// Solmar Bay: a grid city with a beach on the west edge, a marina in the
// south, a plaza, the docks in the east and Old Town in the north. Buildings
// are solid rectangles; roads are the gaps between blocks. Cars and
// pedestrians spawn on the roads, never inside a building.
import { WORLD, COLORS } from './config.js';
import { mulberry32, range, pick } from './random.js';

export const DISTRICTS = [
  { name: 'Marina', x: 300, y: 2100, w: 700, h: 420 },
  { name: 'Grand Hotel', x: 2400, y: 300, w: 500, h: 300 },
  { name: 'Central Plaza', x: 1500, y: 1150, w: 600, h: 500 },
  { name: 'The Docks', x: 3000, y: 2000, w: 480, h: 420 },
  { name: 'Old Town Safehouse', x: 500, y: 250, w: 500, h: 350 },
  { name: 'Solmar Bank', x: 1650, y: 1300, w: 300, h: 200 },
  { name: 'Sunset Pier', x: 0, y: 1250, w: 260, h: 120 },
];

// Landmarks that make each district read at a glance: the plaza fountain,
// the wooden pier jutting into the bay, a striped lighthouse by the marina,
// and two rooftop billboards over the avenues.
export const LANDMARKS = [
  { type: 'fountain', x: 1800, y: 1400, r: 42 },
  { type: 'pier', x: 0, y: 1250, w: 200, h: 120 },
  { type: 'lighthouse', x: 80, y: 2450 },
  { type: 'billboard', x: 1560, y: 470, w: 180, h: 60, text: 'SOLMAR' },
  { type: 'billboard', x: 2760, y: 1670, w: 180, h: 60, text: 'SUNSET' },
];

// The beach strip on the west edge stays open: the first building column
// starts at x = 204, so the sand and the water are never built on.
export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const pitch = WORLD.block;
  // Buildings sit in the cells BETWEEN the roads. Each cell is centred on a
  // 300-line (300, 600, ...) and spans 228 px, so the 72 px road strips and
  // the 18 px sidewalks stay clear on every side. Roads and buildings agree:
  // cars drive on the dark strips, never through a wall.
  const cell = pitch - WORLD.road; // 228
  const cols = Math.floor(WORLD.width / pitch) - 1;
  const rows = Math.floor(WORLD.height / pitch) - 1;
  for (let bx = 0; bx < cols; bx += 1) {
    for (let by = 0; by < rows; by += 1) {
      const cx = (bx + 1) * pitch; // 300, 600, ...
      const cy = (by + 1) * pitch; // 300, 600, ...
      const inner = cell - WORLD.sidewalk * 2;
      const x0 = cx - cell / 2 + WORLD.sidewalk;
      const y0 = cy - cell / 2 + WORLD.sidewalk;
      // Keep the plaza open in the middle of the map.
      if (bx >= 5 && bx <= 6 && by >= 4 && by <= 5) continue;
      const inset = range(rng, 0, 26);
      buildings.push({
        x: x0 + inset / 2,
        y: y0 + inset / 2,
        w: inner - inset,
        h: inner - inset,
        color: pick(rng, COLORS.building),
        roof: rng() > 0.5,
      });
    }
  }
  // Roads: vertical avenues and horizontal streets, as centre lines.
  const avenues = [];
  for (let x = WORLD.block / 2; x < WORLD.width; x += WORLD.block) avenues.push(x);
  const streets = [];
  for (let y = WORLD.block / 2; y < WORLD.height; y += WORLD.block) streets.push(y);
  return { seed, buildings, avenues, streets, rng };
}

// The building at point (x, y), or null when the point is in the open.
export function hitsBuilding(world, x, y) {
  for (const b of world.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps and keep it inside the
// map. Returns the corrected position; the caller decides what the impact
// means (a bounce, a skid, a slide).
export function collideCircle(world, x, y, radius) {
  let nx = x;
  let ny = y;
  for (const b of world.buildings) {
    const closestX = Math.max(b.x, Math.min(nx, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - closestX;
    const dy = ny - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) {
      // Dead centre of a wall: shove straight up out of it.
      ny = b.y - radius;
    } else {
      const d = Math.sqrt(d2);
      nx = closestX + (dx / d) * radius;
      ny = closestY + (dy / d) * radius;
    }
  }
  nx = Math.max(radius, Math.min(WORLD.width - radius, nx));
  ny = Math.max(radius, Math.min(WORLD.height - radius, ny));
  return { x: nx, y: ny };
}

// Nearest point on the road network to (x, y): used to snap traffic and
// police onto a road instead of spawning them inside a block.
export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of world.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) {
      bestD = d;
      best = { x: ax, y, vertical: true };
    }
  }
  for (const sy of world.streets) {
    const d = Math.abs(y - sy);
    if (d < bestD) {
      bestD = d;
      best = { x, y: sy, vertical: false };
    }
  }
  return best;
}

export function districtByName(name) {
  return DISTRICTS.find((d) => d.name === name);
}

// True when the point is on a road strip (within half the road width of a
// centre line): handy for spawn checks and screenshot staging.
export function isOnRoad(world, x, y) {
  const half = WORLD.road / 2;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

// A random point on the road network: spawn point for traffic and police.
export function randomRoadPoint(world, rng) {
  if (rng() > 0.5) {
    return { x: pick(rng, world.avenues), y: range(rng, 150, WORLD.height - 150) };
  }
  return { x: range(rng, 150, WORLD.width - 150), y: pick(rng, world.streets) };
}
