// Sunset Streets — browser entry point. Wires input, the game loop, the
// camera, the HUD, banners, pause, save/load and screenshot staging.

import {
  createGame, stepGame, startMission, retryMission, currentMission,
  objectiveText, objectivePoint, serializeSave, applySave, SAVE_KEY,
  WORLD_W, WORLD_H,
} from './sim.js';
import { drawWorld, drawActors, drawWaypoint, drawMinimap } from './render.js';
import { createFx, applyEvents, updateFx, drawFx } from './fx.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

const state = createGame(1337);
const fx = createFx();
const audio = createAudio();
const cam = { x: state.player.x, y: state.player.y, zoom: 1, w: 1280, h: 720 };

const keys = {};
let mouse = { x: 640, y: 360, down: false };
let paused = false;
let started = false;
let lastBanner = '';
let bannerUntil = 0;
let lastEventAt = 0;

const $ = (id) => document.getElementById(id);

function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US');
}

function showBanner(text, sub, ms) {
  const el = $('banner');
  el.querySelector('.banner-title').textContent = text;
  el.querySelector('.banner-sub').textContent = sub || '';
  el.classList.remove('hidden');
  lastBanner = text;
  bannerUntil = performance.now() + (ms || 3200);
}

function hideBanner() {
  $('banner').classList.add('hidden');
}

function showBriefing() {
  const m = currentMission(state);
  if (!m) return;
  $('brief-title').textContent = `Job ${m.id} — ${m.title}`;
  $('brief-giver').textContent = `from ${m.giver} · pays ${fmtMoney(m.payout)}`;
  $('brief-text').textContent = m.brief;
  $('briefing').classList.remove('hidden');
}

function hideBriefing() {
  $('briefing').classList.add('hidden');
}

function showEndScreen(win) {
  $('end-title').textContent = win ? 'SOLMAR BAY IS YOURS' : 'BUSTED';
  $('end-sub').textContent = win
    ? `All six jobs done. You earned ${fmtMoney(state.earned)} on top of your starting cash — Lena and Marco are already planning the next one.`
    : 'The job failed. Press R to retry.';
  $('end-stats').textContent = win
    ? `Total earned ${fmtMoney(state.earned)} · Jobs busted ${state.bustedCount} · Final cash ${fmtMoney(state.money)}`
    : `Cash ${fmtMoney(state.money)} · Jobs busted ${state.bustedCount}`;
  $('endscreen').classList.remove('hidden');
}

function hideEndScreen() {
  $('endscreen').classList.add('hidden');
}

function updateHud() {
  $('hud-money').textContent = fmtMoney(state.money);
  $('hud-hp').textContent = Math.max(0, Math.round(state.hp));
  $('hud-hp-bar').style.width = `${Math.max(0, state.hp)}%`;
  $('hud-ammo').textContent = state.ammo;
  $('hud-objective').textContent = objectiveText(state);
  const stars = $('hud-stars');
  stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  stars.classList.toggle('hot', state.wanted >= 3);
  const m = currentMission(state);
  $('hud-mission').textContent = state.won ? 'All jobs complete' : m ? `Job ${m.id}/6 — ${m.title}` : '';
  const t = state.mission.timer;
  if (state.mission.stage === 'active' && state.mission.timerStarted && t > 0) {
    $('hud-timer').textContent = `${Math.ceil(t)}s`;
    $('hud-timer').classList.toggle('urgent', t <= 15);
  } else {
    $('hud-timer').textContent = '';
  }
  // Pause button label.
  $('btn-pause').textContent = paused ? '▶ Resume' : 'II Pause';
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state)));
  } catch (e) { /* storage unavailable — the game still runs */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(state, JSON.parse(raw));
  } catch (e) {
    return false;
  }
}

function readInput() {
  const input = {
    up: !!keys['KeyW'] || !!keys['ArrowUp'],
    down: !!keys['KeyS'] || !!keys['ArrowDown'],
    left: !!keys['KeyA'] || !!keys['ArrowLeft'],
    right: !!keys['KeyD'] || !!keys['ArrowRight'],
    sprint: !!keys['ShiftLeft'] || !!keys['ShiftRight'],
    punch: false,
    fire: false,
    enter: false,
    mouseX: 0,
    mouseY: 0,
  };
  // Mouse position in world coordinates.
  const rect = canvas.getBoundingClientRect();
  const sx = (mouse.x - rect.left) * (canvas.width / rect.width);
  const sy = (mouse.y - rect.top) * (canvas.height / rect.height);
  input.mouseX = cam.x + (sx - cam.w / 2) / cam.zoom;
  input.mouseY = cam.y + (sy - cam.h / 2) / cam.zoom;
  return input;
}

let punchQueued = false;
let fireHeld = false;
let enterQueued = false;
let fireCooldown = 0;

function handleEvents(events) {
  for (const e of events) {
    lastEventAt = state.time;
    if (e.type === 'missionComplete') {
      audio.missionComplete();
      showBanner('JOB DONE', `${e.title} — +${fmtMoney(e.payout)}`, 3400);
      saveGame();
      if (!state.won) showBriefing();
    } else if (e.type === 'win') {
      audio.win();
      saveGame();
      showEndScreen(true);
    } else if (e.type === 'busted') {
      audio.fail();
      saveGame();
      showBanner('BUSTED', e.reason === 'time' ? 'Out of time.' : 'The cops got you. Cash penalty $100.', 3600);
      showEndScreen(false);
    } else if (e.type === 'pickup' || e.type === 'stepDone') {
      audio.pickup();
    } else if (e.type === 'shot') {
      audio.shot();
    } else if (e.type === 'punch') {
      audio.punch();
    } else if (e.type === 'crash' || e.type === 'ram') {
      audio.crash();
    } else if (e.type === 'starDrop') {
      audio.starDrop();
      showBanner('HEAT DROPPING', `Wanted level now ${e.wanted} star${e.wanted === 1 ? '' : 's'}`, 1800);
    } else if (e.type === 'steal') {
      audio.steal();
    } else if (e.type === 'missionStart') {
      hideBriefing();
    }
  }
  applyEvents(fx, events);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  cam.w = w;
  cam.h = h;
  // Zoom out on wide screens so more of the city shows.
  cam.zoom = Math.max(0.72, Math.min(1.05, w / 1500));
}

window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  audio.unlock();
  if (!started) {
    started = true;
    audio.startMusic();
    $('title-screen').classList.add('hidden');
    showBriefing();
  }
  if (e.code === 'Space') {
    punchQueued = true;
    e.preventDefault();
  }
  if (e.code === 'KeyF') fireHeld = true;
  if (e.code === 'KeyE') enterQueued = true;
  if (e.code === 'Enter') {
    if (state.mission.stage === 'briefing') {
      startMission(state);
      audio.click();
    }
  }
  if (e.code === 'KeyR') {
    if (state.mission.stage === 'failed') {
      hideEndScreen();
      retryMission(state);
      showBriefing();
      audio.click();
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    paused = !paused;
    updateHud();
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyF') fireHeld = false;
});

canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
  mouse.down = true;
  if (e.button === 0) fireHeld = true;
  audio.unlock();
});
window.addEventListener('mouseup', () => {
  mouse.down = false;
  fireHeld = false;
});

$('btn-start').addEventListener('click', () => {
  started = true;
  audio.unlock();
  audio.startMusic();
  $('title-screen').classList.add('hidden');
  const had = loadGame();
  if (had) showBanner('WELCOME BACK', 'Your progress was loaded.', 2600);
  showBriefing();
});
$('btn-continue').addEventListener('click', () => {
  started = true;
  audio.unlock();
  audio.startMusic();
  $('title-screen').classList.add('hidden');
  loadGame();
  showBriefing();
});
$('btn-brief-start').addEventListener('click', () => {
  startMission(state);
  audio.click();
});
$('btn-pause').addEventListener('click', () => {
  paused = !paused;
  updateHud();
});
$('btn-sound').addEventListener('click', () => {
  audio.setMusic(!audio.musicOn);
  $('btn-sound').textContent = audio.musicOn ? '♪ Music on' : '♪ Music off';
});
$('btn-retry').addEventListener('click', () => {
  hideEndScreen();
  retryMission(state);
  showBriefing();
});
$('btn-restart').addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
});

// Continue button only makes sense when a save exists.
try {
  $('btn-continue').style.display = localStorage.getItem(SAVE_KEY) ? '' : 'none';
} catch (e) {
  $('btn-continue').style.display = 'none';
}

// ---- Screenshot staging -------------------------------------------------
// ?shot=cover|briefing|chase|win arranges a real in-game scene for captures.
function stageShot(kind) {
  started = true;
  $('title-screen').classList.add('hidden');
  audio.enabled = false;
  if (kind === 'cover') {
    state.player.x = 1500;
    state.player.y = 1350;
    const car = state.cars.find((c) => c.kind === 'parked' && Math.abs(c.x - 1500) < 400);
    if (car) {
      state.player.onFoot = false;
      state.player.carId = car.id;
      car.speed = 320;
      car.angle = 0;
      car.x = 1380;
      car.y = 1350;
    }
    state.mission.stage = 'active';
    state.mission.index = 1;
    state.mission.step = 1;
  } else if (kind === 'briefing') {
    state.player.x = 450;
    state.player.y = 600;
    showBriefing();
  } else if (kind === 'chase') {
    state.player.x = 1800;
    state.player.y = 1350;
    state.wanted = 3;
    state.mission.stage = 'active';
    state.mission.index = 2;
    state.mission.step = 0;
    const car = state.cars.find((c) => c.kind === 'parked');
    if (car) {
      state.player.onFoot = false;
      state.player.carId = car.id;
      car.speed = 380;
      car.angle = Math.PI;
      car.x = 1900;
      car.y = 1350;
    }
  } else if (kind === 'win') {
    state.won = true;
    state.earned = 4100;
    state.money = 4220;
    state.mission.index = 6;
    state.mission.stage = 'done';
    showEndScreen(true);
  }
  updateHud();
}

const shotKind = new URLSearchParams(window.location.search).get('shot');
if (shotKind) stageShot(shotKind);

// ---- Main loop ----------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (performance.now() > bannerUntil && lastBanner) {
    hideBanner();
    lastBanner = '';
  }
  if (!started || paused) {
    // Still draw the world behind the title screen.
    drawFrame(dt);
    return;
  }
  const input = readInput();
  input.punch = punchQueued;
  input.enter = enterQueued;
  punchQueued = false;
  enterQueued = false;
  fireCooldown -= dt;
  input.fire = fireHeld && fireCooldown <= 0;
  if (input.fire) fireCooldown = 0.22;
  const events = stepGame(state, input, dt);
  handleEvents(events);
  updateFx(fx, dt);
  audio.engine(state.player.onFoot ? 0 : Math.abs(state.player.speed) / 460);
  audio.siren(state.wanted >= 2);
  drawFrame(dt);
  updateHud();
}

function drawFrame(dt) {
  void dt;
  // Camera eases toward the player.
  const tx = state.player.x;
  const ty = state.player.y;
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
  cam.x = Math.max(cam.w / 2 / cam.zoom, Math.min(WORLD_W - cam.w / 2 / cam.zoom, cam.x));
  cam.y = Math.max(cam.h / 2 / cam.zoom, Math.min(WORLD_H - cam.h / 2 / cam.zoom, cam.y));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Sunset sky wash behind the world edges.
  const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
  sky.addColorStop(0, '#ff9d6b');
  sky.addColorStop(0.55, '#ff7e5f');
  sky.addColorStop(1, '#7a4a8a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.translate(cam.w / 2, cam.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + fx.shakeX, -cam.y + fx.shakeY);
  drawWorld(ctx, state, cam);
  drawFx(ctx, fx);
  drawActors(ctx, state);
  drawWaypoint(ctx, state, cam);
  ctx.restore();
  // Minimap in the corner.
  const mw = 190;
  const mh = (mw * WORLD_H) / WORLD_W;
  mctx.clearRect(0, 0, mw, mh);
  drawMinimap(mctx, state, 0, 0, mw);
  const obj = objectivePoint(state);
  if (obj && !state.won) {
    ctx.save();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

requestAnimationFrame(frame);
