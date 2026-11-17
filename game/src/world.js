// Solmar Bay: a grid city with a beach on the west edge, a marina in the south,
// a plaza, the docks in the east and Old Town in the north. Buildings are solid
// rectangles; roads are the gaps between blocks. Cars and pedestrians spawn on roads.
import { WORLD, COLORS } from './config.js';
import { mulberry32, range, pick } from './random.js';

export const DISTRICTS = [
  { name: 'Marina', x: 300, y: 2100, w: 700, h: 420 },
  { name: 'Grand Hotel', x: 2400, y: 300, w: 500, h: 300 },
  { name: 'Central Plaza', x: 1500, y: 1150, w: 600, h: 500 },
  { name: 'The Docks', x: 3000, y: 2000, w: 480, h: 420 },
  { name: 'Old Town Safehouse', x: 500, y: 250, w: 500, h: 350 },
];

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const pitch = WORLD.block;
  const roadHalf = WORLD.road / 2;
  for (let bx = 0; bx < WORLD.width / pitch; bx += 1) {
    for (let by = 0; by < WORLD.height / pitch; by += 1) {
      const x0 = bx * pitch + roadHalf + WORLD.sidewalk;
      const y0 = by * pitch + roadHalf + WORLD.sidewalk;
      const w = pitch - WORLD.road - WORLD.sidewalk * 2;
      const h = pitch - WORLD.road - WORLD.sidewalk * 2;
      // Keep the plaza open in the middle of the map.
      if (bx >= 5 && bx <= 6 && by >= 4 && by <= 5) continue;
      // The beach strip on the west edge stays open.
      if (bx === 0) continue;
      const color = pick(rng, COLORS.building);
      const inset = range(rng, 0, 26);
      buildings.push({
        x: x0 + inset / 2,
        y: y0 + inset / 2,
        w: w - inset,
        h: h - inset,
        color,
        roof: range(rng, 0, 1) > 0.5,
      });
    }
  }
  // Roads: vertical avenues and horizontal streets (centre lines).
  const avenues = [];
  for (let x = WORLD.block / 2; x < WORLD.width; x += WORLD.block) avenues.push(x);
  const streets = [];
  for (let y = WORLD.block / 2; y < WORLD.height; y += WORLD.block) streets.push(y);
  return { seed, buildings, avenues, streets, rng };
}

// Is the point (x, y) inside any building?
export function hitsBuilding(world, x, y) {
  for (const b of world.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings; returns the corrected position.
export function collideCircle(world, x, y, radius) {
  let nx = x;
  let ny = y;
  for (const b of world.buildings) {
    const closestX = Math.max(b.x, Math.min(nx, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - closestX;
    const dy = ny - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        ny = b.y - radius;
      } else {
        const d = Math.sqrt(d2);
        nx = closestX + (dx / d) * radius;
        ny = closestY + (dy / d) * radius;
      }
    }
  }
  nx = Math.max(radius, Math.min(WORLD.width - radius, nx));
  ny = Math.max(radius, Math.min(WORLD.height - radius, ny));
  return { x: nx, y: ny };
}

// Nearest point on the road network to (x, y): used to snap traffic onto roads.
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

// A random point on the road network: spawn point for traffic and police.
export function randomRoadPoint(world, rng) {
  if (rng() > 0.5) {
    return { x: pick(rng, world.avenues), y: range(rng, 150, WORLD.height - 150) };
  }
  return { x: range(rng, 150, WORLD.width - 150), y: pick(rng, world.streets) };
}
