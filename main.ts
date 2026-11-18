// Sunset Streets — the make.fun gta6-01 entry program (Node 22, stdlib only).
//
// It hands the game in: copies game/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library (vendor/makefun-game.ts, unchanged).
// The program runs twice in the grader and both runs must write the same
// bytes, so nothing here depends on the clock, the network or the filesystem
// outside this repository. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Everything the entry hands in must exist, and every screenshot must fit
// the gate's 256 KiB cap before the dossier is built.
function requireDir(name) {
  const p = join(here, name);
  if (!existsSync(p) || !statSync(p).isDirectory()) {
    throw new Error(`main.ts: expected a ${name}/ directory beside main.ts`);
  }
  return p;
}

function checkScreenshots(dir) {
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  if (files.length < 1) {
    throw new Error('main.ts: expected at least 1 screenshot in screenshots/');
  }
  if (files.length > 4) {
    throw new Error(`main.ts: ${files.length} screenshots, but the gate allows at most 4`);
  }
  for (const f of files) {
    if (statSync(join(dir, f)).size > 262144) {
      throw new Error(`main.ts: screenshot ${f} is over the 256 KiB cap`);
    }
  }
}

const gameDir = requireDir('game');
const shotsDir = requireDir('screenshots');
checkScreenshots(shotsDir);

// The grader refuses any name under /output that starts with a dot, so the
// copy skips dotfiles at every depth (no .gitkeep, no .DS_Store).
const keepVisible = (path) => !basename(path).startsWith('.');

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true, filter: keepVisible });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true, filter: keepVisible });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse anyway
// (more than 4 screenshots or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in all, or a game path over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Sunset Streets handed in: game/ + screenshots/ copied to ${out}, dossier.json written.`);
