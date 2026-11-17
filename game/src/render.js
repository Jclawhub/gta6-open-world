// Canvas rendering: the city, cars, people, effects and the whole HUD
// (health, money, wanted stars, minimap, mission tracker, messages).
import { WORLD, COLORS, CAR, PLAYER } from './config.js';
import { DISTRICTS } from './world.js';
import { SCREEN_TITLE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './game.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Pin the canvas to the viewport explicitly: some headless windows report a
    // smaller layout viewport than the screenshot size.
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.dpr = dpr;
  }

  draw(game) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    const vw = w / this.dpr;
    const vh = h / this.dpr;
    // Camera follows the player, with a shake offset when the action is loud.
    const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    this.camera.x = game.player.x - vw / 2 + shakeX;
    this.camera.y = game.player.y - vh / 2 + shakeY;
    this.drawWorld(ctx, game, vw, vh);
    this.drawPickups(ctx, game);
    this.drawCars(ctx, game);
    this.drawPeds(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawBullets(ctx, game);
    this.drawParticles(ctx, game);
    this.drawMissionMarker(ctx, game);
    ctx.restore();
    this.drawHud(ctx, game, vw, vh);
    if (game.screen === SCREEN_TITLE) this.drawTitle(ctx, game, vw, vh);
    if (game.screen === SCREEN_PAUSE) this.drawPause(ctx, vw, vh);
    if (game.screen === SCREEN_OVER) this.drawGameOver(ctx, game, vw, vh);
    if (game.screen === SCREEN_WIN) this.drawWin(ctx, game, vw, vh);
  }

  drawWorld(ctx, game, vw, vh) {
    const cam = this.camera;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, vw, vh);
    // Beach on the west edge and water beyond it.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(-cam.x, -cam.y, 150, WORLD.height);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(-cam.x - 400, -cam.y, 400, WORLD.height);
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const ax of game.world.avenues) {
      ctx.fillRect(ax - WORLD.road / 2 - cam.x, -cam.y, WORLD.road, WORLD.height);
    }
    for (const sy of game.world.streets) {
      ctx.fillRect(-cam.x, sy - WORLD.road / 2 - cam.y, WORLD.width, WORLD.road);
    }
    // Dashed centre lines.
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    ctx.beginPath();
    for (const ax of game.world.avenues) {
      ctx.moveTo(ax - cam.x, -cam.y);
      ctx.lineTo(ax - cam.x, WORLD.height - cam.y);
    }
    for (const sy of game.world.streets) {
      ctx.moveTo(-cam.x, sy - cam.y);
      ctx.lineTo(WORLD.width - cam.x, sy - cam.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Sidewalks around each block.
    ctx.fillStyle = COLORS.sidewalk;
    for (const b of game.world.buildings) {
      ctx.fillRect(b.x - WORLD.sidewalk - cam.x, b.y - WORLD.sidewalk - cam.y, b.w + WORLD.sidewalk * 2, b.h + WORLD.sidewalk * 2);
    }
    // Buildings with a roof line.
    for (const b of game.world.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      if (b.roof) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(b.x + 10 - cam.x, b.y + 10 - cam.y, b.w - 20, 14);
      }
    }
    // District labels.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      ctx.fillText(d.name, d.x + d.w / 2 - cam.x, d.y + d.h / 2 - cam.y);
    }
  }

  drawCars(ctx, game) {
    const cam = this.camera;
    for (const car of game.cars) {
      ctx.save();
      ctx.translate(car.x - cam.x, car.y - cam.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,30,50,0.85)';
      ctx.fillRect(-6, -CAR.width / 2 + 4, 16, CAR.width - 8);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 4, 3, 6);
      ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 10, 3, 6);
      if (car.kind === 'police') {
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(-10, -CAR.width / 2 - 3, 8, 5);
        ctx.fillStyle = '#2f6fd0';
        ctx.fillRect(2, -CAR.width / 2 - 3, 8, 5);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PD', 0, 4);
      }
      ctx.restore();
    }
  }

  drawPeds(ctx, game) {
    const cam = this.camera;
    for (const ped of game.peds) {
      ctx.save();
      ctx.translate(ped.x - cam.x, ped.y - cam.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d0a9';
      ctx.beginPath();
      ctx.arc(6, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (ped.panic > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', ped.x - cam.x, ped.y - cam.y - 16);
      }
    }
    // Police on foot.
    for (const cop of game.police) {
      if (!cop.onFoot) continue;
      ctx.save();
      ctx.translate(cop.x - cam.x, cop.y - cam.y);
      ctx.fillStyle = '#1c4fb0';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 4);
      ctx.restore();
    }
  }

  drawPlayer(ctx, game) {
    const cam = this.camera;
    const p = game.player;
    if (p.inCar) return; // the car itself shows the player
    ctx.save();
    ctx.translate(p.x - cam.x, p.y - cam.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -4, 12, 8); // facing direction / shoulders
    ctx.restore();
    // Pistol in hand when there is ammo.
    if (p.ammo > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔫', p.x - cam.x, p.y - cam.y - 20);
    }
  }

  drawBullets(ctx, game) {
    const cam = this.camera;
    ctx.fillStyle = '#ffe066';
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles(ctx, game) {
    const cam = this.camera;
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cam.x - 3, pt.y - cam.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  drawPickups(ctx, game) {
    const cam = this.camera;
    for (const pk of game.pickups) {
      const bob = Math.sin(pk.bob) * 4;
      ctx.save();
      ctx.translate(pk.x - cam.x, pk.y - cam.y + bob);
      ctx.fillStyle = pk.kind === 'stash' ? '#ff8c00' : '#37d67a';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
      ctx.restore();
    }
  }

  drawMissionMarker(ctx, game) {
    const target = game.missionTarget();
    if (!target || game.screen !== 'play') return;
    const cam = this.camera;
    const cx = target.x + (target.w ?? 0) / 2 - cam.x;
    const cy = target.y + (target.h ?? 0) / 2 - cam.y;
    const pulse = 26 + Math.sin(game.time * 4) * 6;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(cx, cy - pulse - 18);
    ctx.lineTo(cx - 8, cy - pulse - 4);
    ctx.lineTo(cx + 8, cy - pulse - 4);
    ctx.closePath();
    ctx.fill();
  }

  drawHud(ctx, game, vw, vh) {
    if (game.screen === SCREEN_TITLE) return;
    // Top-left: health bar + money.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 230, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${game.money}`, 26, 38);
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 48, 180, 12);
    ctx.fillStyle = game.player.health > 30 ? '#37d67a' : '#ff5252';
    ctx.fillRect(26, 48, 180 * Math.max(0, game.player.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`HP ${Math.max(0, Math.ceil(game.player.health))}   Ammo ${game.player.ammo}`, 26, 72);
    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(vw - 190, 14, 176, 44, 10);
    ctx.fill();
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < game.wanted ? '★' : '☆';
    ctx.fillStyle = game.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.4)';
    ctx.fillText(stars, vw - 102, 44);
    // Mission tracker, top centre.
    const m = game.currentMission();
    if (m) {
      const step = m.steps[game.missionStep] ?? m.steps[m.steps.length - 1];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const label = `${m.title}: ${step}`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.beginPath();
      ctx.roundRect(vw / 2 - tw / 2 - 14, 14, tw + 28, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.textAlign = 'center';
      ctx.fillText(label, vw / 2, 36);
      if (m.timer && game.missionStep > 0) {
        ctx.fillStyle = game.missionTimer < 20 ? '#ff5252' : '#fff';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`${Math.ceil(game.missionTimer)}s`, vw / 2, 66);
      }
    }
    // Message line.
    if (game.messageTimer > 0 && game.message) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '14px system-ui, sans-serif';
      const tw = ctx.measureText(game.message).width;
      ctx.beginPath();
      ctx.roundRect(vw / 2 - tw / 2 - 12, vh - 96, tw + 24, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(game.message, vw / 2, vh - 76);
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.player.inCar ? 'WASD drive · E exit car · F shoot · P pause' : 'WASD move · E steal car · Space punch · F shoot · P pause', 16, vh - 16);
    this.drawMinimap(ctx, game, vw, vh);
  }

  drawMinimap(ctx, game, vw, vh) {
    const size = 150;
    const x0 = vw - size - 14;
    const y0 = vh - size - 14;
    const scale = size / WORLD.width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#3a3f46';
    for (const ax of game.world.avenues) ctx.fillRect(x0 + ax * scale - 1, y0, 2, size);
    for (const sy of game.world.streets) ctx.fillRect(x0, y0 + sy * scale - 1, size, 2);
    const target = game.missionTarget();
    if (target) {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(x0 + (target.x + (target.w ?? 0) / 2) * scale, y0 + (target.y + (target.h ?? 0) / 2) * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.police) {
      ctx.fillStyle = '#4d9fff';
      ctx.fillRect(x0 + cop.car.x * scale - 2, y0 + cop.car.y * scale - 2, 4, 4);
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + game.player.x * scale, y0 + game.player.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x0, y0, size, size);
  }

  drawTitle(ctx, game, vw, vh) {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SUNSET STREETS', vw / 2, vh / 2 - 110);
    ctx.fillStyle = '#7fd4ff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in Solmar Bay', vw / 2, vh / 2 - 72);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Steal cars. Outrun the Solmar Bay PD. Run four missions for Lena Ortiz.', vw / 2, vh / 2 - 30);
    ctx.fillText('WASD move / drive · E enter or steal a car · Space punch · F shoot · P pause · M mute', vw / 2, vh / 2 + 2);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Press ENTER to start', vw / 2, vh / 2 + 56);
    if (game.bestMoney > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`Best haul so far: $${game.bestMoney}`, vw / 2, vh / 2 + 92);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('A completely original game. No real city, person or game is depicted.', vw / 2, vh - 24);
  }

  drawPause(ctx, vw, vh) {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('Paused', vw / 2, vh / 2 - 20);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('P resume · R restart mission · S save game', vw / 2, vh / 2 + 20);
  }

  drawGameOver(ctx, game, vw, vh) {
    ctx.fillStyle = 'rgba(20, 4, 8, 0.75)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('WASTED', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`You went down with $${game.money} in your pocket.`, vw / 2, vh / 2 + 4);
    ctx.fillText('Press ENTER to try again', vw / 2, vh / 2 + 44);
  }

  drawWin(ctx, game, vw, vh) {
    ctx.fillStyle = 'rgba(6, 20, 12, 0.78)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY IS YOURS', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`All four missions done. Final haul: $${game.money}. Cars stolen: ${game.stats.carsStolen}.`, vw / 2, vh / 2 + 4);
    ctx.fillText('Press ENTER to play again', vw / 2, vh / 2 + 44);
  }
}
