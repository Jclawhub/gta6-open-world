// Sunset Streets — the game simulation: player on foot and in cars, traffic,
// pedestrians, police and the wanted system, combat, missions and pickups.
import { WORLD, PLAYER, CAR, POLICE, WANTED, MISSIONS, COLORS, SAVE_KEY, STARTING } from './config.js';
import { buildWorld, collideCircle, nearestRoadPoint, districtByName } from './world.js';
import { mulberry32, range, pick, clamp, dist, angleTo, angleDelta } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

let nextId = 1;

function makeCar(rng, x, y, angle, color, kind) {
  return {
    id: nextId += 1,
    x, y, angle,
    speed: 0,
    color: color ?? pick(rng, COLORS.traffic),
    kind: kind ?? 'traffic', // traffic | parked | police | player
    driver: kind === 'traffic',
    targetSpeed: range(rng, 90, 170),
    lane: rng() > 0.5 ? 1 : -1,
    vertical: rng() > 0.5,
    stuck: 0,
  };
}

function makePed(rng, x, y) {
  return {
    id: nextId += 1,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 35, 70),
    color: pick(rng, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1']),
    wander: range(rng, 2, 6),
    panic: 0,
  };
}

export class Game {
  constructor(seed = 20261117) {
    this.seed = seed;
    this.world = buildWorld(seed);
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.money = STARTING.money;
    this.bestMoney = 0;
    this.reset();
  }

  reset() {
    const rng = this.rng;
    this.player = {
      x: 1800, y: 1350, angle: -Math.PI / 2,
      health: PLAYER.health,
      ammo: STARTING.ammo,
      inCar: null,
      punchTimer: 0,
      shootTimer: 0,
      sprint: false,
    };
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.police = [];
    this.wanted = 0;
    this.wantedTimer = 0;
    this.unseenTimer = 0;
    this.missionIndex = 0;
    this.missionStep = 0;
    this.missionTimer = 0;
    this.missionDone = false;
    this.message = '';
    this.messageTimer = 0;
    this.bustedTimer = 0;
    this.shake = 0;
    this.stats = { carsStolen: 0, missionsDone: 0, pedsDown: 0 };
    // Parked cars along the avenues.
    for (let i = 0; i < 26; i += 1) {
      const avenue = pick(rng, this.world.avenues);
      const street = pick(rng, this.world.streets);
      const vertical = rng() > 0.5;
      const x = vertical ? avenue + 24 : range(rng, 200, WORLD.width - 200);
      const y = vertical ? range(rng, 200, WORLD.height - 200) : street + 24;
      this.cars.push(makeCar(rng, x, y, vertical ? Math.PI / 2 : 0, null, 'parked'));
    }
    // Traffic cars on the roads.
    for (let i = 0; i < 16; i += 1) {
      const avenue = pick(rng, this.world.avenues);
      const street = pick(rng, this.world.streets);
      const vertical = rng() > 0.5;
      const car = makeCar(rng, vertical ? avenue : range(rng, 300, WORLD.width - 300), vertical ? range(rng, 300, WORLD.height - 300) : street, vertical ? Math.PI / 2 : 0, null, 'traffic');
      car.vertical = vertical;
      car.speed = car.targetSpeed;
      this.cars.push(car);
    }
    // Pedestrians on sidewalks.
    for (let i = 0; i < 42; i += 1) {
      this.peds.push(makePed(rng, range(rng, 150, WORLD.width - 150), range(rng, 150, WORLD.height - 150)));
    }
    // Cash pickups scattered around the city.
    for (let i = 0; i < 14; i += 1) {
      this.pickups.push({
        x: range(rng, 200, WORLD.width - 200),
        y: range(rng, 200, WORLD.height - 200),
        amount: 25 + Math.floor(rng() * 4) * 25,
        bob: rng() * Math.PI * 2,
        kind: 'cash',
      });
    }
    this.spawnMissionMarkers();
  }

  currentMission() {
    return MISSIONS[this.missionIndex] ?? null;
  }

  missionTarget() {
    const m = this.currentMission();
    if (!m) return null;
    if (m.id === 'fare') {
      if (this.missionStep === 0) return districtByName('Marina');
      if (this.missionStep === 1) return districtByName('Marina');
      return districtByName('Grand Hotel');
    }
    if (m.id === 'delivery') {
      if (this.missionStep === 0) return districtByName('Central Plaza');
      return districtByName('The Docks');
    }
    if (m.id === 'getaway') return districtByName('Old Town Safehouse');
    if (m.id === 'stash') {
      const stash = this.pickups.find((p) => p.kind === 'stash');
      return stash ? { x: stash.x, y: stash.y, w: 60, h: 60 } : null;
    }
    return null;
  }

  spawnMissionMarkers() {
    const m = this.currentMission();
    if (!m) return;
    if (m.id === 'stash') {
      const spots = [
        { x: 700, y: 600 }, { x: 2900, y: 900 }, { x: 1800, y: 2300 },
      ];
      for (const s of spots) {
        this.pickups.push({ x: s.x, y: s.y, amount: 200, bob: 0, kind: 'stash' });
      }
    }
  }

  say(text, seconds = 3) {
    this.message = text;
    this.messageTimer = seconds;
  }

  addWanted(stars) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + stars, 0, WANTED.maxStars);
    if (this.wanted > before) {
      this.unseenTimer = 0;
      this.say(`Wanted level ${this.wanted} — the Solmar Bay PD is on you!`, 3);
    }
  }

  startMission(index) {
    this.missionIndex = index;
    this.missionStep = 0;
    this.missionDone = false;
    const m = this.currentMission();
    if (m) {
      this.missionTimer = m.timer ?? 0;
      this.say(`${m.giver}: ${m.briefing}`, 6);
      this.spawnMissionMarkers();
      // The Getaway opens with the heat already on: three stars on your tail.
      if (m.id === 'getaway') this.addWanted(3);
    }
  }

  completeMission() {
    const m = this.currentMission();
    if (!m) return;
    this.money += m.reward;
    this.stats.missionsDone += 1;
    this.missionDone = true;
    this.say(`Mission complete — ${m.title} paid $${m.reward}!`, 4);
    this.missionIndex += 1;
    this.missionStep = 0;
    if (this.missionIndex >= MISSIONS.length) {
      this.screen = SCREEN_WIN;
    } else {
      this.startMission(this.missionIndex);
    }
  }

  // --- player actions -------------------------------------------------------
  tryEnterCar(sound) {
    if (this.player.inCar) {
      const car = this.player.inCar;
      this.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      this.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      this.player.inCar = null;
      return;
    }
    let best = null;
    let bestD = 70;
    for (const car of this.cars) {
      const d = dist(this.player.x, this.player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    if (best.kind === 'traffic' || best.kind === 'police') {
      best.kind = 'player';
      best.driver = false;
      this.addWanted(WANTED.starsForSteal);
      this.stats.carsStolen += 1;
      this.say('You jacked a car! The owner called it in.', 2.5);
      if (sound) sound.crash();
    } else if (best.kind === 'parked') {
      best.kind = 'player';
      best.driver = false;
      this.stats.carsStolen += 1;
      this.say('You took a parked car.', 2);
      if (sound) sound.door();
    }
    this.player.inCar = best;
    this.player.x = best.x;
    this.player.y = best.y;
  }

  punch(sound) {
    if (this.player.punchTimer > 0 || this.player.inCar) return;
    this.player.punchTimer = PLAYER.punchCooldown;
    if (sound) sound.punch();
    const px = this.player.x + Math.cos(this.player.angle) * PLAYER.punchRange;
    const py = this.player.y + Math.sin(this.player.angle) * PLAYER.punchRange;
    for (const ped of this.peds) {
      if (dist(px, py, ped.x, ped.y) < 30) {
        ped.panic = 4;
        this.stats.pedsDown += 1;
        this.addWanted(WANTED.starsForKill);
        this.burst(ped.x, ped.y, '#ff5a5a');
        this.shake = 6;
      }
    }
    for (const cop of this.police) {
      if (cop.onFoot && dist(px, py, cop.x, cop.y) < 34) {
        cop.health -= PLAYER.punchDamage;
        this.burst(cop.x, cop.y, '#ffd23f');
      }
    }
  }

  shoot(sound) {
    if (this.player.shootTimer > 0 || this.player.ammo <= 0) return;
    this.player.shootTimer = 0.28;
    this.player.ammo -= 1;
    if (sound) sound.shot();
    const angle = this.player.inCar ? this.player.inCar.angle : this.player.angle;
    const ox = this.player.x + Math.cos(angle) * 26;
    const oy = this.player.y + Math.sin(angle) * 26;
    this.bullets.push({ x: ox, y: oy, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.9 });
    this.shake = 3;
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i += 1) {
      this.particles.push({
        x, y,
        vx: range(this.rng, -140, 140),
        vy: range(this.rng, -140, 140),
        life: range(this.rng, 0.3, 0.7),
        color,
      });
    }
  }

  // --- police ---------------------------------------------------------------
  spawnPolice() {
    const want = this.wanted >= 3 ? 3 : this.wanted >= 1 ? 2 : 0;
    while (this.police.length < want) {
      const angle = this.rng() * Math.PI * 2;
      const d = 700;
      const x = clamp(this.player.x + Math.cos(angle) * d, 100, WORLD.width - 100);
      const y = clamp(this.player.y + Math.sin(angle) * d, 100, WORLD.height - 100);
      const near = nearestRoadPoint(this.world, x, y);
      const car = makeCar(this.rng, near.x, near.y, 0, COLORS.police, 'police');
      car.speed = POLICE.chaseSpeed * 0.8;
      this.cars.push(car);
      this.police.push({ car, onFoot: false, health: 40, sirenTimer: 0 });
    }
  }

  // --- main update ----------------------------------------------------------
  update(dt, input, sound) {
    this.time += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 20);
    const p = this.player;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.shootTimer > 0) p.shootTimer -= dt;

    if (input.justPressed('e')) this.tryEnterCar(sound);
    if (input.justPressed(' ') || input.justPressed('mouse0')) {
      if (p.inCar) this.shoot(sound);
      else this.punch(sound);
    }
    if (input.justPressed('f')) this.shoot(sound);
    if (input.justPressed('m') && sound) {
      sound.setMuted(!sound.muted);
      this.say(sound.muted ? 'Sound muted' : 'Sound on', 1.5);
    }

    if (p.inCar) this.updateDriving(dt, input, sound);
    else this.updateOnFoot(dt, input);

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updateBullets(dt, sound);
    this.updatePolice(dt, sound);
    this.updatePickups(dt, sound);
    this.updateParticles(dt);
    this.updateWanted(dt);
    this.updateMission(dt, sound);

    if (p.health <= 0) {
      this.screen = SCREEN_OVER;
      this.bestMoney = Math.max(this.bestMoney, this.money);
    }
  }

  updateOnFoot(dt, input) {
    const p = this.player;
    const mv = input.moveVector();
    const speed = (input.down('shift') ? PLAYER.sprintSpeed : PLAYER.walkSpeed);
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    const fixed = collideCircle(this.world, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
  }

  updateDriving(dt, input, sound) {
    const car = this.player.inCar;
    const mv = input.moveVector();
    const forward = mv.y < 0 ? 1 : mv.y > 0 ? -1 : 0;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) car.speed -= CAR.brake * dt;
    else {
      car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
      if (Math.abs(car.speed) < 6) car.speed = 0; // settle to a stop, no jitter
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (Math.abs(car.speed) > 4) {
      const steer = mv.x;
      car.angle += steer * CAR.turnRate * dt * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 120, 0.3, 1);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = collideCircle(this.world, nx, ny, CAR.length / 2);
    if (hit.x !== nx || hit.y !== ny) {
      if (Math.abs(car.speed) > 200 && sound) sound.crash();
      car.speed *= -0.25;
      this.shake = Math.max(this.shake, 4);
    }
    car.x = hit.x;
    car.y = hit.y;
    this.player.x = car.x;
    this.player.y = car.y;
    if (sound && Math.abs(car.speed) > 60 && Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) {
      sound.engine(true);
    }
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      if (car.kind !== 'traffic') continue;
      const dir = car.vertical ? Math.PI / 2 : 0;
      const target = car.vertical ? dir : (car.lane > 0 ? 0 : Math.PI);
      car.angle += angleDelta(car.angle, target) * Math.min(1, dt * 4);
      car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Stay on the road: bounce off buildings and turn at map edges.
      if (collideCircle(this.world, nx, ny, CAR.length / 2).x !== nx || collideCircle(this.world, nx, ny, CAR.length / 2).y !== ny) {
        car.angle += Math.PI / 2;
        car.stuck += 1;
        if (car.stuck > 4) {
          const near = nearestRoadPoint(this.world, car.x, car.y);
          car.x = near.x;
          car.y = near.y;
          car.stuck = 0;
        }
        continue;
      }
      if (nx < 80 || nx > WORLD.width - 80 || ny < 80 || ny > WORLD.height - 80) {
        car.angle += Math.PI;
        continue;
      }
      car.x = nx;
      car.y = ny;
    }
  }

  updatePeds(dt) {
    for (const ped of this.peds) {
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = range(this.rng, 2, 6);
        ped.angle = range(this.rng, 0, Math.PI * 2);
      }
      if (ped.panic > 0) {
        ped.panic -= dt;
        const away = angleTo(this.player.x, this.player.y, ped.x, ped.y);
        ped.angle = away;
        ped.x += Math.cos(away) * 160 * dt;
        ped.y += Math.sin(away) * 160 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      const fixed = collideCircle(this.world, ped.x, ped.y, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
  }

  updateBullets(dt, sound) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      for (const cop of this.police) {
        if (cop.onFoot && dist(b.x, b.y, cop.x, cop.y) < 22) {
          cop.health -= 20;
          b.life = 0;
          this.burst(b.x, b.y, '#ffd23f');
        }
      }
      for (const ped of this.peds) {
        if (dist(b.x, b.y, ped.x, ped.y) < 18) {
          ped.panic = 4;
          b.life = 0;
          this.stats.pedsDown += 1;
          this.addWanted(WANTED.starsForKill);
        }
      }
      if (collideCircle(this.world, b.x, b.y, 2).x !== b.x || collideCircle(this.world, b.x, b.y, 2).y !== b.y) {
        b.life = 0;
        this.burst(b.x, b.y, '#cccccc');
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.police = this.police.filter((cop) => {
      if (cop.health <= 0) {
        this.burst(cop.x, cop.y, '#2f6fd0');
        this.addWanted(1);
        return false;
      }
      return true;
    });
  }

  updatePolice(dt, sound) {
    if (this.wanted > 0) this.spawnPolice();
    for (const cop of this.police) {
      cop.sirenTimer -= dt;
      if (cop.sirenTimer <= 0 && sound) {
        sound.siren();
        cop.sirenTimer = 2.4;
      }
      const car = cop.car;
      const d = dist(car.x, car.y, this.player.x, this.player.y);
      if (this.wanted === 0) {
        // Heat is off: police drift back to patrol.
        car.speed = Math.max(0, car.speed - 200 * dt);
        continue;
      }
      if (cop.onFoot) {
        const a = angleTo(car.x, car.y, this.player.x, this.player.y);
        car.x += Math.cos(a) * 190 * dt;
        car.y += Math.sin(a) * 190 * dt;
        if (d < POLICE.arrestRange && !this.player.inCar) {
          this.bustedTimer += dt;
          this.say(`BUSTED in ${Math.max(0, POLICE.bustTime - this.bustedTimer).toFixed(1)}s — run!`, 0.4);
          if (this.bustedTimer >= POLICE.bustTime) {
            this.player.health = 0;
            this.say('Busted by the Solmar Bay PD!', 3);
          }
        } else {
          this.bustedTimer = 0;
        }
        continue;
      }
      // Chase in the car: steer at the player, ram when close.
      const wantAngle = angleTo(car.x, car.y, this.player.x, this.player.y);
      car.angle += clamp(angleDelta(car.angle, wantAngle), -2.6 * dt, 2.6 * dt);
      car.speed += (POLICE.chaseSpeed - car.speed) * Math.min(1, dt * 1.5);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = collideCircle(this.world, nx, ny, CAR.length / 2);
      if (fixed.x === nx && fixed.y === ny) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.5;
      }
      if (d < 60) {
        // Ram the player.
        if (this.player.inCar) {
          this.player.inCar.speed *= 0.6;
          if (sound) sound.crash();
          this.shake = Math.max(this.shake, 5);
          this.player.health -= POLICE.ramDamage * dt * 2;
        } else {
          this.player.health -= POLICE.ramDamage * dt * 4;
          this.shake = Math.max(this.shake, 5);
        }
      }
      if (d < 90 && !this.player.inCar) {
        cop.onFoot = true;
        cop.x = car.x;
        cop.y = car.y;
      }
    }
    // Remove police cars that drifted far away once the heat is off.
    if (this.wanted === 0) {
      this.police = this.police.filter((cop) => dist(cop.car.x, cop.car.y, this.player.x, this.player.y) < 900);
    }
  }

  updatePickups(dt, sound) {
    for (const pk of this.pickups) pk.bob += dt * 3;
    const p = this.player;
    this.pickups = this.pickups.filter((pk) => {
      if (dist(p.x, p.y, pk.x, pk.y) < 40) {
        this.money += pk.amount;
        this.say(`+$${pk.amount} ${pk.kind === 'stash' ? 'stash cash' : 'found cash'}!`, 2);
        if (sound) sound.pickup();
        if (pk.kind === 'stash') {
          this.addWanted(1);
          if (this.currentMission()?.id === 'stash') {
            this.missionStep += 1;
            if (this.missionStep >= 3) {
              this.completeMission();
              if (sound) sound.missionDone();
            }
          }
        }
        return false;
      }
      return true;
    });
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  updateWanted(dt) {
    if (this.wanted === 0) return;
    // Out of sight of every cop: heat slowly cools.
    let seen = false;
    for (const cop of this.police) {
      if (dist(cop.car.x, cop.car.y, this.player.x, this.player.y) < 650) seen = true;
    }
    if (!seen) {
      this.unseenTimer += dt;
      if (this.unseenTimer >= WANTED.decaySeconds) {
        this.wanted -= 1;
        this.unseenTimer = 0;
        this.say(`Heat dropping — wanted level ${this.wanted}.`, 2);
      }
    } else {
      this.unseenTimer = 0;
    }
    this.wantedTimer += dt;
  }

  updateMission(dt, sound) {
    const m = this.currentMission();
    if (!m || this.missionDone) return;
    if (m.timer && this.missionStep > 0) {
      this.missionTimer -= dt;
      if (this.missionTimer <= 0) {
        this.say('Too slow — the delivery failed. Try the mission again (R).', 4);
        this.missionStep = 0;
        this.missionTimer = m.timer;
      }
    }
    const target = this.missionTarget();
    if (!target) return;
    const cx = target.x + (target.w ?? 0) / 2;
    const cy = target.y + (target.h ?? 0) / 2;
    const d = dist(this.player.x, this.player.y, cx, cy);
    const radius = Math.max(target.w ?? 120, target.h ?? 120) / 2 + 30;
    if (d < radius) {
      if (m.id === 'fare') {
        if (this.missionStep === 0) {
          this.missionStep = 1;
          this.pickupTimer = 0;
          this.say('Client spotted — stop in the marker to pick them up.', 3);
        } else if (this.missionStep === 1) {
          // Wait in the marker while the client walks over and gets in.
          this.pickupTimer = (this.pickupTimer ?? 0) + dt;
          if (this.pickupTimer > 1.2) {
            this.missionStep = 2;
            this.say('Client is in — drive them to the Grand Hotel.', 3);
          }
        } else if (this.missionStep === 2) {
          this.completeMission();
          if (sound) sound.missionDone();
        }
      } else if (m.id === 'delivery') {
        if (this.missionStep === 0) {
          this.missionStep = 1;
          this.missionTimer = m.timer;
          this.say('Case secured! 90 seconds to the Docks — go!', 3);
        } else if (this.missionStep === 1) {
          this.completeMission();
          if (sound) sound.missionDone();
        }
      } else if (m.id === 'getaway') {
        if (this.wanted === 0) {
          this.completeMission();
          if (sound) sound.missionDone();
        } else {
          this.say('Too hot! Lose the cops first, then hide here.', 1.5);
        }
      } else if (m.id === 'stash') {
        if (this.missionStep >= 3) {
          this.completeMission();
          if (sound) sound.missionDone();
        }
      }
    }
  }

  // --- save / load ----------------------------------------------------------
  save() {
    try {
      const data = {
        money: this.money,
        bestMoney: this.bestMoney,
        missionIndex: this.missionIndex,
        stats: this.stats,
        time: this.time,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.money = data.money ?? this.money;
      this.bestMoney = data.bestMoney ?? 0;
      this.missionIndex = data.missionIndex ?? 0;
      this.stats = data.stats ?? this.stats;
      this.time = data.time ?? 0;
      // startMission() (called by main.js after load) spawns the mission markers,
      // so load() must not spawn them a second time.
      return true;
    } catch {
      return false;
    }
  }
}
