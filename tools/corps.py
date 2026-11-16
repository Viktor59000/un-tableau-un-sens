"""Prépare les corps humains de l'expérience à partir du mannequin Xbot (Mixamo, exemples three.js).

    python tools/corps.py

Lit tools/sources/Xbot.glb, applique la pose « idle » (calcul du skinning hors ligne), puis écrit :
  assets/models/sleeper.bin  corps allongé sans tête (la tête scannée est posée dessus), allégé à ~7 000 triangles,
                             déjà dans le repère du caisson : tête vers -X, dos à y = 0, cou coupé en x = -0,735
  assets/models/echo.bin     nuages de points de visiteurs debout (3 poses), pour les « échos » de la galerie

Formats (little endian) :
  sleeper.bin  Uint32 nSommets, Uint32 nIndices, Float32 xyz[nSommets], Uint8 rgba[nSommets], Uint32 indices[nIndices]
  echo.bin     Uint32 nPoses, Uint32 nPoints, Float32 xyz[nPoses][nPoints]   (pieds à y = 0, regard vers +Z)

Prérequis : pip install numpy fast-simplification
"""
import json
import struct

import fast_simplification
import numpy as np

SRC = "tools/sources/Xbot.glb"
NECK_X = -0.735
CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

raw = open(SRC, "rb").read()
jlen = struct.unpack_from("<I", raw, 12)[0]
G = json.loads(raw[20:20 + jlen])
BIN = raw[20 + jlen + 8:]


def acc(i):
    a = G["accessors"][i]
    bv = G["bufferViews"][a["bufferView"]]
    dt = np.dtype("<" + CT[a["componentType"]])
    n = NC[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or dt.itemsize * n
    if stride == dt.itemsize * n:
        out = np.frombuffer(BIN, dt, a["count"] * n, off).reshape(a["count"], n)
    else:
        out = np.stack([np.frombuffer(BIN, dt, n, off + k * stride) for k in range(a["count"])])
    out = out.astype(np.float64) if a["componentType"] == 5126 else out
    if a.get("normalized"):
        out = out / float(np.iinfo(dt).max)
    return out


def trs(t, r, s):
    x, y, z, w = r
    m = np.eye(4)
    m[:3, :3] = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) * np.array(s)
    m[:3, 3] = t
    return m


NODES = G["nodes"]
PARENT = {c: i for i, n in enumerate(NODES) for c in n.get("children", [])}
NAME = {n["name"]: i for i, n in enumerate(NODES)}


def pose(clip, frac):
    """Matrices globales de tous les nœuds pour l'animation « clip » à la fraction « frac » de sa durée."""
    loc = [dict(t=n.get("translation", [0, 0, 0]), r=n.get("rotation", [0, 0, 0, 1]), s=n.get("scale", [1, 1, 1])) for n in NODES]
    an = next(a for a in G["animations"] if a["name"] == clip)
    for ch in an["channels"]:
        sm = an["samplers"][ch["sampler"]]
        times, vals = acc(sm["input"])[:, 0], acc(sm["output"])
        k = int(np.argmin(np.abs(times - times[-1] * frac)))
        loc[ch["target"]["node"]][{"translation": "t", "rotation": "r", "scale": "s"}[ch["target"]["path"]]] = vals[k]
    glob = {}

    def g(i):
        if i not in glob:
            m = trs(loc[i]["t"], loc[i]["r"], loc[i]["s"])
            glob[i] = g(PARENT[i]) @ m if i in PARENT else m
        return glob[i]
    return [g(i) for i in range(len(NODES))]


def skinned(glob):
    """Renvoie [(nom, sommets posés, triangles)] pour chaque maillage."""
    out = []
    for n in NODES:
        if "mesh" not in n:
            continue
        sk = G["skins"][n["skin"]]
        ibm = acc(sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        jm = np.stack([glob[j] @ ibm[k] for k, j in enumerate(sk["joints"])])
        for p in G["meshes"][n["mesh"]]["primitives"]:
            v = acc(p["attributes"]["POSITION"])
            vh = np.concatenate([v, np.ones((len(v), 1))], 1)
            ji, w = acc(p["attributes"]["JOINTS_0"]).astype(int), acc(p["attributes"]["WEIGHTS_0"]).astype(np.float64)
            w = w / w.sum(1, keepdims=True)
            res = np.zeros((len(v), 3))
            for c in range(4):
                res += w[:, c:c + 1] * np.einsum("nij,nj->ni", jm[ji[:, c]], vh)[:, :3]
            out.append((n["name"], res, acc(p["indices"]).reshape(-1, 3).astype(np.int64)))
    return out


def bone(glob, name):
    return glob[NAME["mixamorig:" + name]][:3, 3]


# ---------------------------------------------------------------- dormeur
glob = pose("idle", 0.0)
neck, head = bone(glob, "Neck"), bone(glob, "Head")
ycut = neck[1] + (head[1] - neck[1]) * 0.55
hands = [bone(glob, "LeftHand"), bone(glob, "RightHand")]
ankle = min(bone(glob, "LeftFoot")[1], bone(glob, "RightFoot")[1])
shoulder = bone(glob, "LeftArm")
hips = bone(glob, "Hips")
print("cou", neck.round(3), "tête", head.round(3), "coupe y =", round(ycut, 3), "cheville", round(ankle, 3), "épaule", shoulder.round(3))

SUIT, SUIT2, DARK, ACC = (0.17, 0.22, 0.28), (0.095, 0.125, 0.165), (0.03, 0.035, 0.045), (0.95, 0.45, 0.22)
P, C, I, base = [], [], [], 0
for name, v, f in skinned(glob):
    f = f[(v[f][:, :, 1] < ycut).all(1)]                       # on retire la tête : elle est remplacée par un visage scanné
    used = np.unique(f)
    remap = -np.ones(len(v), int)
    remap[used] = np.arange(len(used))
    v, f = v[used], remap[f]
    target = 5200 if "Surface" in name else 1900
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_count=target, agg=4)
    v2 = v2.astype(np.float64)
    col = np.tile(SUIT if "Surface" in name else DARK, (len(v2), 1)).astype(np.float64)
    if "Surface" in name:
        x, y = v2[:, 0], v2[:, 1]
        torso = (y > hips[1] - 0.05) & (y < shoulder[1] + 0.03) & (np.abs(x) < 0.2)
        col[torso & (np.abs(x) > 0.105)] = SUIT2                                  # flancs plus sombres
        col[(y > hips[1] - 0.02) & (y < hips[1] + 0.035) & (np.abs(x) < 0.2)] = DARK   # ceinture
        col[y < ankle + 0.17] = DARK                                              # bottes
        for h in hands:
            col[np.linalg.norm(v2 - h, axis=1) < 0.13] = DARK                    # gants
            col[(np.linalg.norm(v2 - h, axis=1) < 0.16) & (np.linalg.norm(v2 - h, axis=1) >= 0.13)] = SUIT2
        col[(x > 0.14) & (y < shoulder[1] - 0.1) & (y > shoulder[1] - 0.128)] = ACC   # brassard d'identification, bras gauche
    P.append(v2); C.append(col); I.append(f2.astype(np.int64) + base); base += len(v2)
    print(" ", name, len(v), "→", len(v2), "sommets,", len(f2), "triangles")
P, C, I = np.concatenate(P), np.concatenate(C), np.concatenate(I)
lying = np.stack([NECK_X - (P[:, 1] - ycut), P[:, 2] - P[:, 2].min(), -(P[:, 0] - neck[0])], 1)   # debout (x,y,z) → allongé : Y→-X, Z→+Y, X→-Z
print("  cou allongé : y =", round(neck[2] - P[:, 2].min(), 3), "· pieds en x =", round(lying[:, 0].max(), 3), "· épaisseur", round(lying[:, 1].max(), 3))
rgba = np.concatenate([np.clip(C * 255, 0, 255), np.full((len(C), 1), 255)], 1).astype(np.uint8)
with open("assets/models/sleeper.bin", "wb") as f:
    f.write(struct.pack("<II", len(lying), I.size))
    f.write(lying.astype("<f4").tobytes()); f.write(rgba.tobytes()); f.write(I.astype("<u4").tobytes())
print("sleeper.bin :", len(lying), "sommets,", len(I), "triangles")

# ---------------------------------------------------------------- échos de visiteurs (nuages de points)
rng = np.random.default_rng(7)
NPT = 2600
clouds = []
for clip, frac in (("idle", 0.0), ("walk", 0.3), ("sad_pose", 0.0)):
    parts = skinned(pose(clip, frac))
    v = np.concatenate([p[1] for p in parts])
    off, tri = 0, []
    for _, pv, pf in parts:
        tri.append(pf + off); off += len(pv)
    tri = np.concatenate(tri)
    a, b, c = v[tri[:, 0]], v[tri[:, 1]], v[tri[:, 2]]
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1)
    pick = rng.choice(len(tri), NPT, p=area / area.sum())
    r1, r2 = np.sqrt(rng.random(NPT))[:, None], rng.random(NPT)[:, None]
    pts = (1 - r1) * a[pick] + r1 * (1 - r2) * b[pick] + r1 * r2 * c[pick]
    pts[:, 0] -= pts[:, 0].mean(); pts[:, 2] -= pts[:, 2].mean(); pts[:, 1] -= pts[:, 1].min()
    clouds.append(pts)
    print("écho", clip, "hauteur", round(pts[:, 1].max(), 2))
with open("assets/models/echo.bin", "wb") as f:
    f.write(struct.pack("<II", len(clouds), NPT))
    for pts in clouds:
        f.write(pts.astype("<f4").tobytes())
print("echo.bin :", len(clouds), "poses ×", NPT, "points")
