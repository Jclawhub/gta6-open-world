// All sound is synthesized with WebAudio — no audio files. A tiny synth for effects
// (shots, punches, pickups, sirens, engine hum) and a simple bass-and-hat music loop.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, duration, type = 'square', volume = 0.2, slideTo = null) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise(duration, volume = 0.2, lowpass = 1200) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise(0.14, 0.35, 2600);
    this.tone(180, 0.1, 'square', 0.18, 60);
  }

  punch() {
    this.noise(0.09, 0.25, 700);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.22);
    setTimeout(() => this.tone(990, 0.14, 'sine', 0.22), 70);
  }

  door() {
    this.noise(0.07, 0.18, 500);
    this.tone(220, 0.06, 'square', 0.1, 140);
  }

  honk() {
    this.tone(370, 0.16, 'square', 0.14);
    setTimeout(() => this.tone(370, 0.16, 'square', 0.14), 190);
  }

  crash() {
    this.noise(0.3, 0.4, 900);
    this.tone(90, 0.25, 'sawtooth', 0.25, 40);
  }

  siren() {
    this.tone(700, 0.35, 'sine', 0.1, 1050);
    setTimeout(() => this.tone(1050, 0.35, 'sine', 0.1, 700), 360);
  }

  engine(on) {
    if (!this.ensure()) return;
    if (!on) return;
    this.tone(70, 0.12, 'sawtooth', 0.05, 110);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 110));
  }

  startMusic() {
    if (this.musicOn || !this.ensure()) return;
    this.musicOn = true;
    // Chill coastal groove: bass line + hats, 112 BPM eighth notes.
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 0, 65.4, 0];
    const stepMs = 60000 / 112 / 2;
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const note = bass[this.step % bass.length];
      if (note > 0) this.tone(note, 0.22, 'triangle', 0.16);
      if (this.step % 2 === 0) this.noise(0.03, 0.05, 8000);
      this.step += 1;
    }, stepMs);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
