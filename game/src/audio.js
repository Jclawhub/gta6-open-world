// Sunset Streets — synthesized audio. Every sound is built with the
// WebAudio API; the game ships no audio files at all.

export function createAudio() {
  const api = {
    ctx: null,
    master: null,
    musicOn: true,
    musicTimer: null,
    sirenNodes: null,
    engineNodes: null,
    enabled: false,
  };

  function ensure() {
    if (api.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      api.ctx = new AC();
      api.master = api.ctx.createGain();
      api.master.gain.value = 0.5;
      api.master.connect(api.ctx.destination);
      api.enabled = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || !api.enabled) return;
    const t0 = api.ctx.currentTime + when;
    const osc = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(api.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure() || !api.enabled) return;
    const t0 = api.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(api.ctx.sampleRate * dur));
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = api.ctx.createBufferSource();
    src.buffer = buf;
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = api.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(api.master);
    src.start(t0);
  }

  api.unlock = function () {
    if (ensure() && api.ctx.state === 'suspended') api.ctx.resume();
  };

  api.shot = function () {
    noise(0.14, 0.5, 2600);
    tone(180, 0.1, 'square', 0.22, 0, 60);
  };

  api.punch = function () {
    noise(0.09, 0.4, 700);
    tone(120, 0.09, 'sine', 0.4, 0, 55);
  };

  api.crash = function () {
    noise(0.35, 0.55, 900);
    tone(90, 0.3, 'sawtooth', 0.25, 0, 40);
  };

  api.pickup = function () {
    tone(660, 0.12, 'sine', 0.3);
    tone(880, 0.16, 'sine', 0.3, 0.09);
    tone(1320, 0.2, 'sine', 0.25, 0.18);
  };

  api.missionComplete = function () {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.32, i * 0.11));
  };

  api.win = function () {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, 0.3, 'triangle', 0.32, i * 0.13));
  };

  api.fail = function () {
    tone(392, 0.25, 'sawtooth', 0.22, 0, 370);
    tone(311, 0.35, 'sawtooth', 0.22, 0.22, 294);
    tone(233, 0.5, 'sawtooth', 0.22, 0.44, 220);
  };

  api.click = function () {
    tone(900, 0.05, 'square', 0.15);
  };

  // Heat cooling off: a descending two-tone blip when a star drops.
  api.starDrop = function () {
    tone(520, 0.14, 'sine', 0.25, 0, 380);
    tone(380, 0.2, 'sine', 0.22, 0.12, 260);
  };

  // Car theft: a quick two-note alarm chirp.
  api.steal = function () {
    tone(980, 0.07, 'square', 0.18);
    tone(1240, 0.09, 'square', 0.18, 0.08);
  };

  api.siren = function (on) {
    if (!ensure() || !api.enabled) return;
    if (on && !api.sirenNodes) {
      const osc = api.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 720;
      const lfo = api.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = api.ctx.createGain();
      lfoGain.gain.value = 240;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const g = api.ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(api.master);
      osc.start();
      lfo.start();
      api.sirenNodes = { osc, lfo, g };
    } else if (!on && api.sirenNodes) {
      try {
        api.sirenNodes.osc.stop();
        api.sirenNodes.lfo.stop();
      } catch (e) { /* already stopped */ }
      api.sirenNodes = null;
    }
  };

  api.engine = function (speed01) {
    if (!ensure() || !api.enabled) return;
    if (!api.engineNodes) {
      const osc = api.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      const filter = api.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const g = api.ctx.createGain();
      g.gain.value = 0;
      osc.connect(filter);
      filter.connect(g);
      g.connect(api.master);
      osc.start();
      api.engineNodes = { osc, filter, g };
    }
    const n = api.engineNodes;
    n.osc.frequency.setTargetAtTime(55 + speed01 * 130, api.ctx.currentTime, 0.08);
    n.filter.frequency.setTargetAtTime(400 + speed01 * 900, api.ctx.currentTime, 0.08);
    n.g.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, api.ctx.currentTime, 0.1);
  };

  // A slow sunset groove: a bass line over a soft pad, scheduled in bars.
  const bassLine = [55, 0, 55, 65.4, 0, 49, 0, 58.3, 55, 0, 55, 65.4, 73.4, 0, 49, 0];
  const padChords = [
    [220, 261.6, 329.6],
    [174.6, 220, 261.6],
    [196, 246.9, 293.7],
    [146.8, 220, 293.7],
  ];
  let bar = 0;
  let step = 0;

  api.startMusic = function () {
    if (!ensure() || !api.enabled || api.musicTimer) return;
    const stepDur = 0.24;
    api.musicTimer = setInterval(() => {
      if (!api.musicOn || !api.enabled) return;
      const bass = bassLine[step % bassLine.length];
      if (bass) tone(bass, stepDur * 0.9, 'triangle', 0.16);
      if (step % 16 === 0) {
        const chord = padChords[bar % padChords.length];
        chord.forEach((f) => tone(f, stepDur * 16, 'sine', 0.035));
        bar++;
      }
      if (step % 8 === 4) noise(0.05, 0.05, 5000);
      step++;
    }, stepDur * 1000);
  };

  api.stopMusic = function () {
    if (api.musicTimer) {
      clearInterval(api.musicTimer);
      api.musicTimer = null;
    }
  };

  api.setMusic = function (on) {
    api.musicOn = on;
    if (on) api.startMusic();
    else api.stopMusic();
  };

  return api;
}
