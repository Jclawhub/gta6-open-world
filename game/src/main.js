// Sunset Streets — bootstrap: canvas setup, the game loop, screens, save/load
// and the deterministic screenshot mode (?shot=finale|chase|mission|sprint|city|foot&seed=N).
import { Game, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed') ?? 20261117);
const seed = Number.isFinite(seedParam) ? seedParam : 20261117;
const shotName = params.get('shot');

const game = new Game(seed);
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new SoundBank();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function resize() {
  renderer.resize();
}
window.addEventListener('resize', resize);
resize();

// Hiding the tab pauses the game instead of letting the city run on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === SCREEN_PLAY) {
    game.screen = SCREEN_PAUSE;
    announce('Paused');
  }
});

// Screenshot mode: stage a deterministic scene, draw one frame on the next
// animation frame (after layout), then stop.
if (shotName) {
  game.load();
  stageShot(shotName, game, sound);
  requestAnimationFrame(() => {
    resize();
    renderer.draw(game);
    announce(`Screenshot scene: ${shotName}`);
  });
} else {
  game.load();
  if (game.missionIndex > 0) game.startMission(game.missionIndex);
  else game.startMission(0);
  game.screen = SCREEN_TITLE;
  announce('Sunset Streets — press Enter to start');

  let last = performance.now();
  let lastSave = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.justPressed('enter') || input.justPressed(' ')) {
      if (game.screen === SCREEN_TITLE) {
        game.screen = SCREEN_PLAY;
        sound.ensure();
        sound.startMusic();
        announce('Playing Sunset Streets');
      } else if (game.screen === SCREEN_OVER || game.screen === SCREEN_WIN) {
        game.reset();
        game.startMission(0);
        game.screen = SCREEN_PLAY;
        announce('Playing Sunset Streets');
      }
    }
    if (input.justPressed('p') && (game.screen === SCREEN_PLAY || game.screen === SCREEN_PAUSE)) {
      game.screen = game.screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
      announce(game.screen === SCREEN_PAUSE ? 'Paused' : 'Playing');
    }
    if (game.screen === SCREEN_PAUSE) {
      if (input.justPressed('r')) {
        game.reset();
        game.startMission(game.missionIndex);
        game.screen = SCREEN_PLAY;
      }
      if (input.justPressed('s')) {
        game.save();
        game.say('Game saved.', 2);
      }
    }
    if (game.screen === SCREEN_PLAY) {
      game.update(dt, input, sound);
      // Autosave every 30 seconds of play.
      if (game.time - lastSave >= 30) {
        lastSave = game.time;
        game.save();
      }
    }
    renderer.draw(game);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
