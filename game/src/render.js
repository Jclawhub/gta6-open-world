// Sunset Streets — canvas renderer. Draws the city, the actors and the
// waypoint from the pure sim state. No game logic lives here.

import { WORLD_W, WORLD_H, ROAD_HALF, SIDEWALK, DISTRICTS } from './sim.js';

const SHADOW_DX = 26;
const SHADOW_DY = 18;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state, cam) {
  const { buildings, parks, palms, signs } = state.city;
  const vw = cam.w;
  const vh = cam.h;
  const vx0 = cam.x - vw / 2 / cam.zoom;
  const vy0 = cam.y - vh / 2 / cam.zoom;
  const vx1 = cam.x + vw / 2 / cam.zoom;
  const vy1 = cam.y + vh / 2 / cam.zoom;
  const inView = (x, y, w, h) => x + w > vx0 - 80 && x < vx1 + 80 && y + h > vy0 - 80 && y < vy1 + 80;

  // Ground: warm dusk earth.
  ctx.fillStyle = '#b98a5e';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

  // Water on the far west, then the beach strip.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(vx0, vy0, Math.max(0, 40 - vx0), vy1 - vy0);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(40, vy0, 70, vy1 - vy0);
  // Gentle surf line.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(44, vy0);
  ctx.lineTo(44, vy1);
  ctx.stroke();

  // Parks: lawn green with tree blobs.
  for (const p of parks) {
    if (!inView(p.x, p.y, p.w, p.h)) continue;
    ctx.fillStyle = '#5e9a4e';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#548c44';
    for (let i = 0; i < 5; i++) {
      const tx = p.x + 24 + ((i * 37) % (p.w - 48));
      const ty = p.y + 26 + ((i * 53) % (p.h - 52));
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads: asphalt with sidewalks and lane dashes.
  drawRoads(ctx, vx0, vy0, vx1, vy1);

  // Docks: container yard on the east strip.
  drawDocks(ctx, vx0, vy0, vx1, vy1);

  // District labels, faint, painted on the ground.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px Georgia, serif';
  for (const d of DISTRICTS) {
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    if (!inView(cx - 200, cy - 40, 400, 80)) continue;
    ctx.fillStyle = 'rgba(255,240,210,0.20)';
    ctx.fillText(d.name.toUpperCase(), cx, cy);
  }
  ctx.restore();

  // Buildings with long sunset shadows.
  for (const b of buildings) {
    if (!inView(b.x, b.y, b.w, b.h)) continue;
    ctx.fillStyle = 'rgba(60,30,20,0.35)';
    ctx.fillRect(b.x + SHADOW_DX, b.y + SHADOW_DY, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Rooftop details: vents and skylights.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 10, b.y + 10, Math.min(26, b.w - 20), Math.min(18, b.h - 20));
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,220,150,0.75)';
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) {
        ctx.fillRect(wx, b.y + b.h - 12, 8, 6);
      }
    }
    if (b.name) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,245,225,0.85)';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
    }
  }

  // Palm trees.
  for (const palm of palms) {
    if (!inView(palm.x - 20, palm.y - 20, 40, 40)) continue;
    drawPalm(ctx, palm.x, palm.y, palm.s);
  }

  // Neon signs with glow.
  for (const s of signs) {
    if (!inView(s.x - 120, s.y - 30, 240, 60)) continue;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x, s.y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.text, s.x, s.y);
    ctx.restore();
  }

  // Mission markers: stashes glow gold, objectives pulse.
  drawMissionMarkers(ctx, state);
}

function drawRoads(ctx, vx0, vy0, vx1, vy1) {
  const roadXs = [];
  for (let i = 0; i <= 11; i++) roadXs.push(150 + 300 * i);
  const roadYs = [];
  for (let j = 0; j <= 8; j++) roadYs.push(150 + 300 * j);

  // Sidewalks.
  ctx.fillStyle = '#c9b8a0';
  for (const cx of roadXs) {
    ctx.fillRect(cx - ROAD_HALF - SIDEWALK, vy0, (ROAD_HALF + SIDEWALK) * 2, vy1 - vy0);
  }
  for (const cy of roadYs) {
    ctx.fillRect(vx0, cy - ROAD_HALF - SIDEWALK, vx1 - vx0, (ROAD_HALF + SIDEWALK) * 2);
  }
  // Asphalt.
  ctx.fillStyle = '#3d3a44';
  for (const cx of roadXs) {
    ctx.fillRect(cx - ROAD_HALF, vy0, ROAD_HALF * 2, vy1 - vy0);
  }
  for (const cy of roadYs) {
    ctx.fillRect(vx0, cy - ROAD_HALF, vx1 - vx0, ROAD_HALF * 2);
  }
  // Centre dashes, warm amber in the sunset.
  ctx.fillStyle = '#e8c25e';
  for (const cx of roadXs) {
    for (let y = Math.max(0, Math.floor(vy0 / 44) * 44); y < vy1; y += 44) {
      ctx.fillRect(cx - 2, y, 4, 22);
    }
  }
  for (const cy of roadYs) {
    for (let x = Math.max(0, Math.floor(vx0 / 44) * 44); x < vx1; x += 44) {
      ctx.fillRect(x, cy - 2, 22, 4);
    }
  }
  // Zebra crosswalks at every intersection in view, on all four arms.
  ctx.fillStyle = 'rgba(240,235,225,0.85)';
  for (const cx of roadXs) {
    for (const cy of roadYs) {
      if (cx < vx0 - 80 || cx > vx1 + 80 || cy < vy0 - 80 || cy > vy1 + 80) continue;
      for (let k = -2; k <= 2; k++) {
        // North and south arms: stripes run across the vertical road.
        ctx.fillRect(cx - 30 + k * 13, cy - ROAD_HALF - 16, 7, 12);
        ctx.fillRect(cx - 30 + k * 13, cy + ROAD_HALF + 4, 7, 12);
        // East and west arms: stripes run across the horizontal road.
        ctx.fillRect(cx - ROAD_HALF - 16, cy - 30 + k * 13, 12, 7);
        ctx.fillRect(cx + ROAD_HALF + 4, cy - 30 + k * 13, 12, 7);
      }
    }
  }
}

function drawDocks(ctx, vx0, vy0, vx1, vy1) {
  if (vx1 < 3480) return;
  ctx.fillStyle = '#6a6258';
  ctx.fillRect(3480, vy0, WORLD_W - 3480, vy1 - vy0);
  const cols = ['#c96b3a', '#3a7ac9', '#4da34d', '#c9a13a', '#8a5ac9'];
  for (let i = 0; i < 14; i++) {
    const x = 3500 + (i % 2) * 44;
    const y = 120 + Math.floor(i / 2) * 150 + ((i * 37) % 40);
    if (y > vy1 || y < vy0 - 120) continue;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(x, y, 38, 90);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x, y + 14 + k * 18, 38, 3);
  }
  // Cranes.
  ctx.strokeStyle = '#2e2a26';
  ctx.lineWidth = 6;
  for (const cy of [700, 1500, 2300]) {
    if (cy < vy0 - 160 || cy > vy1) continue;
    ctx.beginPath();
    ctx.moveTo(3520, cy);
    ctx.lineTo(3520, cy - 150);
    ctx.lineTo(3590, cy - 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3590, cy - 150);
    ctx.lineTo(3590, cy - 90);
    ctx.stroke();
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#6a4a2e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(4, -12, 2, -22);
  ctx.stroke();
  ctx.strokeStyle = '#2e8a4e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(2, -22);
    ctx.quadraticCurveTo(Math.cos(a) * 14, -22 + Math.sin(a) * 14, Math.cos(a) * 22, -22 + Math.sin(a) * 22 + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMissionMarkers(ctx, state) {
  const m = state.mission;
  if (state.won || m.stage !== 'active') return;
  const step = state.mission.step;
  const mission = state.mission.index < 6 ? state : null;
  if (!mission) return;
  const steps = [
    // Per-mission marker positions mirror the sim's steps.
  ];
  void steps;
  const s = (state.mission.index >= 0 && state.mission.index < 6)
    ? (function () {
        const defs = [
          [[450, 450], [750, 750]],
          [[1800, 1350], [3300, 1350]],
          [null, [750, 2250]],
          [[450, 1950], [1950, 1050], [3150, 2250]],
          [[450, 750], [1800, 1050], [3150, 1350]],
          [[1800, 450], [750, 2250]],
        ];
        return defs[state.mission.index][step] || null;
      })()
    : null;
  if (!s) return;
  const [mx, my] = s;
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ffd76a';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(mx, my, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd76a';
  ctx.fill();
  // A light pillar so the marker reads from far away.
  const grad = ctx.createLinearGradient(mx, my - 260, mx, my);
  grad.addColorStop(0, 'rgba(255,215,106,0)');
  grad.addColorStop(1, 'rgba(255,215,106,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(mx - 8, my - 260, 16, 260);
  ctx.restore();
}

function drawCar(ctx, c, isPlayer) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(40,20,10,0.35)';
  ctx.fillRect(-27 + 6, -13 + 5, 54, 26);
  // Body.
  ctx.fillStyle = c.color;
  roundRect(ctx, -27, -13, 54, 26, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.9)';
  roundRect(ctx, -8, -10, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.65)';
  ctx.fillRect(6, -9, 4, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(24, -11, 3, 5);
  ctx.fillRect(24, 6, 3, 5);
  // Taillights.
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-27, -11, 3, 5);
  ctx.fillRect(-27, 6, 3, 5);
  if (c.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', -2, 4);
    // Light bar.
    const t = Date.now() / 180;
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-14, -13, 8, 5);
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(6, -13, 8, 5);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -30, -16, 60, 32, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  const palette = { walker: '#e8e0d0', jogger: '#ff8a5e', tourist: '#5ec8ff' };
  // Shadow.
  ctx.fillStyle = 'rgba(40,20,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = palette[ped.type] || '#e8e0d0';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Head + facing tick.
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(40,20,10,0.35)';
  ctx.beginPath();
  ctx.ellipse(4, 5, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jacket (teal) with a coral stripe — the player's look.
  ctx.fillStyle = '#1f9d8a';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff6b5e';
  ctx.fillRect(-4, -13, 8, 6);
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(6, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when armed.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, 4);
  ctx.lineTo(20, 2);
  ctx.stroke();
  ctx.restore();
  // Gold ring so the player never gets lost in a crowd.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,215,106,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18 + Math.sin(state.time * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawActors(ctx, state) {
  for (const c of state.cars) {
    if (c.kind === 'parked' || c.kind === 'traffic' || c.kind === 'police') {
      const isPlayer = !state.player.onFoot && state.player.carId === c.id;
      drawCar(ctx, c, isPlayer);
    }
  }
  for (const ped of state.peds) drawPed(ctx, ped);
  for (const o of state.officers) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(40,20,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2a5e';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(0, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawPlayer(ctx, state);
}

export function drawWaypoint(ctx, state, cam) {
  if (state.won || state.mission.stage !== 'active') return;
  const defs = [
    [[450, 450], [750, 750]],
    [[1800, 1350], [3300, 1350]],
    [null, [750, 2250]],
    [[450, 1950], [1950, 1050], [3150, 2250]],
    [[450, 750], [1800, 1050], [3150, 1350]],
    [[1800, 450], [750, 2250]],
  ];
  const pt = defs[state.mission.index] ? defs[state.mission.index][state.mission.step] : null;
  if (!pt) return;
  const [tx, ty] = pt;
  const sx = (tx - cam.x) * cam.zoom + cam.w / 2;
  const sy = (ty - cam.y) * cam.zoom + cam.h / 2;
  // On screen: a floating diamond above the target. Off screen: an edge arrow.
  if (sx > 40 && sx < cam.w - 40 && sy > 40 && sy < cam.h - 40) {
    ctx.save();
    const bob = Math.sin(state.time * 4) * 6;
    ctx.translate(sx, sy - 52 + bob);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const cx = cam.w / 2;
  const cy = cam.h / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(a) * (Math.min(cam.w, cam.h) / 2 - 46);
  const ey = cy + Math.sin(a) * (Math.min(cam.w, cam.h) / 2 - 46);
  const dist = Math.round(Math.hypot(tx - state.player.x, ty - state.player.y));
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = '#ffd76a';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dist}m`, ex, ey + 30);
  ctx.restore();
}

export function drawMinimap(ctx, state, x, y, size) {
  const scale = size / WORLD_W;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,16,24,0.72)';
  roundRect(ctx, 0, 0, size, (size * WORLD_H) / WORLD_W, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(0, 0, size, (size * WORLD_H) / WORLD_W);
  ctx.clip();
  ctx.fillStyle = '#3d3a44';
  for (let i = 0; i <= 11; i++) ctx.fillRect((150 + 300 * i) * scale - 1, 0, 2, (WORLD_H * scale));
  for (let j = 0; j <= 8; j++) ctx.fillRect(0, (150 + 300 * j) * scale - 1, size, 2);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(0, 0, 40 * scale, WORLD_H * scale);
  // Objective blip.
  const defs = [
    [[450, 450], [750, 750]],
    [[1800, 1350], [3300, 1350]],
    [null, [750, 2250]],
    [[450, 1950], [1950, 1050], [3150, 2250]],
    [[450, 750], [1800, 1050], [3150, 1350]],
    [[1800, 450], [750, 2250]],
  ];
  if (!state.won && state.mission.stage === 'active') {
    const pt = defs[state.mission.index] ? defs[state.mission.index][state.mission.step] : null;
    if (pt) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(pt[0] * scale, pt[1] * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player blip.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(state.player.x * scale, state.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(state.player.x * scale, state.player.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
