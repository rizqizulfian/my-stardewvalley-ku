# Lembah Padi

A cozy farming life sim for the browser. Original art, characters and music,
all generated in code at boot. Vite + TypeScript + Phaser 3, no backend.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

The view shows about 30 tiles across; the native resolution follows the window at a whole-number zoom.

Controls: WASD / arrows to walk, click / Space to use the held tool, X / right-click to pick or talk,
1-0 or the wheel to choose an item, E for the backpack, M to mute, hold T to fast-forward the clock and
N to skip to the next day (debug). Press any key on the start screen to begin (this also starts audio).

Music credits are in [CREDITS.md](CREDITS.md).

## Layout

| Folder | What lives there |
| --- | --- |
| `src/config.ts` | Every tunable (resolution, speeds, timings, audio levels, depths). |
| `src/art/` | `palette.ts` (the 32 colours), `pixel.ts` (toolkit), and generators for terrain, props, characters, fx/UI, font. |
| `src/audio/` | `AudioManager` (the only audio API), generative sequencer, instruments, ambience, SFX. |
| `src/data/` | Maps, terrain kinds, props, characters, music tracks, ambience curves, day/night grading. |
| `src/systems/` | Game state, time, map parsing/collision, map rendering, atmosphere. |
| `src/entities/` | Player. |
| `src/scenes/` | Boot (art generation), World, UI overlay. |
| `src/ui/` | Bitmap text, 9-slice panels, clock panel. |

## Art pipeline

* `palette.ts` holds the only colours. Grids store palette indices, so nothing off-palette can be drawn.
  The day/night grade (multiply + additive sky light) and light halos are post effects on top.
* `pixel.ts`: `PixelGrid` (parse string grids with a legend, draw, stamp, flip, sway-shear, recolour),
  `shade()` (3–5 tone ramp shading lit from the top-left), `outline()` (outline in a darker hue-shifted
  shade of the neighbouring fill), `innerShadow()`, ordered dithering, seeded noise.
* A `TextureSink` receives finished grids. `PhaserTextureSink` registers canvas textures; to move to a PNG
  atlas, load the atlas with the same keys and frame indices instead of calling `registerAllArt`.
* Paths, water, deep water and grass patches use dual-grid (corner) autotiling: 16 tiles per terrain with
  seamless, noise-wobbled edges. Water has 4 animation frames and full-tile variants.

## Audio

* `AudioManager.playMusic(id)` crossfades (2.5 s) to a track from `data/music.ts`. Tracks are generative
  (chord progression, motif-based melody, pad, keys, sub bass, soft drums, vinyl crackle) or `kind: 'file'`.
* Ambience layers (birds, crickets, wind, water, waves, gulls) follow curves in `data/ambience.ts`, scaled
  per map. Water and surf volume follow the player's distance to water.
* File tracks are decoded once and resume where they stopped when the player comes back to that map.
* SFX are synthesised with random pitch variation; footsteps change with the surface underfoot.
* Volumes and mute persist in localStorage.

## Maps

Maps are ASCII rows in `src/data/maps/*.ts`: a terrain layer and a prop layer of the same size.
Legends live in `data/terrain.ts` and `data/props.ts`. A prop character marks the bottom-left cell of its
footprint; `#` in the prop layer marks cells covered by a bigger prop.

Maps: Farm, Rumah (house interior), Kampung Padi (village), Pasar Lembah (town), Pantai Senja (beach).
`warps` in a map def are exit rectangles: walking into one fades out and restarts the World scene on the
target map at `tx, ty`. Rooms smaller than the view are centred.
