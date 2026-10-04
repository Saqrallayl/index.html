# Your plan, walkable

A realistic 3D build of the upper-floor plan, as a first-person browser
walkthrough. Three.js only — no build step, no external assets, no network
calls: geometry, textures and the floor plan are all generated from data in
this repo.

**Open `index.html`** (serve the folder, e.g. `python3 -m http.server 8000`;
ES modules need http, not `file://`).

## Controls

| | |
|---|---|
| Move / look | **W A S D** or arrows, mouse (click once to lock the pointer) |
| Run | **Shift** |
| Fly | **F**, then **E / Q** for up / down |
| Eye height | scroll wheel |
| Evening lights | **N** |
| Floor plan overlay | **P** |
| Furnished ⇄ empty shell | **G** or the bottom-left button |
| Roof on / off | bottom-left button |
| Minimap · help bar | **M** · **H** |
| Back to the top of the stairs | **R** |

## What is modelled

34.0 × 40.5 ft envelope, 1,319 sq ft of upper floor (brief: 1,393.4 gross),
plus a 13'-10" × 6'-11" covered patio and a 20'-0" × 14'-3" covered balcony.

Open kitchen (19' × 9'-9" run, island with sink/DW and four stools, pantry bank,
patio door) → central dining → living room (20' × 16'-4", 10 ft ceiling, linear
fireplace, slider to the balcony). Master suite with bay window, ensuite
(double vanity, freestanding tub, walk-in shower with niche), enclosed WC and
the walk-in closet. Bedroom 2, laundry with side-by-side W/D, powder room,
linen closet. The stair drops from the central hall into the open foyer below,
between glass guards.

## Layout as data

| file | role |
|---|---|
| `tools/plan.py` | rooms, walls, doors, windows, stair — the source of truth |
| `tools/furniture.py` | the furniture / fixture schedule |
| `tools/gen_assets.py` | bakes both into `src/plandata.js` + `assets/plan.png` |
| `src/builder.js` | extrudes plan data (walls, slabs, openings, stair, railings) |
| `src/furniture.js` | parametric builders (orientation-aware local u/v space) |
| `src/materials.js` | procedural canvas textures (oak, tile, marble, quartz, fabric) |
| `src/player.js` | first-person controller: collisions, stairs, ledges, touch |
| `src/main.js` | scene, lighting, HUD, minimap, view modes, adaptive resolution |

## Checks

```bash
python3 tools/gen_assets.py                                   # plan -> data
node --experimental-default-type=module tools/harness.mjs     # geometry + navigation
node --experimental-default-type=module tools/ui-smoke.mjs    # entry point + input
node --experimental-default-type=module tools/api-check.mjs   # three.js API surface
python3 tools/preview.py                                      # offline stills
python3 tools/sheet.py                                        # contact sheet
```

`plan.py` verifies the slab has no overlaps and no gaps (area sum 1,319.2 vs
union 1,319.5 sq ft). `harness.mjs` builds the whole scene headless and reports:

- 361 meshes / ~25k triangles, 141 architecture + 45 furniture colliders
- furniture AABB placement: 0 pieces outside their footprint, 0 over the void
- flood-fill navigation: **96% of the floor reachable on foot** from the stairs
- every quick-jump lands on a floor; the stair descends 10 ft under load

`ui-smoke.mjs` runs `main.js` against a DOM shim + stubbed renderer and drives
real input (walk, look, fly, wheel, buttons, touch, stair descent) — it caught
the minimap context bug, the over-damped walk speed and the stair blocker.

`tools/preview/` holds the offline renders (flat-shaded, painter's algorithm);
`assets/walkthrough-stills.jpg` is the contact sheet.
