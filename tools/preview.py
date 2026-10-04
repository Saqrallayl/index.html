#!/usr/bin/env python3
"""
Offline preview renderer.

Reads tools/scene.bin (dumped by tools/harness.mjs) and rasterises a few
camera views with flat Lambert shading so the model can be eyeballed without
a browser. Painter's algorithm - good enough for layout / massing checks.
"""
import array, math, os, struct, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(HERE, 'scene.bin')
OUT = os.path.join(HERE, 'preview')
SUN = (-0.30, 0.42, 0.86)      # light direction (matches src/main.js)


def load(path):
    data = open(path, 'rb').read()
    off = 0
    nMesh, nVerts = struct.unpack_from('<II', data, off)
    off += 8
    meshes = []
    for _ in range(nMesh):
        (nl,) = struct.unpack_from('<I', data, off); off += 4
        name = data[off:off + nl].decode(); off += nl
        props = struct.unpack_from('<9f', data, off); off += 36
        m = struct.unpack_from('<16f', data, off); off += 64
        (n,) = struct.unpack_from('<I', data, off); off += 4
        pos = array.array('f'); pos.frombytes(data[off:off + n * 12]); off += n * 12
        nor = array.array('f'); nor.frombytes(data[off:off + n * 12]); off += n * 12
        meshes.append((name, props, m, pos, nor))
    return meshes


def matmul(m, v):
    x, y, z = v
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


def rot3(m, v):
    x, y, z = v
    return (m[0] * x + m[4] * y + m[8] * z,
            m[1] * x + m[5] * y + m[9] * z,
            m[2] * x + m[6] * y + m[10] * z)


def build_tris(meshes):
    tris = []
    for name, props, m, pos, nor in meshes:
        if props[8] > 0.5:           # transparent (glass) - draw faintly, later
            pass
        for i in range(0, len(pos), 9):
            v = []
            for k in range(3):
                v.append(matmul(m, (pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2])))
            n = rot3(m, (nor[i], nor[i + 1], nor[i + 2]))
            tris.append((v, n, props, name))
    return tris


def render(tris, eye, target, w, h, fov=62, ambient=0.56, sky=0.22, clip=0.4,
           near_skip=True, bg=((0.55, 0.68, 0.82), (0.86, 0.87, 0.84)),
           sunmul=1.0, lights=None, K=120.0):
    ex, ey, ez = eye
    tx, ty, tz = target
    fx, fy, fz = tx - ex, ty - ey, tz - ez
    fl = math.sqrt(fx * fx + fy * fy + fz * fz)
    f = (fx / fl, fy / fl, fz / fl)
    upw = (0, 1, 0)
    rx = f[1] * upw[2] - f[2] * upw[1]
    ry = f[2] * upw[0] - f[0] * upw[2]
    rz = f[0] * upw[1] - f[1] * upw[0]
    rl = math.sqrt(rx * rx + ry * ry + rz * rz) or 1
    r = (rx / rl, ry / rl, rz / rl)
    u = (r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0])
    focal = (h / 2) / math.tan(math.radians(fov) / 2)

    img = Image.new('RGB', (w, h), tuple(int(c * 255) for c in bg[1]))
    d = ImageDraw.Draw(img)
    for y in range(h):                      # sky / ground gradient
        t = y / h
        c = tuple(int(255 * (bg[0][i] * (1 - t) + bg[1][i] * t)) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)

    out = []
    for v, n, props, name in tris:
        p = []
        behind = 0
        for (x, y, z) in v:
            dx, dy, dz = x - ex, y - ey, z - ez
            cz = dx * f[0] + dy * f[1] + dz * f[2]
            cx = dx * r[0] + dy * r[1] + dz * r[2]
            cy = dx * u[0] + dy * u[1] + dz * u[2]
            if cz < clip:
                behind += 1
                p.append(None)
                continue
            p.append((w / 2 + cx * focal / cz, h / 2 - cy * focal / cz, cz))
        if behind == 3:
            continue
        d_ = depth = sum(q[2] for q in p if q) / (3 - behind)
        if depth > 500:
            continue
        # flat shade
        nrm = n
        if nrm[0] * (v[0][0] - ex) + nrm[1] * (v[0][1] - ey) + nrm[2] * (v[0][2] - ez) > 0:
            nrm = (-nrm[0], -nrm[1], -nrm[2])
        lam = max(0.0, nrm[0] * SUN[0] + nrm[1] * SUN[1] + nrm[2] * SUN[2])
        l = ambient + 0.85 * lam * sunmul
        if lights:
            # point lights: approximate irradiance at the face centre
            mx = (v[0][0] + v[1][0] + v[2][0]) / 3
            my = (v[0][1] + v[1][1] + v[2][1]) / 3
            mz = (v[0][2] + v[1][2] + v[2][2]) / 3
            for lp in lights:
                ddx, ddy, ddz = lp['pos'][0] - mx, lp['pos'][1] - my, lp['pos'][2] - mz
                d2 = ddx * ddx + ddy * ddy + ddz * ddz
                if d2 > lp['dist'] ** 2:
                    continue
                dist = math.sqrt(d2) or 0.001
                ndl = max(0.0, (nrm[0] * ddx + nrm[1] * ddy + nrm[2] * ddz) / dist)
                l += (lp['intensity'] * K / d2) * ndl / 6.0
        if props[1] > 0.5 and props[2] > 0.5:
            l = ambient + 0.5 * lam
        r_, g_, b_ = props[0], props[1], props[2]
        r_, g_, b_ = r_ * l + sky * 0.5, g_ * l + sky * 0.55, b_ * l + sky * 0.75
        r_, g_, b_ = r_ * l + props[6] * 0.9, g_ * l + props[7] * 0.9, b_ * l + props[8] * 0.9
        col = (min(255, int(255 * r_ ** 0.85)), min(255, int(255 * g_ ** 0.85)), min(255, int(255 * b_ ** 0.85)))
        alpha = 0.32 if props[8] > 0.5 else 1.0
        poly = [(q[0], q[1]) for q in p if q]
        if len(poly) < 3:
            continue
        # huge polygons (ground, slabs) always draw first: painter's algorithm
        area = abs((poly[1][0]-poly[0][0])*(poly[2][1]-poly[0][1]) - (poly[2][0]-poly[0][0])*(poly[1][1]-poly[0][1])) / 2
        out.append((1e9 if area > 40000 else depth, poly, col, alpha, name))
    out.sort(key=lambda t: -t[0])
    for depth, poly, col, alpha, name in out:
        if alpha < 1:
            d.polygon(poly, fill=col)
        else:
            d.polygon(poly, fill=col)
    return img


VIEWS = [
    ('19-evening-living', (29.0, 5.6, 38.5), (27, 4.2, 26), 74),
    ('20-evening-kitchen', (18.6, 5.6, 3.0), (30, 3.6, 12), 74),
    ('17-stair',        (23.0, 6.4, 20.0), (22.7, 1.0, 30), 74),
    ('18-stair-down',   (22.7, -4.0, 30.0), (22.7, -8.0, 34), 74),
    ('11-living2',      (29.0, 5.6, 38.5), (27, 4.4, 26), 74),
    ('12-fireplace',    (26.5, 5.4, 31.5), (34, 4.0, 31.5), 74),
    ('13-nook',         (19.5, 5.4, 39.5), (14, 4.2, 30), 74),
    ('14-ens',          (9.5, 5.4, 22.5),  (1.5, 3.6, 21), 74),
    ('15-laundry',      (30.0, 5.4, 15.5), (29, 4.6, 10), 74),
    ('16-powder',       (15.8, 5.2, 4.6),  (12, 4.4, 2), 74),
    ('01-aerial-sw',     (-42, 52, 78),   (17, 2, 24), 62),
    ('02-aerial-se',     (66, 46, 66),    (16, 2, 22), 62),
    ('03-aerial-n',      (24, 44, -46),   (18, 2, 22), 62),
    ('04-living',        (30, 5.6, 37.5), (18, 5.0, 24), 74),
    ('05-kitchen',       (18.6, 5.6, 3.0), (30, 4.2, 12), 74),
    ('06-master',        (12.4, 5.6, 38.2), (2, 4.4, 27), 74),
    ('07-balcony',       (24, 5.6, 52),   (23, 6, 40), 74),
    ('08-hall-entry',    (23.2, 6.4, 17.0), (16, 4.0, 30), 74),
    ('09-top',           (17, 96, 23.5),  (17, 0, 22.5), 42),
    ('10-bed2',          (8.6, 5.6, 9.6), (2, 4.6, 1), 74),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    meshes = load(BIN)
    tris = build_tris(meshes)
    lights = None
    lp = os.path.join(HERE, 'scene.lights.json')
    if os.path.exists(lp):
        import json
        lights = json.load(open(lp))
        print(f"{len(lights)} point lights loaded")
    print(f"{len(meshes)} meshes, {len(tris)} triangles")
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    for name, eye, tgt, fov in VIEWS:
        if only and not any(o in name for o in only):
            continue
        night = name.startswith('19') or name.startswith('20')
        img = render(tris, eye, tgt, 1000, 640, fov,
                     ambient=0.10 if night else 0.56, sky=0.05 if night else 0.22,
                     sunmul=0.08 if night else 1.0,
                     lights=lights if night else None,
                     bg=((0.05, 0.06, 0.10), (0.07, 0.07, 0.09)) if night else
                        ((0.55, 0.68, 0.82), (0.86, 0.87, 0.84)))
        p = os.path.join(OUT, name + '.jpg')
        img.save(p, quality=88)
        print('  wrote', p)


if __name__ == '__main__':
    main()
