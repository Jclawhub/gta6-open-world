// Deterministic screenshot scenes: each scene plays the real game forward
// from a fresh world for a fixed number of steps with a simple autopilot, so
// the frame is what a short session really looks like and the same seed
// always gives the same frame. Used with ?shot=finale|chase|mission|sprint|city|foot&seed=1.
import { SCREEN_PLAY, SCREEN_TITLE } from './game.js';
import { angleDelta } from './random.js';
import { nearestRoadPoint } from './world.js';

const STEP = 1 / 60;

// The scenes the screenshot mode knows, in the order the dossier lists them.
export const SHOT_SCENES = ['finale', 'sprint', 'city', 'chase', 'mission', 'foot'];

// A fake input the autopilot steers: the scenes drive through the game's own
// physics (throttle + steering), so the car accelerates, turns and skids the
// way a player's car does instead of being teleported along.
function driverInput() {
  const state = { steer: 0, throttle: 0 };
  return {
    state,
    justPressed: () => false,
    down: () => false,
    moveVector: () => ({ x: state.steer, y: state.throttle > 0 ? -1 : 0 }),
    endFrame: () => {},
  };
}

// Steer the player's car toward a target point, full throttle.
function driveToward(game, input, tx, ty) {
  const car = game.player.inCar;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const d = angleDelta(car.angle, want);
  input.state.steer = Math.max(-1, Math.min(1, d * 2));
  input.state.throttle = 1;
}

function stepWorld(game, input, sound, steps) {
  for (let i = 0; i < steps; i += 1) {
    game.update(STEP, input, sound);
    input.endFrame();
  }
}

// Route to a target along the road grid: the car drives down streets and
// avenues (straight corridors with no buildings) instead of steering
// diagonally through city blocks, where it used to get stuck on a corner.
function routeWaypoints(game, tx, ty) {
  const nearest = (v, list) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const car = game.player.inCar;
  const startStreet = nearest(car.y, game.world.streets);
  const targetAvenue = nearest(tx, game.world.avenues);
  const targetStreet = nearest(ty, game.world.streets);
  return [
    [car.x, startStreet],
    [targetAvenue, startStreet],
    [targetAvenue, targetStreet],
    [tx, ty],
  ];
}

function driveRoute(game, input, sound, tx, ty, maxSeconds) {
  const waypoints = routeWaypoints(game, tx, ty);
  let leg = 0;
  const maxSteps = Math.round(maxSeconds * 60);
  for (let i = 0; i < maxSteps && leg < waypoints.length; i += 1) {
    const [wx, wy] = waypoints[leg];
    const d = Math.hypot(game.player.x - wx, game.player.y - wy);
    if (d < 140) {
      leg += 1;
    } else if (leg === waypoints.length - 1 && d < 260) {
      // Final approach: coast to a stop near the target instead of circling it.
      input.state.throttle = 0;
      driveToward(game, input, wx, wy);
      input.state.throttle = 0;
    } else {
      driveToward(game, input, wx, wy);
    }
    game.update(STEP, input, sound);
    input.endFrame();
  }
  input.state.throttle = 0;
  input.state.steer = 0;
}

// Pull the pursuing police onto the road behind the player, in frame.
function pullPoliceIntoFrame(game) {
  for (const cop of game.police) {
    const spot = nearestRoadPoint(
      game.world,
      game.player.x - 220 + game.police.indexOf(cop) * 90,
      game.player.y + 130,
    );
    cop.car.x = spot.x;
    cop.car.y = spot.y;
    cop.car.speed = 380;
  }
}

function putPlayerInCar(game) {
  const car = game.cars.find((c) => c.kind === 'parked');
  if (!car) return null;
  car.kind = 'player';
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  return car;
}

export function stageShot(name, game, sound) {
  // Every scene drives through the same driver input; scenes that do not
  // drive leave its throttle at 0, which reads exactly like no keys.
  const input = driverInput();
  const silent = {
    setMuted: () => {}, siren: () => {}, crash: () => {}, engine: () => {},
    shot: () => {}, punch: () => {}, missionDone: () => {}, pickup: () => {},
    skid: () => {}, checkpoint: () => {}, honk: () => {}, door: () => {},
  };
  game.reset();
  game.screen = SCREEN_PLAY;
  if (name === 'finale') {
    // The cover: the Vault Job mid-escape — two stars, police in pursuit,
    // the Safehouse marker on the HUD and minimap, cash and traffic in frame.
    game.startMission(5);
    game.player.x = 1800;
    game.player.y = 1400;
    game.update(STEP, input, silent);
    putPlayerInCar(game);
    // Drive to just outside the Safehouse completion radius: the shot
    // catches the escape in progress, not the win screen after delivery.
    driveRoute(game, input, silent, 1000, 650, 20);
    pullPoliceIntoFrame(game);
    driveRoute(game, input, silent, 1000, 650, 2);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'sprint') {
    // Sunset Sprint: racing toward the first checkpoint, timer on the HUD.
    game.startMission(4);
    putPlayerInCar(game);
    driveRoute(game, input, silent, 3150, 2150, 12);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'city') {
    // Title screen over a living city: traffic and pedestrians move, camera
    // on the player.
    game.screen = SCREEN_TITLE;
    stepWorld(game, input, silent, 8 * 60);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Player in a car, three stars, police in pursuit, mid-chase.
    // startMission(2) already puts three stars on the player.
    game.startMission(2);
    putPlayerInCar(game);
    driveRoute(game, input, silent, 900, 500, 16);
    pullPoliceIntoFrame(game);
    driveRoute(game, input, silent, 900, 500, 2);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 1 in progress: driving to the Marina pickup, objective on HUD.
    game.startMission(0);
    putPlayerInCar(game);
    driveRoute(game, input, silent, 650, 2300, 14);
    return { screen: SCREEN_PLAY };
  }
  // 'foot': on foot near the plaza, cash pickups and pedestrians around.
  game.player.x = 1750;
  game.player.y = 1350;
  stepWorld(game, input, silent, 5 * 60);
  return { screen: SCREEN_PLAY };
}
