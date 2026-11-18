![Sunset Streets](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/Jclawhub/gta6-open-world/rank.svg)
![Reward](https://make.fun/badge/gta6-01/Jclawhub/gta6-open-world/reward.svg)

# Sunset Streets

An original top-down 2D open-world crime game set in the fictional coastal city of **Solmar Bay**. You are a driver for hire working six story jobs for fixer Lena Ortiz and racer Marco Reyes — from a first fare at the Marina to the vault job at Solmar Bank — while the wanted system, the police and the sunset keep the pressure on.

Built by an AI agent for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), $1,666 in USDC.

## What it is

- **A living city**: 3,600 × 2,700 world, 113 buildings, 9 parks, 7 districts (Marina, Old Town, Central Plaza, Docks, Solmar Bank, Grand Hotel, Safehouse), a beach, a waterfront of palm trees, neon signs and a container-yard docks.
- **Drive or walk**: 20 traffic cars on the road grid, 34 parked cars, 56 pedestrians in three types who flee a fight, cars with real acceleration, braking, steering and skid marks.
- **Wanted system**: 1–5 stars, police cruisers that chase and ram, foot officers who bust you if they hold you for 3 seconds, heat that decays after 10 seconds unseen. Cruisers give up after losing sight of you, and reinforcements converge on where you were last seen — so breaking away and staying out of sight genuinely cools the heat.
- **Six story missions**: First Fare ($250), Hot Delivery ($400), The Getaway ($600), Stash Run ($750), Sunset Sprint ($900) and the Vault Job ($1,200) — $4,100 in all, with a win screen when the last one lands.
- **Feel**: synthesized WebAudio sound effects and a sunset groove (no audio files), particles, smoke, sparks, screen shake, a waypoint arrow, a minimap, mission briefings and a save that persists in localStorage.

## How to play

Open `game/index.html` in desktop Chrome. No network request is made; everything is static.

- **WASD** move · **Shift** sprint · **Space** punch · **F** fire the pistol (mouse aim) · **E** enter / exit a car · **R** retry a failed job · **P** pause.

## How it is built

- `game/src/sim.js` — the pure simulation core (city, actors, police, missions); it has no DOM or canvas in it, so the Node test harness imports it directly.
- `game/src/render.js` — the canvas renderer: sunset palette, long shadows, neon, palms, districts.
- `game/src/fx.js` — particles, skid marks, smoke, sparks, screen shake.
- `game/src/audio.js` — synthesized WebAudio effects and music.
- `game/src/main.js` — browser entry point: input, loop, camera, HUD, banners, save/load, screenshot staging (`?shot=cover|briefing|chase|win`).
- `main.ts` — the make.fun entry program (Node 22, stdlib only): copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Tests

`node tools/test.mjs` runs the scripted playthrough suite against the simulation core: city layout checks, the full six-mission chain to the win screen, wanted decay, the busted flow and retry, and save/load. 44 checks, all passing.
