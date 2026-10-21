# Lembah Padi

A cozy farming life sim for the browser. Original art, characters and music,
all generated in code at boot. Vite + TypeScript + Phaser 3, no backend.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

The view shows about 30 tiles across; the native resolution follows the window at a whole-number zoom.

Controls: WASD / arrows to walk, click / Space to use the held tool (and to hook and reel when fishing),
X / right-click to pick, talk, sit or read, 1-0 or the wheel to choose an item, E for the backpack,
Esc for settings, M to mute, hold T to fast-forward the clock and N to skip to the next day (debug).
Press any key on the start screen to begin (this also starts audio).

Music credits are in [CREDITS.md](CREDITS.md).

## Layout

| Folder | What lives there |
| --- | --- |
| `src/config.ts` | Every tunable (resolution, speeds, timings, audio levels, depths). |
| `src/art/` | `palette.ts` (the 32 colours), `pixel.ts` (toolkit), and generators for terrain, props, characters, fx/UI, font. |
| `src/audio/` | `AudioManager` (the only audio API), generative sequencer, instruments, ambience, SFX. |
| `src/data/` | Maps, terrain kinds, props, characters, music tracks, ambience curves, day/night grading. |
| `src/systems/` | Game state, time, map parsing/collision, map rendering, atmosphere. |
| `src/entities/` | Player, villagers (`Npc`). |
| `src/scenes/` | Boot (art generation), World, UI overlay. |
| `src/ui/` | Bitmap text, 9-slice panels, clock, hotbar, backpack, shop, dialog box, settings. |

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
* Ambience layers (birds, crickets, wind, water, waves, gulls, rain) follow curves in `data/ambience.ts`, scaled
  per map. Rain is switched on by the weather.
* Every generative track has summer, fall, winter and rain takes (same harmony, new melody seed, other
  voices and tempo), built in `data/music.ts`; `musicFor()` picks one for the season and weather. Water and surf volume follow the player's distance to water.
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

## Daily life (Phase 4)

* **Needs** (`systems/needs.ts`, tuning in `NEEDS` in `config.ts`): energy, hunger, thirst and alertness,
  shown as bars under the clock. Tools cost energy and make you thirsty; time drains hunger, thirst and
  alertness. Empty needs drain energy and slow walking.
* **Restore:** eat or drink food from the hotbar (click / Space), drink at a well or the kitchen counter,
  sit on a bench (X) to rest, sleep in bed.
* **Day end** (`systems/day.ts`): bed or collapsing at 2:00 am ends the day: shipping box sale, crop growth,
  calendar and seasons (out-of-season crops wither), then you wake beside the bed and the game saves.
* **Shops** (`data/shops.ts`): Toko Tani (seeds for the season), Warung Bu Sari (meals and drinks),
  Kios Buah (fruit). Click to buy (Shift: 5), click your items to sell at half price. Opening hours apply.
* **Shipping box** by the farmhouse pays full price overnight.
* **Save** (`systems/save.ts`): localStorage, written each morning. On the title screen Delete starts over.

## Village life (Phase 5)

* **Villagers** (`data/npcs.ts`, `entities/Npc.ts`, `systems/NpcSystem.ts`): eleven people with daily
  schedules across village, town and beach (they walk between stops, sit on benches, dance, fish).
  Talk with X: an introduction, then lines that change with friendship and rain. Holding an item adds
  a "Give" choice (one gift a day; loved, liked, neutral and disliked gifts). Hearts show next to the name.
  Bu Sari, Ujang and Koh Budi also open their shops. Jotaro has a Stand. Pak Darto gives you a fishing rod.
* **Fishing** (`systems/Fishing.ts`, fish in `data/fish.ts`): face water with the rod and press Space.
  Wait for the "!", press quickly, then press while the red marker is in the green zone. Three hits land
  the fish, three misses lose it. Pond and sea have their own fish, by season and hour.
* **Foraging** (`data/forage.ts`, `systems/forage.ts`, `systems/Gathering.ts`): shells, sea stars and the
  odd pearl on the beach, mushrooms and fern shoots in the grass, new every morning. Fruit trees (banana,
  coconut palm, rose apple) are picked with X and bear again three days later.
* **Weather** (`systems/Weather.ts`, `WEATHER` in `config.ts`): rainy days water every field, grey the sky,
  bring rain sounds and change the music. The notice board in town tells tomorrow's weather.
* **Letters** (`data/mail.ts`): the farm mailbox gets letters overnight (welcome, invitations, presents
  from friends). A "!" shows over it when something is waiting.
* **Settings** (`ui/SettingsMenu.ts`): Esc. Music, ambience and effect volumes, mute, save now, start a new
  farm, and the controls.
