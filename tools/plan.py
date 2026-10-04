#!/usr/bin/env python3
"""
Source of truth for the upper-floor plan of the walkthrough model.

Room rectangles, wall runs, doors, windows and the stair, with validation
(overlap / hole detection), a top-down plan render for review, and export to
assets/plan.json which planner.js extrudes into the walkable 3D model.

Feet, plan view:  x = west->east, z = north->south, y = up.
"""
import json, os

EXT, INT = 0.50, 0.40
DOOR_W, DOOR_H = 2.83, 6.83
SILL, HEAD = 2.50, 6.83
BOUNDS = (0.0, 0.0, 34.0, 40.5)          # interior envelope x0,z0,x1,z1
ZONE_OPEN = 'open'                        # anything sharing this zone is open plan

def R(id, name, x0, z0, x1, z1, floor='wood', ceil=9.0, zone=None, kind='in'):
    return dict(id=id, name=name, rect=[x0, z0, x1, z1], floor=floor,
                ceil=ceil, zone=zone or id, kind=kind)

ROOMS = [
    # ---- north band : bedroom 2 | powder + linen + hall | kitchen ----------
    R('bed2',    'Bedroom 2',       0.00,  0.00, 10.00, 10.67, 'wood',  9.0, 'bed2'),
    R('powder',  'Powder Room',    10.40,  0.00, 16.50,  5.17, 'tile',  9.0, 'powder'),
    R('linen',   'Linen',          10.40,  5.57, 12.60,  7.90, 'wood',  9.0, 'linen'),
    R('hall_A',  'Hall',           12.60,  5.57, 16.50, 10.67, 'wood',  9.0, ZONE_OPEN),
    R('hall_B',  '',               10.40,  7.90, 12.60, 10.67, 'wood',  9.0, ZONE_OPEN),
    R('kitchen', 'Kitchen',        16.50,  0.00, 34.00,  9.75, 'wood',  9.0, ZONE_OPEN),
    # ---- central band : spine hall | open dining | laundry ----------------
    R('hall_c',  'Hall',           13.98, 10.67, 18.60, 16.65, 'wood',  9.0, ZONE_OPEN),
    R('hall_e2', '',               16.50,  9.75, 18.60, 10.67, 'wood',  9.0, ZONE_OPEN),
    R('dining',  'Dining',         18.60,  9.75, 26.60, 16.65, 'wood',  9.5, ZONE_OPEN),
    R('laundry', 'Laundry',        26.60,  9.75, 34.00, 16.65, 'tile',  9.0, 'laundry'),
    R('hall_c2', 'Hall',           13.98, 16.65, 17.40, 24.17, 'wood',  9.0, ZONE_OPEN),
    R('hall_e',  'Hall',           17.40, 16.65, 34.00, 19.65, 'wood',  9.0, ZONE_OPEN),
    R('land',    '',               20.90, 19.65, 24.40, 21.80, 'wood',  9.0, ZONE_OPEN),
    R('hall_g',  'Hall',           24.40, 19.65, 34.00, 24.17, 'wood',  9.5, ZONE_OPEN),
    # ---- south band : master suite | living room --------------------------
    R('living',  'Living Room',    13.98, 24.17, 34.00, 40.50, 'wood', 10.0, ZONE_OPEN),
    R('master',  'Master Bedroom',  0.00, 24.22, 13.58, 40.50, 'wood', 10.0, 'master'),
    R('vest',    'Suite Entry',    11.00, 18.24, 13.58, 24.17, 'wood',  9.0, 'vest'),
    R('wic',     'Walk-in Closet',  0.00, 11.07,  6.67, 18.24, 'carpet',9.0, 'suite'),
    R('ens_n',   'Ensuite',         7.07, 13.99, 13.58, 18.24, 'tile',  9.0, 'ens'),
    R('ens_s',   'Ensuite',         0.00, 18.24, 10.60, 23.82, 'tile',  9.0, 'ens'),
    R('wc',      'Water Closet',    7.07, 11.07, 13.58, 13.99, 'tile',  9.0, 'wc'),
    # ---- open to below / outdoors ----------------------------------------
    R('foyer',   'Foyer Below',    17.40, 19.65, 20.90, 24.17, 'wood',  9.0, ZONE_OPEN, kind='void'),
    R('stair',   'Stair',          20.90, 21.80, 24.40, 34.95, 'wood',  9.0, ZONE_OPEN, kind='void'),
    R('patio',   'Covered Patio',  20.17, -6.92, 34.00,  0.00, 'stone', 9.0, 'patio', kind='out'),
    R('balcony', 'Covered Balcony',13.98, 41.00, 34.00, 55.25, 'stone', 9.67,'bal',   kind='out'),
]
ROOM = {r['id']: r for r in ROOMS}

VOID = [17.40, 19.65, 20.90, 24.17]        # open to the foyer below
STAIR_HOLE = [20.90, 21.80, 24.40, 34.95]  # stairwell slot through the slab
STAIR = dict(x0=20.90, x1=24.40, z_top=21.80, risers=16, tread=0.875, rise=10.0/16)

# no wall between these rooms and their neighbours (railings / open entries)
# each entry: (x0, z0, x1, z1)  - a plan segment whose walls are suppressed
SUPPRESS = [
    (16.90, 19.65, 17.90, 24.40),      # spine hall <-> foyer void     (railing)
    (17.20, 23.95, 21.00, 24.60),      # living room <-> foyer void    (railing)
    (20.70, 19.45, 21.10, 24.45),      # landing     <-> foyer void    (railing)
    (20.70, 24.00, 21.10, 35.15),      # living room <-> stair void    (railing)
    (24.20, 19.45, 24.60, 35.15),      # hall / living <-> stair void  (railing)
    (20.80, 34.80, 24.60, 35.15),      # live edge at foot of the stair
]

OP = [
    # doors:  hinge 'low'/'high' = which end of the opening, swing +1/-1 = which
    # side of the wall the leaf opens into            ------------------------
    dict(kind='door',  axis='z', line=10.20, at= 9.40, w=DOOR_W, h=DOOR_H, id='bed2_d', hinge='high', swing=-1, name='Bedroom 2'),
    dict(kind='door',  axis='x', line= 5.37, at=14.60, w=DOOR_W, h=DOOR_H, id='pow_d',  hinge='high', swing=-1, name='Powder'),
    dict(kind='door',  axis='z', line=12.60, at= 6.70, w=1.90,   h=DOOR_H, id='lin_d',  hinge='low',  swing= 1, name='Linen'),
    dict(kind='door',  axis='x', line=16.85, at=29.60, w=DOOR_W, h=DOOR_H, id='lau_d',  hinge='low',  swing= 1, name='Laundry'),
    dict(kind='door',  axis='z', line=13.78, at=21.60, w=DOOR_W, h=DOOR_H, id='vest_d', hinge='low',  swing=-1, name='Suite entry'),
    dict(kind='door',  axis='x', line=24.20, at=12.40, w=DOOR_W, h=DOOR_H, id='mst_d',  hinge='high', swing= 1, name='Master bedroom'),
    dict(kind='door',  axis='x', line=24.02, at= 9.30, w=2.33,   h=DOOR_H, id='ens_d',  hinge='high', swing=-1, name='Ensuite'),
    dict(kind='door',  axis='x', line=18.24, at=12.20, w=2.40,   h=DOOR_H, id='ens_v',  hinge='low',  swing=-1, name='Ensuite from suite entry'),
    dict(kind='door',  axis='z', line= 6.87, at=15.50, w=2.50,   h=DOOR_H, id='wic_d',  hinge='low',  swing= 1, name='Walk-in closet'),
    dict(kind='pocket',axis='x', line=14.19, at= 8.65, w=2.40,   h=DOOR_H, id='wc_d',   name='Water closet'),
    dict(kind='door',  axis='x', line=-0.25, at=27.00, w=3.00,   h=DOOR_H, id='pat_d',  hinge='low',  swing= 1, glass=True, name='Patio'),
    # sliding glass wall to the balcony (living room, south wall)
    dict(kind='slider',axis='x', line=40.75, at=21.50, w=8.00,   h=8.00,  id='bal_s',  panels=3, name='Balcony'),
    # windows --------------------------------------------------------------
    dict(kind='win', axis='x', line=-0.25, at= 2.60, w=4.00, id='w_bed2_1'),
    dict(kind='win', axis='x', line=-0.25, at= 7.00, w=2.60, id='w_bed2_2'),
    dict(kind='win', axis='z', line=-0.25, at= 5.20, w=3.50, id='w_bed2_3'),
    dict(kind='win', axis='x', line=-0.25, at=13.20, w=3.00, id='w_pow'),
    dict(kind='win', axis='x', line=-0.25, at=20.60, w=3.00, sill=3.5, id='w_kit_1'),
    dict(kind='win', axis='x', line=-0.25, at=31.60, w=2.50, sill=3.5, id='w_kit_2'),
    dict(kind='win', axis='z', line= 0.25, at=13.20, w=3.00, id='w_lau'),
    dict(kind='win', axis='z', line=-0.25, at=20.20, w=2.60, sill=3.9, id='w_ens'),
    dict(kind='win', axis='z', line=-0.25, at=25.60, w=3.00, id='w_mst_1'),
    dict(kind='win', axis='z', line=-0.25, at=35.60, w=3.00, id='w_mst_2'),
    dict(kind='win', axis='x', line=40.75, at=16.90, w=3.00, id='w_liv_1'),
    dict(kind='win', axis='x', line=40.75, at=30.60, w=3.00, id='w_liv_2'),
    dict(kind='win', axis='z', line=-0.25, at=14.40, w=2.00, id='w_wic'),
    # bay window in front of the master (opening + glazing)
    dict(kind='open', axis='x', line=40.75, at=4.60, w=4.40, h=10.0, id='bay_open'),
]
BAY = dict(x0=2.00, z0=40.50, x1=7.20, z1=42.30, h=10.0)   # master bay window

# ------------------------------------------------------------- helpers -----
def inr(r, x, z, pad=0.0):
    return r[0]-pad <= x <= r[2]+pad and r[1]-pad <= z <= r[3]+pad

def ceil_at(x, z, pad=0.35, default=9.0):
    h = default
    for r in ROOMS:
        if r['kind'] == 'out':
            continue
        if inr(r['rect'], x, z, pad):
            h = max(h, r['ceil'])
    return h

def zone_at(x, z):
    for r in ROOMS:
        if inr(r['rect'], x, z, 0.02) and r['kind'] != 'out':
            return r['zone']
    return None

def suppressed(axis, c, a, b):
    for (x0, z0, x1, z1) in SUPPRESS:
        if axis == 'x' and x0 <= c <= x1 and not (b < z0 or a > z1):
            return True
        if axis == 'z' and z0 <= c <= z1 and not (b < x0 or a > x1):
            return True
    return False

# ------------------------------------------------------------- walls -------
def build_walls():
    out = []
    for r in ROOMS:
        if r['kind'] == 'out':
            continue
        x0, z0, x1, z1 = r['rect']
        for side, vert, line, a0, a1 in [('N', 0, z0, x0, x1), ('S', 0, z1, x0, x1),
                                         ('W', 1, x0, z0, z1), ('E', 1, x1, z0, z1)]:
            n = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}[side]
            on_env = ((side == 'N' and abs(line-BOUNDS[1]) < 1e-6) or
                      (side == 'S' and abs(line-BOUNDS[3]) < 1e-6) or
                      (side == 'W' and abs(line-BOUNDS[0]) < 1e-6) or
                      (side == 'E' and abs(line-BOUNDS[2]) < 1e-6))
            half = (EXT if on_env else INT) / 2.0
            cuts = {round(a0, 3), round(a1, 3)}
            for o in ROOMS:
                if o is r or o['kind'] == 'out':
                    continue
                ox0, oz0, ox1, oz1 = o['rect']
                if vert:
                    if ox0 - 0.5 < line < ox1 + 0.5:
                        for c in (oz0, oz1):
                            if a0+1e-6 < c < a1-1e-6:
                                cuts.add(round(c, 3))
                else:
                    if oz0 - 0.5 < line < oz1 + 0.5:
                        for c in (ox0, ox1):
                            if a0+1e-6 < c < a1-1e-6:
                                cuts.add(round(c, 3))
            cuts = sorted(cuts)
            for i in range(len(cuts)-1):
                s0, s1 = cuts[i], cuts[i+1]
                if s1 - s0 < 0.08:
                    continue
                px, pz = (line + n[0]*0.6, (s0+s1)/2) if vert else ((s0+s1)/2, line + n[1]*0.6)
                far = zone_at(px, pz)
                if far is not None and far == r['zone']:
                    continue
                h = max(r['ceil'], ceil_at(px, pz))
                c = line + (n[0] if vert else n[1]) * half/2.0
                if suppressed('z' if vert else 'x', c, s0, s1):
                    continue
                if vert:
                    out.append(dict(axis='z', c=round(c, 4), t=half, a=s0, b=s1, y0=0.0, y1=h, ext=on_env))
                else:
                    out.append(dict(axis='x', c=round(c, 4), t=half, a=s0, b=s1, y0=0.0, y1=h, ext=on_env))
    return out

def cut(walls, o):
    res, line, kind = [], o['line'], o['kind']
    a0, a1 = o['at']-o['w']/2.0, o['at']+o['w']/2.0
    for w in walls:
        same = (w['axis'] == o['axis']) and abs(w['c'] - line) < (w['t'] + EXT + 0.02)
        if not (same and (min(a1, w['b']) - max(a0, w['a'])) > 0.02):
            res.append(w); continue
        yb, yt = (o.get('sill', SILL), o.get('head', HEAD)) if kind == 'win' else (0.0, o.get('h', DOOR_H))
        if w['a'] < a0 - 0.02:
            res.append(dict(w, b=round(min(a0, w['b']), 4)))
        if w['b'] > a1 + 0.02:
            res.append(dict(w, a=round(max(a1, w['a']), 4)))
        if w['y1'] > yt + 0.02:
            res.append(dict(w, a=max(a0, w['a']), b=min(a1, w['b']), y0=yt, y1=w['y1']))
        if kind == 'win' and w['y0'] < yb - 0.02:
            res.append(dict(w, a=max(a0, w['a']), b=min(a1, w['b']), y0=w['y0'], y1=yb))
    return res

def ceilings():
    slabs, soffits = [], []
    for r in ROOMS:
        if r['kind'] == 'void':
            continue
        x0, z0, x1, z1 = r['rect']
        slabs.append(dict(rect=[x0, z0, x1, z1], y=r['ceil'], out=(r['kind'] == 'out')))
        if r['ceil'] > 9.0 and r['kind'] == 'in':
            for s in [(x0-0.8, z0-0.8, x1+0.8, z0), (x0-0.8, z1, x1+0.8, z1+0.8),
                      (x0-0.8, z0, x0, z1), (x1, z0, x1+0.8, z1)]:
                soffits.append(dict(rect=list(s), y=r['ceil']))
    return slabs, soffits

# ------------------------------------------------------------- checks ------
def raster_check(walls, step=0.15):
    """(a) sum vs union of room areas -> overlaps, (b) uncovered walkable
    cells -> holes in the floor plan."""
    xs = [BOUNDS[0], BOUNDS[2]]; zs = [BOUNDS[1], BOUNDS[3]]
    nx = int((BOUNDS[2]-BOUNDS[0])/step); nz = int((BOUNDS[3]-BOUNDS[1])/step)
    cover = [[False]*nz for _ in range(nx)]
    count = 0
    voids = [r for r in ROOMS if r['kind'] == 'void']
    for r in ROOMS:
        if r['kind'] in ('out', 'void'):
            continue
        x0, z0, x1, z1 = r['rect']
        for i in range(nx):
            x = BOUNDS[0] + (i+0.5)*step
            if not (x0 <= x <= x1): continue
            for j in range(nz):
                z = BOUNDS[1] + (j+0.5)*step
                if z0 <= z <= z1 and not cover[i][j]:
                    cover[i][j] = True; count += 1
    area_union = count*step*step
    area_sum = sum((r['rect'][2]-r['rect'][0])*(r['rect'][3]-r['rect'][1])
                   for r in ROOMS if r['kind'] == 'in')
    # holes: uncovered and not inside a wall
    holes = []
    for i in range(nx):
        x = BOUNDS[0] + (i+0.5)*step
        for j in range(nz):
            if cover[i][j]: continue
            z = BOUNDS[1] + (j+0.5)*step
            if any(inr(v['rect'], x, z, 0.02) for v in voids): continue
            inwall = False
            for w in walls:
                if w['axis'] == 'x':
                    if abs(z-w['c']) <= w['t']/2+step and w['a']-step <= x <= w['b']+step: inwall = True; break
                else:
                    if abs(x-w['c']) <= w['t']/2+step and w['a']-step <= z <= w['b']+step: inwall = True; break
            if not inwall: holes.append((round(x, 2), round(z, 2)))
    return area_sum, area_union, holes

# ------------------------------------------------------------- render ------
def render(path, walls, scale=13):
    from PIL import Image, ImageDraw, ImageFont
    minx, minz, maxx, maxz = -2.0, -9.0, 36.5, 57.0
    im = Image.new('RGB', (int((maxx-minx)*scale), int((maxz-minz)*scale)), (243, 241, 236))
    d = ImageDraw.Draw(im, 'RGBA')
    px = lambda x, z: ((x-minx)*scale, (z-minz)*scale)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
        fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
    except Exception:
        f = fb = ImageFont.load_default()

    COL = dict(wood=(228, 208, 176), tile=(224, 226, 220), carpet=(216, 210, 198), stone=(206, 202, 194))
    for r in ROOMS:
        fill = (196, 214, 226) if r['kind'] == 'void' else COL[r['floor']]
        d.rectangle([px(*r['rect'][:2]), px(*r['rect'][2:])], fill=fill)
    for w in walls:
        if w['axis'] == 'x':
            d.rectangle([px(w['a'], w['c']-w['t']/2), px(w['b'], w['c']+w['t']/2)], fill=(70, 64, 58))
        else:
            d.rectangle([px(w['c']-w['t']/2, w['a']), px(w['c']+w['t']/2, w['b'])], fill=(70, 64, 58))
    for o in OP:
        c = (198, 226, 240) if o['kind'] == 'win' else ((170, 214, 236) if o['kind'] == 'slider' else (250, 249, 245))
        a0, a1 = o['at']-o['w']/2, o['at']+o['w']/2
        if o['axis'] == 'x':
            d.rectangle([px(a0, o['line']-0.55), px(a1, o['line']+0.55)], fill=c)
        else:
            d.rectangle([px(o['line']-0.55, a0), px(o['line']+0.55, a1)], fill=c)
    s = STAIR
    for i in range(s['risers']):
        z = s['z_top'] + i*s['tread']
        if z > STAIR_HOLE[3]:
            break
        g = 205 - i*6
        d.rectangle([px(s['x0']+0.1, z), px(s['x1']-0.1, z+s['tread'])], fill=(g, g-8, g-20),
                    outline=(120, 112, 104))
    zz = s['z_top'] + s['risers']*s['tread']
    d.line([px(s['x0']+0.1, STAIR_HOLE[3]), px(s['x1']-0.1, STAIR_HOLE[3])], fill=(150, 60, 60), width=2)
    d.text(px(s['x0']+0.2, STAIR_HOLE[3]+0.5), 'stair continues below this floor level',
           fill=(150, 60, 60), font=f)
    for v, lab in ((VOID, 'open to below'), (STAIR_HOLE, 'stairwell')):
        d.rectangle([px(v[0], v[1]), px(v[2], v[3])], outline=(30, 110, 165), width=2)
        d.text(px((v[0]+v[2])/2, v[3]-0.6), lab, fill=(30, 110, 165), font=f, anchor='ms')
    d.rectangle([px(BAY['x0'], BAY['z0']), px(BAY['x1'], BAY['z1'])], fill=(228, 208, 176), outline=(70, 64, 58))
    for r in ROOMS:
        x0, z0, x1, z1 = r['rect']
        if r['name'] and (x1-x0) > 2.6 and (z1-z0) > 1.6:
            cx, cz = (x0+x1)/2, (z0+z1)/2
            d.multiline_text(px(cx, cz), f"{r['name']}\n{x1-x0:.1f}' x {z1-z0:.1f}'",
                             fill=(58, 53, 48), font=f, anchor='mm', align='center')
    d.text(px(0, -8.4), 'N ^   upper floor   envelope 34.0 x 40.5 ft   patio + balcony outdoors',
           fill=(80, 74, 68), font=fb)
    im.save(path)
    return path

# ------------------------------------------------------------- export ------
def export(path):
    walls = build_walls()
    for o in OP:
        walls = cut(walls, o)
    # bay window opening in the master's south wall
    slabs, soffits = ceilings()
    a_sum, a_union, holes = raster_check(walls)
    data = dict(units='ft', bounds=BOUNDS, ext=EXT, intt=INT, int=INT,
                doorH=DOOR_H, sill=SILL, head=HEAD, void=VOID, stair_hole=STAIR_HOLE, stair=STAIR, bay=BAY,
                rooms=[dict(id=r['id'], name=r['name'], rect=r['rect'], floor=r['floor'],
                            ceil=r['ceil'], zone=r['zone'], kind=r['kind']) for r in ROOMS],
                openings=OP, walls=walls, ceilings=slabs, soffits=soffits,
                stats=dict(area_sum=round(a_sum, 1), area_union=round(a_union, 1),
                           envelope=round((BOUNDS[2]-BOUNDS[0])*(BOUNDS[3]-BOUNDS[1]), 1)))
    with open(path, 'w') as fh:
        json.dump(data, fh, indent=1)
    return data, holes

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    data, holes = export(os.path.join(root, 'assets', 'plan.json'))
    render(os.path.join(here, 'plan.png'), data['walls'])
    st = data['stats']
    print(f"walls {len(data['walls'])}   room area sum {st['area_sum']:,.1f}  "
          f"union {st['area_union']:,.1f}  envelope {st['envelope']:,.1f} sq ft")
    print(f"overlap (sum-union): {st['area_sum']-st['area_union']:.1f} sq ft")
    print(f"holes: {len(holes)}" + (f"  e.g. {holes[:8]}" if holes else ""))
