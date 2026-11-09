#!/usr/bin/env python3
"""
Pretvara MakeHuman (CC0) bazni mesh + morph targete u kompaktan binarni
format za aplikaciju: web/model/body.bin + web/model/body.json

Upotreba:
  git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman mh
  cd mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/targets && cd ..
  python3 tools/build_model.py mh/makehuman/data web/model
"""
import json
import os
import struct
import sys

import numpy as np

DATA, OUT = sys.argv[1], sys.argv[2]
T = os.path.join(DATA, 'targets')


# ---------------- OBJ ----------------
def load_obj(path):
    verts, groups, cur = [], {}, None
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('g '):
                cur = line.split(None, 1)[1].strip()
                groups.setdefault(cur, [])
            elif line.startswith('f '):
                idx = [int(p.split('/')[0]) - 1 for p in line.split()[1:]]
                groups[cur].append(idx)
    return np.array(verts, dtype=np.float64), groups


verts, groups = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
NV = len(verts)


def tris(faces):
    out = []
    for f in faces:
        for i in range(1, len(f) - 1):
            out.append((f[0], f[i], f[i + 1]))
    return out


body_tris = tris(groups['body'])
eye_tris = tris(groups['helper-l-eye']) + tris(groups['helper-r-eye'])
used = sorted({i for t in body_tris + eye_tris for i in t})
remap = {o: n for n, o in enumerate(used)}
used_arr = np.array(used)


# ---------------- targeti ----------------
def target(rel, weight=1.0):
    d = np.zeros((NV, 3))
    path = os.path.join(T, rel)
    with open(path) as f:
        for line in f:
            if not line.strip() or line.startswith('#'):
                continue
            p = line.split()
            d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return d * weight


def zero():
    return np.zeros((NV, 3))


MD = 'macrodetails/'
U = MD + 'universal-female-young-%smuscle-%sweight.target'
BR = 'breast/female-young-averagemuscle-averageweight-%scup-%sfirmness.target'

# Osnovna žena: mlada, prosječni mišići/težina, miješana etnička pripadnost (kao u MakeHumanu)
base_delta = target(U % ('average', 'average'))
for race in ('caucasian', 'african', 'asian'):
    base_delta += target(MD + '%s-female-young.target' % race, 1 / 3)
base = verts + base_delta
avg = target(U % ('average', 'average'))


def pair(dec, inc):
    """dec/inc: funkcije ili relativne putanje targeta -> (delta_dec, delta_inc)"""
    def ld(x):
        if callable(x):
            return x()
        if isinstance(x, (list, tuple)):
            s = zero()
            for y in x:
                s += target(y)
            return s
        return target(x)
    return ld(dec), ld(inc)


def lr(name):  # spoji lijevu i desnu stranu
    return ['armslegs/l-' + name, 'armslegs/r-' + name]


H = MD + 'height/female-young-averagemuscle-averageweight-%sheight.target'

# (id, labela, grupa, dec, inc)
MORPHS = [
    ('height', 'Visina', 'Tijelo', H % 'min', H % 'max'),
    ('weight', 'Težina / punoća', 'Tijelo', lambda: target(U % ('average', 'min')) - avg, lambda: target(U % ('average', 'max')) - avg),
    ('muscle', 'Mišićavost', 'Tijelo', lambda: target(U % ('min', 'average')) - avg, lambda: target(U % ('max', 'average')) - avg),

    ('headSize', 'Veličina glave', 'Glava i vrat', ['head/head-scale-vert-decr.target', 'head/head-scale-horiz-decr.target', 'head/head-scale-depth-decr.target'],
     ['head/head-scale-vert-incr.target', 'head/head-scale-horiz-incr.target', 'head/head-scale-depth-incr.target']),
    ('headWidth', 'Širina glave', 'Glava i vrat', 'head/head-scale-horiz-decr.target', 'head/head-scale-horiz-incr.target'),
    ('headFat', 'Punoća lica', 'Glava i vrat', 'head/head-fat-decr.target', 'head/head-fat-incr.target'),
    ('neckLength', 'Dužina vrata', 'Glava i vrat', 'measure/measure-neck-height-decr.target', 'measure/measure-neck-height-incr.target'),
    ('neckCirc', 'Debljina vrata', 'Glava i vrat', 'measure/measure-neck-circ-decr.target', 'measure/measure-neck-circ-incr.target'),

    ('shoulders', 'Širina ramena', 'Trup', 'measure/measure-shoulder-dist-decr.target', 'measure/measure-shoulder-dist-incr.target'),
    ('vshape', 'V-oblik leđa', 'Trup', 'torso/torso-vshape-decr.target', 'torso/torso-vshape-incr.target'),
    ('torsoLength', 'Dužina trupa', 'Trup', 'measure/measure-napetowaist-dist-decr.target', 'measure/measure-napetowaist-dist-incr.target'),
    ('torsoDepth', 'Dubina trupa', 'Trup', 'torso/torso-scale-depth-decr.target', 'torso/torso-scale-depth-incr.target'),
    ('underbust', 'Obim ispod grudi', 'Trup', 'measure/measure-underbust-circ-decr.target', 'measure/measure-underbust-circ-incr.target'),
    ('waist', 'Struk', 'Trup', 'measure/measure-waist-circ-decr.target', 'measure/measure-waist-circ-incr.target'),
    ('belly', 'Stomak', 'Trup', 'stomach/stomach-pregnant-decr.target', 'stomach/stomach-pregnant-incr.target'),
    ('hips', 'Bokovi', 'Trup', 'measure/measure-hips-circ-decr.target', 'measure/measure-hips-circ-incr.target'),
    ('waistHeight', 'Visina struka', 'Trup', 'hip/hip-waist-down.target', 'hip/hip-waist-up.target'),
    ('glutes', 'Zadnjica', 'Trup', 'buttocks/buttocks-volume-decr.target', 'buttocks/buttocks-volume-incr.target'),

    ('bustSize', 'Veličina grudi', 'Grudi', BR % ('min', 'average'), BR % ('max', 'average')),
    ('bustFirm', 'Čvrstoća grudi', 'Grudi', BR % ('average', 'min'), BR % ('average', 'max')),
    ('bustHeight', 'Visina grudi', 'Grudi', 'breast/breast-trans-down.target', 'breast/breast-trans-up.target'),
    ('bustDist', 'Razmak grudi', 'Grudi', 'breast/breast-dist-decr.target', 'breast/breast-dist-incr.target'),
    ('bustPoint', 'Isturenost grudi', 'Grudi', 'breast/breast-point-decr.target', 'breast/breast-point-incr.target'),
    ('bustVol', 'Volumen gore/dolje', 'Grudi', 'breast/breast-volume-vert-down.target', 'breast/breast-volume-vert-up.target'),

    ('upperArmLen', 'Dužina nadlaktice', 'Ruke', 'measure/measure-upperarm-length-decr.target', 'measure/measure-upperarm-length-incr.target'),
    ('lowerArmLen', 'Dužina podlaktice', 'Ruke', 'measure/measure-lowerarm-length-decr.target', 'measure/measure-lowerarm-length-incr.target'),
    ('upperArm', 'Debljina nadlaktice', 'Ruke', 'measure/measure-upperarm-circ-decr.target', 'measure/measure-upperarm-circ-incr.target'),
    ('lowerArm', 'Debljina podlaktice', 'Ruke', lr('lowerarm-fat-decr.target'), lr('lowerarm-fat-incr.target')),
    ('wrist', 'Zglob šake', 'Ruke', 'measure/measure-wrist-circ-decr.target', 'measure/measure-wrist-circ-incr.target'),
    ('hands', 'Veličina šaka', 'Ruke', lr('hand-scale-decr.target'), lr('hand-scale-incr.target')),

    ('upperLegLen', 'Dužina natkoljenice', 'Noge', 'measure/measure-upperleg-height-decr.target', 'measure/measure-upperleg-height-incr.target'),
    ('lowerLegLen', 'Dužina potkoljenice', 'Noge', 'measure/measure-lowerleg-height-decr.target', 'measure/measure-lowerleg-height-incr.target'),
    ('thighs', 'Butine', 'Noge', 'measure/measure-thigh-circ-decr.target', 'measure/measure-thigh-circ-incr.target'),
    ('knees', 'Koljena', 'Noge', 'measure/measure-knee-circ-decr.target', 'measure/measure-knee-circ-incr.target'),
    ('calves', 'Listovi', 'Noge', 'measure/measure-calf-circ-decr.target', 'measure/measure-calf-circ-incr.target'),
    ('ankles', 'Gležnjevi', 'Noge', 'measure/measure-ankle-circ-decr.target', 'measure/measure-ankle-circ-incr.target'),
    ('feet', 'Veličina stopala', 'Noge', lr('foot-scale-decr.target'), lr('foot-scale-incr.target')),
]

# ---------------- zapis ----------------
os.makedirs(OUT, exist_ok=True)
buf = bytearray()


def put(arr, dtype):
    global buf
    while len(buf) % 4:
        buf += b'\0'
    off = len(buf)
    a = np.ascontiguousarray(arr, dtype=dtype)
    buf += a.tobytes()
    return {'offset': off, 'count': int(a.size)}


def remap_tris(ts):
    return np.array([[remap[i] for i in t] for t in ts], dtype=np.uint32).ravel()


bpos = base[used_arr]
# podigni tako da stopala stoje na y = 0
floor = bpos[:, 1].min()
bpos[:, 1] -= floor

manifest = {
    'source': 'MakeHuman 1.x base mesh and targets (CC0 1.0)',
    'unit': 'dm',
    'vertexCount': len(used),
    'position': put(bpos, np.float32),
    'body': put(remap_tris(body_tris), np.uint32),
    'eyes': put(remap_tris(eye_tris), np.uint32),
    'morphs': [],
}

for mid, label, group, dec, inc in MORPHS:
    d_dec, d_inc = pair(dec, inc)
    entry = {'id': mid, 'label': label, 'group': group}
    for key, d in (('dec', d_dec), ('inc', d_inc)):
        d = d[used_arr]
        nz = np.where(np.abs(d).max(axis=1) > 1e-5)[0]
        entry[key] = {'idx': put(nz, np.uint32), 'delta': put(d[nz], np.float32)}
    manifest['morphs'].append(entry)
    print(f'{mid:12s} dec={entry["dec"]["idx"]["count"]:6d} inc={entry["inc"]["idx"]["count"]:6d}')

with open(os.path.join(OUT, 'body.bin'), 'wb') as f:
    f.write(buf)
with open(os.path.join(OUT, 'body.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print('vertices', len(used), 'bytes', len(buf))
