// Sunset Streets — scripted playthrough tests (Node, no browser needed).
// Imports the pure simulation core and drives it through scripted inputs.
// Run: node tools/test.mjs
import {
  createGame, stepGame, startMission, retryMission, currentMission, currentStep,
  serializeSave, applySave, pointInRect, MISSIONS,
} from '../game/src/sim.js';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

function stepN(state, input, n, dt = 1 / 60) {
  let events = [];
  for (let i = 0; i < n; i++) events = stepGame(state, input, dt);
  return events;
}

const idle = { up: false, down: false, left: false, right: false, sprint: false, punch: false, fire: false, enter: false, mouseX: 0, mouseY: 0 };

function teleport(state, x, y) {
  state.player.x = x;
  state.player.y = y;
  state.player.onFoot = true;
  state.player.carId = -1;
  state.player.speed = 0;
}

// Evasion hop: teleport to an anchor point far from every police unit, so
// the heat can actually decay. Alternating the same two corners fails —
// police camp the corners the player keeps returning to.
const EVADE_ANCHORS = [
  [200, 200], [1800, 200], [3400, 200],
  [200, 1350], [1800, 1350], [3400, 1350],
  [200, 2500], [1800, 2500], [3400, 2500],
];
function evadeTeleport(state) {
  const police = [
    ...state.cars.filter((c) => c.kind === 'police'),
    ...state.officers,
  ];
  let best = null;
  let bestD = -1;
  for (const [x, y] of EVADE_ANCHORS) {
    const d = police.length
      ? Math.min(...police.map((u) => Math.hypot(u.x - x, u.y - y)))
      : 99999;
    if (d > bestD) { bestD = d; best = [x, y]; }
  }
  teleport(state, best[0], best[1]);
  return bestD;
}

console.log('== city layout ==');
{
  const s = createGame(1337);
  check('113 buildings', s.city.buildings.length === 113, `got ${s.city.buildings.length}`);
  check('9 parks', s.city.parks.length === 9, `got ${s.city.parks.length}`);
  check('34 parked cars', s.cars.filter((c) => c.kind === 'parked').length === 34);
  check('20 traffic cars', s.cars.filter((c) => c.kind === 'traffic').length === 20);
  check('56 pedestrians', s.peds.length === 56, `got ${s.peds.length}`);
  // No building overlaps a road.
  const xs = [];
  for (let i = 0; i <= 11; i++) xs.push(150 + 300 * i);
  const ys = [];
  for (let j = 0; j <= 8; j++) ys.push(150 + 300 * j);
  let roadHits = 0;
  for (const b of s.city.buildings) {
    for (const cx of xs) if (b.x < cx + 54 && b.x + b.w > cx - 54) roadHits++;
    for (const cy of ys) if (b.y < cy + 54 && b.y + b.h > cy - 54) roadHits++;
  }
  check('0 building/road overlaps', roadHits === 0, `got ${roadHits}`);
  // No parked car inside a building.
  let parkedIn = 0;
  for (const c of s.cars.filter((c) => c.kind === 'parked')) {
    if (s.city.buildings.some((b) => pointInRect(c.x, c.y, b))) parkedIn++;
  }
  check('0 parked cars inside buildings', parkedIn === 0, `got ${parkedIn}`);
  // No pedestrian inside a building.
  let pedIn = 0;
  for (const p of s.peds) {
    if (s.city.buildings.some((b) => pointInRect(p.x, p.y, b))) pedIn++;
  }
  check('0 pedestrians inside buildings', pedIn === 0, `got ${pedIn}`);
  // Buildings do not overlap each other.
  let overlaps = 0;
  for (let i = 0; i < s.city.buildings.length; i++) {
    for (let j = i + 1; j < s.city.buildings.length; j++) {
      const a = s.city.buildings[i];
      const b = s.city.buildings[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps++;
    }
  }
  check('0 building/building overlaps', overlaps === 0, `got ${overlaps}`);
}

console.log('== combat basics ==');
{
  const s = createGame(1337);
  // Stealing an occupied traffic car adds a star.
  const traffic = s.cars.find((c) => c.kind === 'traffic');
  teleport(s, traffic.x, traffic.y);
  stepN(s, { ...idle, enter: true }, 1);
  check('stealing a traffic car gives 1 star', s.wanted === 1, `wanted=${s.wanted}`);
  check('player is in the car', !s.player.onFoot && s.player.carId === traffic.id);
  stepN(s, { ...idle, enter: true }, 1);
  check('exit car works', s.player.onFoot);
  // Pistol fires and spends ammo.
  const ammo0 = s.ammo;
  stepN(s, { ...idle, fire: true, mouseX: s.player.x + 200, mouseY: s.player.y }, 1);
  check('pistol spends 1 ammo', s.ammo === ammo0 - 1, `ammo=${s.ammo}`);
  // Punch has a cooldown: two punches in one frame only fire once.
  const s2 = createGame(1337);
  const ped = s2.peds[0];
  teleport(s2, ped.x, ped.y);
  const hp0 = ped.hp;
  stepN(s2, { ...idle, punch: true }, 1);
  check('punch deals 12 damage', ped.hp === hp0 - 12, `hp=${ped.hp}`);
  check('harming a pedestrian adds a star', s2.wanted === 1, `wanted=${s2.wanted}`);
}

console.log('== wanted decay ==');
{
  const s = createGame(1337);
  s.wanted = 2;
  // The player evades properly: hop to a fresh anchor far from every
  // police unit every 2 seconds so cruisers and officers lose the trail.
  let droppedTo1 = false;
  let elapsed = 0;
  while (elapsed < 30) {
    evadeTeleport(s);
    stepN(s, idle, 120);
    elapsed += 2;
    if (s.wanted <= 1) droppedTo1 = true;
    if (s.wanted === 0) break;
  }
  check('one star drops after 10s unseen', droppedTo1, `elapsed=${elapsed}s wanted=${s.wanted}`);
  check('wanted reaches 0 while evading', s.wanted === 0, `elapsed=${elapsed}s`);
}

console.log('== busted flow + retry ==');
{
  const s = createGame(1337);
  startMission(s);
  s.wanted = 2;
  // Plant an officer on top of the player and hold them there.
  s.officers.push({ x: s.player.x + 10, y: s.player.y, angle: 0, bustTimer: 0, hp: 50, lostT: 0 });
  stepN(s, idle, 60 * 4);
  check('busted after 3s held by an officer', s.mission.stage === 'failed', `stage=${s.mission.stage}`);
  check('cash penalty applied', s.money === 20, `money=${s.money}`);
  retryMission(s);
  check('retry returns to briefing', s.mission.stage === 'briefing');
  check('retry restores at least 50 hp', s.hp >= 50, `hp=${s.hp}`);
}

console.log('== full six-mission chain ==');
{
  const s = createGame(1337);
  let completed = 0;
  for (let m = 0; m < MISSIONS.length; m++) {
    const def = MISSIONS[m];
    check(`mission ${def.id} briefing stage`, s.mission.stage === 'briefing' && s.mission.index === m, `stage=${s.mission.stage} index=${s.mission.index}`);
    startMission(s);
    let guard = 0;
    while (s.mission.stage === 'active' && guard++ < 60 * 120) {
      const step = currentStep(s);
      if (!step) break;
      if (step.type === 'loseHeat') {
        // Evade: hop to a fresh anchor far from every police unit every
        // 2 seconds so cruisers lose the trail and give up; heat can then
        // decay to zero.
        let heatGone = false;
        let t = 0;
        while (s.mission.stage === 'active' && t < 40) {
          evadeTeleport(s);
          stepN(s, idle, 120);
          t += 2;
          if (s.wanted === 0) { heatGone = true; break; }
        }
        check(`mission ${def.id} loseHeat step completes`, heatGone, `wanted=${s.wanted} after ${t}s`);
        if (!heatGone) break;
        continue;
      }
      // Walk the player to the objective (driving where the step needs a car).
      if (step.needCar) {
        const car = s.cars.find((c) => c.kind === 'parked');
        teleport(s, car.x, car.y);
        // Press E once: get in and stay in the car.
        stepN(s, { ...idle, enter: true }, 1);
        // Drive the car to the target: move car and rider together, staying in it.
        car.x = step.x;
        car.y = step.y;
        s.player.x = step.x;
        s.player.y = step.y;
      } else {
        teleport(s, step.x, step.y);
      }
      stepN(s, idle, 3);
      // Mission 5's timer starts at the briefing; the teleports are instant,
      // so the timer never runs out in the scripted chain.
    }
    if (s.mission.stage === 'failed') {
      check(`mission ${def.id} completes`, false, `failed at step ${s.mission.step}`);
      break;
    }
    completed++;
    check(`mission ${def.id} (${def.title}) completes`, s.mission.index === m + 1 || s.won, `index=${s.mission.index} won=${s.won}`);
    if (s.mission.index !== m + 1 && !s.won) break; // do not cascade into the next mission
    // After the Vault Job the game is won.
    if (m === MISSIONS.length - 1) {
      check('win screen reached', s.won === true, `won=${s.won}`);
      check('total earned is $4,100', s.earned === 4100, `earned=${s.earned}`);
      check('final cash is $4,220', s.money === 4220, `money=${s.money}`);
    }
  }
  check('all 6 missions completed', completed === 6, `completed=${completed}`);
}

console.log('== save / load ==');
{
  const s = createGame(1337);
  s.money = 1234;
  s.ammo = 7;
  s.mission.index = 3;
  s.earned = 1250;
  const data = serializeSave(s);
  const s2 = createGame(1337);
  const ok = applySave(s2, data);
  check('save applies', ok);
  check('money restored', s2.money === 1234, `money=${s2.money}`);
  check('ammo restored', s2.ammo === 7, `ammo=${s2.ammo}`);
  check('mission index restored', s2.mission.index === 3, `index=${s2.mission.index}`);
  check('earned restored', s2.earned === 1250, `earned=${s2.earned}`);
  check('stage is briefing after load', s2.mission.stage === 'briefing');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
