# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jclawhub/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jclawhub/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sunset Streets — an original top-down open-world crime game set in the fictional coastal city of Solmar Bay. Steal cars, outrun the Solmar Bay PD under a five-star wanted system, fight on foot, and run four story missions for fixer Lena Ortiz. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## Run it

```sh
npx --yes serve game
```

Then open the printed URL in a desktop browser — or serve `game/` with any static file server and open `index.html`. No build step, no network requests — everything is static files under `game/`.

## Controls

- **WASD / arrows** — move on foot, drive in a car
- **E** — enter / exit a car, steal parked and driven cars
- **Space** — punch (on foot)
- **F** — shoot the pistol
- **Shift** — sprint
- **P** — pause · **R** — restart mission · **S** — save game · **M** — mute

## What is in the game

- A grid city with a beach, marina, central plaza, docks and Old Town, with traffic cars and pedestrians that wander, panic and flee
- Car stealing and driving, with a five-star wanted level and police cars that chase and ram, plus police on foot who try to bust you
- Four story missions (taxi fare, timed delivery, police getaway, stash run) plus cash pickups to collect
- HUD with health, money, ammo, wanted stars, a minimap and a mission tracker; title, pause, game-over and win screens; save/load via localStorage
- Synthesized WebAudio sound effects and a music loop — no audio files

## Screenshots

The `screenshots/` folder holds real renders of the game itself: the title over the living city, a police chase with three wanted stars, and the first mission in progress.

---

<sub>Entered on [make.fun](https://make.fun/?ref=km9b10em&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
