# Asset TODO

The game currently runs entirely with committed local placeholders. Replace assets in priority order without changing simulation code.

## P0 — required for a formal visual release

| Asset | Formal path | Recommended resolution / frames | Transparency | Current placeholder | Replacement |
|---|---|---|---|---|---|
| Menu miner promotional illustration | `public/assets/menu/miner-portrait.webp` and `.png` | 960×1080, 1 frame | yes | `public/assets/placeholders/menu/miner-portrait-placeholder.svg` | Update `src/config/artAssets.ts`, set `placeholder: false` |
| Game miner atlas | `public/assets/game/miner/miner.png` + `miner.json` | 256×256 per frame; idle 8, fire 5, pull-light 8, pull-heavy 8, dynamite 6, celebrate 10, fail 8 | yes | two generated transparent frames for each state, registered as Phaser animations | Configure the atlas descriptor and matching frame prefixes; retain animation keys and `[0.5,0.92]` origin |
| Small gold | `public/assets/game/items/gold-small.webp` | 64×64, 1 frame | yes | generated `gold-small` | Add manifest path; retain key |
| Medium gold | `public/assets/game/items/gold-medium.webp` | 96×96, 1 frame | yes | generated `gold-medium` | Add manifest path; retain key |
| Large gold | `public/assets/game/items/gold-large.webp` | 144×128, 1 frame | yes | generated `gold-large` | Add manifest path; retain key |
| Rock | `public/assets/game/items/rock.webp` | 96×96, 1 frame | yes | generated `rock` | Add manifest path; retain key |
| Diamond | `public/assets/game/items/diamond.png` + atlas data | 72×80, 6 frames at 8 FPS | yes | generated `diamond` | Add atlas/spritesheet path and shimmer animation |
| Mystery chest | `public/assets/game/items/chest.png` + atlas data | 112×96, 4 frames | yes | generated `chest` | Add open animation without changing reward logic |
| TNT | `public/assets/game/items/tnt.png` + atlas data | 88×104, 6 fuse frames | yes | generated `tnt` | Add fuse animation; explosion remains EffectsSystem-owned |
| Mole | `public/assets/game/items/mole.png` + atlas data | 112×80, 8 frames at 10 FPS | yes | generated `mole` | Add walk animation; direction still uses flipX |
| Diamond mole | `public/assets/game/items/diamond-mole.png` + atlas data | 120×96, 8 frames at 10 FPS | yes | generated `diamond-mole` | Add walk/glint animation |
| Sky layer | `public/assets/game/backgrounds/sky.webp` | 2560×360 | no | generated `background-sky` | Configure image path and preserve top-center origin |
| Surface layer | `public/assets/game/backgrounds/surface.webp` | 2560×320 | yes | generated `background-surface` | Keep ground line aligned near world Y=142 |
| Far mine layer | `public/assets/game/backgrounds/mine-far.webp` | 2560×1156 | no | generated `background-mine-far` | Preserve central playable safe region |
| Mid mine layer | `public/assets/game/backgrounds/mine-mid.webp` | 2560×1156 | yes | generated `background-mine-mid` | Avoid high-frequency detail behind items |
| Timber supports | `public/assets/game/backgrounds/mine-supports.webp` | 2560×1156 | yes | generated `background-mine-supports` | Keep supports decorative; do not imply collision |
| Front mine layer | `public/assets/game/backgrounds/mine-front.webp` | 2560×1156 | yes | generated `background-mine-front` | Keep alpha low so items remain visible |

## P1 — polish after the core art set

| Asset | Formal path | Recommended resolution / frames | Transparency | Current placeholder | Replacement |
|---|---|---|---|---|---|
| Primary/secondary buttons | `public/assets/ui/buttons.png` + atlas JSON | 3–4 states per button, source around 320×112 | yes | CSS gradients and texture variables | Export decorative surfaces only; retain HTML text |
| Paper panel | `public/assets/ui/panel-paper.png` | 256×256 nine-slice | yes | CSS panel | Configure 24–40 px nine-slice margins |
| Wood panel | `public/assets/ui/panel-wood.png` | 256×256 nine-slice | yes | CSS panel | Configure 24–40 px nine-slice margins |
| Common icons | `public/assets/ui/icons.png` + atlas JSON | 48×48 or 64×64 | yes | `GameIcon` text placeholders | Map names in `GameIcon`; preserve accessible labels |
| Particle atlas | `public/assets/game/effects/particles.png` + JSON | 32×32 frames: dust, spark, smoke, rock-chip, gold-chip, star | yes | six generated particle textures | Update manifest; emitters need no rule changes |
| Explosion animation | `public/assets/game/effects/explosion.png` + JSON | 12–16 frames, 16–20 FPS | yes | spark/smoke/rock particle combination | Trigger from existing `explosion` effect event |
| Rock fracture animation | `public/assets/game/effects/rock-break.png` + JSON | 8–12 frames | yes | rock-chip emitter | Trigger from `rock-break` effect event |
| Gold collection burst | `public/assets/game/effects/gold-collect.png` + JSON | 8–12 frames | yes | gold-chip emitter | Trigger from `gold` effect event |
| Success/failure overlays | `public/assets/game/effects/result.png` + JSON | optional 8–12 frames each | yes | star/smoke emitters and Miner state | Keep result text in HTML |

## Acceptance checklist for every replacement

- [ ] Key remains centralized in `assetKeys.ts`.
- [ ] Runtime path and metadata are updated in `assetManifest.ts` and `art-manifest.json`.
- [ ] Placeholder remains available as fallback.
- [ ] `?debug=assets` shows correct size, origin, scale and animation.
- [ ] No browser request returns 404.
- [ ] Transparent edges pass light/dark background inspection.
- [ ] Desktop and 390×844 mobile visual tests remain readable.
- [ ] `npm run check`, `npm test`, `npm run build`, and `npm run test:visual` pass.
