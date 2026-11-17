"""Donne des doigts qui se referment aux mains du visiteur (assets/models/corps.glb).

    python tools/mains.py

Le modèle n'a pas de squelette : chaque main est un bloc de peau rigide au bout de l'avant-bras. Ce script calcule, pour chacune,
la position de ses sommets quand la main se referme sur une barre (flexion des quatre doigts en trois articulations, pouce ramené
vers la paume) et l'inscrit dans le fichier comme « cible de déformation » (morph target glTF, nommée « prise »). Le décor règle
ensuite l'ouverture de la main entre 0 (à plat) et 1 (refermée) : app/corps.js, tableau GRIP.

À relancer après tools/humains_blender.py (qui réécrit corps.glb sans cible). Prérequis : pip install numpy.
"""
import json
import struct

import numpy as np

PATH = "assets/models/corps.glb"
# articulations des doigts, en mètres depuis le poignet le long de la main, et angles de fermeture (degrés)
JOINTS = ((0.108, 52), (0.150, 68), (0.180, 34))
BLEND = 0.013      # demi-largeur de la zone où le pli s'installe (évite une cassure nette)
THUMB = 32         # rotation du pouce vers la paume (degrés)

raw = open(PATH, "rb").read()
jlen = struct.unpack_from("<I", raw, 12)[0]
G = json.loads(raw[20:20 + jlen])
BIN = bytearray(raw[20 + jlen + 8:])
DT = {5126: "<f4", 5123: "<u2", 5125: "<u4"}


def acc(i):
    a = G["accessors"][i]
    bv = G["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC3": 3}[a["type"]]
    return np.frombuffer(bytes(BIN), DT[a["componentType"]], a["count"] * n, bv.get("byteOffset", 0) + a.get("byteOffset", 0)).reshape(-1, n)


def add_vec3(data, with_bounds):
    while len(BIN) % 4:
        BIN.append(0)
    G["bufferViews"].append({"buffer": 0, "byteOffset": len(BIN), "byteLength": data.size * 4})
    BIN.extend(data.astype("<f4").tobytes())
    a = {"bufferView": len(G["bufferViews"]) - 1, "componentType": 5126, "count": len(data), "type": "VEC3"}
    if with_bounds:
        a["min"], a["max"] = data.min(0).astype(float).tolist(), data.max(0).astype(float).tolist()
    G["accessors"].append(a)
    return len(G["accessors"]) - 1


def zeros(count):
    """Accesseur sans données : tout à zéro (les autres morceaux de l'avant-bras ne bougent pas)."""
    G["accessors"].append({"componentType": 5126, "count": int(count), "type": "VEC3", "min": [0, 0, 0], "max": [0, 0, 0]})
    return len(G["accessors"]) - 1


def smooth(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1)
    return k * k * (3 - 2 * k)


def normals(P, F):
    n = np.zeros_like(P)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3):
        np.add.at(n, F[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def weld(P):
    """Les sommets confondus (bords de lissage) doivent bouger ensemble : indice du représentant de chacun."""
    key = np.round(P * 2e4).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    return inv.reshape(-1)


def close_hand(P, side):
    """side : +1 main droite, -1 main gauche (le pouce est du côté side * lat)."""
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    a = vt[0] if vt[0][1] < 0 else -vt[0]                      # axe poignet -> doigts
    n = vt[2] if vt[2][0] * side > 0 else -vt[2]               # normale de la paume : bras le long du corps, elle regarde vers le corps
    lat = np.cross(a, n) * (1 if np.cross(a, n)[2] * side > 0 else -1)   # vers le pouce (l'avant, bras le long du corps)
    t = (P - c) @ a
    t0 = t.min()
    t = t - t0
    s = (P - c) @ lat
    h = (P - c) @ n
    thumb = smooth(0.034, 0.05, s) * (1 - smooth(0.118, 0.134, t))   # 1 sur le pouce, 0 ailleurs
    tt, hh, ss = t.copy(), h.copy(), s.copy()
    for tj, deg in reversed(JOINTS):                            # de la dernière phalange vers la paume
        w = smooth(tj - BLEND, tj + BLEND, t) * (1 - thumb)
        near = (np.abs(t - tj) < 0.012) & (thumb < 0.2)
        hj = np.median(h[near]) if near.any() else 0.0
        th = np.radians(deg) * w
        dt, dh = tt - tj, hh - hj
        tt = tj + dt * np.cos(th) - dh * np.sin(th)
        hh = hj + dt * np.sin(th) + dh * np.cos(th)
    th = np.radians(THUMB) * thumb                              # le pouce pivote autour de l'axe de la main, vers la paume
    ds, dh = ss - 0.03, hh
    ss = 0.03 + ds * np.cos(th) - dh * np.sin(th)
    hh = ds * np.sin(th) + dh * np.cos(th)
    return c + np.outer(tt + t0, a) + np.outer(ss, lat) + np.outer(hh, n)


done = 0
for node in G["nodes"]:
    if not node["name"].startswith("avant_bras_"):
        continue
    side = 1 if node["name"].endswith("_d") else -1
    mesh = G["meshes"][node["mesh"]]
    for prim in mesh["primitives"]:
        prim.pop("targets", None)
        count = G["accessors"][prim["attributes"]["POSITION"]]["count"]
        if G["materials"][prim["material"]]["name"] != "peau":
            prim["targets"] = [{"POSITION": zeros(count), "NORMAL": zeros(count)}]
            continue
        P = acc(prim["attributes"]["POSITION"]).astype(np.float64)
        F = acc(prim["indices"]).reshape(-1, 3).astype(np.int64)
        inv = weld(P)
        Q = close_hand(P, side)
        Fw = inv[F]                                             # normales calculées sur le maillage soudé, pour un lissage continu
        Pw, Qw = np.zeros((inv.max() + 1, 3)), np.zeros((inv.max() + 1, 3))
        Pw[inv], Qw[inv] = P, Q
        dn = (normals(Qw, Fw) - normals(Pw, Fw))[inv]
        prim["targets"] = [{"POSITION": add_vec3(Q - P, True), "NORMAL": add_vec3(dn, False)}]
        print(node["name"], ":", len(P), "sommets, déplacement maximal", round(float(np.linalg.norm(Q - P, axis=1).max()) * 100, 1), "cm")
        done += 1
    mesh["weights"] = [0.0]
    mesh.setdefault("extras", {})["targetNames"] = ["prise"]

assert done == 2, "mains introuvables"
while len(BIN) % 4:
    BIN.append(0)
G["buffers"][0]["byteLength"] = len(BIN)
js = json.dumps(G, separators=(",", ":")).encode("utf-8")
js += b" " * (-len(js) % 4)
with open(PATH, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(BIN)))
    f.write(struct.pack("<I4s", len(js), b"JSON")); f.write(js)
    f.write(struct.pack("<I4s", len(BIN), b"BIN\0")); f.write(bytes(BIN))
print("corps.glb mis à jour :", (12 + 16 + len(js) + len(BIN)) // 1024, "Ko")
