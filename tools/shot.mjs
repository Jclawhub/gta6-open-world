// Sunset Streets — screenshot driver (CDP edition). Serves game/ over HTTP,
// renders the four staged scenes in headless Chrome at 1280x720 via the
// DevTools protocol, and converts each PNG to a JPEG under the 256 KiB cap.
//
// The plain `chrome --screenshot` flag does not write a file with this
// Chrome-for-Testing build, so this driver talks CDP directly with a
// dependency-free WebSocket client (Node stdlib only). Run: node tools/shot.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const CHROME = '/home/hatch/chrome/chrome-linux64/chrome';
const DEBUG_PORT = 9333;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const path = join(gameDir, url === '/' ? 'index.html' : url);
  if (!path.startsWith(gameDir) || !existsSync(path)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});

// ---- Minimal WebSocket client (RFC 6455, text frames) -------------------
function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = randomBytes(16).toString('base64');
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: {
        Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13',
      },
    });
    req.on('upgrade', (res, socket) => {
      const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      if (res.headers['sec-websocket-accept'] !== accept) {
        reject(new Error('bad Sec-WebSocket-Accept'));
        return;
      }
      const handlers = new Map();
      let nextId = 1;
      let buf = Buffer.alloc(0);
      let frags = [];
      const events = [];
      let eventWaiter = null;
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        for (;;) {
          if (buf.length < 2) break;
          const fin = (buf[0] & 0x80) !== 0;
          const op = buf[0] & 0x0f;
          let len = buf[1] & 0x7f;
          let off = 2;
          if (len === 126) {
            if (buf.length < 4) break;
            len = buf.readUInt16BE(2);
            off = 4;
          } else if (len === 127) {
            if (buf.length < 10) break;
            len = Number(buf.readBigUInt64BE(2));
            off = 10;
          }
          if (buf.length < off + len) break;
          const payload = buf.subarray(off, off + len);
          buf = buf.subarray(off + len);
          if (op === 9) { // ping -> pong
            sendRaw(0x8a, payload);
            continue;
          }
          if (op === 8) { socket.end(); continue; }
          frags.push(payload);
          if (fin) {
            const msg = Buffer.concat(frags).toString('utf8');
            frags = [];
            let json;
            try { json = JSON.parse(msg); } catch (e) { continue; }
            if (json.id && handlers.has(json.id)) {
              const { resolve: r, reject: j } = handlers.get(json.id);
              handlers.delete(json.id);
              if (json.error) j(new Error(JSON.stringify(json.error)));
              else r(json.result);
            } else if (json.method) {
              events.push(json.method);
              if (eventWaiter) { const w = eventWaiter; eventWaiter = null; w(json.method); }
            }
          }
        }
      });
      socket.on('error', reject);
      function sendRaw(firstByte, payload) {
        const mask = randomBytes(4);
        const len = payload.length;
        let header;
        if (len < 126) header = Buffer.from([firstByte, 0x80 | len]);
        else if (len < 65536) { header = Buffer.alloc(4); header[0] = firstByte; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
        else { header = Buffer.alloc(10); header[0] = firstByte; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
        const masked = Buffer.alloc(len);
        for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
        socket.write(Buffer.concat([header, mask, masked]));
      }
      function send(method, params) {
        const id = nextId++;
        return new Promise((resolve, reject) => {
          handlers.set(id, { resolve, reject });
          sendRaw(0x81, Buffer.from(JSON.stringify({ id, method, params: params || {} })));
        });
      }
      function waitEvent(name, timeoutMs) {
        if (events.includes(name)) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(`timeout waiting for ${name}`)), timeoutMs);
          const prev = eventWaiter;
          eventWaiter = (m) => {
            if (m === name) { clearTimeout(t); resolve(); }
            else if (prev) prev(m);
          };
        });
      }
      resolve({ send, waitEvent, close: () => socket.end() });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpJson(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: DEBUG_PORT, path, method }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`bad JSON from ${path}: ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOTS = [
  { kind: 'cover', file: '1-cover.jpg' },
  { kind: 'briefing', file: '2-briefing.jpg' },
  { kind: 'chase', file: '3-chase.jpg' },
  { kind: 'win', file: '4-win.jpg' },
];

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome-shot-profile',
    '--window-size=1280,720', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    // Wait for the DevTools endpoint.
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try { await httpJson('GET', '/json/version'); up = true; }
      catch (e) { await sleep(200); }
    }
    if (!up) throw new Error('chrome DevTools endpoint never came up');

    mkdirSync(shotsDir, { recursive: true });
    for (const shot of SHOTS) {
      const target = await httpJson('PUT', `/json/new?about:blank`);
      const ws = await wsConnect(target.webSocketDebuggerUrl);
      await ws.send('Page.enable');
      await ws.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      const url = `http://127.0.0.1:${port}/index.html?shot=${shot.kind}`;
      const nav = ws.send('Page.navigate', { url });
      await Promise.race([ws.waitEvent('Page.loadEventFired', 20000), nav]);
      // Let the staged scene run for a few frames before capturing.
      await sleep(3500);
      const { data } = await ws.send('Page.captureScreenshot', { format: 'png' });
      const png = join('/tmp', `sunset-${shot.kind}.png`);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(png, Buffer.from(data, 'base64'));
      ws.close();
      // /json/close answers "Target is closing" as plain text, not JSON.
      await new Promise((resolve) => {
        const req = http.request({ host: '127.0.0.1', port: DEBUG_PORT, path: `/json/close/${target.id}`, method: 'GET' }, (res) => { res.resume(); res.on('end', resolve); });
        req.on('error', resolve);
        req.end();
      });
      // Convert to JPEG and shrink until under 256 KiB.
      let quality = 82;
      const out = join(shotsDir, shot.file);
      for (;;) {
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', String(quality), out]);
        const size = statSync(out).size;
        if (size <= 262144 || quality <= 40) {
          console.log(`${shot.file}: ${size} bytes (quality ${quality})`);
          break;
        }
        quality -= 10;
      }
    }
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
