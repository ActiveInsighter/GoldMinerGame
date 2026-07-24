# Gold Miner Architecture

## Runtime ownership

```text
React pages and dialogs
        │ low-frequency commands / HUD snapshots
        ▼
GoldMinerEngine public API
        │
        ▼
Phaser BootScene → PreloadScene → GameScene
        │                         │
        │                         ├─ BackgroundLayers
        │                         ├─ Miner
        │                         ├─ Rope + Hook
        │                         ├─ MineItemView instances
        │                         └─ EffectsSystem
        │
        ▼
GameSimulation (single source of truth)
        │
        └─ model.ts pure rules and configuration
```

`GameSimulation` owns all per-frame state: hook angle and length, mine-item positions, collision, score, combo, countdown, dynamite, random events and level completion. It does not import Phaser, React, DOM, Canvas or storage.

`GameScene` creates display objects once and synchronizes them from simulation snapshots. It must not create a new sprite or graphics object every frame. New mine objects are created only when a simulation event adds an item; collected and destroyed objects are removed through explicit events.

## React responsibilities

React remains responsible for:

- menu, result and failure pages;
- shop, achievements, help and settings;
- cloud-save controls and local-save workflows;
- accessible text and announcements;
- responsive HTML layout;
- low-frequency HUD rendering.

React must not store hook length, angle or mine-item positions. It communicates through the `GoldMinerEngine` controller and receives throttled `HudSnapshot` values.

React supplies only a `.mine-phaser-host` container. Phaser creates, sizes and destroys the visible canvas inside that container. This is required for `Phaser.AUTO` to perform normal WebGL capability detection; passing a pre-created canvas would make Phaser treat the page as a custom environment and require an explicit renderer type.

## Phaser responsibilities

Phaser owns the visible mine world:

- background layers and parallax metadata;
- the single authoritative `Miner` object;
- rope, hook and mine-item images;
- particles, tweens, floating scores and camera feedback;
- pointer, keyboard and touch input for the play field.

The renderer uses `Phaser.AUTO`, preferring WebGL and falling back to Canvas. The removed legacy architecture rendered a hidden 2D canvas and uploaded it as a `CanvasTexture`; no such bridge remains.

## Resource loading

Runtime code references only centralized keys from `src/game/config/assetKeys.ts`. `src/game/assets/assetManifest.ts` records dimensions, origins and fallback information. `AssetSystem` queues formal files when paths are configured and always finalizes local generated placeholders.

The loading contract is:

```text
formal file exists and loads → use formal texture
formal file missing/fails     → generate local placeholder under the configured fallback key
```

A missing formal asset must never make the game black-screen or fail production build.

## Scene lifecycle

1. `BootScene` initializes the renderer and starts preload.
2. `PreloadScene` queues manifest assets and creates fallback textures once.
3. `GameScene` creates simulation and display objects.
4. `GoldMinerEngine.start()` enables simulation updates.
5. Scene shutdown removes keyboard, pointer and visibility listeners, destroys particle emitters and clears object references.
6. React cleanup calls `GoldMinerEngine.stop()`, which destroys the Phaser game instance and its generated canvas exactly once.

## Preserved systems

The refactor intentionally leaves these modules and contracts intact:

- `model.ts`: levels, item values and weights, mine generation, scoring, combo, shop and achievements;
- `audio.ts`: audio initialization and sound names;
- `storage.ts`: local persistence and save migration;
- Worker and D1 code: cloud-save API, migrations and deployment;
- React run/session/result handling: campaign, daily and endless progression.

## Testing boundaries

- Pure simulation tests instantiate `GameSimulation` without a browser renderer.
- Manifest tests ensure every business item maps to a texture and every texture key has a fallback.
- Playwright visual tests validate menu, live game, pause, shop and asset previews at desktop and mobile viewports.
- Worker/D1 tests remain independent of Phaser.
