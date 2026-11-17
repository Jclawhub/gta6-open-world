# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jclawhub/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jclawhub/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sunset Streets — an original top-down open-world crime game set in the fictional coastal city of Solmar Bay. Steal cars, outrun the Solmar Bay PD under a five-star wanted system, fight on foot, and run six story missions for fixer Lena Ortiz and Marco Reyes. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## Run it

```sh
npx --yes serve game
```

Then open the printed URL in a desktop browser — or serve `game/` with any static file server and open `index.html`. No build step, no network requests — everything is static files under `game/`.

## Controls

- **WASD / arrows** — move on foot, drive in a car
- **E** — enter / exit a car, steal parked and driven cars
- **Space** — punch (on foot)
- **F** — shoot the pistol (aim with the mouse on foot)
- **H** — honk the horn
- **Shift** — sprint
- **P** — pause · **R** — restart mission · **S** — save game · **M** — mute

## What is in the game

- A grid city with a beach, marina, central plaza, docks and Old Town — plus a plaza fountain, the Sunset Pier and rooftop billboards — with traffic cars and pedestrians that wander, jog, linger as tourists, panic and flee
- Car stealing and driving, with a five-star wanted level and police cars that chase and ram with a cooldown between rams, plus police on foot who try to bust you (sprint away to buy time)
- Six story missions (taxi fare, timed delivery, police getaway, stash run, checkpoint sprint race, bank vault job) plus cash pickups to collect
- Crash sparks and smoke, skid marks when braking hard, a waypoint arrow to off-screen objectives, and a mission-complete banner when a job pays out
- HUD with health, money, ammo, wanted stars, a minimap and a mission tracker; title, pause, game-over and win screens; save/load via localStorage; the tab auto-pauses when hidden
- Synthesized WebAudio sound effects and a music loop — no audio files

## Screenshots

The `screenshots/` folder holds four real renders of the game itself:

1. `1-city.jpg` — the cover: a Vault Job getaway in progress, two wanted stars, a police chase, the mission tracker, the minimap and the HUD in one frame.
2. `2-chase.jpg` — a high-speed police chase through downtown Solmar Bay.
3. `3-mission.jpg` — Marco Reyes' first fare, picking up a client at Marina.
4. `4-sprint.jpg` — the Sunset Sprint: racing the 75-second clock to the first checkpoint.

---

<sub>Entered on [make.fun](https://make.fun/?ref=km9b10em&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
