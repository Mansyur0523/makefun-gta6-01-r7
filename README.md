# Sunset Streets: Marisol Bay

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Mansyur0523/makefun-gta6-01-r7/rank.svg)](https://make.fun/c/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Mansyur0523/makefun-gta6-01-r7/reward.svg)](https://make.fun/c/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built from scratch in
three.js. Play it offline in a desktop browser: serve `game/` with any static
server (`node serve.ts`, then open http://localhost:8080).

## The game

Jax Marlowe came home to Marisol Bay — a sun-soaked coastal city at golden hour —
with nothing but a busted scooter and a debt. Nadia Reyes has work for him: nine
story missions across the city, from stealing his first wheels to taking the
crown from rival kingpin Kane Voss.

## Features

- **Open world**: a grid city with roads, sidewalks, lit buildings, a beach, a
  pier and the sea, all under a low sunset sun.
- **Traffic & pedestrians**: AI cars follow the road grid; walkers stroll the
  sidewalks and flee from gunfire.
- **Carjacking & driving**: steal parked or moving cars (E), arcade driving with
  six car types, engine and brake garage upgrades.
- **5-star wanted system**: Marisol PD pursuit cars and a helicopter at 3+
  stars, heat that cools when you escape, busts when cornered.
- **Combat**: four weapons (pistol, shotgun, SMG, rifle) with tracers, enemy
  return fire, body armor and health.
- **9 story missions**: deliveries, shakedowns, a vault job, a harbor hit and a
  final 5-star showdown, with on-screen objectives and a beacon marker.
- **Radio**: three original generative WebAudio stations (synthwave, funk, lo-fi).
- **Shops & safehouse**: Ammu-Nation Marisol sells weapons, ammo, armor and
  upgrades; the safehouse heals and saves.
- **HUD & minimap**: wanted stars, cash, clock, health/armor, speed, weapon,
  objective tracker and a live circular minimap.
- **Save/load**: progress autosaves after every mission (localStorage).

## Controls

WASD move / drive, mouse look & aim (click to shoot), E enter/exit car,
F interact, 1–4 weapons, R radio, Shift sprint, Space handbrake, P pause,
M mute.

## Tech

Static files only, no build step, no network requests. three.js r128 vendored
under `game/vendor/`. All music and sound effects are synthesized with WebAudio.
