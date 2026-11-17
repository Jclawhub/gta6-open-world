// Deterministic screenshot scenes, in the starter's spirit: each scene plays the
// real game forward from a fresh world for a fixed number of steps with a simple
// autopilot, so the frame is what a short session really looks like and the same
// seed always gives the same frame. Used with ?shot=city|chase|mission|foot&seed=1.
import { SCREEN_PLAY, SCREEN_TITLE } from './game.js';
import { collideCircle } from './world.js';

const STEP = 1 / 60;

function driveToward(game, tx, ty) {
  // Steer the player's car toward a target point, full throttle, sliding along
  // buildings instead of driving through them.
  const car = game.player.inCar;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.angle += Math.max(-2.4 * STEP, Math.min(2.4 * STEP, d));
  car.speed = Math.min(430, car.speed + 420 * STEP);
  const nx = car.x + Math.cos(car.angle) * car.speed * STEP;
  const ny = car.y + Math.sin(car.angle) * car.speed * STEP;
  const fixed = collideCircle(game.world, nx, ny, 27);
  car.x = fixed.x;
  car.y = fixed.y;
  game.player.x = car.x;
  game.player.y = car.y;
}

function stepWorld(game, input, sound, steps) {
  for (let i = 0; i < steps; i += 1) {
    game.update(STEP, input, sound);
    input.endFrame();
  }
}

// A fake input that reports no keys: the scenes move the world directly.
function nullInput() {
  return {
    justPressed: () => false,
    down: () => false,
    moveVector: () => ({ x: 0, y: 0 }),
    endFrame: () => {},
  };
}

export function stageShot(name, game, sound) {
  const input = nullInput();
  const silent = { setMuted: () => {}, siren: () => {}, crash: () => {}, engine: () => {}, shot: () => {}, punch: () => {}, missionDone: () => {}, pickup: () => {} };
  game.reset();
  game.screen = SCREEN_PLAY;
  if (name === 'city') {
    // Title screen over a living city: traffic and pedestrians move, camera on the player.
    game.screen = SCREEN_TITLE;
    stepWorld(game, input, silent, 8 * 60);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Player in a car, three stars, police in pursuit, mid-chase.
    // startMission('getaway') already puts three stars on the player.
    game.startMission(2);
    const car = game.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      game.player.inCar = car;
      game.player.x = car.x;
      game.player.y = car.y;
    }
    for (let i = 0; i < 14 * 60; i += 1) {
      driveToward(game, 900, 500);
      game.update(STEP, input, silent);
    }
    // Pull the pursuing police into frame behind the player for the shot.
    for (const cop of game.police) {
      cop.car.x = game.player.x - 220 + game.police.indexOf(cop) * 90;
      cop.car.y = game.player.y + 130;
      cop.car.speed = 380;
    }
    for (let i = 0; i < 2 * 60; i += 1) {
      driveToward(game, 900, 500);
      game.update(STEP, input, silent);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 1 in progress: driving to the Marina pickup, objective on the HUD.
    game.startMission(0);
    const car = game.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      game.player.inCar = car;
      game.player.x = car.x;
      game.player.y = car.y;
    }
    for (let i = 0; i < 10 * 60; i += 1) {
      driveToward(game, 650, 2300);
      game.update(STEP, input, silent);
    }
    return { screen: SCREEN_PLAY };
  }
  // 'foot': on foot near the plaza, cash pickups and pedestrians around.
  game.player.x = 1750;
  game.player.y = 1350;
  stepWorld(game, input, silent, 5 * 60);
  return { screen: SCREEN_PLAY };
}
