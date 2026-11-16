// SPES — danse sensorielle : la galerie Ceysson & Bénétière reconstituée, projetée en hologramme dans le cortex du visiteur.
// Les volumes sont réels (murs, mobilier, reflets du sol) mais rendus comme une projection : surfaces de verre sombre, arêtes
// lumineuses, balayage. Seules les quatre œuvres ont leur matière et leur couleur. `?reel` montre la variante en cube blanc.
// Références : vues de l'exposition « Résonances » publiées par la galerie (murs blancs, sol gris brillant qui reflète
// les œuvres, plafond blanc à cadres de LED et rails de projecteurs, façade vitrée à montants noirs, socles blancs).
// Le plan (enveloppe, cimaises, escalier, niveau 1, place des œuvres) reste celui du parcours — voir REPRISE.md.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PLUMES } from './plumes.js';

const PI = Math.PI, V3 = THREE.Vector3;
const DSY = -400, GH = 6, L1 = 3.2;
const INK = '#39424c'; let HOLO = true;
// en hologramme, les lettrages sombres deviennent clairs ; les teintes des œuvres restent, éclaircies
const holoInk = (c) => { const k = new THREE.Color(c), h = {}; k.getHSL(h); return '#' + (h.s < 0.3 ? k.setRGB(0.62, 0.84, 0.9) : k.setHSL(h.h, Math.min(1, h.s * 1.1), Math.max(h.l, 0.62))).getHexString(); };

// tirage reproductible : le décor est identique d'un chargement à l'autre
let seed = 20261121;
const rnd = (a = 1, b) => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296; return b === undefined ? r * a : a + r * (b - a); };
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const std = (o) => new THREE.MeshStandardMaterial(o);

/* ------------------------------------------------------------------ textures dessinées */
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
// texte à l'encre (lettrage adhésif, cartels) : sombre sur mur clair
function inkText(lines, { color = INK, w = 512, size = 40, sub = 22, scale = 1, align = 'left', lh = 1.3, font = 'Rajdhani', weight = 600, track = 0 } = {}) {
  const h = Math.ceil(size * 1.45 + (lines.length - 1) * sub * lh + 10), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (HOLO) color = holoInk(color);
  g.textBaseline = 'middle'; g.textAlign = align; const x = align === 'center' ? w / 2 : align === 'right' ? w - 6 : 6; g.fillStyle = color;
  if (track && 'letterSpacing' in g) g.letterSpacing = track + 'px';
  g.font = `${weight} ${size}px "${font}", sans-serif`; g.fillText(lines[0], x, size * 0.74);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.globalAlpha = 0.82; g.font = `500 ${sub}px Rajdhani, sans-serif`; for (let i = 1; i < lines.length; i++) g.fillText(lines[i], x, size * 1.45 + (i - 0.5) * sub * lh);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * h / w), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: HOLO ? 0xb4b4b4 : 0xffffff }));
  m.userData.h = scale * h / w; return m;
}
// une plume dans une case de 256 × 512 : rouge = nuance des barbes, vert = rachis (éclairci), alpha = matière
function drawFeather(g, kind, CW, CH) {
  const bx = CW / 2, by = CH - 26, L = by - 30, bend = rnd(-1, 1) * (kind === 2 ? 36 : kind === 3 ? 46 : 14), wob = kind === 3 ? rnd(8, 20) : 0;
  const R = (t) => [bx + bend * Math.sin(t * PI * 0.85) + wob * Math.sin(t * 9), by - L * t];
  const T = (t) => { const a = R(t - 0.01), b = R(t + 0.01), dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy); return [dx / n, dy / n]; };
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const barb = (t, side, ang, len, alpha, curl = 0.3) => { const p = R(t), tg = T(t), d = rot(tg, side * ang), sh = 175 + (rnd(80) | 0);
    g.strokeStyle = `rgba(${sh},0,0,${alpha})`; g.beginPath(); g.moveTo(p[0], p[1]);
    g.quadraticCurveTo(p[0] + d[0] * len * 0.55 + tg[0] * len * 0.1, p[1] + d[1] * len * 0.55 + tg[1] * len * 0.1, p[0] + d[0] * len + tg[0] * len * curl, p[1] + d[1] * len + tg[1] * len * curl); g.stroke(); };
  const wisp = (t, ang, len, alpha) => { let p = R(t), d = rot(T(t), ang); g.strokeStyle = `rgba(${185 + (rnd(70) | 0)},0,0,${alpha})`; g.beginPath(); g.moveTo(p[0], p[1]); const n = 7, cu = rnd(-0.22, 0.22);
    for (let i = 0; i < n; i++) { d = rot(d, cu + rnd(-0.12, 0.12)); p = [p[0] + d[0] * len / n, p[1] + d[1] * len / n]; g.lineTo(p[0], p[1]); } g.stroke(); };
  g.lineCap = 'round'; g.lineWidth = 1.7;
  if (kind === 0 || kind === 2) { // plume à étendard (large) ou plume fine : barbes serrées, fendues par endroits
    const HW = kind === 0 ? rnd(50, 62) : rnd(20, 27), N = kind === 0 ? 240 : 170, t0 = 0.14;
    for (const side of [-1, 1]) { let off = 0, next = 0, asym = side < 0 ? rnd(0.78, 1) : rnd(0.9, 1.08);
      for (let i = 0; i < N; i++) { const t = t0 + (1 - t0) * (i / N) * 0.985; if (i >= next) { off = rnd(-0.13, 0.13); next = i + rnd(7, 22); if (rnd() < 0.5) continue; }
        const u = (t - t0) / (1 - t0), hw = HW * Math.pow(Math.sin(PI * Math.pow(u, 0.72)), 0.62) * asym + 2, ang = 0.86 - u * 0.36 + off; barb(t, side, ang, hw / Math.sin(ang) * rnd(0.9, 1.04), 0.82, 0.26 + off); } }
    for (let i = 0; i < (kind === 0 ? 70 : 34); i++) wisp(rnd(0.04, 0.2), (rnd() < 0.5 ? -1 : 1) * rnd(0.7, 1.7), rnd(22, kind === 0 ? 78 : 44), 0.34); // duvet à la base
  } else if (kind === 1) { // duvet : touffe de barbes longues et libres
    for (let i = 0; i < 330; i++) { const t = rnd(0.04, 0.5); wisp(t, (rnd() < 0.5 ? -1 : 1) * rnd(0.12, 1.25), rnd(110, 330) * (1 - t * 0.5), 0.3); }
  } else { for (let i = 0; i < 22; i++) { const t = rnd(0.55, 0.98); barb(t, rnd() < 0.5 ? -1 : 1, rnd(0.5, 0.9), rnd(8, 22), 0.5); } } // barbe isolée, presque un fil
  const stop = kind === 1 ? 0.42 : 1, seg = 44; // rachis : épais à la base, effilé vers la pointe
  for (let i = 0; i < seg; i++) { const a = R(stop * i / seg), b = R(stop * (i + 1) / seg); g.strokeStyle = 'rgba(255,255,0,.95)'; g.lineWidth = (kind === 3 ? 1.7 : 3.1) * (1 - (i / seg) * 0.8) + 0.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
}
function featherAtlas() {
  const CW = 256, CH = 512, c = document.createElement('canvas'); c.width = CW * 4; c.height = CH * 2; const g = c.getContext('2d');
  for (let k = 0; k < 8; k++) { g.save(); g.translate((k % 4) * CW, ((k / 4) | 0) * CH); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); drawFeather(g, k % 4, CW, CH); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
function barkTex() { // écorce : stries verticales irrégulières (relief)
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#777'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) { const x = rnd(256), y = rnd(512), l = rnd(20, 150), v = rnd() < 0.5 ? 20 : 215; g.strokeStyle = `rgba(${v},${v},${v},${rnd(0.15, 0.5)})`; g.lineWidth = rnd(0.6, 3); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + rnd(-5, 5), y + l * 0.3, x + rnd(-5, 5), y + l * 0.6, x + rnd(-4, 4), y + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function foliageTex() { // arbre vu à contre-jour derrière la façade
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.strokeStyle = '#2a2118'; g.lineCap = 'round'; g.lineWidth = 16; g.beginPath(); g.moveTo(256, 512); g.quadraticCurveTo(250, 380, 262, 250); g.stroke();
  for (let i = 0; i < 9; i++) { g.lineWidth = rnd(3, 8); g.beginPath(); g.moveTo(258, rnd(260, 400)); g.quadraticCurveTo(256 + rnd(-90, 90), rnd(200, 300), 256 + rnd(-170, 170), rnd(90, 240)); g.stroke(); }
  for (let i = 0; i < 2600; i++) { const a = rnd(PI * 2), r = Math.pow(rnd(), 0.6) * 215, x = 256 + Math.cos(a) * r * 1.02, y = 205 + Math.sin(a) * r * 0.86, v = rnd();
    g.fillStyle = `rgba(${(38 + v * 70) | 0},${(66 + v * 88) | 0},${(30 + v * 34) | 0},${rnd(0.35, 0.9)})`; g.beginPath(); g.ellipse(x, y, rnd(3, 10), rnd(2, 6), rnd(PI), 0, PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildGallery({ scene, loader, works, TX, W, upd, U, lite, touch, reel }) {
  HOLO = !reel;
  const ds = new THREE.Group(); ds.position.y = DSY; ds.visible = false; scene.add(ds); W.ds = ds; W.DSY = DSY;
  const soft = softTex(), mirrorY = { value: DSY }, MIRROR = !lite;
  const P = (x, z, y = 0) => new V3(x, y, z);

  /* ================================================================ matières */
  // modelé des murs : plus sombre au ras du sol et sous le plafond (la lumière vient du haut, le sol la renvoie)
  const shade = (mat, lo = 0.8) => { mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n float gy=vWp.y-(${DSY.toFixed(1)}); diffuseColor.rgb*=mix(${lo.toFixed(2)},1.,smoothstep(0.,1.8,gy))*mix(1.,.9,smoothstep(${(GH - 1.6).toFixed(1)},${GH.toFixed(1)},gy));`); };
    mat.customProgramCacheKey = () => 'shade' + lo; return mat; };
  const mWall = shade(std({ color: 0xefeeea, roughness: 0.94, envMapIntensity: 0.18 }));
  const mCeil = std({ color: 0xf3f3f0, roughness: 0.96, envMapIntensity: 0.12 });
  const mWhite = std({ color: 0xf4f4f2, roughness: 0.55, envMapIntensity: 0.3 });                      // socles, banque d'accueil
  const mDark = std({ color: 0x16181b, roughness: 0.42, metalness: 0.65, envMapIntensity: 0.6 });      // acier noir des menuiseries
  const mOak = std({ color: 0xb48c5e, roughness: 0.6, envMapIntensity: 0.3 });
  const mGrey = std({ color: 0xa4a8ab, roughness: 0.72, envMapIntensity: 0.2 });                       // sol mat du niveau 1
  const mAsph = std({ color: 0x4a4e53, roughness: 0.96, envMapIntensity: 0.1 });
  const mPave = std({ color: 0x9c9e9f, roughness: 0.9, envMapIntensity: 0.1 });
  const mBistro = std({ color: 0x1f4a3c, roughness: 0.35, envMapIntensity: 0.6 });                      // carrelage vert du comptoir du Bistrot
  const mGlass = std({ color: 0xcfe6ee, transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0.1, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide });
  const mLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(2.7) });
  const mWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.4).multiplyScalar(3) });
  const mExit = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1, 0.45).multiplyScalar(1.6) });
  const mPly = std({ color: 0xd9bd8c, roughness: 0.62, envMapIntensity: 0.25 });                        // contreplaqué clair des meubles de librairie
  // projection holographique : la matière devient un verre sombre qui luit en vue rasante, traversé par un balayage lent
  const holoT = { value: 0 }; W.timeU.push(holoT);
  const holo = (mat, hex, tint = 0x8fdfe8, k = 1) => { mat.color.setHex(hex); mat.envMapIntensity = 0.3; const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '', tc = new THREE.Color(tint).multiplyScalar(k);
    mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uHT = holoT; sh.uniforms.uHC = { value: tc };
      sh.vertexShader = 'varying vec3 vHw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vHw=(modelMatrix*vec4(position,1.)).xyz;');
      sh.fragmentShader = 'varying vec3 vHw;uniform float uHT;uniform vec3 uHC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float hf=pow(1.-clamp(abs(dot(normalize(vViewPosition),normal)),0.,1.),2.5); float hs=smoothstep(.9996,1.,sin(vHw.y*1.25-uHT*.45+vHw.x*.06+vHw.z*.04)*.5+.5); totalEmissiveRadiance+=uHC*(hf*.2+hs*.08+.018);'); };
    mat.customProgramCacheKey = () => key + '|holo'; return mat; };
  if (HOLO) { holo(mWall, 0x0a1017); holo(mCeil, 0x070b10, 0x8fdfe8, 0.6); holo(mWhite, 0x121c25, 0xa8e8f0, 1.3); holo(mDark, 0x05070a, 0x7fe3e6, 0.8); holo(mOak, 0x1a140d, 0xffc98a, 1.1); holo(mPly, 0x1c1710, 0xffd9a0, 1.2);
    holo(mGrey, 0x0c1117); holo(mAsph, 0x04070a, 0x8fdfe8, 0.3); holo(mPave, 0x070b10, 0x8fdfe8, 0.5); holo(mBistro, 0x0b1f18, 0x6fe0b0, 1.1); mLed.color.setRGB(0.72, 0.96, 1).multiplyScalar(1.9); }
  const mEdge = new THREE.LineBasicMaterial({ color: 0xa6e6ee, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }); // arêtes lumineuses des volumes

  /* ================================================================ reflets : chaque objet a un jumeau dessiné sous le sol */
  // Le jumeau garde la position et l'éclairage de l'original ; seule sa projection est retournée par rapport au plan du sol.
  const MIR = `\n vec4 mirW=vec4(transformed,1.);\n#ifdef USE_INSTANCING\n mirW=instanceMatrix*mirW;\n#endif\n mirW=modelMatrix*mirW; mirW.y=2.*uMirrorY-mirW.y; gl_Position=projectionMatrix*viewMatrix*mirW;`;
  const mirCache = new Map();
  function mirrorMat(src) {
    if (mirCache.has(src)) return mirCache.get(src);
    const m = src.clone(), prev = src.onBeforeCompile, key = src.customProgramCacheKey ? src.customProgramCacheKey() : '';
    if (src.side === THREE.FrontSide) m.side = THREE.BackSide;
    m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uMirrorY = mirrorY;
      sh.vertexShader = 'uniform float uMirrorY;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n#ifdef FLIP_SIDED\n transformedNormal=-transformedNormal;\n#endif').replace('#include <project_vertex>', '#include <project_vertex>' + MIR); };
    m.customProgramCacheKey = () => 'mir|' + key; mirCache.set(src, m); return m;
  }
  function twin(mesh) { // à appeler une fois la matière de l'original entièrement configurée
    if (!MIRROR) return null; let t;
    if (mesh.isInstancedMesh) { t = new THREE.InstancedMesh(mesh.geometry, mirrorMat(mesh.material), mesh.count); t.instanceMatrix = mesh.instanceMatrix; t.instanceColor = mesh.instanceColor; }
    else if (mesh.isSkinnedMesh) { t = new THREE.SkinnedMesh(mesh.geometry, mirrorMat(mesh.material)); t.bind(mesh.skeleton, mesh.bindMatrix); }
    else t = new THREE.Mesh(mesh.geometry, mirrorMat(mesh.material));
    t.frustumCulled = false; t.userData.twin = true; t.receiveShadow = mesh.receiveShadow; t.renderOrder = -2;
    if (mesh.isSkinnedMesh) mesh.parent.add(t); else mesh.add(t); return t;
  }

  /* ================================================================ architecture : volumes fusionnés par matière */
  const buckets = new Map();
  const put = (mat, geo) => { if (!buckets.has(mat)) buckets.set(mat, []); const g = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); buckets.get(mat).push(g); };
  const box = (mat, w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); put(mat, g); };
  const span = (mat, x1, x2, y1, y2, z1, z2) => box(mat, Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1), (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); // boîte donnée par ses bornes
  const cyl = (mat, r1, r2, h, x, y, z, seg = 16, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); put(mat, g); };

  // --- enveloppe (faces intérieures : x -15,2 … 15,3 · z 0 … -32,3 ; renfoncement du Bistrot à l'ouest)
  const GX0 = -12.2, GX1 = -2, GTOP = 5.2, DX0 = -8.05, DX1 = -6.15; // façade vitrée et porte d'entrée
  span(mWall, -19, GX0, 0, GH + 0.3, 0, 0.4); span(mWall, GX1, 15.7, 0, GH + 0.3, 0, 0.4); span(mWall, GX0, GX1, GTOP, GH + 0.3, 0, 0.4);
  span(mWall, -15.6, -15.2, 0, GH, 0, -11.5); span(mWall, -15.6, -15.2, 0, GH, -18.9, -32.3); span(mWall, -15.6, -15.2, 3.4, GH, -11.5, -18.9);       // ouest + linteau du Bistrot
  span(mWall, -19, -18.6, 0, 3.4, -11.1, -19.3); span(mWall, -18.6, -15.2, 0, 3.4, -11.5, -11.1); span(mWall, -18.6, -15.2, 0, 3.4, -18.9, -19.3); // renfoncement ouest : un couloir où l'accrochage continue
  span(mCeil, -19, -15.2, 3.4, 3.7, -11.1, -19.3);
  span(mWall, -15.6, 15.7, 0, GH, -32.3, -32.7); span(mWall, 15.3, 15.7, 0, GH, 0, -32.7);
  span(mCeil, -19, 15.7, GH, GH + 0.3, 0.4, -32.7);
  // --- cimaises (40 cm d'épaisseur, 4,20 m de haut)
  for (const [x1, z1, x2, z2] of [[-0.8, -22.5, -0.8, -29.5], [-11.2, -20, -2, -20], [1.7, -20, 10, -20], [-0.8, -10.9, -0.8, -16.7], [1.7, -9.7, 6.2, -9.7]])
    if (x1 === x2) span(mWall, x1 - 0.2, x1 + 0.2, 0, 4.2, z1, z2); else span(mWall, x1, x2, 0, 4.2, z1 - 0.2, z1 + 0.2);
  // --- niveau 1 : dalle, murs de la salle haute, local fermé dessous
  span(mCeil, 7.2, 15.3, L1 - 0.3, L1 - 0.012, 0, -13); span(mGrey, 7.2, 15.3, L1 - 0.012, L1, 0, -13);
  span(mWall, 7.05, 7.35, 0, GH, -3.5, -13); span(mWall, 7.05, 15.3, 0, GH, -12.85, -13.15); span(mWall, 7.2, 15.3, 0, L1 - 0.3, -3.35, -3.65);
  span(mWhite, 7.05, 7.2, L1 - 0.3, L1, 0, -3.5);                                                              // rive de la dalle
  // --- escalier : volée droite, marches en chêne sur un fût blanc, garde-corps en acier noir
  { const n = 16, run = 4.6 / n, rise = L1 / n;
    for (let i = 0; i < n; i++) { const x = 2.6 + i * run; span(mWhite, x, x + run, 0, (i + 1) * rise - 0.03, -1.4, -3.0); span(mOak, x - 0.02, x + run, (i + 1) * rise - 0.03, (i + 1) * rise, -1.38, -3.02); }
    const ang = Math.atan2(L1, 4.6), len = Math.hypot(L1, 4.6);
    for (const z of [-1.4, -3.0]) { const g = new THREE.BoxGeometry(len + 0.3, 0.04, 0.05); g.rotateZ(ang); g.translate(2.6 + 2.3, L1 / 2 + 1.0, z); put(mDark, g);
      for (let i = 0; i <= n; i += 2) { const x = 2.6 + i * run + 0.05; span(mDark, x - 0.012, x + 0.012, i * rise, i * rise + 1.0, z - 0.012, z + 0.012); } }
    for (const [za, zb] of [[0, -1.36], [-3.04, -3.5]]) { span(mDark, 7.24, 7.28, L1 + 1.0, L1 + 1.04, za, zb); for (let z = za; z >= zb - 0.01; z -= 0.34) span(mDark, 7.25, 7.27, L1, L1 + 1.0, z - 0.01, z + 0.01); } }
  // --- façade : montants et traverses noirs, porte à deux vantaux ouverte
  span(mDark, GX0, GX1, -0.2, 0.001, 0, 0.4);                                                                                                                  // seuil
  { for (let x = GX0; x <= GX1 + 0.01; x += (GX1 - GX0) / 10) span(mDark, x - 0.04, x + 0.04, x > DX0 + 0.1 && x < DX1 - 0.1 ? 2.55 : 0, GTOP, 0.1, 0.3); // pas de montant dans le passage de la porte
    for (const y of [0.04, 2.55, GTOP - 0.04]) { span(mDark, GX0, DX0, y - 0.04, y + 0.04, 0.1, 0.3); span(mDark, DX1, GX1, y - 0.04, y + 0.04, 0.1, 0.3); }
    span(mDark, DX0, DX1, 2.51, 2.59, 0.1, 0.3); span(mDark, DX0, DX1, GTOP - 0.08, GTOP, 0.1, 0.3); span(mDark, DX0 - 0.05, DX0 + 0.05, 0, 2.55, 0.08, 0.32); span(mDark, DX1 - 0.05, DX1 + 0.05, 0, 2.55, 0.08, 0.32);
    for (const [hx, s] of [[DX0, -1], [DX1, 1]]) for (const [w, h, x, y] of [[0.93, 0.07, 0.465, 0.035], [0.93, 0.07, 0.465, 2.465], [0.07, 2.5, 0.035, 1.25], [0.07, 2.5, 0.895, 1.25], [0.03, 0.5, 0.8, 1.1]]) { const g = new THREE.BoxGeometry(w, h, w < 0.05 ? 0.09 : 0.05); g.translate(s * x, y, 0); g.rotateY(s * 1.35); g.translate(hx, 0, 0.3); put(mDark, g); } } // vantaux ouverts vers l'intérieur
  // --- plafond : cadres de LED, rails carrés et projecteurs, bouches d'aération
  const ledRect = (cx, cz, w, d, y = GH - 0.012, t = 0.035) => { span(mLed, cx - w / 2, cx + w / 2, y - 0.02, y, cz - d / 2, cz - d / 2 + t); span(mLed, cx - w / 2, cx + w / 2, y - 0.02, y, cz + d / 2 - t, cz + d / 2); span(mLed, cx - w / 2, cx - w / 2 + t, y - 0.02, y, cz - d / 2, cz + d / 2); span(mLed, cx + w / 2 - t, cx + w / 2, y - 0.02, y, cz - d / 2, cz + d / 2); };
  const track = (cx, cz, w, d, y = GH - 0.04) => { for (const [a, b, c2, e] of [[cx - w / 2, cx + w / 2, cz - d / 2, cz - d / 2 + 0.035], [cx - w / 2, cx + w / 2, cz + d / 2 - 0.035, cz + d / 2], [cx - w / 2, cx - w / 2 + 0.035, cz - d / 2, cz + d / 2], [cx + w / 2 - 0.035, cx + w / 2, cz - d / 2, cz + d / 2]]) span(mDark, a, b, y - 0.03, y + 0.03, c2, e);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0.2, -1]]) { const x = cx + sx * (w / 2 - 0.3), z = cz + sz * (d / 2 - 0.017); cyl(mWhite, 0.045, 0.05, 0.16, x, y - 0.13, z, 12, sz * 0.5); cyl(mDark, 0.012, 0.012, 0.08, x, y - 0.04, z, 6); } };
  for (const [cx, cz, w, d] of [[-10.6, -5.4, 6, 5.6], [-3.6, -5.6, 5.2, 5.6], [-8.2, -14.9, 7.4, 6.2], [3.6, -15, 5.8, 6.4], [11.2, -16.6, 5.4, 4.6], [-8.2, -26.2, 7.6, 7.4], [6.9, -26.3, 9.6, 7.4], [2.9, -4.6, 5.4, 5]]) {
    ledRect(cx, cz, w, d); track(cx, cz, w * 0.52, d * 0.5); span(mDark, cx + w * 0.3, cx + w * 0.3 + 0.9, GH - 0.008, GH - 0.002, cz - d * 0.36, cz - d * 0.36 + 0.07); }
  ledRect(11.25, -6.5, 7.3, 12.2, GH - 0.012, 0.03); track(11.25, -8.2, 4.2, 5.6);                                                                         // salle haute : gorge lumineuse
  // --- mobilier : banque d'accueil, librairie, socles, banc, Bistrot
  // accueil et librairie : une pièce à part, entre la façade vitrée et la nef. Un mur de refend (4,20 m) les sépare, percé de deux passages.
  // Mobilier d'après les photos du lieu : bureau à plateau sombre, meubles de contreplaqué clair sur roulettes, meubles à plans blancs, étagères murales.
  for (const [x1, x2] of [[-15.2, -6.5], [-3.7, -1.0], [6.2, 7.05]]) span(mWall, x1, x2, 0, 4.2, -9.5, -9.9);
  for (const [x1, x2] of [[-6.5, -3.7], [-1.0, 1.7]]) span(mWall, x1, x2, 3, 4.2, -9.5, -9.9);                                                              // linteaux des passages
  span(mWall, -1.0, -0.6, 0, 4.2, -9.9, -10.9);
  span(mDark, -12.5, -10.5, 0.72, 0.75, -2.2, -3.0); for (const [x, z] of [[-12.44, -2.26], [-10.56, -2.26], [-12.44, -2.94], [-10.56, -2.94]]) span(mDark, x - 0.015, x + 0.015, 0, 0.72, z - 0.015, z + 0.015); // bureau d'accueil
  span(mDark, -11.85, -11.3, 0.9, 1.26, -2.52, -2.545); span(mDark, -11.6, -11.55, 0.75, 0.92, -2.5, -2.56); span(mWhite, -12.3, -12.0, 0.75, 0.755, -2.5, -2.92); span(mWhite, -10.95, -10.7, 0.75, 0.78, -2.6, -2.9); // écran, registre, pile de livrets
  cyl(mDark, 0.007, 0.007, 0.42, -12.3, 0.96, -2.35, 6); cyl(mDark, 0.075, 0.05, 0.06, -12.3, 1.19, -2.35, 12); cyl(mDark, 0.06, 0.06, 0.012, -12.3, 0.756, -2.35, 12);                              // lampe
  span(mDark, -11.75, -11.25, 0.44, 0.5, -1.55, -2.0); span(mDark, -11.75, -11.25, 0.5, 0.96, -1.5, -1.55); cyl(mDark, 0.025, 0.025, 0.42, -11.5, 0.23, -1.78, 8); cyl(mDark, 0.27, 0.27, 0.03, -11.5, 0.03, -1.78, 5); // fauteuil
  const UNITS = [[-12.4, -7.3, 0.9, 1.25], [-11.46, -7.3, 0.9, 0.85], [-12.4, -6.36, 0.9, 0.85], [-11.46, -6.36, 0.9, 1.05], [-9.9, -7.0, 1.1, 0.8]], PT = 0.022, PY = 0.09;
  for (const [x, z, s, h] of UNITS) { const a = x - s / 2, b = x + s / 2, c = z - s / 2, d = z + s / 2;                                                    // casiers ouverts des deux côtés, sur roulettes
    span(mPly, a, b, PY, PY + PT, c, d); span(mPly, a, b, PY + h - PT, PY + h, c, d); span(mPly, a, a + PT, PY, PY + h, c, d); span(mPly, b - PT, b, PY, PY + h, c, d); span(mPly, x - PT / 2, x + PT / 2, PY, PY + h, c, d);
    span(mPly, a, b, PY + h * 0.5 - PT / 2, PY + h * 0.5 + PT / 2, c, d); span(mPly, a, b, PY, PY + h, z - PT / 2, z + PT / 2);
    for (const [cx, cz] of [[a + 0.07, c + 0.07], [b - 0.07, c + 0.07], [a + 0.07, d - 0.07], [b - 0.07, d - 0.07]]) cyl(mDark, 0.035, 0.035, 0.03, cx, 0.045, cz, 10, PI / 2); }
  for (const [x1, x2] of [[-14.3, -14.1], [-8.3, -8.1]]) span(mWall, x1, x2, 0, 2.9, -9.5, -6.5);                                                         // la librairie est dans un renfoncement : deux retours de mur
  for (const x of [-12.6, -11.2, -9.8]) { span(mWhite, x - 0.65, x + 0.65, 0.1, 1.12, -9.48, -8.7); span(mDark, x - 0.6, x + 0.6, 0, 0.1, -9.4, -8.78);                                        // meubles à plans : tiroirs larges et plats
    for (let i = 0; i < 9; i++) { const y = 0.1 + i * 0.113; span(mDark, x - 0.63, x + 0.63, y - 0.002, y + 0.002, -8.702, -8.694); span(mDark, x - 0.07, x + 0.07, y + 0.05, y + 0.058, -8.7, -8.682); } }
  const SHELVES = [[-14.1, 1], [-8.3, -1]];                                                                                                                    // [plan du mur, côté où l'étagère avance]
  for (const [xw, d] of SHELVES) { const xa = xw, xb = xw + d * 0.38; for (const z of [-8.78, -6.68]) span(mPly, xa, xb, 0, 2.3, z - 0.015, z + 0.015); for (const y of [0.06, 0.5, 0.94, 1.38, 1.82, 2.27]) span(mPly, xa, xb, y - 0.015, y + 0.015, -8.78, -6.68); } // étagères murales
  span(mPly, -4.7, -2.7, 0.4, 0.45, -0.75, -1.2); for (const x of [-4.6, -2.8]) span(mPly, x - 0.02, x + 0.02, 0, 0.4, -0.78, -1.17);                                                              // banc de l'entrée
  const PLINTHS = [[5.2, -13.6, 1.0, 0.95], [-8.6, -28.4, 1.2, 0.8], [6.6, -24.8, 1.1, 1.0]];
  for (const [x, z, s, h] of PLINTHS) span(mWhite, x - s / 2, x + s / 2, 0, h, z - s / 2, z + s / 2);
  span(mWhite, -9.2, -6.4, 0, 0.44, -31, -31.6);                                                                                                               // banc
  const table = (x, y0, z, lamp) => { cyl(mOak, 0.4, 0.4, 0.035, x, y0 + 0.745, z, 24); cyl(mDark, 0.03, 0.03, 0.72, x, y0 + 0.37, z, 8); cyl(mDark, 0.22, 0.24, 0.02, x, y0 + 0.02, z, 16);                    // guéridon et deux chaises
    for (const s of [-1, 1]) { const cx = x + s * 0.62; span(mDark, cx - 0.2, cx + 0.2, y0 + 0.44, y0 + 0.47, z - 0.2, z + 0.2); span(mDark, cx + s * 0.18, cx + s * 0.2, y0 + 0.47, y0 + 0.86, z - 0.2, z + 0.2); for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) span(mDark, cx + lx - 0.012, cx + lx + 0.012, y0, y0 + 0.44, z + lz - 0.012, z + lz + 0.012); }
    if (lamp) { cyl(mDark, 0.004, 0.004, lamp - 1.98, x, y0 + (lamp + 1.98) / 2, z, 4); cyl(mDark, 0.16, 0.05, 0.16, x, y0 + 1.9, z, 16); const b = new THREE.SphereGeometry(0.05, 10, 8); b.translate(x, y0 + 1.84, z); put(mWarm, b); } };
  for (const x of [9.0, 11.2, 13.4]) table(x, 0, -1.05, L1 - 0.3);                                                                                             // Bistrot : à côté de l'escalier, sous le niveau 1
  for (const [x, z] of [[11.0, -1.7], [13.5, -1.7], [13.6, -11.3]]) table(x, L1, z, 0);                                                                         // tables et chaises du niveau 1
  span(mBistro, 8.2, 12.8, 0, 1.06, -2.95, -2.5); span(mOak, 8.14, 12.86, 1.06, 1.1, -3.0, -2.42); span(mDark, 8.2, 12.8, 0.18, 0.2, -2.5, -2.42);                // comptoir : face carrelée, plateau de chêne, repose-pieds
  for (const x of [8.8, 9.7, 10.6, 11.5, 12.4]) { cyl(mDark, 0.16, 0.16, 0.04, x, 0.76, -2.05, 14); cyl(mDark, 0.02, 0.02, 0.74, x, 0.38, -2.05, 6); cyl(mDark, 0.18, 0.2, 0.02, x, 0.01, -2.05, 12); } // tabourets
  span(mOak, 8.4, 12.7, 1.5, 1.53, -3.35, -3.16); span(mOak, 8.4, 12.7, 1.95, 1.98, -3.35, -3.16);                                                             // étagères à bouteilles
  { const g = new THREE.BoxGeometry(0.55, 0.95, 0.03); g.rotateX(-0.22); g.translate(6.5, 0.47, -4.1); put(mDark, g); const g2 = new THREE.BoxGeometry(0.55, 0.95, 0.03); g2.rotateX(0.22); g2.translate(6.5, 0.47, -4.32); put(mDark, g2); } // ardoise du Bistrot, au pied de l'escalier
  ledRect(-16.9, -15.2, 2.0, 6.0, 3.4 - 0.012, 0.03);                                                                                                           // couloir ouest
  span(mExit, 14.1, 14.5, 2.32, 2.44, -32.28, -32.25); span(mWall, 13.8, 14.8, 0, 2.2, -32.3, -32.27); span(mDark, 13.86, 13.9, 1.02, 1.1, -32.27, -32.22);    // issue de secours
  // --- parvis
  span(mPave, -16, 2, -0.2, 0, 0.4, 7.5);

  const flush = () => { for (const [mat, list] of buckets) { const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = mat !== mLed && mat !== mWarm && mat !== mExit; m.receiveShadow = true; ds.add(m); if (mat !== mPave) twin(m);
      if (HOLO && mat !== mLed && mat !== mWarm && mat !== mExit && mat !== mAsph) { const eg = new THREE.EdgesGeometry(m.geometry, 30), l = new THREE.LineSegments(eg, mEdge); l.frustumCulled = false; m.add(l); // en hologramme, chaque volume est souligné par ses arêtes
        if (MIRROR && mat !== mPave) { const l2 = new THREE.LineSegments(eg, mirrorMat(mEdge)); l2.frustumCulled = false; l2.renderOrder = -2; l2.userData.twin = true; m.add(l2); } } } buckets.clear(); };

  // --- sol du rez-de-chaussée : résine grise brillante, à demi transparente pour laisser voir les jumeaux (reflets)
  const mFloor = std({ color: HOLO ? 0x04070a : 0xc3c7ca, roughness: HOLO ? 0.13 : 0.2, metalness: 0, envMapIntensity: HOLO ? 0.25 : 0.5, transparent: true, depthWrite: false });
  mFloor.onBeforeCompile = (sh) => { sh.uniforms.uHT = holoT; // en hologramme : trame fine au sol, et des ondes qui partent de tes pas
    sh.vertexShader = 'varying vec3 vFw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFw=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vFw;uniform float uHT;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', HOLO ? '#include <emissivemap_fragment>\n { vec2 fg=abs(fract(vFw.xz)-.5); float fl=smoothstep(.488,.5,max(fg.x,fg.y)); vec2 f4=abs(fract(vFw.xz/4.)-.5); float fl4=smoothstep(.4955,.5,max(f4.x,f4.y)); float fd=length(vFw.xz-cameraPosition.xz); float fw=smoothstep(.47,.5,abs(fract(fd*.45-uHT*.3)-.5))*exp(-fd*.3); totalEmissiveRadiance+=vec3(.5,.85,.95)*((fl*.045+fl4*.15)*exp(-fd*.05)+fw*.1); }' : '#include <emissivemap_fragment>')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n float fr=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),2.2); gl_FragColor.a=${MIRROR ? (HOLO ? 'mix(.9,.42,fr)' : 'mix(.84,.36,fr)') : '1.'};`); };
  mFloor.userData.ao = true;
  { const sh = new THREE.Shape(); sh.moveTo(-15.2, 0); sh.lineTo(15.3, 0); sh.lineTo(15.3, 32.3); sh.lineTo(-15.2, 32.3); sh.lineTo(-15.2, 18.9); sh.lineTo(-18.6, 18.9); sh.lineTo(-18.6, 11.5); sh.lineTo(-15.2, 11.5); sh.closePath(); // (x, -z)
    const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), mFloor); f.rotation.x = -PI / 2; f.renderOrder = -1; f.receiveShadow = true; ds.add(f); }
  // seuil de la porte et extérieur : sol opaque
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(260, 130), mAsph); f.rotation.x = -PI / 2; f.position.set(0, -0.21, 65.4); f.receiveShadow = true; ds.add(f); }

  // --- vitrages
  { const g = []; const pane = (x1, x2, y1, y2) => { const p = new THREE.PlaneGeometry(x2 - x1, y2 - y1); p.translate((x1 + x2) / 2, (y1 + y2) / 2, 0.2); g.push(p); };
    pane(GX0, DX0, 0, GTOP); pane(DX1, GX1, 0, GTOP); pane(DX0, DX1, 2.55, GTOP); const m = new THREE.Mesh(mergeGeometries(g, false), mGlass); ds.add(m); twin(m); }

  /* ================================================================ lumière */
  const HB = HOLO ? 0.6 : 2.25, SB = HOLO ? 0 : 3.4, hemi = new THREE.HemisphereLight(0xffffff, 0xc9cdd2, HB); ds.add(hemi); // en hologramme, seules les œuvres sont vraiment éclairées
  const sun = new THREE.DirectionalLight(0xfff0d6, SB); sun.position.set(6.2, 24.6, 12.6); sun.target.position.set(-1.6, 0, -16); sun.castShadow = !HOLO; // même direction que la tache de soleil du narthex
  sun.shadow.mapSize.set(lite || touch ? 1024 : 2048, lite || touch ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 2, far: 90 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  ds.add(sun, sun.target); if (!HOLO) W.shadowLights.push(sun); W.dsSun = sun;
  { const l = new THREE.PointLight(0xffb060, 12, 8, 2); l.position.set(10.6, 2.2, -1.7); ds.add(l); }   // chaleur du Bistrot, sous le niveau 1
  const ledBase = mLed.color.clone(), hemiSky = new THREE.Color(0xffffff), hemiDusk = new THREE.Color(1, 0.7, 0.58);
  W.dsDim = (k) => { hemi.intensity = HOLO ? HB * (1 + 1.6 * k) : HB * (1 - 0.62 * k); hemi.color.lerpColors(hemiSky, hemiDusk, k); sun.intensity = SB * (1 - 0.8 * k); mLed.color.copy(ledBase).multiplyScalar(1 - 0.86 * k); }; // pénombre rose (œuvre 3)

  // --- ciel, arbres du parvis
  if (!HOLO) { const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vD;void main(){float h=clamp(vD.y,0.,1.);vec3 c=mix(vec3(.92,.94,.95),vec3(.42,.6,.82),pow(h,.55));float s=max(dot(normalize(vD),normalize(vec3(-.12,.62,.77))),0.);c+=vec3(1.,.9,.72)*(pow(s,90.)*2.4+pow(s,8.)*.25);gl_FragColor=vec4(c*1.15,1.);}' }));
  sky.renderOrder = -5; ds.add(sky); }
  if (!HOLO) { const g1 = new THREE.PlaneGeometry(9, 9); g1.translate(0, 4.5, 0); const g2 = g1.clone(); g2.rotateY(PI / 2); const tm = new THREE.MeshBasicMaterial({ map: foliageTex(), alphaTest: 0.35, side: THREE.DoubleSide });
    const spots = [[-13, 11], [-8.5, 15], [-3, 12.5], [1.5, 17], [-18, 16], [6, 13], [-11, 22], [-1, 24], [11, 20], [-23, 12]], tr = new THREE.InstancedMesh(mergeGeometries([g1, g2], false), tm, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    spots.forEach(([x, z], i) => { const s = rnd(0.85, 1.4); e.set(0, rnd(PI), 0); q.setFromEuler(e); m4.compose(new V3(x, -0.2, z), q, new V3(s, s * rnd(0.95, 1.2), s)); tr.setMatrixAt(i, m4); tr.setColorAt(i, new THREE.Color().setHSL(0.27 + rnd(-0.03, 0.04), 0.3, rnd(0.42, 0.6))); }); ds.add(tr); }

  /* ================================================================ détails fins */
  // livres de la librairie, bouteilles du Bistrot : instances colorées
  { const N = 1500, bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), HOLO ? new THREE.MeshBasicMaterial() : std({ roughness: 0.7, envMapIntensity: 0.2 }), N), m4 = new THREE.Matrix4(), c = new THREE.Color(), q0 = new THREE.Quaternion(), tintH = new THREE.Color(0x4fb6c4); let n = 0;
    const pal = [0xf2f0ea, 0xe8e2d4, 0x1f2328, 0xc8402f, 0x2d5f8a, 0xe2b53c, 0x6b8f71, 0xd9d4cb, 0x8a8d90, 0xf1efe9, 0xb0452f];
    // une rangée de livres debout : le long de z (étagères murales) ou de x (casiers), dos tourné vers `face`
    const row = (alongX, a0, a1, y, fixed, face, hMax = 0.33) => { let p = a0; while (p < a1 && n < N) { const t = rnd(0.012, 0.045), h = rnd(0.2, hMax), d = rnd(0.16, 0.24); if (rnd() < 0.1) { p += rnd(0.03, 0.14); continue; } if (p + t > a1) break;
        if (alongX) m4.compose(new V3(p + t / 2, y + h / 2, fixed + face * d / 2), q0, new V3(t, h, d)); else m4.compose(new V3(fixed + face * d / 2, y + h / 2, p + t / 2), q0, new V3(d, h, t));
        bm.setMatrixAt(n, m4); c.setHex(pal[(rnd(pal.length)) | 0]); if (HOLO) c.lerp(tintH, 0.55).multiplyScalar(0.34); bm.setColorAt(n, c); n++; p += t + 0.002; } };
    for (const [xw, dir] of SHELVES) for (const y of [0.075, 0.515, 0.955, 1.395, 1.835]) row(false, -8.72, -6.72, y, xw + dir * 0.01, dir);
    for (const [x, z, s, h] of UNITS) for (const y of [PY + PT, PY + h * 0.5 + PT / 2]) for (const side of [-1, 1]) for (const [a0, a1] of [[x - s / 2 + PT + 0.01, x - PT / 2 - 0.01], [x + PT / 2 + 0.01, x + s / 2 - PT - 0.01]]) if (rnd() < 0.85) row(true, a0, a1, y, z + side * (s / 2 - 0.01), -side, Math.min(0.33, h * 0.5 - 0.06));
    bm.count = n; bm.castShadow = false; bm.receiveShadow = true; ds.add(bm); twin(bm); }
  { const N = 44, bg = new THREE.CylinderGeometry(0.035, 0.038, 0.3, 10), bt = new THREE.InstancedMesh(bg, std({ roughness: 0.15, metalness: 0.1, envMapIntensity: 1.5 }), N), m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < N; i++) { m4.makeTranslation(8.55 + (i >> 1) * 0.185 + rnd(0.03), (i % 2 ? 2.13 : 1.68), -3.26); bt.setMatrixAt(i, m4); bt.setColorAt(i, c.setHex([0x1d3a22, 0x4a2a12, 0x0e1512, 0x6a4a1c][(rnd(4)) | 0])); } ds.add(bt); }
  // formes de verre sur les socles (évocation : aucune œuvre réelle n'est reproduite hors du lot 42-SE)
  { const mG = std({ color: 0x5f8fd0, emissive: HOLO ? 0x12324a : 0x000000, roughness: 0.08, metalness: 0, envMapIntensity: 2, transparent: true, opacity: 0.6 }), geos = [];
    for (const [x, z, s, h] of PLINTHS) for (let k = 0; k < 3; k++) { const pts = [], H = rnd(0.22, 0.4), w = rnd(0.07, 0.11); for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(w * (0.25 + Math.sin(t * PI) * 0.9 * (1 - t * 0.35) + 0.35 * Math.sin(t * PI * 3) * 0.3) + 0.004, t * H)); }
      const g = new THREE.LatheGeometry(pts, 20); g.translate(x + rnd(-0.28, 0.28) * s, h, z + rnd(-0.28, 0.28) * s); geos.push(g); }
    const m = new THREE.Mesh(mergeGeometries(geos, false), mG); m.castShadow = true; ds.add(m); twin(m); }
  // œuvres « hors lot » : seules quatre œuvres ont été numérisées — les autres ne sont plus que des emplacements cotés
  { const ln = [], add = (cx, cy, cz, w, h, nx, nz) => { const tx = -nz, tz = nx, o = 0.012; const c = (a, b) => [cx + tx * a + nx * o, cy + b, cz + tz * a + nz * o];
      const q = [c(-w / 2, -h / 2), c(w / 2, -h / 2), c(w / 2, h / 2), c(-w / 2, h / 2)]; for (let i = 0; i < 4; i++) ln.push(...q[i], ...q[(i + 1) % 4]);
      for (let d = -w / 2 + 0.12; d < w / 2 + h; d += 0.12) { const a0 = Math.max(-w / 2, d - h), a1 = Math.min(w / 2, d); if (a1 > a0) ln.push(...c(a1, -h / 2 + (d - a1)), ...c(a0, -h / 2 + (d - a0))); }
      const t = inkText([TX.horsLot || 'HORS LOT', (w * 100).toFixed(0) + ' × ' + (h * 100).toFixed(0) + ' cm · ' + (TX.nonNum || 'non numérisé')], { color: '#6f7d8c', w: 300, size: 30, sub: 22, scale: 0.34 }); t.position.set(...c(-w / 2 + 0.17, -h / 2 - 0.1)); t.rotation.y = Math.atan2(nx, nz); ds.add(t); };
    for (const [x, y, z, w, h, nx, nz] of [[-9, 2, -32.29, 2.2, 2.4, 0, 1], [-4.2, 1.9, -32.29, 1.4, 1.8, 0, 1], [3.5, 1.9, -32.29, 2.6, 2, 0, 1], [9.2, 1.8, -32.29, 1.2, 1.5, 0, 1], [15.29, 1.9, -17.5, 2, 2.2, -1, 0], [15.29, 1.8, -22, 1.2, 1.2, -1, 0], [15.29, 2, -27.5, 2.8, 2.4, -1, 0],
      [-18.59, 1.8, -13.5, 1.3, 1.5, 1, 0], [-18.59, 1.8, -16.7, 1.7, 1.4, 1, 0], [-16.9, 1.8, -11.51, 1.2, 1.2, 0, -1], [-16.9, 1.8, -18.89, 1.4, 1.1, 0, 1], [-15.19, 1.9, -29.2, 1.6, 2, 1, 0], [-0.59, 1.9, -26, 2.4, 2, 1, 0], [-1.01, 1.9, -26, 1.5, 1.9, -1, 0], [-6.6, 1.9, -20.21, 2.6, 2.1, 0, -1], [-6.6, 1.9, -19.79, 1.8, 1.8, 0, 1], [5.8, 1.9, -20.21, 2.2, 2, 0, -1], [5.8, 1.8, -19.79, 1.3, 1.6, 0, 1], [3.95, 2, -9.91, 1.8, 2.2, 0, -1], [-0.59, 1.9, -13.8, 1.6, 1.9, 1, 0],
      [7.04, 2, -8.4, 2.2, 2.2, -1, 0], [12.6, L1 + 1.5, -0.01, 1.2, 0.9, 0, -1], [7.36, L1 + 1.5, -8.6, 0.9, 0.7, 1, 0], [15.29, L1 + 1.5, -3.4, 0.7, 0.9, -1, 0], [13.4, L1 + 1.5, -12.84, 0.6, 0.8, 0, 1]]) add(x, y, z, w, h, nx, nz);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ln, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: HOLO ? 0x8fdfe8 : 0x6f7d8c, transparent: true, opacity: HOLO ? 0.4 : 0.5 })); l.frustumCulled = false; ds.add(l); }
  // lettrages : enseigne, titre de l'exposition, repères
  { const lt = loader.load('assets/Ceysson.svg'); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; // logo de la galerie : en enseigne sur la façade et sur le mur de l'accueil
    const logo = (wd, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, wd * 47.25 / 321), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, color: HOLO ? 0xa9c9d2 : 0x15181c })); m.position.set(x, y, z); m.rotation.y = ry; ds.add(m); return m; };
    logo(5.2, -7.1, 5.62, 0.405); logo(2.6, -11.2, 3.45, -9.49);
    const t = inkText(['LOUIS CANE'], { color: '#14171b', w: 900, size: 78, scale: 2.5, font: 'Krona One', weight: 400 }); t.position.set(3.25, 2.55, -9.495); ds.add(t);
    const t2 = inkText(['Résonances', TX.expo1 || 'Clôture de l\'exposition — 21 & 22 novembre 2026', TX.expo2 || 'Parcours sensoriel « un tableau, un sens » · quatre œuvres, quatre sens internes', TX.expo3 || 'Lot 42-SE numérisé pour le programme HOPE'], { color: '#2a3138', w: 900, size: 54, sub: 26, scale: 2.5 }); t2.position.set(3.25, 1.98, -9.495); ds.add(t2);
    for (const [txt, x, y, z, ry, sc] of [[TX.librairie || 'LIBRAIRIE', -11.2, 2.75, -9.49, 0, 1.3], [TX.bistrot || 'LE BISTROT', 7.04, 3.05, -1.75, -PI / 2, 1.5], [TX.niv1 || 'NIV. 1', 7.04, 4.3, -5.2, -PI / 2, 1.1], [TX.accueil || 'ACCUEIL', -15.19, 2.4, -2.6, PI / 2, 1.1]]) { const l = inkText([txt], { color: '#3a424b', w: 520, size: 46, scale: sc, align: 'center', track: 8 }); l.position.set(x, y, z); l.rotation.y = ry; ds.add(l); } }

  // poussière dans les rayons de soleil de la façade
  { const n = lite || HOLO ? 200 : 520, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([rnd(-12, -2), rnd(0.1, 5), rnd(-7.5, -0.3)], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: soft, color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(1.6), size: 0.018, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; ds.add(pts);
    W.dsTime = 1; upd.push((t, dt) => { if (!ds.visible) return; for (let i = 0; i < n; i++) { p[i * 3 + 1] += dt * 0.03 * W.dsTime; p[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.01 * W.dsTime; if (p[i * 3 + 1] > 5) p[i * 3 + 1] = 0.1; } g.attributes.position.needsUpdate = true; }); }

  /* ================================================================ le parcours : fil d'Ariane projeté au sol */
  const ART = [
    { pos: P(-1.0, -13.4), n: new V3(-1, 0, 0), lv: 0 }, { pos: P(-15.2, -24.8), n: new V3(1, 0, 0), lv: 0 },
    { pos: P(9.2, -12.85), n: new V3(0, 0, 1), lv: L1 }, { pos: P(15.3, -7.7), n: new V3(-1, 0, 0), lv: L1 }];
  const stopOf = (i) => ART[i].pos.clone().addScaledVector(ART[i].n, works[i].dist).setY(ART[i].lv);
  W.legs = [[P(-7.1, 3.2), P(-7.1, -2.5), P(-5.6, -8.6), P(-4.2, -12.2), stopOf(0)],
    [stopOf(0), P(-4.4, -15.2), P(-12.6, -15.4), P(-13.3, -21.5), stopOf(1)],
    [stopOf(1), P(-11, -24.4), P(-4.2, -24), P(-2.2, -21.7), P(0.3, -19.6), P(0.5, -12), P(0.5, -5), P(1.2, -2.6), P(2.6, -2.2), P(3.75, -2.2, 0.8), P(4.9, -2.2, 1.6), P(6.05, -2.2, 2.4), P(7.3, -2.2, L1), P(9.1, -3.4, L1), stopOf(2)],
    [stopOf(2), P(11.6, -8.9, L1), stopOf(3)]].map((pts) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25));
  { const pp = [], ss = []; let acc = 0; W.legLen = []; for (const c of W.legs) { const len = c.getLength(), n = Math.ceil(len / 0.22); W.legLen.push([acc, len]); for (let i = 0; i <= n; i++) { const p = c.getPointAt(i / n); pp.push(p.x, p.y + 0.012, p.z); ss.push(acc + len * i / n); } acc += len; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(ss, 1));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uHead: { value: 0 }, uPx: { value: 1 }, uAll: { value: 0 } },
      vertexShader: 'attribute float aS;uniform float uHead,uTime,uPx,uAll;varying float vA;void main(){float d=aS-uHead;float e=(d-2.2)/2.6;e=exp(-e*e);vA=(d<-1.?.1:.34)+uAll*.5+.6*e+.2*smoothstep(.9,1.,sin(aS*1.4-uTime*3.));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uPx*(3.4+2.6*e)/max(1.,-mv.z*.35);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float a=smoothstep(.5,.2,length(gl_PointCoord-.5));gl_FragColor=vec4(vec3(1.,.2,.1),a*min(vA,1.));}' }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; ds.add(pts); W.pathU = m.uniforms;
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); const pl = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff4f38, transparent: true, opacity: 0.1 })); pl.frustumCulled = false; ds.add(pl); W.pathLine = pl.material; }

  /* ================================================================ les quatre œuvres du lot 42-SE */
  const dimLine = (len, txt) => { const g = new THREE.Group(), p = [-len / 2, 0, 0, len / 2, 0, 0, -len / 2, -0.018, 0, -len / 2, 0.018, 0, len / 2, -0.018, 0, len / 2, 0.018, 0], bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: HOLO ? 0xcfe6f0 : 0x39424c, transparent: true, opacity: 0.7 }))); const t = inkText([txt], { w: 220, size: 40, scale: 0.17, align: 'center' }); t.position.y = -0.04; g.add(t); return g; };
  // front d'impression : la matière n'existe qu'au-dessus de la ligne qui descend
  const reveal = (mat, st, h) => { const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uPrint = st.print; sh.uniforms.uPH = { value: h }; sh.uniforms.uPC = { value: st.col };
      sh.vertexShader = 'varying float vPy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPy=position.y;');
      sh.fragmentShader = 'varying float vPy;uniform float uPrint,uPH;uniform vec3 uPC;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float pf=(.5-vPy/uPH)-uPrint*1.08+.04; if(pf>0.) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance+=uPC*smoothstep(-.03,0.,pf)*3.*step(uPrint,.999);'); };
    mat.customProgramCacheKey = () => key + '|rev' + st.i; return mat; };

  const atlas = featherAtlas();
  W.stations = works.map((wk, i) => {
    const A = ART[i], g = new THREE.Group(); g.position.set(A.pos.x, A.lv + wk.cy, A.pos.z); g.rotation.y = Math.atan2(A.n.x, A.n.z); ds.add(g); // +Z local = vers la salle
    const stop = stopOf(i), st = { i, g, n: A.n, lv: A.lv, k: 0, a: 0, b: 1, print: { value: 0 }, col: new THREE.Color(wk.col), fx: { on: false }, wallPos: A.pos.clone().setY(A.lv + wk.cy),
      stop: { pos: stop.clone().setY(A.lv + 1.66 + DSY), look: A.pos.clone().setY(A.lv + wk.cy + DSY) } };
    // barre d'impression et faisceau du projecteur de plafond
    const bar = new THREE.Mesh(new THREE.BoxGeometry(wk.w + 0.1, 0.005, 0.005), new THREE.MeshBasicMaterial({ color: st.col.clone().multiplyScalar(4) })); bar.position.z = 0.05; g.add(bar);
    const top = (A.lv ? GH - A.lv : GH) - wk.cy - 0.2, lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, top, 1.4, -wk.w / 2, 0, 0.05, 0, top, 1.4, wk.w / 2, 0, 0.05], 3));
    const fan = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: wk.col, transparent: true, opacity: 0.5 })); fan.frustumCulled = false; g.add(fan);
    // cotes, référence d'inventaire, cartel : apparaissent une fois l'œuvre imprimée
    const info = new THREE.Group(); info.position.z = 0.012; g.add(info); const im = [];
    const hd = dimLine(wk.w, wk.dw); hd.position.set(0, -wk.h / 2 - 0.1, 0); info.add(hd); const vd = dimLine(wk.h, wk.dh); vd.rotation.z = PI / 2; vd.position.set(-(wk.w / 2 + 0.1), 0, 0); info.add(vd);
    const idl = inkText(['CB-0' + (i + 1) + ' · ' + (TX.lot || 'LOT 42-SE')], { color: '#' + st.col.clone().multiplyScalar(0.62).getHexString(), w: 300, size: 40, scale: 0.2 }); idl.position.set(-wk.w / 2 + 0.1, wk.h / 2 + 0.07, 0); info.add(idl);
    { const cw = 0.2, card = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.11, 0.004), mWhite), tx = inkText([wk.title, wk.artist, wk.tech], { color: '#22272d', w: 520, size: 40, sub: 27, scale: cw - 0.02 });
      card.position.set(wk.w / 2 + 0.22 + cw / 2, 1.32 - wk.cy, -0.008); tx.position.set(card.position.x, card.position.y, 0); info.add(card, tx); }
    info.traverse((o) => { if (o.material && o.material.transparent && !im.includes(o.material)) { o.material.userData.op = o.material.opacity; o.material.opacity = 0; im.push(o.material); } });
    // repère au sol (dans la vraie galerie : « place tes pieds sur le repère »)
    { const fg = new THREE.Group(); fg.position.set(stop.x, A.lv + 0.006, stop.z); ds.add(fg); const rm = new THREE.MeshBasicMaterial({ color: wk.col, transparent: true, opacity: 0, depthWrite: false });
      for (const [r0, r1] of [[0.3, 0.31], [0.36, 0.364]]) { const r = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), rm); r.rotation.x = -PI / 2; fg.add(r); }
      const tk = []; for (let k = 0; k < 24; k++) { const a = k / 24 * PI * 2; tk.push(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38, Math.cos(a) * (k % 6 ? 0.4 : 0.44), 0, Math.sin(a) * (k % 6 ? 0.4 : 0.44)); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tk, 3)); fg.add(new THREE.LineSegments(tg, rm));
      const lb = inkText([(wk.canal || '') + ' · ' + Math.round(wk.dist * 100) + ' cm'], { color: '#' + st.col.clone().multiplyScalar(0.6).getHexString(), w: 300, size: 36, scale: 0.3, align: 'center' }); lb.rotation.x = -PI / 2; lb.rotation.z = Math.atan2(A.n.x, A.n.z); lb.position.set(A.n.x * 0.56, 0, A.n.z * 0.56); lb.material.opacity = 0; fg.add(lb); st.floorMats = [rm, lb.material]; }
    // projecteur d'accrochage
    { const sp = new THREE.SpotLight(0xfff3e2, 1.25, 0, 0.42, 0.85, 0); sp.position.set(A.pos.x + A.n.x * 2.4, A.lv + Math.min(GH - A.lv - 0.4, wk.cy + 2.6), A.pos.z + A.n.z * 2.4); sp.target.position.set(A.pos.x, A.lv + wk.cy, A.pos.z); ds.add(sp, sp.target); st.spot = sp; }
    upd.push((t, dt) => { if (!ds.visible) return; const p = st.print; p.value = Math.min(1, Math.max(0, p.value + (st.k > p.value ? dt : -dt) / 3.6)); st.a += ((p.value > 0.97 ? 1 : 0) - st.a) * (1 - Math.exp(-dt * 2.5)); st.b += ((st.near ? 0 : 1) - st.b) * (1 - Math.exp(-dt * 3));
      const on = p.value > 0.005 && p.value < 0.995; bar.visible = fan.visible = on; if (on) { const y = wk.h / 2 - p.value * wk.h; bar.position.y = y; const a = lg.attributes.position; a.setY(1, y); a.setY(3, y); a.needsUpdate = true; }
      im.forEach((m) => { m.opacity = m.userData.op * st.a * st.b; }); st.floorMats[0].opacity = st.k * 0.85; st.floorMats[1].opacity = st.k * 0.9; st.spot.intensity = 0.25 + p.value; });
    return st;
  });
  const S = W.stations;
  const photo = (i, cb) => { const t = loader.load(works[i].img, cb); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const cover = (tex, wk, zoom = 1) => { const pa = wk.w / wk.h, sx = (pa > wk.ar ? 1 : pa / wk.ar) * zoom, sy = (pa > wk.ar ? wk.ar / pa : 1) * zoom; tex.repeat.set(sx, sy); tex.offset.set((1 - sx) / 2, (1 - sy) / 2); };
  const hang = (st, mesh, mirror = true) => { mesh.castShadow = false; mesh.receiveShadow = false; st.g.add(mesh); if (mirror && !st.lv) twin(mesh); return mesh; };

  /* ---------- 01 · Plume sur Rhodoïde — kinesthésie : les plumes se détachent et tombent, et ton corps tombe avec elles */
  { const st = S[0], wk = works[0], SIDE = wk.w, floorY = -wk.cy;
    const film = reveal(std({ color: 0xf6f7f5, roughness: 0.3, envMapIntensity: 0.4, transparent: true, opacity: 0.78 }), st, SIDE); hang(st, new THREE.Mesh(new THREE.PlaneGeometry(SIDE, SIDE), film)).position.z = 0.022;
    const gloss = reveal(std({ color: 0xffffff, roughness: 0.04, metalness: 0, envMapIntensity: 1.6, transparent: true, opacity: 0.11, depthWrite: false }), st, SIDE); const gm = hang(st, new THREE.Mesh(new THREE.PlaneGeometry(SIDE, SIDE), gloss), false); gm.position.z = 0.036; gm.renderOrder = 3;
    { const pins = []; for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const c = new THREE.CylinderGeometry(0.006, 0.006, 0.04, 10); c.rotateX(PI / 2); c.translate(sx * (SIDE / 2 - 0.02), sy * (SIDE / 2 - 0.02), 0.02); pins.push(c); } hang(st, new THREE.Mesh(mergeGeometries(pins, false), reveal(std({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.3 }), st, SIDE))); }
    // la plume que tu fixes : choisie près du centre, animée image par image
    let hi = 0, best = 9; PLUMES.forEach((f, k) => { const d = Math.hypot(f[0] - 0.04, f[1] - 0.06) + (f[6] === 0 ? 0 : 1) + (f[3] > 0.07 ? 0 : 0.5); if (d < best) { best = d; hi = k; } });
    const rest = PLUMES.filter((f, k) => k !== hi), n = rest.length, base = new THREE.PlaneGeometry(1, 1, 1, 6), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv; geo.instanceCount = n;
    const lin = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    const aH = new Float32Array(n * 4), aC = new Float32Array(n * 4), aR = new Float32Array(n * 4);
    rest.forEach((f, k) => { const c = lin(f[5]); aH.set([f[0] * SIDE, f[1] * SIDE, f[2], f[3] * SIDE * 1.25], k * 4); aC.set([c.r, c.g, c.b, f[6] + (rnd() < 0.5 ? 4 : 0)], k * 4); aR.set([rnd(), rnd(), rnd(), rnd()], k * 4); });
    geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(aH, 4)); geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aC, 4)); geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(aR, 4));
    const FRAG = `uniform sampler2D uAtlas;uniform float uLight;varying vec2 vUv;varying vec3 vCol;varying float vA;varying float vL;
      void main(){ vec4 t=texture2D(uAtlas,vUv); float a=t.a*vA; if(a<.012) discard; float sh=min(1.,t.r/max(t.a,.02)), wh=min(1.,t.g/max(t.a,.02));
        vec3 c=mix(vCol*(.42+.6*sh),vec3(.9,.89,.86),wh*.55)*vL*uLight; gl_FragColor=vec4(c,min(1.,a*2.6)); }`;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uAtlas: { value: atlas }, uT: { value: 0 }, uFloor: { value: floorY }, uPrint: st.print, uSide: { value: SIDE }, uLight: { value: 0.74 }, uMir: { value: 0 }, uMirrorY: mirrorY },
      vertexShader: `attribute vec4 aHome;attribute vec4 aCol;attribute vec4 aRnd;uniform float uT,uFloor,uPrint,uSide,uMir,uMirrorY;varying vec2 vUv;varying vec3 vCol;varying float vA;varying float vL;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ float cell=aCol.w, col=mod(cell,4.), row=floor(cell/4.); vUv=vec2((col+uv.x)/4.,1.-(row+1.-uv.y)/2.); vCol=aCol.rgb;
          float len=aHome.w; vec3 p=vec3(position.x*len*.5,position.y*len,0.); float v=uv.y;
          float t=max(0.,uT-(2.6+aRnd.x*6.)); float lift=smoothstep(0.,1.5,t), fall=max(0.,t-.45);                 // chaque plume lâche prise à son tour
          float vy=.15+aRnd.y*.13, fy=uFloor+.004+aRnd.w*.006, tl=max(.01,(aHome.y-fy)/vy), fl=min(fall,tl), land=smoothstep(tl-.5,tl,fall);
          float w=.85+aRnd.y*.8, ph=aRnd.z*6.283, sw=sin(fl*w+ph);
          p.z+=(v-.5)*(v-.5)*len*(.1+lift*.7)*(1.-land)+abs(position.x)*len*.25*lift*(1.-land);                      // la plume se cambre en vol
          p.xz=rot(lift*(sw*1.15+(aRnd.z-.5)*1.3)*(1.-land))*p.xz;                                                // roulis autour du rachis
          p.yz=rot(lift*(1.25+.5*sin(fl*.8+ph))*(1.-land)+land*1.5708)*p.yz;                                       // elle se couche à plat, puis repose au sol
          p.xy=rot(aHome.z-1.5708+lift*sw*.5)*p.xy; if(land>.001) p.xz=rot(land*aRnd.x*6.283)*p.xz;
          vec3 o=vec3(aHome.xy,.03); o.y=max(aHome.y-fall*vy,fy); float amp=(.08+aRnd.z*.26)*smoothstep(0.,2.5,fl);
          o.x+=amp*(sw-sin(ph)); o.z+=lift*.03+smoothstep(0.,4.5,fl)*(.12+aRnd.y*aRnd.y*2.1)+amp*.4*cos(fl*w*.5+ph);
          float born=step(.5-aHome.y/uSide,uPrint*1.08-.04); vA=born*(1.-land*.25); vL=.86+.14*cos(lift*sw*2.);
          vec4 wp=modelMatrix*vec4(o+p,1.); if(uMir>.5) wp.y=2.*uMirrorY-wp.y; gl_Position=projectionMatrix*viewMatrix*wp; }`, fragmentShader: FRAG });
    const fm = new THREE.Mesh(geo, mat); fm.frustumCulled = false; fm.renderOrder = 2; st.g.add(fm);
    if (MIRROR) { const m2 = mat.clone(); for (const k of Object.keys(mat.uniforms)) if (k !== 'uMir') m2.uniforms[k] = mat.uniforms[k]; m2.uniforms.uMir = { value: 1 }; const f2 = new THREE.Mesh(geo, m2); f2.frustumCulled = false; f2.renderOrder = -2; st.g.add(f2); }
    const hf = PLUMES[hi], hc = lin(hf[5]), hlen = hf[3] * SIDE * 1.35;
    const hmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uAtlas: { value: atlas }, uLight: { value: 0.78 }, uCol: { value: hc }, uCell: { value: hf[6] }, uA: { value: 0 }, uBend: { value: 0 } },
      vertexShader: `uniform vec3 uCol;uniform float uCell,uA,uBend;varying vec2 vUv;varying vec3 vCol;varying float vA;varying float vL;
        void main(){ vUv=vec2((mod(uCell,4.)+uv.x)/4.,1.-(floor(uCell/4.)+1.-uv.y)/2.); vCol=uCol; vA=uA; vL=1.; vec3 p=position; p.z+=((uv.y-.5)*(uv.y-.5)*.9+abs(position.x)*.5)*uBend; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`, fragmentShader: FRAG });
    const hero = new THREE.Mesh(new THREE.PlaneGeometry(hlen * 0.5, hlen, 1, 8), hmat); hero.renderOrder = 4; hero.frustumCulled = false; st.g.add(hero);
    const hHome = new V3(hf[0] * SIDE, hf[1] * SIDE, 0.031), ring = new THREE.Mesh(new THREE.RingGeometry(hlen * 0.62, hlen * 0.62 + 0.0025, 48), new THREE.MeshBasicMaterial({ color: wk.col, transparent: true, opacity: 0, depthWrite: false })); ring.position.copy(hHome).setZ(0.04); ring.renderOrder = 5; st.g.add(ring);
    Object.assign(st.fx, { t: 0, hero: new V3(), sway: 0, drop: 0 });
    upd.push((tt, dt) => { if (!ds.visible) return; const fx = st.fx; if (fx.on) fx.t += dt * W.dsTime; else fx.t = Math.max(0, fx.t - dt * 5); mat.uniforms.uT.value = fx.t;
      const t = fx.t, f = Math.max(0, t - 0.9), lift = sm(0, 1.6, t), w = 1.05, sw = Math.sin(f * w), amp = 0.2 * sm(0, 3, f), y = Math.max(hHome.y - f * 0.13, floorY + 0.4);
      hero.position.set(hHome.x + amp * sw, y, hHome.z + lift * 0.12 + sm(0, 6, f) * 0.5); hero.rotation.set(lift * (0.9 + 0.3 * Math.sin(f * 0.8)), lift * sw * 1.0, hf[2] - PI / 2 + lift * sw * 0.45, 'ZXY');
      hmat.uniforms.uA.value = st.print.value * 1.08 - 0.04 > 0.5 - hf[1] ? 1 : 0; hmat.uniforms.uBend.value = hlen * (0.12 + lift * 0.5); ring.material.opacity = st.a * (fx.on ? Math.max(0, 1 - t * 0.5) : 0.55 + 0.25 * Math.sin(tt * 3)) * st.b; ring.rotation.z = tt * 0.4;
      st.g.localToWorld(fx.hero.copy(hero.position)); fx.sway = amp * sw; fx.drop = hHome.y - y; }); }

  /* ---------- 02 · Résine sur grillage — toucher haptique virtuel : la matière répond au regard */
  { const st = S[1], wk = works[1], hit = new THREE.Vector2(9, 9), amp = { value: 0 }, RES = 1024, cv = document.createElement('canvas'), bump = document.createElement('canvas'); cv.width = cv.height = bump.width = bump.height = RES;
    const map = new THREE.CanvasTexture(cv), bmp = new THREE.CanvasTexture(bump); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = bmp.anisotropy = 8; const SAT = new Float32Array(64 * 64);
    const im = new Image(); im.onload = () => { // la photo donne la couleur ; le grillage, les coulures et le relief sont redessinés finement par-dessus
      const g = cv.getContext('2d'), pa = wk.w / wk.h, sw = pa > wk.ar ? im.width : im.width * pa / wk.ar, sh = pa > wk.ar ? im.height * wk.ar / pa : im.height; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, RES, RES);
      const src = g.getImageData(0, 0, RES, RES), d = src.data, bg = bump.getContext('2d'), out = bg.createImageData(RES, RES), o = out.data, PITCH = RES / 112, hs = (x, y) => { const t = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return t - Math.floor(t); };
      for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) { const k = (y * RES + x) * 4, r = d[k] / 255, gg = d[k + 1] / 255, b = d[k + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx - mn;
        const fx2 = Math.abs(((x / PITCH) % 1) - 0.5), fy2 = Math.abs(((y / PITCH) % 1) - 0.5), wire = Math.max(sm(0.38, 0.5, fx2), sm(0.38, 0.5, fy2)), resin = sm(0.1, 0.34, sat), drip = hs(Math.floor(x / 3), Math.floor(y / 9)) > 0.985 ? 0.25 : 0;
        const h = resin * 0.55 + wire * (0.42 - resin * 0.3) + drip * resin + hs(x, y) * 0.04, sh2 = 1 - wire * (0.56 - resin * 0.3);
        d[k] *= sh2; d[k + 1] *= sh2; d[k + 2] *= sh2 * (1 + wire * 0.04); o[k] = o[k + 1] = o[k + 2] = Math.min(255, h * 255); o[k + 3] = 255; if (!(x & 15) && !(y & 15)) SAT[(y >> 4) * 64 + (x >> 4)] = sat; }
      g.putImageData(src, 0, 0); bg.putImageData(out, 0, 0); map.needsUpdate = true; bmp.needsUpdate = true; }; im.src = wk.img;
    const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bmp, bumpScale: 2.2, roughness: 0.3, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.14, envMapIntensity: 1.1 });
    const timeU = { value: 0 }; W.timeU.push(timeU);
    mat.onBeforeCompile = (sh) => { sh.uniforms.uHit = { value: hit }; sh.uniforms.uAmp = amp; sh.uniforms.uTime = timeU;
      const F = 'uniform vec2 uHit;uniform float uAmp,uTime;\nfloat bulge(vec2 p){float d=distance(p,uHit);return (exp(-d*d*16.)*.045+sin(d*30.-uTime*5.)*exp(-d*3.4)*.008)*uAmp;}\n';
      sh.vertexShader = F + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n { float e=.012; objectNormal=normalize(vec3(-(bulge(position.xy+vec2(e,0.))-bulge(position.xy-vec2(e,0.)))/(2.*e),-(bulge(position.xy+vec2(0.,e))-bulge(position.xy-vec2(0.,e)))/(2.*e),1.)); }')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z+=bulge(position.xy);'); };
    mat.customProgramCacheKey = () => 'resine'; reveal(mat, st, wk.h);
    const mesh = hang(st, new THREE.Mesh(new THREE.PlaneGeometry(wk.w, wk.h, 120, 120), mat)); mesh.position.z = 0.03;
    { const e = []; for (const [w, h, x, y] of [[wk.w + 0.012, 0.006, 0, wk.h / 2 + 0.003], [wk.w + 0.012, 0.006, 0, -wk.h / 2 - 0.003], [0.006, wk.h, -wk.w / 2 - 0.003, 0], [0.006, wk.h, wk.w / 2 + 0.003, 0]]) { const b = new THREE.BoxGeometry(w, h, 0.03); b.translate(x, y, 0.015); e.push(b); } hang(st, new THREE.Mesh(mergeGeometries(e, false), reveal(std({ color: 0x3a3d40, metalness: 0.85, roughness: 0.5 }), st, wk.h))); } // chant du grillage
    const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(wk.w * 2.4, wk.h * 2.4), new THREE.MeshBasicMaterial({ visible: false })); hitPlane.position.z = 0.03; st.g.add(hitPlane);
    Object.assign(st.fx, { hitPlane, mesh: st.g, hit, amp, satAt: (x, y) => { const u = Math.min(63, Math.max(0, ((x / wk.w + 0.5) * 64) | 0)), v = Math.min(63, Math.max(0, ((0.5 - y / wk.h) * 64) | 0)); return SAT[v * 64 + u]; } });
    upd.push(() => { amp.value += ((st.fx.on ? 1 : 0) - amp.value) * 0.05; }); }

  /* ---------- 03 · Arpenter ⅔ — proprioception : la salle grandit, les troncs sortent du cuivre, tu rétrécis */
  { const st = S[2], wk = works[2], tex = photo(2); cover(tex, wk);
    const rough = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 2600; i++) { const v = rnd(60, 150) | 0; g.strokeStyle = `rgba(${v},${v},${v},.5)`; g.lineWidth = rnd(0.5, 1.6); const y = rnd(512), x = rnd(512), l = rnd(30, 260); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + rnd(-1, 1)); g.stroke(); } return new THREE.CanvasTexture(c); })(); // cuivre brossé
    const plate = reveal(std({ map: tex, metalness: 0.62, roughness: 1, roughnessMap: rough, envMapIntensity: 1.5, color: 0xffe9dc }), st, wk.h); hang(st, new THREE.Mesh(new THREE.PlaneGeometry(wk.w, wk.h), plate)).position.z = 0.02;
    { const e = []; for (const [w, h, x, y] of [[wk.w, 0.004, 0, wk.h / 2], [wk.w, 0.004, 0, -wk.h / 2], [0.004, wk.h, -wk.w / 2, 0], [0.004, wk.h, wk.w / 2, 0]]) { const b = new THREE.BoxGeometry(w, h, 0.02); b.translate(x, y, 0.01); e.push(b); }
      for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const c = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12); c.rotateX(PI / 2); c.translate(sx * (wk.w / 2 - 0.035), sy * (wk.h / 2 - 0.035), 0.023); e.push(c); }
      hang(st, new THREE.Mesh(mergeGeometries(e.map((x) => x.toNonIndexed()), false), reveal(std({ color: 0xb87348, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2 }), st, wk.h))); }
    // sous-bois : troncs à l'échelle du visiteur rétréci, autour de lui et jusqu'au fond de la brume
    const forest = new THREE.Group(); forest.position.set(0, -wk.cy, 0); st.g.add(forest); const bk = barkTex(), trunks = [], dz = wk.dist;
    const tmat = std({ color: 0x2a1a14, roughness: 0.95, bumpMap: bk, bumpScale: 6, envMapIntensity: 0.1 });
    for (let i = 0; i < 30; i++) { const near = i < 12, a = rnd(PI * 2), r = rnd(1.6, 6.5), x = near ? (i % 2 ? -1 : 1) * rnd(0.75, 2.6) : Math.cos(a) * r, z = near ? rnd(0.3, dz + 1.6) : dz + Math.sin(a) * r;
      if (Math.abs(x) < 0.7 && z < dz + 0.8) continue; if (Math.hypot(x, z - dz) < 0.55) continue; const rad = rnd(0.035, 0.11), gt = new THREE.CylinderGeometry(rad * 0.62, rad, 14, 12, 8, true); gt.translate(0, 7, 0);
      const p = gt.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setX(k, p.getX(k) + Math.sin(yy * 0.5 + i) * 0.05 * (yy / 14)); } gt.computeVertexNormals();
      const m = new THREE.Mesh(gt, tmat); m.position.set(x, 0, z); m.rotation.set(rnd(-0.03, 0.03), rnd(PI), rnd(-0.04, 0.04)); m.scale.y = 0.0001; m.visible = false; m.userData.d = rnd(0, 1.6); forest.add(m); trunks.push(m); }
    bk.repeat.set(2, 9);
    // feuilles qui tombent dans la lumière rose de la photographie
    const LN = lite ? 60 : 160, lp = new Float32Array(LN * 3), lr = []; for (let i = 0; i < LN; i++) { lp.set([rnd(-3.5, 3.5), rnd(0, 6), rnd(0.2, dz + 3)], i * 3); lr.push(rnd(0.5, 1.4)); }
    const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); const leaves = new THREE.Points(lgeo, new THREE.PointsMaterial({ map: soft, color: 0x7a2c1c, size: 0.03, transparent: true, opacity: 0, depthWrite: false })); leaves.frustumCulled = false; forest.add(leaves);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(1, 0.62, 0.42).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.set(-1.6, 5.2, 0.6); glow.scale.setScalar(7); forest.add(glow);
    const canopy = new THREE.SpriteMaterial({ map: foliageTex(), color: 0x2c1612, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(canopy), a = rnd(PI * 2), r = rnd(1.4, 6); s.position.set(Math.cos(a) * r, rnd(2.6, 7.5), dz + Math.sin(a) * r * 0.8 - 1); const k = rnd(3, 6); s.scale.set(k, k, 1); forest.add(s); }
    Object.assign(st.fx, { t: 0, k: 0 });
    upd.push((tt, dt) => { if (!ds.visible) return; const fx = st.fx; if (fx.on) fx.t += dt; else fx.t = Math.max(0, Math.min(fx.t, 4.5) - dt * 2.6); fx.k = sm(0, 4.5, fx.t); canopy.opacity = fx.k * 0.9;
      for (const t of trunks) { const k = Math.min(1, Math.max(0, (fx.t - t.userData.d) / 3)); t.visible = k > 0.001; t.scale.y = Math.max(0.0001, 1 - Math.pow(1 - k, 3)); }
      leaves.material.opacity = fx.k * 0.85; glow.material.opacity = fx.k * 0.5; if (fx.k > 0.01) { for (let i = 0; i < LN; i++) { lp[i * 3 + 1] -= dt * 0.22 * lr[i]; lp[i * 3] += Math.sin(tt * lr[i] + i) * dt * 0.12; if (lp[i * 3 + 1] < 0) lp[i * 3 + 1] = 6; } lgeo.attributes.position.needsUpdate = true; } }); }

  /* ---------- 04 · n°60 — intéroception et chronoception : la vapeur du dessin monte, le temps ralentit, on entend son cœur */
  { const st = S[3], wk = works[3], tex = photo(3); cover(tex, wk, 0.94);
    hang(st, new THREE.Mesh(new THREE.PlaneGeometry(wk.w, wk.h), reveal(std({ map: tex, roughness: 0.55, envMapIntensity: 0.2 }), st, wk.h + 0.06))).position.z = 0.012;
    { const e = [], F = 0.022; for (const [w, h, x, y] of [[wk.w + 2 * F, F, 0, wk.h / 2 + F / 2], [wk.w + 2 * F, F, 0, -wk.h / 2 - F / 2], [F, wk.h, -wk.w / 2 - F / 2, 0], [F, wk.h, wk.w / 2 + F / 2, 0]]) { const b = new THREE.BoxGeometry(w, h, 0.035); b.translate(x, y, 0.0175); e.push(b); }
      hang(st, new THREE.Mesh(mergeGeometries(e, false), reveal(std({ color: 0xc8a577, roughness: 0.55, envMapIntensity: 0.3 }), st, wk.h + 0.06)));                                         // baguette de chêne clair
      const gl = hang(st, new THREE.Mesh(new THREE.PlaneGeometry(wk.w, wk.h), reveal(std({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.02, envMapIntensity: 2.4, depthWrite: false }), st, wk.h + 0.06)), false); gl.position.z = 0.028; gl.renderOrder = 3; }
    // vapeur : elle part des récipients du dessin et vient vers le visage
    const SRC = [[0.5, 0.56], [0.594, 0.56], [0.79, 0.66], [0.315, 0.84]], N = 84, base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv; geo.instanceCount = N;
    const a0 = new Float32Array(N * 4); for (let i = 0; i < N; i++) { const s = SRC[i % (i % 5 === 4 ? 4 : 3)]; a0.set([(s[0] - 0.5) * wk.w * 0.94, (s[1] - 0.5) * wk.h * 0.94, rnd(), rnd()], i * 4); } geo.setAttribute('aS', new THREE.InstancedBufferAttribute(a0, 4));
    const sm2 = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTex: { value: soft }, uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: `attribute vec4 aS;uniform float uT,uA;varying vec2 vUv;varying float vA;
        void main(){ vUv=uv; float life=fract(uT*.085+aS.z); float e=life*life*(3.-2.*life); vec3 o=vec3(aS.x,aS.y,.03);
          o.y+=life*.36; o.x+=sin(life*7.+aS.w*6.283)*.026*life+(aS.w-.5)*.06*life; o.z+=e*.34; float s=.014+life*.1;
          vA=uA*smoothstep(0.,.1,life)*(1.-smoothstep(.5,1.,life))*.62; vec4 mv=modelViewMatrix*vec4(o,1.); mv.xy+=position.xy*s; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: 'uniform sampler2D uTex;varying vec2 vUv;varying float vA;void main(){float a=texture2D(uTex,vUv).a*vA;gl_FragColor=vec4(vec3(.5,.42,.36),a);}' });
    const steam = new THREE.Mesh(geo, sm2); steam.frustumCulled = false; steam.renderOrder = 4; st.g.add(steam);
    Object.assign(st.fx, { beat: 0, pulse: 0 });
    upd.push((t, dt) => { if (!ds.visible) return; const fx = st.fx; fx.pulse *= 0.93; sm2.uniforms.uA.value += ((fx.on ? 1 : 0) - sm2.uniforms.uA.value) * 0.03; sm2.uniforms.uT.value += dt * (0.35 + 0.65 * W.dsTime); }); }

  flush();

  /* ================================================================ visiteurs : échos de la galerie ouverte, en 2026 */
  // Silhouettes en grain fin (trame stochastique), qui marchent, s'arrêtent devant un mur, repartent. Leurs reflets suivent.
  // Une première passe n'écrit que la profondeur : la silhouette se fond ensuite en une seule couche, sans voir ses propres membres par transparence.
  const ghost = HOLO ? std({ color: 0x000000, emissive: 0x7fdfe8, emissiveIntensity: 0.5, roughness: 1, envMapIntensity: 0, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending })
    : std({ color: 0x20252b, roughness: 0.9, envMapIntensity: 0.15, transparent: true, opacity: 0.5, depthWrite: false });
  ghost.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', HOLO // hologramme : contour lumineux, tranches fines ; variante claire : silhouette pleine
    ? '#include <dithering_fragment>\n gl_FragColor.a*=.62+.38*step(.5,fract(gl_FragCoord.y*.25));'
    : '#include <dithering_fragment>\n gl_FragColor.a*=.42+.58*pow(clamp(dot(normalize(vViewPosition),normal),0.,1.),.6);'); };
  ghost.customProgramCacheKey = () => 'echo';
  const ghostDepth = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const blob = HOLO ? new THREE.MeshBasicMaterial({ map: soft, color: 0x7fdfe8, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }) : new THREE.MeshBasicMaterial({ map: soft, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const WALK = [ // boucles de marche : [x, z, pause en s]
    [[5, -12.2, 0], [11.6, -15.2, 7], [12.4, -18.4, 6], [4.2, -17.4, 0]], [[4, -23, 0], [12.6, -27, 8], [8, -30.6, 6], [2.4, -27.6, 7]],
    [[-9.4, -29.6, 7], [-3.4, -30.4, 0], [-2.6, -27.4, 6]], [[-9.2, -4.3, 0], [-13.4, -4.8, 8], [-10.6, -8.1, 6], [-13.3, -8.2, 7]]];
  const STAND = [[-10.85, 0, -1.7, PI], [9.6, 0, -2.0, PI], [-17.2, 0, -15.6, -PI / 2], [13.5, L1, -4.2, PI / 2], [-11.9, 0, -5.1, PI]];
  new GLTFLoader().load('assets/models/visiteur.glb', (gl) => {
    const clip = (n) => gl.animations.find((a) => a.name === n), all = []; let k0 = 1;
    { gl.scene.updateMatrixWorld(true); let lo = 1e9, hi = -1e9; const v = new V3(); gl.scene.traverse((o) => { if (o.isBone) { v.setFromMatrixPosition(o.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } }); k0 = 1.74 / Math.max(0.01, hi - lo); } // taille mesurée sur le squelette
    const make = (walker) => { const root = cloneSkinned(gl.scene), holder = new THREE.Group(); holder.add(root); root.scale.multiplyScalar(k0 * rnd(0.93, 1.06)); ds.add(holder);
      const sk = []; root.traverse((o) => { if (o.isSkinnedMesh) sk.push(o); });
      for (const o of sk) { o.material = ghost; o.frustumCulled = false; o.castShadow = false; o.renderOrder = 2; const d = new THREE.SkinnedMesh(o.geometry, ghostDepth); d.bind(o.skeleton, o.bindMatrix); d.frustumCulled = false; d.renderOrder = 1; o.parent.add(d); }
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), blob); b.rotation.x = -PI / 2; b.position.y = 0.008; holder.add(b);
      const mixer = new THREE.AnimationMixer(root), idle = mixer.clipAction(clip('idle')), walk = mixer.clipAction(clip('walk')); idle.play(); walk.play(); walk.setEffectiveWeight(0); idle.time = rnd(2); mixer.update(0);
      const v = { holder, mixer, idle, walk, sk, w: 0, walker }; all.push(v); return v; };
    const nW = touch || lite ? 2 : WALK.length, nS = touch || lite ? 3 : STAND.length;
    for (let i = 0; i < nW; i++) { const v = make(true), pts = WALK[i]; v.pts = pts; v.i = 0; v.wait = pts[0][2] * rnd(); v.holder.position.set(pts[0][0], 0, pts[0][1]); v.yaw = rnd(PI * 2); }
    for (let i = 0; i < nS; i++) { const v = make(false), s = STAND[i]; v.holder.position.set(s[0], s[1], s[2]); v.holder.rotation.y = s[3]; }
    ds.updateMatrixWorld(true); for (const v of all) if (v.holder.position.y < 1) for (const o of v.sk) twin(o);
    const d = new V3();
    upd.push((t, dt) => { if (!ds.visible) return; const ts = W.dsTime;
      for (const v of all) { if (v.walker) { const tg = v.pts[v.i]; d.set(tg[0] - v.holder.position.x, 0, tg[1] - v.holder.position.z); const dist = d.length(); let moving = false;
          if (dist < 0.08) { if (v.wait <= 0) v.wait = tg[2]; v.wait -= dt * ts; if (v.wait <= 0) { v.i = (v.i + 1) % v.pts.length; v.wait = 0; } }
          else { moving = true; d.multiplyScalar(1 / dist); v.holder.position.addScaledVector(d, Math.min(dist, 0.82 * dt * ts * (0.3 + 0.7 * v.w))); const ty = Math.atan2(d.x, d.z); v.yaw += Math.atan2(Math.sin(ty - v.yaw), Math.cos(ty - v.yaw)) * Math.min(1, dt * 4 * ts); }
          v.w += ((moving ? 1 : 0) - v.w) * Math.min(1, dt * 3 * ts); v.walk.setEffectiveWeight(v.w); v.idle.setEffectiveWeight(1 - v.w); v.walk.timeScale = 0.72; v.holder.rotation.y = v.yaw; }
        v.mixer.update(dt * ts); } });
  });

  /* ================================================================ interface du module */
  // changement d'échelle (œuvre 3) : la galerie grandit autour du point où tu te tiens ; le plan du sol ne bouge pas
  const base = new V3(0, DSY, 0), feet = new V3();
  W.setScale = (s, fx = 0, fy = DSY, fz = 0) => { feet.set(fx, fy, fz); ds.scale.setScalar(s); ds.position.copy(feet).multiplyScalar(1 - s).addScaledVector(base, s); if (s !== 1) sun.shadow.needsUpdate = true; W.dsScale = s; };
  W.dsScale = 1;
  // plan de la galerie pour la mini-carte : murs, vitrages et mobilier, plus le tracé du parcours
  W.planDs = { walls: [[-15.2, 0, GX0, 0], [GX1, 0, 15.3, 0], [15.3, 0, 15.3, -32.3], [15.3, -32.3, -15.2, -32.3], [-15.2, -32.3, -15.2, -18.9], [-15.2, -18.9, -18.6, -18.9], [-18.6, -18.9, -18.6, -11.5], [-18.6, -11.5, -15.2, -11.5], [-15.2, -11.5, -15.2, 0], [7.2, -3.5, 7.2, -13], [7.2, -13, 15.3, -13], [7.2, -3.5, 15.3, -3.5], [-14.2, -9.5, -14.2, -6.5], [-8.2, -9.5, -8.2, -6.5], [-15.2, -9.7, -6.5, -9.7], [-3.7, -9.7, -0.8, -9.7], [1.7, -9.7, 7.2, -9.7], [-0.8, -9.7, -0.8, -16.7]],
    soft: [[GX0, 0, DX0, 0], [DX1, 0, GX1, 0]], boxes: [[-0.8, -26, 0.4, 7], [-6.6, -20, 9.2, 0.4], [5.85, -20, 8.3, 0.4], [4.9, -2.2, 4.6, 1.6], [-11.5, -2.6, 2, 0.8], [-11.2, -9.1, 4.1, 0.8], [10.5, -2.7, 4.6, 0.6], ...UNITS.map(([x, z, s]) => [x, z, s, s]), ...PLINTHS.map(([x, z, s]) => [x, z, s, s])], path: [] };
  for (const c of W.legs) { const n = Math.ceil(c.getLength() / 0.6); for (let i = 0; i <= n; i++) { const p = c.getPointAt(i / n); W.planDs.path.push(p.x, p.z); } }
  W.dsLook = HOLO ? { bg: new THREE.Color(0x020306), fog: new THREE.Color(0x050a0f), density: 0.012, forest: new THREE.Color(0x9a5646), exposure: 1.1, bloom: 0.92, bloomBase: 0.42 }
    : { bg: new THREE.Color(0xe6eaee), fog: new THREE.Color(0xe2e7eb), density: 0.0075, forest: new THREE.Color(0xd78f72), exposure: 1.5, bloom: 1.3, bloomBase: 0.22 };
}
