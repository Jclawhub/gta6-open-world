// Sunset Streets — pure simulation core (no DOM, no canvas).
// Imported by the browser game and by the Node test harness alike.
// Everything here is derived from the prose design spec only.

export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_PITCH = 300;
export const ROAD_HALF = 36;
export const SIDEWALK = 18;
export const SAVE_KEY = 'sunset-streets-save-v1';

export const MISSIONS = [
  {
    id: 1, title: 'First Fare', giver: 'Lena Ortiz', payout: 250,
    brief: 'Lena needs a driver. Pick up the passenger waiting at the Marina and drive them to the Grand Hotel. No rush — but do not keep them waiting.',
    steps: [
      { type: 'goto', label: 'Pick up the passenger at the Marina', x: 450, y: 450, radius: 70 },
      { type: 'goto', label: 'Drive the passenger to the Grand Hotel', x: 750, y: 750, radius: 70, needCar: true },
    ],
  },
  {
    id: 2, title: 'Hot Delivery', giver: 'Lena Ortiz', payout: 400,
    brief: 'A case is waiting at Central Plaza. Get it to the Docks in 90 seconds. The buyer does not wait, and neither does the clock.',
    steps: [
      { type: 'goto', label: 'Pick up the case at Central Plaza', x: 1800, y: 1350, radius: 70 },
      { type: 'goto', label: 'Deliver the case to the Docks', x: 3300, y: 1350, radius: 70, timer: 90 },
    ],
  },
  {
    id: 3, title: 'The Getaway', giver: 'Marco Reyes', payout: 600,
    brief: 'You are hot — three stars and every cruiser in Solmar Bay on your tail. Lose the heat, then slip to the Safehouse in Old Town.',
    steps: [
      { type: 'loseHeat', label: 'Lose the heat — stay unseen until the stars drop' },
      { type: 'goto', label: 'Reach the Safehouse in Old Town', x: 750, y: 2250, radius: 80 },
    ],
  },
  {
    id: 4, title: 'Stash Run', giver: 'Lena Ortiz', payout: 750,
    brief: 'Three stashes are hidden around the city. Collect them all. Watch the streets — the cops do not like collectors.',
    steps: [
      { type: 'collect', label: 'Collect the stash at the Marina', x: 450, y: 1950, radius: 60 },
      { type: 'collect', label: 'Collect the stash at Central Plaza', x: 1950, y: 1050, radius: 60 },
      { type: 'collect', label: 'Collect the stash at the Docks', x: 3150, y: 2250, radius: 60 },
    ],
  },
  {
    id: 5, title: 'Sunset Sprint', giver: 'Marco Reyes', payout: 900,
    brief: 'Three checkpoints, 75 seconds, one very fast car. The timer starts the moment this briefing ends — so go.',
    steps: [
      { type: 'goto', label: 'Checkpoint 1 — Marina', x: 450, y: 750, radius: 70, timer: 75 },
      { type: 'goto', label: 'Checkpoint 2 — Central Plaza', x: 1800, y: 1050, radius: 70 },
      { type: 'goto', label: 'Checkpoint 3 — Docks', x: 3150, y: 1350, radius: 70 },
    ],
  },
  {
    id: 6, title: 'Vault Job', giver: 'Lena Ortiz', payout: 1200,
    brief: 'The big one. Take the vault case from Solmar Bank to the Safehouse. The whole force will be out — drive like the sunset depends on it.',
    steps: [
      { type: 'goto', label: 'Take the vault case at Solmar Bank', x: 1800, y: 450, radius: 70 },
      { type: 'goto', label: 'Deliver the vault case to the Safehouse', x: 750, y: 2250, radius: 80 },
    ],
  },
];

export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 900, h: 2700, tint: '#e8b06a' },
  { name: 'Old Town', x: 0, y: 1800, w: 1200, h: 900, tint: '#c98a5e' },
  { name: 'Central Plaza', x: 1500, y: 1050, w: 600, h: 600, tint: '#d9a05b' },
  { name: 'Docks', x: 3000, y: 900, w: 600, h: 1800, tint: '#8a7a68' },
  { name: 'Solmar Bank', x: 1500, y: 150, w: 600, h: 600, tint: '#b08a5a' },
  { name: 'Grand Hotel', x: 600, y: 600, w: 300, h: 300, tint: '#e0a878' },
  { name: 'Safehouse', x: 600, y: 2100, w: 300, h: 300, tint: '#7a6a58' },
];

// Seeded RNG (mulberry32) so the city is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roadCentersX() {
  const out = [];
  for (let i = 0; i <= 11; i++) out.push(150 + 300 * i);
  return out;
}
export function roadCentersY() {
  const out = [];
  for (let j = 0; j <= 8; j++) out.push(150 + 300 * j);
  return out;
}

function isOnRoad(x, y) {
  for (const cx of roadCentersX()) if (Math.abs(x - cx) <= ROAD_HALF + SIDEWALK) return true;
  for (const cy of roadCentersY()) if (Math.abs(y - cy) <= ROAD_HALF + SIDEWALK) return true;
  return false;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildCity(seed = 1337) {
  const rnd = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const signs = [];

  // Landmark buildings, placed first at fixed spots inside their blocks
  // (blocks run x/y 204+300k .. 396+300k, so every landmark sits clear of
  // the roads and sidewalks around it).
  const landmarks = [
    { name: 'Grand Hotel', x: 530, y: 530, w: 140, h: 110, color: '#e8b06a', roof: '#c98a4a', tall: true },
    { name: 'Solmar Bank', x: 1720, y: 220, w: 160, h: 120, color: '#d8c8a8', roof: '#b8a888', tall: true },
    { name: 'Safehouse', x: 540, y: 2040, w: 90, h: 70, color: '#9a8a7a', roof: '#7a6a58', tall: false },
    { name: 'Marina Market', x: 230, y: 1440, w: 130, h: 90, color: '#e0a078', roof: '#c08058', tall: false },
    { name: 'Dock Office', x: 3230, y: 830, w: 140, h: 100, color: '#8a7a68', roof: '#6a5a48', tall: false },
  ];
  for (const lm of landmarks) buildings.push({ ...lm, kind: 'landmark' });

  // City blocks: the rectangles between neighbouring roads.
  const blocks = [];
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 8; j++) {
      blocks.push({ x: 204 + 300 * i, y: 204 + 300 * j, w: 192, h: 192 });
    }
  }
  // Shuffle blocks deterministically.
  for (let i = blocks.length - 1; i > 0; i--) {
    const k = Math.floor(rnd() * (i + 1));
    [blocks[i], blocks[k]] = [blocks[k], blocks[i]];
  }

  // 9 parks take whole blocks.
  const parkBlocks = blocks.slice(0, 9);
  for (const b of parkBlocks) {
    parks.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  }
  // Buildings fill the remaining blocks until we reach 113.
  const roofPalette = ['#b0705a', '#a8886a', '#8a7a6a', '#c09060', '#7a6a7a', '#b89070', '#986858'];
  const wallPalette = ['#d8b890', '#c8a888', '#b8a088', '#d0b090', '#c0a080', '#a89888'];
  let bi = 0;
  for (const b of blocks.slice(9)) {
    if (buildings.length >= 113) break;
    if (landmarks.some((lm) => rectsOverlap(lm, b))) continue;
    const n = rnd() < 0.45 ? 2 : 1;
    for (let k = 0; k < n && buildings.length < 113; k++) {
      // Two buildings in one block go in separate halves so they never
      // overlap each other; a lone building takes the whole block.
      const half = n === 2 ? b.w / 2 : b.w;
      const x0 = b.x + (n === 2 && k === 1 ? b.w / 2 : 0);
      const w = n === 2 ? 50 + rnd() * 35 : 55 + rnd() * 85;
      const h = n === 2 ? 50 + rnd() * 70 : 55 + rnd() * 85;
      const x = x0 + 8 + rnd() * Math.max(1, half - w - 16);
      const y = b.y + 8 + rnd() * Math.max(1, b.h - h - 16);
      const cand = { x, y, w, h };
      if (buildings.some((o) => rectsOverlap(o, cand))) continue;
      buildings.push({
        ...cand,
        kind: 'house',
        name: '',
        color: wallPalette[Math.floor(rnd() * wallPalette.length)],
        roof: roofPalette[Math.floor(rnd() * roofPalette.length)],
        tall: rnd() < 0.25,
      });
      bi++;
    }
  }
  // Top up with small sheds along the east docks strip, stacked
  // deterministically into the gaps between horizontal roads so none sits
  // on asphalt and the count always reaches 113.
  const shedXs = 3510;
  for (let j = 0; j < 8 && buildings.length < 113; j++) {
    let y = 204 + 300 * j + 8;
    while (y + 45 <= 396 + 300 * j && buildings.length < 113) {
      const h = 40 + rnd() * 10;
      const w = 35 + rnd() * 15;
      const cand = { x: shedXs, y, w, h };
      if (!buildings.some((o) => rectsOverlap(o, cand))) {
        buildings.push({ ...cand, kind: 'shed', name: '', color: '#8a7a68', roof: '#6a5a48', tall: false });
      }
      y += h + 12;
    }
  }

  // Palm trees along the Marina waterfront (x ~ 60..120) and scattered in parks.
  for (let y = 60; y < WORLD_H - 40; y += 110 + rnd() * 60) {
    palms.push({ x: 55 + rnd() * 45, y, s: 0.8 + rnd() * 0.5 });
  }
  for (const p of parks) {
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      palms.push({ x: p.x + 20 + rnd() * (p.w - 40), y: p.y + 20 + rnd() * (p.h - 40), s: 0.7 + rnd() * 0.5 });
    }
  }

  // Neon signs in Marina and Central Plaza.
  signs.push({ x: 450, y: 300, text: 'MARINA', color: '#ff5e8a' });
  signs.push({ x: 750, y: 690, text: 'HOTEL SOLMAR', color: '#ffb347' });
  signs.push({ x: 1800, y: 1200, text: 'PLAZA', color: '#4dd8ff' });
  signs.push({ x: 1800, y: 1500, text: 'NEON ROW', color: '#c96bff' });
  signs.push({ x: 3300, y: 1050, text: 'DOCKS', color: '#7dff8a' });

  return { buildings, parks, palms, signs };
}

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#ff6b9d', '#7f8c8d'];

export function createGame(seed = 1337) {
  const city = buildCity(seed);
  const rnd = mulberry32(seed + 99);
  const xs = roadCentersX();
  const ys = roadCentersY();

  const cars = [];
  // 34 parked cars along road edges (on the sidewalk strip, never inside buildings).
  let placed = 0;
  let guard = 0;
  while (placed < 34 && guard++ < 2000) {
    const vertical = rnd() < 0.5;
    const cx = xs[Math.floor(rnd() * xs.length)];
    const cy = ys[Math.floor(rnd() * ys.length)];
    const along = 120 + rnd() * (vertical ? 2400 : 3300);
    const side = rnd() < 0.5 ? -1 : 1;
    const x = vertical ? cx + side * (ROAD_HALF + 14) : 60 + along % 3480;
    const y = vertical ? 60 + along % 2580 : cy + side * (ROAD_HALF + 14);
    if (x < 40 || x > WORLD_W - 40 || y < 40 || y > WORLD_H - 40) continue;
    if (city.buildings.some((b) => pointInRect(x, y, b))) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    cars.push({
      id: cars.length, kind: 'parked', x, y, angle: vertical ? Math.PI / 2 : 0,
      speed: 0, color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
      driver: false, hp: 100,
    });
    placed++;
  }
  // 20 traffic cars driving the road grid.
  for (let i = 0; i < 20; i++) {
    const vertical = rnd() < 0.5;
    const cx = xs[Math.floor(rnd() * xs.length)];
    const cy = ys[Math.floor(rnd() * ys.length)];
    cars.push({
      id: cars.length, kind: 'traffic',
      x: vertical ? cx + (rnd() < 0.5 ? -18 : 18) : 100 + rnd() * 3400,
      y: vertical ? 100 + rnd() * 2500 : cy + (rnd() < 0.5 ? -18 : 18),
      angle: vertical ? (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI),
      speed: 120 + rnd() * 80, color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
      driver: true, hp: 100, vertical,
    });
  }

  // 56 pedestrians on sidewalks, 3 types.
  const peds = [];
  const types = ['walker', 'jogger', 'tourist'];
  guard = 0;
  while (peds.length < 56 && guard++ < 3000) {
    const vertical = rnd() < 0.5;
    const cx = xs[Math.floor(rnd() * xs.length)];
    const cy = ys[Math.floor(rnd() * ys.length)];
    const side = rnd() < 0.5 ? -1 : 1;
    const off = ROAD_HALF + 6 + rnd() * 10;
    const x = vertical ? cx + side * off : 80 + rnd() * 3440;
    const y = vertical ? 80 + rnd() * 2540 : cy + side * off;
    if (x < 30 || x > WORLD_W - 30 || y < 30 || y > WORLD_H - 30) continue;
    if (city.buildings.some((b) => pointInRect(x, y, b))) continue;
    const type = types[Math.floor(rnd() * types.length)];
    peds.push({
      x, y, angle: rnd() * Math.PI * 2,
      speed: type === 'jogger' ? 95 : type === 'tourist' ? 45 : 65,
      type, hp: 30, state: 'wander', tx: x, ty: y, fleeT: 0,
    });
  }

  return {
    seed, time: 0, money: 120, hp: 100, ammo: 24,
    player: { x: 450, y: 600, angle: -Math.PI / 2, speed: 0, onFoot: true, carId: -1, radius: 14 },
    cars, peds,
    officers: [],
    wanted: 0, unseenTime: 0, lastSeenX: 450, lastSeenY: 600,
    mission: { index: 0, stage: 'briefing', step: 0, timer: 0, timerStarted: false, startX: 450, startY: 600 },
    won: false, bustedCount: 0, earned: 0,
    events: [],
    city,
  };
}

export function currentMission(state) {
  return MISSIONS[state.mission.index] || null;
}

export function currentStep(state) {
  const m = currentMission(state);
  if (!m) return null;
  return m.steps[state.mission.step] || null;
}

export function objectiveText(state) {
  const m = currentMission(state);
  if (state.won) return 'All jobs done — Solmar Bay is yours.';
  if (!m) return '';
  if (state.mission.stage === 'briefing') return `New job: ${m.title} — press ENTER to start.`;
  if (state.mission.stage === 'failed') return 'Job failed — press R to retry.';
  const s = currentStep(state);
  return s ? s.label : m.title;
}

export function objectivePoint(state) {
  const s = currentStep(state);
  if (!s || s.type === 'loseHeat') return null;
  return { x: s.x, y: s.y };
}

export function startMission(state) {
  const m = currentMission(state);
  if (!m || state.mission.stage !== 'briefing') return;
  state.mission.stage = 'active';
  state.mission.step = 0;
  state.mission.startX = state.player.x;
  state.mission.startY = state.player.y;
  state.mission.timerStarted = false;
  if (m.id === 3) {
    state.wanted = 3;
    state.unseenTime = 0;
  }
  if (m.id === 6) {
    state.wanted = Math.max(state.wanted, 3);
    state.unseenTime = 0;
  }
  state.events.push({ type: 'missionStart', x: state.player.x, y: state.player.y });
}

export function failMission(state, reason) {
  if (state.mission.stage !== 'active') return;
  state.mission.stage = 'failed';
  const penalty = Math.min(state.money, 100);
  state.money -= penalty;
  state.events.push({ type: 'busted', x: state.player.x, y: state.player.y, reason, penalty });
  if (reason === 'busted') state.bustedCount++;
}

export function retryMission(state) {
  if (state.mission.stage !== 'failed') return;
  const m = currentMission(state);
  state.hp = Math.max(state.hp, 50);
  state.player.x = state.mission.startX;
  state.player.y = state.mission.startY;
  state.player.onFoot = true;
  state.player.carId = -1;
  state.player.speed = 0;
  state.wanted = m.id === 3 || m.id === 6 ? 3 : 0;
  state.unseenTime = 0;
  state.officers = [];
  state.mission.stage = 'briefing';
  state.mission.step = 0;
  state.mission.timerStarted = false;
}

export function completeMission(state) {
  const m = currentMission(state);
  if (!m) return;
  state.money += m.payout;
  state.earned += m.payout;
  state.hp = Math.min(100, state.hp + 25);
  state.events.push({ type: 'missionComplete', x: state.player.x, y: state.player.y, payout: m.payout, title: m.title });
  state.mission.index++;
  state.mission.step = 0;
  state.mission.timerStarted = false;
  if (state.mission.index >= MISSIONS.length) {
    state.won = true;
    state.mission.stage = 'done';
    state.events.push({ type: 'win', x: state.player.x, y: state.player.y });
  } else {
    state.mission.stage = 'briefing';
  }
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function hitsBuilding(state, x, y, r) {
  for (const b of state.city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    if (Math.hypot(x - nx, y - ny) < r) return b;
  }
  return null;
}

function moveActor(state, a, dx, dy, r) {
  // Axis-separated movement so actors slide along walls instead of sticking.
  const nx = a.x + dx;
  if (!hitsBuilding(state, nx, a.y, r) && nx > r && nx < WORLD_W - r) a.x = nx;
  const ny = a.y + dy;
  if (!hitsBuilding(state, a.x, ny, r) && ny > r && ny < WORLD_H - r) a.y = ny;
}

function nearestCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of state.cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function addWanted(state, n) {
  state.wanted = Math.min(5, state.wanted + n);
  state.unseenTime = 0;
}

// Pick a spawn point for a cruiser: on a road 600-850 px from where the
// player was LAST SEEN — never closer than 550 px, never inside a building.
// Reinforcements converge on the last known position, not on the player's
// current one, so breaking away and staying out of sight actually works.
function pickSpawnPoint(state) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  const cx = state.lastSeenX;
  const cy = state.lastSeenY;
  const p = state.player;
  for (let tries = 0; tries < 8; tries++) {
    const vertical = Math.random() < 0.5;
    let x;
    let y;
    if (vertical) {
      x = xs[Math.floor(Math.random() * xs.length)];
      y = cy + (Math.random() < 0.5 ? -1 : 1) * (600 + Math.random() * 250);
    } else {
      y = ys[Math.floor(Math.random() * ys.length)];
      x = cx + (Math.random() < 0.5 ? -1 : 1) * (600 + Math.random() * 250);
    }
    x = Math.max(60, Math.min(WORLD_W - 60, x));
    y = Math.max(60, Math.min(WORLD_H - 60, y));
    const d = dist(x, y, cx, cy);
    if (d >= 550 && d <= 1100 && !hitsBuilding(state, x, y, 16)) return { x, y, vertical };
  }
  const a = Math.random() * Math.PI * 2;
  return {
    x: Math.max(60, Math.min(WORLD_W - 60, cx + Math.cos(a) * 700)),
    y: Math.max(60, Math.min(WORLD_H - 60, cy + Math.sin(a) * 700)),
    vertical: Math.random() < 0.5,
  };
}

function spawnPolice(state) {
  // No reinforcements while the heat is cooling: once the player has been
  // unseen for 4 seconds, the force stops sending fresh units, so losing
  // the heat is actually possible.
  if (state.unseenTime >= 4) return;
  const wantCars = Math.min(state.wanted, 4);
  let policeCars = state.cars.filter((c) => c.kind === 'police').length;
  while (policeCars < wantCars) {
    const spot = pickSpawnPoint(state);
    state.cars.push({
      id: state.cars.length, kind: 'police', x: spot.x, y: spot.y,
      angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x),
      speed: 0, color: '#1a1a2e', driver: true, hp: 200, vertical: spot.vertical,
      ramCd: 0, lastSeenX: state.lastSeenX, lastSeenY: state.lastSeenY, lostT: 0,
    });
    policeCars++;
  }
  const wantOfficers = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
  while (state.officers.length < wantOfficers) {
    const ang = Math.random() * Math.PI * 2;
    const d = 260 + Math.random() * 120;
    state.officers.push({
      x: Math.max(40, Math.min(WORLD_W - 40, state.lastSeenX + Math.cos(ang) * d)),
      y: Math.max(40, Math.min(WORLD_H - 40, state.lastSeenY + Math.sin(ang) * d)),
      angle: 0, bustTimer: 0, hp: 50, lostT: 0,
    });
  }
}

function updatePolice(state, dt, input) {
  const p = state.player;
  // Cruisers chase the player while they can see them; once the trail goes
  // cold they drive to the last known spot, search it, and give up.
  for (const c of state.cars) {
    if (c.kind !== 'police') continue;
    const d = dist(c.x, c.y, p.x, p.y);
    let tx = p.x;
    let ty = p.y;
    if (d < 500) {
      c.lastSeenX = p.x;
      c.lastSeenY = p.y;
      c.lostT = 0;
    } else {
      c.lostT += dt;
      tx = c.lastSeenX;
      ty = c.lastSeenY;
      // Give up after 6 s without seeing the player: the cruiser leaves
      // and a replacement (if any) spawns at the last-seen spot, not on
      // top of the player, so the trail genuinely goes cold.
      if (c.lostT > 6) {
        c.dead = true;
        continue;
      }
    }
    const want = Math.atan2(ty - c.y, tx - c.x);
    let da = want - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    const top = d < 500 ? 430 : 300;
    c.speed = Math.min(top, c.speed + 380 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!hitsBuilding(state, nx, ny, 16)) { c.x = nx; c.y = ny; }
    else { c.angle += 1.2 * dt; }
    c.ramCd = Math.max(0, (c.ramCd || 0) - dt);
    if (d < 46 && c.ramCd <= 0) {
      c.ramCd = 1.2;
      state.hp = Math.max(0, state.hp - 6);
      state.events.push({ type: 'ram', x: p.x, y: p.y });
      if (p.onFoot) {
        // Knock the player sideways.
        p.x += Math.cos(c.angle) * 18;
        p.y += Math.sin(c.angle) * 18;
      }
    }
  }
  state.cars = state.cars.filter((c) => !c.dead);

  // Foot officers run the player down and bust them.
  for (const o of state.officers) {
    const d = dist(o.x, o.y, p.x, p.y);
    o.angle = Math.atan2(p.y - o.y, p.x - o.x);
    const sp = 190;
    moveActor(state, o, Math.cos(o.angle) * sp * dt, Math.sin(o.angle) * sp * dt, 12);
    if (d < 300) {
      o.lostT = 0;
    } else {
      o.lostT += dt;
      if (o.lostT > 5) {
        o.gone = true;
        continue;
      }
    }
    if (d < 46) {
      o.bustTimer += dt * (input && input.sprint ? 0.5 : 1);
      if (o.bustTimer >= 3.0) {
        state.hp = 100;
        failMission(state, 'busted');
        // Respawn at a safe spot.
        p.x = state.mission.startX;
        p.y = state.mission.startY;
        p.onFoot = true;
        p.carId = -1;
        p.speed = 0;
        state.wanted = 0;
        state.officers = [];
        return;
      }
    } else {
      o.bustTimer = Math.max(0, o.bustTimer - dt * 2);
    }
  }
  state.officers = state.officers.filter((o) => !o.gone);
}

function updateWanted(state, dt) {
  if (state.wanted <= 0) return;
  const p = state.player;
  let seen = false;
  for (const c of state.cars) {
    if (c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < 500) { seen = true; break; }
  }
  if (!seen) {
    for (const o of state.officers) {
      if (dist(o.x, o.y, p.x, p.y) < 300) { seen = true; break; }
    }
  }
  if (seen) {
    state.unseenTime = 0;
    state.lastSeenX = p.x;
    state.lastSeenY = p.y;
  } else {
    state.unseenTime += dt;
    if (state.unseenTime >= 10) {
      state.wanted--;
      state.unseenTime = 0;
      state.events.push({ type: 'starDrop', x: p.x, y: p.y, wanted: state.wanted });
      if (state.wanted === 0) {
        state.cars = state.cars.filter((c) => c.kind !== 'police');
        state.officers = [];
      }
    }
  }
}

function updateTraffic(state, dt) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  for (const c of state.cars) {
    if (c.kind !== 'traffic') continue;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = xs.find((cx) => Math.abs(c.x - cx) < 14);
    const nearY = ys.find((cy) => Math.abs(c.y - cy) < 14);
    if (nearX !== undefined && nearY !== undefined && Math.random() < 0.006) {
      c.vertical = !c.vertical;
      if (c.vertical) {
        c.x = nearX;
        c.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.y = nearY;
        c.angle = Math.random() < 0.5 ? 0 : Math.PI;
      }
    }
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (nx < 60 || nx > WORLD_W - 60 || ny < 60 || ny > WORLD_H - 60) {
      c.angle += Math.PI;
    } else if (!hitsBuilding(state, nx, ny, 16)) {
      c.x = nx;
      c.y = ny;
    } else {
      c.angle += Math.PI / 2;
    }
    // Gentle separation so traffic does not stack.
    for (const o of state.cars) {
      if (o === c || o.kind !== 'traffic') continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d < 40 && d > 0.01) {
        c.x += ((c.x - o.x) / d) * 12 * dt;
        c.y += ((c.y - o.y) / d) * 12 * dt;
      }
    }
  }
}

function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    const crashNear = state.events.some((e) => (e.type === 'ram' || e.type === 'shot') && dist(ped.x, ped.y, e.x, e.y) < 170);
    if (d < 90 || crashNear) {
      ped.state = 'flee';
      ped.fleeT = 2.5;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      moveActor(state, ped, Math.cos(a) * ped.speed * 1.9 * dt, Math.sin(a) * ped.speed * 1.9 * dt, 10);
      if (ped.fleeT <= 0) ped.state = 'wander';
      continue;
    }
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 14) {
      // Pick a new nearby sidewalk target.
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 180;
      ped.tx = Math.max(40, Math.min(WORLD_W - 40, ped.x + Math.cos(a) * r));
      ped.ty = Math.max(40, Math.min(WORLD_H - 40, ped.y + Math.sin(a) * r));
      if (hitsBuilding(state, ped.tx, ped.ty, 10)) { ped.tx = ped.x; ped.ty = ped.y; }
    }
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    moveActor(state, ped, Math.cos(a) * ped.speed * dt, Math.sin(a) * ped.speed * dt, 10);
  }
  state.peds = state.peds.filter((ped) => ped.hp > 0);
}

function playerPunch(state) {
  const p = state.player;
  if (!p.onFoot) return;
  let best = null;
  let bestD = 34;
  for (const ped of state.peds) {
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d < bestD) { bestD = d; best = { kind: 'ped', ref: ped }; }
  }
  for (const o of state.officers) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < bestD) { bestD = d; best = { kind: 'officer', ref: o }; }
  }
  state.events.push({ type: 'punch', x: p.x + Math.cos(p.angle) * 24, y: p.y + Math.sin(p.angle) * 24 });
  if (best) {
    best.ref.hp -= 12;
    addWanted(state, 1);
    if (best.kind === 'ped' && best.ref.hp <= 0) {
      state.events.push({ type: 'pedDown', x: best.ref.x, y: best.ref.y });
    }
    if (best.kind === 'officer' && best.ref.hp <= 0) {
      state.officers = state.officers.filter((o) => o !== best.ref);
      state.events.push({ type: 'officerDown', x: best.ref.x, y: best.ref.y });
    }
  }
}

function playerShoot(state, tx, ty) {
  const p = state.player;
  if (!p.onFoot || state.ammo <= 0) return;
  state.ammo--;
  const a = Math.atan2(ty - p.y, tx - p.x);
  p.angle = a;
  const ox = p.x + Math.cos(a) * 20;
  const oy = p.y + Math.sin(a) * 20;
  state.events.push({ type: 'shot', x: ox, y: oy, angle: a });
  // Hitscan: first actor within 14 px of the ray, out to 700 px.
  let best = null;
  let bestT = 700;
  const consider = (ax, ay, ref, kind) => {
    const dx = ax - ox;
    const dy = ay - oy;
    const t = dx * Math.cos(a) + dy * Math.sin(a);
    if (t < 0 || t > bestT) return;
    const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (perp < 16) { bestT = t; best = { ref, kind }; }
  };
  for (const ped of state.peds) consider(ped.x, ped.y, ped, 'ped');
  for (const o of state.officers) consider(o.x, o.y, o, 'officer');
  for (const c of state.cars) {
    if (c.kind === 'police') consider(c.x, c.y, c, 'car');
  }
  if (best) {
    best.ref.hp -= 25;
    state.events.push({ type: 'hit', x: best.ref.x, y: best.ref.y });
    if (best.kind !== 'car') addWanted(state, 1);
    if (best.kind === 'ped' && best.ref.hp <= 0) {
      state.events.push({ type: 'pedDown', x: best.ref.x, y: best.ref.y });
    }
    if (best.kind === 'officer' && best.ref.hp <= 0) {
      state.officers = state.officers.filter((o) => o !== best.ref);
    }
  }
}

function tryEnterCar(state) {
  const p = state.player;
  if (p.onFoot) {
    const car = nearestCar(state, p.x, p.y, 64);
    if (!car) return;
    p.onFoot = false;
    p.carId = car.id;
    p.speed = 0;
    if (car.kind === 'traffic' && car.driver) {
      // Stealing an occupied car: the driver flees and the heat rises.
      car.driver = false;
      addWanted(state, 1);
      const d = Math.atan2(p.y - car.y, p.x - car.x);
      state.peds.push({
        x: car.x + Math.cos(d) * 40, y: car.y + Math.sin(d) * 40,
        angle: d, speed: 95, type: 'walker', hp: 30, state: 'flee', tx: car.x, ty: car.y, fleeT: 3,
      });
      state.events.push({ type: 'steal', x: car.x, y: car.y });
    }
    state.events.push({ type: 'enterCar', x: car.x, y: car.y });
  } else {
    const car = state.cars.find((c) => c.id === p.carId);
    if (!car) { p.onFoot = true; p.carId = -1; return; }
    const a = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(a) * 40;
    p.y = car.y + Math.sin(a) * 40;
    if (hitsBuilding(state, p.x, p.y, 14)) {
      p.x = car.x - Math.cos(a) * 40;
      p.y = car.y - Math.sin(a) * 40;
    }
    p.onFoot = true;
    p.carId = -1;
    p.speed = 0;
    p.angle = car.angle;
    state.events.push({ type: 'exitCar', x: p.x, y: p.y });
  }
}

function updatePlayer(state, dt, input) {
  const p = state.player;
  if (p.onFoot) {
    const sp = input.sprint ? 330 : 210;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      moveActor(state, p, mx * sp * dt, my * sp * dt, p.radius);
      p.speed = sp;
    } else {
      p.speed = 0;
    }
  } else {
    const car = state.cars.find((c) => c.id === p.carId);
    if (!car) { p.onFoot = true; p.carId = -1; return; }
    const accel = input.up ? 420 : 0;
    const brake = input.down ? 620 : 0;
    if (accel) car.speed = Math.min(460, car.speed + accel * dt);
    else if (brake) car.speed = Math.max(-150, car.speed - brake * dt);
    else car.speed *= Math.max(0, 1 - 1.6 * dt);
    const steer = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * 2.9 * dt * Math.min(1, Math.abs(car.speed) / 120) * (car.speed >= 0 ? 1 : -1);
    car.angle += steer;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = hitsBuilding(state, nx, ny, 20);
    if (!hit && nx > 30 && nx < WORLD_W - 30 && ny > 30 && ny < WORLD_H - 30) {
      car.x = nx;
      car.y = ny;
      // Skid marks while cornering hard at speed.
      if (Math.abs(steer) > 0.02 && Math.abs(car.speed) > 220) {
        state.events.push({ type: 'skid', x: car.x, y: car.y, angle: car.angle });
      }
    } else {
      if (Math.abs(car.speed) > 160) {
        state.events.push({ type: 'crash', x: car.x, y: car.y });
      }
      car.speed *= -0.25;
      car.angle += 0.3;
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    // Bumping pedestrians while driving hurts them — and the law notices.
    for (const ped of state.peds) {
      if (ped.hp > 0 && dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.hp = 0;
        addWanted(state, 1);
        state.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
      }
    }
  }
}

function updateMission(state, dt) {
  const m = currentMission(state);
  if (!m || state.mission.stage !== 'active') return;
  const step = currentStep(state);
  if (!step) { completeMission(state); return; }
  // Timers start at the briefing for mission 5, and at the step for mission 2.
  if (step.timer !== undefined && !state.mission.timerStarted) {
    state.mission.timer = step.timer;
    state.mission.timerStarted = true;
  }
  if (m.id === 5 && !state.mission.timerStarted) {
    state.mission.timer = 75;
    state.mission.timerStarted = true;
  }
  if (state.mission.timerStarted) {
    state.mission.timer -= dt;
    if (state.mission.timer <= 0) {
      state.mission.timer = 0;
      failMission(state, 'time');
      return;
    }
  }
  const p = state.player;
  if (step.type === 'goto') {
    if (step.needCar && p.onFoot) return;
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      state.mission.step++;
      state.mission.timerStarted = false;
      state.events.push({ type: 'stepDone', x: step.x, y: step.y });
      if (state.mission.step >= m.steps.length) completeMission(state);
    }
  } else if (step.type === 'collect') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      state.mission.step++;
      state.events.push({ type: 'pickup', x: step.x, y: step.y });
      if (state.mission.step >= m.steps.length) completeMission(state);
    }
  } else if (step.type === 'loseHeat') {
    if (state.wanted === 0) {
      state.mission.step++;
      state.events.push({ type: 'stepDone', x: p.x, y: p.y });
    }
  }
}

export function stepGame(state, input, dt) {
  state.time += dt;
  state.events = [];
  const p = state.player;
  // Cooldowns live on the input-side state object the browser keeps; sim tracks them here.
  state._punchCd = Math.max(0, (state._punchCd || 0) - dt);
  if (input.punch && state._punchCd <= 0 && p.onFoot) {
    state._punchCd = 0.38;
    playerPunch(state);
  }
  if (input.fire && p.onFoot) {
    playerShoot(state, input.mouseX ?? p.x + 100, input.mouseY ?? p.y);
  }
  if (input.enter) {
    tryEnterCar(state);
  }
  updatePlayer(state, dt, input);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  if (state.wanted > 0) spawnPolice(state);
  updatePolice(state, dt, input);
  updateWanted(state, dt);
  updateMission(state, dt);
  if (state.hp <= 0 && state.mission.stage === 'active') {
    state.hp = 100;
    failMission(state, 'wasted');
    p.x = state.mission.startX;
    p.y = state.mission.startY;
    p.onFoot = true;
    p.carId = -1;
    p.speed = 0;
    state.wanted = 0;
    state.officers = [];
  }
  return state.events;
}

export function serializeSave(state) {
  return {
    money: state.money, hp: state.hp, ammo: state.ammo,
    missionIndex: state.mission.index, earned: state.earned,
    x: state.player.x, y: state.player.y,
  };
}

export function applySave(state, data) {
  if (!data) return false;
  state.money = data.money ?? state.money;
  state.hp = data.hp ?? state.hp;
  state.ammo = data.ammo ?? state.ammo;
  state.earned = data.earned ?? 0;
  state.mission.index = Math.min(data.missionIndex ?? 0, MISSIONS.length - 1);
  state.mission.stage = 'briefing';
  state.mission.step = 0;
  state.player.x = data.x ?? 450;
  state.player.y = data.y ?? 600;
  state.player.onFoot = true;
  state.player.carId = -1;
  return true;
}
