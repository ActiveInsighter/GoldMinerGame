# Art Pipeline

## Directory layout

```text
art-source/                         # optional source files, not loaded at runtime
├─ characters/
├─ items/
├─ backgrounds/
├─ ui/
└─ effects/

public/assets/                      # optimized runtime files
├─ menu/
├─ game/
│  ├─ miner/
│  ├─ items/
│  ├─ backgrounds/
│  └─ effects/
├─ ui/
└─ placeholders/
```

Keep PSD, Krita, Aseprite, Blender and other editable sources under `art-source/` or external design storage. Only optimized runtime files belong under `public/assets/`.

## Supported formats

- WebP: preferred for large single images and opaque/semi-transparent backgrounds.
- PNG: preferred for pixel-perfect transparent sprite sheets and as a compatibility source.
- Phaser Atlas: PNG/WebP texture plus JSON frame data for characters, items and effects.
- SVG: allowed for simple local placeholders and React UI illustrations; avoid complex SVG filters in the game world.

Do not load runtime art from remote URLs. Every production asset needs a committed local fallback.

## Naming

Use lowercase kebab-case:

```text
miner-idle-01.png
gold-small.webp
mine-far.webp
particle-rock-chip.png
button-primary-9slice.png
```

Texture keys are defined only in `src/game/config/assetKeys.ts`. File paths and metadata are recorded in `src/game/assets/assetManifest.ts` and root `art-manifest.json`.

## Replacing placeholders

1. Export the formal file to the path listed in `art-manifest.json`.
2. Update the matching descriptor in `src/game/assets/assetManifest.ts`:
   - set `path`;
   - set the correct `kind` (`image`, `spritesheet` or `atlas`);
   - set `placeholder: false`;
   - verify width, height, frame dimensions, origin and scale.
3. For React images, update `src/config/artAssets.ts` and retain the local fallback.
4. Open `?debug=assets` in development and check size, origin, animation and placeholder status.
5. Run `npm run check`, `npm test`, `npm run build` and `npm run test:visual`.

The simulation and gameplay code must not change when art is replaced.

## Atlas generation

Recommended workflow:

1. Draw frames on a fixed canvas with a stable character foot/pivot point.
2. Trim transparent bounds while preserving 2–4 pixels of transparent padding.
3. Pack with TexturePacker, Free Texture Packer, Aseprite CLI or another deterministic atlas tool.
4. Export Phaser-compatible JSON Hash or JSON Array data.
5. Keep frame names semantic, for example:

```text
miner/idle/0001
miner/fire/0001
miner/pull-heavy/0001
```

6. Avoid rotation during packing unless the chosen Phaser loader and art QA process explicitly support it.
7. Prefer power-of-two atlas dimensions only when device compatibility or memory profiling demonstrates a benefit; do not add large empty areas solely for that convention.

## Character animation

The miner must provide these states:

| State | Suggested frames | FPS | Loop |
|---|---:|---:|---|
| idle | 8 | 8 | yes |
| fire | 5 | 14 | no |
| pull-light | 8 | 10 | yes |
| pull-heavy | 8 | 7 | yes |
| dynamite | 6 | 12 | no |
| celebrate | 10 | 10 | yes |
| fail | 8 | 8 | no |

All frames should share the same logical foot/pivot position. Recommended origin is `[0.5, 0.92]`. Keep the winch and hands aligned with the rope origin across frames.

## Nine-slice UI

Buttons and panels should preserve HTML text. Export only the decorative surface and borders. Record left/right/top/bottom stretch margins in `art-manifest.json`.

Recommended starting margins:

- small button: 18–24 px;
- large wood/paper panel: 24–40 px;
- modal frame: 36–48 px.

Keep corners, nails, torn paper edges and wood joints outside the stretchable center.

## WebP compression

- Keep a lossless PNG master.
- Use lossless WebP for crisp UI edges and small transparent sprites when it produces a smaller file.
- Use quality 78–88 for large painted backgrounds, then inspect gradients and dark mine areas for banding.
- Do not repeatedly recompress an already lossy WebP.
- Compare file size and rendering in Chrome desktop and Android before committing.

## Transparent-edge QA

Inspect sprites over white, black and saturated magenta backgrounds. Check for:

- matte-colored fringes;
- semi-transparent dirty pixels;
- cropped shadows or particles;
- inconsistent padding between animation frames;
- texture bleeding at atlas borders.

Use premultiplied-alpha-safe export settings and add atlas extrusion/padding when adjacent frames bleed under scaling.

## Anchors and scale

- Items: center origin `[0.5, 0.5]` unless a hanging point is required.
- Miner: `[0.5, 0.92]`.
- Hook: top attachment point, approximately `[0.5, 0.14]`.
- Backgrounds: top-center `[0.5, 0]`.
- UI icons: optical center rather than mathematical center when necessary.

Set runtime scale in manifest/config, not by editing collision radii. Collision remains simulation-owned.

## Lighting and visual consistency

- Primary light: warm upper-left surface light.
- Underground fill: low-saturation warm brown.
- Gold highlights: pale yellow/cream, not pure white on every edge.
- Diamonds: cyan/teal highlights with restrained bloom.
- Keep item silhouettes readable at mobile scale.
- Small, medium and large gold must differ by silhouette as well as size.

## Mobile crops

Author backgrounds at 2560×1440 or larger and keep gameplay-critical detail within the central 1280×720 safe region. Decorative edges may crop on narrow screens; hook origin, surface line and playable mine field may not.
