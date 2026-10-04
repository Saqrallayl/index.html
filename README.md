# Your plan, walkable

A realistic 3D build of the upper-floor plan in the brief, as a first-person
browser walkthrough (Three.js, no build step, no external assets).

- `index.html` — the walkthrough (open this)
- `site.html` — the original "Elsewhere" travel page, kept for reference
- `assets/plan.png` — the top-down floor plan render
- `tools/plan.py` — the layout source of truth (rooms, walls, doors, windows)
- `tools/furniture.py` — the furniture / fixture schedule
- `tools/gen_assets.py` — bakes both into `src/plandata.js`
- `tools/harness.mjs` — headless build + walkability validation (Node)
- `tools/preview.py` — offline preview renders (`tools/preview/*.jpg`)

## Layout

34.0 x 40.5 ft envelope, 1,319 sq ft of upper floor plus a 13'-10" x 6'-11"
covered patio and a 20'-0" x 14'-3" covered balcony. Two bedrooms, 2.5 baths,
open living / dining / kitchen, laundry, walk-in closet, and a stairwell that
opens to the foyer below.

## Rebuild the geometry

```bash
python3 tools/gen_assets.py                 # plan.json -> src/plandata.js
node --experimental-default-type=module tools/harness.mjs   # validate + dump
python3 tools/preview.py                    # offline previews
```

The harness checks the plan has no overlaps or gaps, measures how much of the
floor is actually reachable on foot, and reports triangle counts. Current
state: full overlap-free slab coverage, 98% of the floor reachable.

## Controls

WASD / arrows to walk, mouse to look, Shift to run, F for fly mode (E/Q up and
down), scroll to change eye height, N for evening with the interior lights on,
P for the floor plan, R to return to the stair.
