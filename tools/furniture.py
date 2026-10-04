#!/usr/bin/env python3
"""
Furniture / fixture schedule for the upper floor.

An item is a footprint rectangle plus the direction its front faces
(0 = north/-z, 90 = east/+x, 180 = south/+z, 270 = west/-x).
furniture.js turns each entry into a parametric mesh group.

(0,0) = inner face of the north-west interior corner; x east, z south, feet.
"""

W, E, S, N = 270, 90, 180, 0        # west / east / south / north facing

def it(kind, x0, z0, x1, z1, face=N, solid=True, h=None, **o):
    d = dict(kind=kind, rect=[round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)],
             face=face, solid=solid)
    if h: d['h'] = h
    d.update({k: v for k, v in o.items() if v is not None})
    return d

def sortie(*a):
    return sorted(a, key=lambda i: i['kind'])

FURNITURE = sortie(
    # ------------------------------------------------ kitchen (16.5-34, 0-9.75)
    it('counter_run', 17.05, 0.00, 25.15, 2.15, S, True, kind_='base', worktop='quartz'),
    it('counter_run', 28.85, 0.00, 33.75, 2.15, S, True, kind_='base', worktop='quartz'),
    it('fridge',      17.25, 0.00, 19.65, 2.55, S, True, h=5.9),
    it('range',       19.90, 0.00, 22.40, 2.25, S, True, worktop='quartz'),
    it('hood',        19.90, 0.00, 22.40, 1.90, S, True, h=7.4),
    it('upper_cab',   22.60, 0.00, 25.15, 1.35, S, True, h=7.6),
    it('upper_cab',   28.85, 0.00, 33.75, 1.35, S, True, h=7.6),
    it('island',      21.50, 4.30, 30.50, 7.30, S, True, h=3.0, stools=4, sink=True, dw=True),
    it('pendant',     24.00, 5.80, 26.00, 7.00, N, False, h=7.0, count=1),
    it('pendant',     27.50, 5.80, 29.50, 7.00, N, False, h=7.0, count=1),
    it('pantry',      32.35, 0.00, 34.00, 9.30, W, True, h=7.8),
    # ------------------------------------------------ dining (18.6-26.6, 9.75-16.65)
    it('dining_table',19.35, 11.45, 25.85, 14.95, N, True, seats=6),
    it('pendant',     22.60, 13.20, 22.60, 13.20, N, False, h=6.4, count=1),
    # ------------------------------------------------ laundry (26.6-34, 9.75-16.65)
    it('washer_dryer',27.15, 9.95, 32.55, 12.45, S, True, worktop='quartz'),
    it('broom_closet',33.35, 9.95, 34.00, 16.45, W, True, h=7.6, doors=2),
    # ------------------------------------------------ powder room (10.4-16.07, 0-5.17)
    it('vanity',      10.60, 0.10, 14.40, 2.00, S, True, sinks=1, worktop='marble'),
    it('wc_toilet',   14.70, 1.50, 16.20, 3.90, W, True),
    it('mirror',      10.70, 0.06, 14.30, 0.11, S, False, h=6.4),
    # ------------------------------------------------ bedroom 2 (0-10, 0-10.67)
    it('bed_queen',    3.35, 1.90, 10.00, 6.90, E, True, headboard=True),
    it('nightstand',   8.45, 0.35, 10.00, 1.75, E, True),
    it('nightstand',   8.45, 7.05, 10.00, 8.45, E, True),
    it('closet_double',0.05, 9.15, 4.65, 10.65, N, True, h=7.5),
    it('dresser',      0.05, 2.20, 1.90, 6.40, E, True),
    it('ceiling_light',4.60, 4.60, 4.60, 4.60, N, False, h=8.6, count=1),
    # ------------------------------------------------ walk-in closet
    it('wic_run',      0.05, 11.12, 1.45, 18.20, E, True, h=7.0),
    it('wic_run',      1.45, 11.12, 6.62, 12.52, S, True, h=7.0),
    it('wic_run',      1.45, 16.80, 6.62, 18.20, N, True, h=7.0),
    # ------------------------------------------------ ensuite
    it('shower',      10.45, 14.25, 13.40, 18.10, W, True, niche=True),
    it('tub_freestanding', 0.42, 18.55, 3.35, 23.65, E, True, ridge=True),
    it('vanity',       3.40, 21.85, 7.60, 23.72, N, True, sinks=2, worktop='marble'),
    it('mirror',       3.50, 23.74, 7.55, 23.79, N, False, h=6.9),
    it('towel_bar',    7.12, 16.55, 7.19, 18.30, E, False, h=4.4),
    it('wic_run',     10.48,  5.65, 12.52,  7.82, S, False, h=6.8),
    it('ceiling_light',11.50, 19.90, 11.50, 19.90, N, False, h=8.6, count=1),
    # ------------------------------------------------ water closet
    it('wc_toilet',   11.85, 11.35, 13.45, 13.65, W, True),
    it('vanity',       7.20, 11.30, 9.10, 12.10, E, True, sinks=1, worktop='marble'),
    # ------------------------------------------------ master bedroom
    it('bed_king',     0.40, 27.90, 7.07, 34.23, W, True, headboard=True),
    it('nightstand',   1.55, 26.20, 3.05, 27.70, W, True),
    it('nightstand',   1.55, 34.45, 3.05, 35.95, W, True),
    it('dresser',      4.10, 24.42, 8.60, 26.32, S, True),
    it('tv_console',  12.58, 30.20, 13.56, 35.90, W, True, tv=True),
    it('armchair',     3.60, 36.60, 6.10, 39.10, S, False),
    it('side_table',   6.45, 37.55, 7.45, 38.55, S, False),
    it('ceiling_light',6.60, 31.80, 6.60, 31.80, N, False, h=9.4, count=1),
    # ------------------------------------------------ living room
    it('rug',         22.00, 27.00, 31.60, 36.60, N, False),
    it('sofa3',       19.00, 28.60, 22.00, 36.10, E, True),
    it('sofa2',       24.90, 26.05, 29.90, 29.05, S, True),
    it('coffee_table',23.60, 30.40, 27.10, 33.90, N, True),
    it('side_table',  19.60, 26.75, 21.10, 28.25, S, False),
    it('armchair',    24.60, 36.30, 27.10, 38.80, N, False),
    it('fireplace',   33.85, 27.00, 34.00, 36.00, W, True, h=8.6),
    it('tv_console',  32.80, 28.40, 34.00, 34.60, W, True, tv=True, h=6.2),
    it('floor_lamp',  21.30, 37.20, 21.90, 37.80, N, False, h=5.6),
    it('plant',       14.35, 39.20, 16.05, 40.35, N, False, h=5.4),
    # ------------------------------------------------ patio (outdoor)
    it('outdoor_table',24.20, -5.60, 29.20, -3.20, N, True, seats=4),
    it('planter',      20.55, -6.65, 22.05, -5.15, N, False, h=2.4),
    it('planter',      32.20, -6.65, 33.70, -5.15, N, False, h=2.4),
    # ------------------------------------------------ balcony (outdoor)
    it('outdoor_sofa', 23.00, 46.60, 30.00, 49.60, S, True),
    it('outdoor_chair',19.60, 47.10, 22.10, 49.40, W, True),
    it('outdoor_chair',30.90, 47.10, 33.40, 49.40, E, True),
    it('outdoor_table',24.30, 51.00, 28.80, 53.10, N, True),
    it('planter',      14.30, 53.30, 16.30, 54.90, N, False, h=2.6),
    it('planter',      31.70, 53.30, 33.70, 54.90, N, False, h=2.6),
)

if __name__ == '__main__':
    tot = 0
    for f in FURNITURE:
        x0, z0, x1, z1 = f['rect']
        tot += (x1-x0)*(z1-z0)
    print(f"{len(FURNITURE)} items, {tot:,.0f} sq ft of footprint")
