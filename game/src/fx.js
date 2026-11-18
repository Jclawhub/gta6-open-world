// Sunset Streets — particles, skid marks, smoke, sparks and screen shake.
// Pure data + canvas drawing; no game logic lives here.

export function createFx() {
  return {
    particles: [],
    skids: [], // {x1,y1,x2,y2,life}
    shake: 0,
    shakeX: 0,
    shakeY: 0,
  };
}

export function addBurst(fx, x, y, color, n, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity: 0,
    });
  }
}

export function addSmoke(fx, x, y, n) {
  for (let i = 0; i < n; i++) {
    fx.particles.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 24,
      vy: -28 - Math.random() * 30,
      life: 0.9 + Math.random() * 0.7,
      maxLife: 1.6,
      size: 9 + Math.random() * 10,
      color: 'rgba(120,120,130,0.55)',
      gravity: -12,
    });
  }
}

export function addSparks(fx, x, y) {
  addBurst(fx, x, y, '#ffd76a', 10, 260, 0.45, 3);
  addBurst(fx, x, y, '#ff9d4d', 6, 180, 0.35, 2.5);
}

export function addSkid(fx, x, y, angle) {
  const dx = Math.cos(angle) * 14;
  const dy = Math.sin(angle) * 14;
  const px = -Math.sin(angle) * 9;
  const py = Math.cos(angle) * 9;
  fx.skids.push({ x1: x - dx + px, y1: y - dy + py, x2: x + dx + px, y2: y + dy + py, life: 6 });
  fx.skids.push({ x1: x - dx - px, y1: y - dy - py, x2: x + dx - px, y2: y + dy - py, life: 6 });
  if (fx.skids.length > 150) fx.skids.splice(0, fx.skids.length - 150);
}

export function addShake(fx, mag) {
  fx.shake = Math.max(fx.shake, mag);
}

export function updateFx(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 0) * dt;
    p.vx *= 1 - 1.8 * dt;
    p.vy *= 1 - 1.8 * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter((s) => s.life > 0);
  if (fx.shake > 0) {
    fx.shake = Math.max(0, fx.shake - dt * 26);
    fx.shakeX = (Math.random() - 0.5) * fx.shake;
    fx.shakeY = (Math.random() - 0.5) * fx.shake;
  } else {
    fx.shakeX = 0;
    fx.shakeY = 0;
  }
}

// Drain sim events into visible effects. Called once per frame.
export function applyEvents(fx, events) {
  for (const e of events) {
    if (e.type === 'shot') {
      addBurst(fx, e.x, e.y, '#ffe08a', 5, 200, 0.18, 2.5);
      addShake(fx, 2);
    } else if (e.type === 'punch') {
      addBurst(fx, e.x, e.y, '#ffffff', 4, 140, 0.22, 3);
    } else if (e.type === 'crash' || e.type === 'ram') {
      addSparks(fx, e.x, e.y);
      addSmoke(fx, e.x, e.y, 4);
      addShake(fx, 9);
    } else if (e.type === 'hit' || e.type === 'pedDown') {
      addBurst(fx, e.x, e.y, '#ff5e5e', 8, 160, 0.4, 3);
    } else if (e.type === 'pickup' || e.type === 'stepDone') {
      addBurst(fx, e.x, e.y, '#7dff8a', 14, 170, 0.6, 3.5);
    } else if (e.type === 'missionComplete' || e.type === 'win') {
      addBurst(fx, e.x, e.y, '#ffd76a', 26, 300, 0.9, 4);
      addBurst(fx, e.x, e.y, '#ff5e8a', 18, 240, 0.8, 3.5);
    } else if (e.type === 'skid') {
      addSkid(fx, e.x, e.y, e.angle);
    } else if (e.type === 'steal') {
      addBurst(fx, e.x, e.y, '#4dd8ff', 8, 150, 0.4, 3);
    } else if (e.type === 'starDrop') {
      // Heat cooling off: a slow blue wisp rising from the player.
      addBurst(fx, e.x, e.y, '#7db8ff', 10, 60, 1.0, 4);
      addBurst(fx, e.x, e.y, '#bfe0ff', 6, 40, 0.8, 3);
    } else if (e.type === 'busted') {
      addBurst(fx, e.x, e.y, '#ff5e5e', 22, 260, 0.7, 4);
      addShake(fx, 12);
    }
  }
}

export function drawFx(ctx, fx) {
  // Skid marks first, under everything else.
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of fx.skids) {
    ctx.strokeStyle = `rgba(20,16,14,${Math.min(0.55, s.life / 6 * 0.55)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.restore();
  for (const p of fx.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
