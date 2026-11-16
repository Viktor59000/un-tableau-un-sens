// SPES — décors 3D : baie cryogénique, hublots, espace, danse sensorielle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Palette du Canva (page « Couleurs »)
export const COL = { steel: 0x4c6783, cyan: 0x7fe3e6, pale: 0xb9d6f2, coral: 0xff4f38, lime: 0xa8e61d,
  safran: 0xf5c400, amber: 0xfca311, ocre: 0xd59639, white: 0xf1f2f4 };

const PI = Math.PI, V3 = THREE.Vector3;
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }`;

const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
const addGlow = (hex, k, op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const hexCss = (h) => '#' + new THREE.Color(h).getHexString();
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/* ---------- textures procédurales ---------- */
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function shaftTex() { // rideau de lumière sous les rampes
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,.95)'); v.addColorStop(0.5, 'rgba(255,255,255,.25)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in'; const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.3, 'rgba(0,0,0,1)'); h.addColorStop(0.7, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
function textPlane(lines, { color = '#7fe3e6', w = 512, size = 44, sub = 24, scale = 1.6, align = 'left', lh = 1.25 } = {}) {
  const h = Math.ceil(size * 1.5 + (lines.length - 1) * sub * lh + 14), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.textAlign = align; const x = align === 'center' ? w / 2 : 10; g.fillStyle = color;
  g.font = `600 ${size}px Rajdhani, sans-serif`; g.fillText(lines[0], x, size * 0.75);
  g.globalAlpha = 0.78; g.font = `500 ${sub}px Rajdhani, sans-serif`; for (let i = 1; i < lines.length; i++) g.fillText(lines[i], x, size * 1.5 + (i - 0.5) * sub * lh);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * h / w), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function circuitTex() { // motif « circuit » du Canva (page effets)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'); g.strokeStyle = '#7fe3e6'; g.fillStyle = '#7fe3e6'; g.lineWidth = 2;
  for (let i = 0; i < 64; i++) { let x = rnd(1024), y = rnd(512); const dirs = [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1]]; let d = dirs[0]; g.globalAlpha = rnd(0.25, 0.9); g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { const len = rnd(30, 150); x += d[0] * len; y += d[1] * len; g.lineTo(x, y); d = dirs[(Math.random() * 3) | 0]; } g.stroke(); g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function colored(geo, col, m) { geo = geo.index ? geo.toNonIndexed() : geo; geo.applyMatrix4(m); const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(col, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
function bodyGeo() { // un dormeur allongé (tête vers -X), sans la tête : combinaison de stase, harnais, articulations, bottes
  const M = (x, y, z, sx = 1, sy = 1, sz = 1, rz = 0, ry = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new V3(sx, sy, sz));
  const skin = [0.62, 0.46, 0.37], suit = [0.17, 0.22, 0.28], suit2 = [0.1, 0.13, 0.17], dark = [0.035, 0.04, 0.05], acc = [0.95, 0.45, 0.22], p = [], H = PI / 2;
  p.push(colored(new THREE.CylinderGeometry(0.047, 0.055, 0.1, 12), skin, M(-0.735, 0.1, 0, 1, 1, 1, H)));
  p.push(colored(new THREE.TorusGeometry(0.066, 0.016, 8, 20), dark, M(-0.69, 0.1, 0, 1, 1, 1, 0, H)));
  p.push(colored(new THREE.CapsuleGeometry(0.135, 0.3, 6, 16), suit, M(-0.44, 0.11, 0, 1, 0.72, 1.16, H)));          // thorax
  p.push(colored(new THREE.CapsuleGeometry(0.115, 0.12, 6, 14), suit2, M(-0.19, 0.1, 0, 1, 0.7, 1.08, H)));        // abdomen
  p.push(colored(new THREE.CapsuleGeometry(0.128, 0.08, 6, 14), suit, M(-0.03, 0.1, 0, 1, 0.72, 1.14, H)));           // bassin
  p.push(colored(new RoundedBoxGeometry(0.2, 0.03, 0.2, 2, 0.012), suit2, M(-0.47, 0.2, 0)));                      // plastron
  p.push(colored(new THREE.BoxGeometry(0.035, 0.012, 0.15), acc, M(-0.47, 0.218, 0)));
  p.push(colored(new THREE.TorusGeometry(0.13, 0.012, 6, 20), dark, M(-0.11, 0.1, 0, 1, 0.72, 1.12, 0, H)));         // ceinture
  for (const s of [-1, 1]) {
    p.push(colored(new THREE.SphereGeometry(0.066, 12, 10), suit2, M(-0.6, 0.1, s * 0.2, 1, 0.85, 1)));            // épaule
    p.push(colored(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), suit, M(-0.45, 0.085, s * 0.255, 1, 1, 1, H)));        // bras
    p.push(colored(new THREE.SphereGeometry(0.05, 10, 8), suit2, M(-0.31, 0.08, s * 0.262)));                         // coude
    p.push(colored(new THREE.CapsuleGeometry(0.043, 0.2, 4, 10), suit, M(-0.17, 0.075, s * 0.262, 1, 1, 1, H)));       // avant-bras
    p.push(colored(new THREE.TorusGeometry(0.044, 0.01, 6, 14), dark, M(-0.05, 0.072, s * 0.262, 1, 1, 1, 0, H)));     // poignet
    p.push(colored(new THREE.SphereGeometry(0.046, 10, 8), skin, M(0.0, 0.062, s * 0.262, 1.5, 0.55, 1)));            // main
    p.push(colored(new THREE.CapsuleGeometry(0.078, 0.3, 4, 12), suit, M(0.23, 0.095, s * 0.095, 1, 0.9, 1, H)));      // cuisse
    p.push(colored(new THREE.SphereGeometry(0.068, 10, 8), suit2, M(0.44, 0.095, s * 0.095)));                        // genou
    p.push(colored(new THREE.CapsuleGeometry(0.058, 0.3, 4, 12), suit, M(0.64, 0.085, s * 0.095, 1, 1, 1, H)));        // jambe
    p.push(colored(new RoundedBoxGeometry(0.11, 0.21, 0.095, 2, 0.02), dark, M(0.9, 0.12, s * 0.095)));               // botte
    p.push(colored(new THREE.TorusGeometry(0.062, 0.012, 6, 14), dark, M(0.82, 0.085, s * 0.095, 1, 1, 1, 0, H)));
  }
  for (const g of p) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(p);
}

export function buildWorld(scene, loader, works) {
  const W = { timeU: [] }; const upd = [];
  const soft = softTex(), shaft = shaftTex();
  const U = (m) => { W.timeU.push(m.uniforms.uTime); return m; };

  /* ================= MATÉRIAUX ================= */
  const pbr = (name, rx, ry, o, rough) => { const mk = (suf, srgb) => { const t = loader.load('assets/tex/pbr/' + name + '_' + suf + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return new THREE.MeshStandardMaterial(Object.assign({ map: mk('diff', true), normalMap: mk('nor', false), envMapIntensity: 0.55 }, rough ? { roughnessMap: mk('rough', false) } : {}, o)); };
  const mMetal = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.55 });
  const mPanel = new THREE.MeshStandardMaterial({ color: 0x2c343c, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.4 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x0c0f13, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.3 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0xc4e8f0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2 });
  const mBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.1, envMapIntensity: 0.5 });
  const mBot = new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.8 }), mBotD = new THREE.MeshStandardMaterial({ color: 0x15191e, metalness: 0.7, roughness: 0.45 });
  const frostTex = (() => { const w = 256, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
    const hs = (x, y) => { const t = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return t - Math.floor(t); }, sm3 = (t) => t * t * (3 - 2 * t);
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm3(x - xi), fy = sm3(y - yi); return (hs(xi, yi) * (1 - fx) + hs(xi + 1, yi) * fx) * (1 - fy) + (hs(xi, yi + 1) * (1 - fx) + hs(xi + 1, yi + 1) * fx) * fy; };
    const fb = (x, y) => vn(x, y) * 0.5 + vn(x * 2.1, y * 2.1) * 0.25 + vn(x * 4.3, y * 4.3) * 0.125 + vn(x * 8.7, y * 8.7) * 0.0625;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = x / w, v = y / h, n = fb(u * 7, v * 16) + fb(u * 30, v * 60) * 0.5, rim = Math.max(0, 1 - Math.min(u, 1 - u) / 0.22), ends = Math.max(0, 1 - Math.min(v, 1 - v) / 0.09);
      const streak = Math.pow(vn(u * 3, v * 90), 3), cr = Math.pow(fb(u * 46, v * 92), 3) * 2.2, a = Math.min(0.85, (Math.max(rim * rim, ends) * 0.85 + Math.max(0, n - 1.02) * 1.6 + streak * 0.12) * (0.55 + n * 0.45)), l = Math.min(1, 0.34 + cr + n * 0.18), k = (y * w + x) * 4;
      d[k] = 0.42 * l * 255; d[k + 1] = 0.56 * l * 255; d[k + 2] = 0.64 * l * 255; d[k + 3] = a * 0.74 * 255; }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
  const frostMats = [0, 0.37, 0.71].map((o) => { const t = frostTex.clone(); t.offset.y = o; t.needsUpdate = true; return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide }); });

  /* ================= BAIE CRYOGÉNIQUE ================= */
  const bay = new THREE.Group(); scene.add(bay); W.bay = bay;
  const BW = 11, BH = 5, Z0 = -15, Z1 = 17, BL = Z1 - Z0, ZC = (Z0 + Z1) / 2;
  add(bay, new THREE.PlaneGeometry(BW, BL), pbr('metal_plate_02', 4, 12, { color: 0x858d95, metalness: 0.8, roughness: 0.9, envMapIntensity: 0.45 }, true), 0, 0, ZC).rotation.x = -PI / 2;
  add(bay, new THREE.PlaneGeometry(BW, BL), pbr('metal_plate_02', 4, 12, { color: 0x6c747c, metalness: 0.7, roughness: 0.9 }, true), 0, BH, ZC).rotation.x = PI / 2;
  const mWall = pbr('blue_metal_plate', 11, 1.7, { color: 0xaab4bf, metalness: 0.55, roughness: 0.58 });
  add(bay, new THREE.PlaneGeometry(BL, BH), mWall, -BW / 2, BH / 2, ZC).rotation.y = PI / 2;
  add(bay, new THREE.PlaneGeometry(BL, BH), mWall, BW / 2, BH / 2, ZC).rotation.y = -PI / 2;
  add(bay, new THREE.PlaneGeometry(BW, BH), pbr('blue_metal_plate', 4, 1.7, { color: 0xaab4bf, metalness: 0.55, roughness: 0.58 }), 0, BH / 2, Z1).rotation.y = PI;
  add(bay, new THREE.BoxGeometry(2.3, 0.03, BL), pbr('metal_plate', 1.6, 22, { color: 0xc4ccd4, metalness: 0.85, roughness: 0.5 }), 0, 0.015, ZC);
  W.guideMat = glow(COL.cyan, 1.3);
  add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, -1.25, 0.035, ZC); add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, 1.25, 0.035, ZC);
  const barMat = glow(COL.pale, 2.6), slitMat = glow(COL.steel, 1.5), shaftMat = new THREE.MeshBasicMaterial({ map: shaft, color: 0xb9d6f2, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const gPillar = rbox(0.4, BH, 0.45, 0.08), gBeam = rbox(BW, 0.32, 0.45, 0.08), gStrut = new THREE.BoxGeometry(0.14, 1.5, 0.3), gBar = new THREE.BoxGeometry(2.4, 0.05, 0.14),
    gSlit = new THREE.BoxGeometry(0.05, 1.5, 0.1), gPan = rbox(0.14, 1.1, 1.9, 0.05), gShaft = new THREE.PlaneGeometry(3.0, 4.4), gTray = new THREE.BoxGeometry(0.5, 0.06, 2.6), gClamp = new THREE.BoxGeometry(0.34, 0.2, 0.08);
  for (let z = Z0 + 1.3; z < Z1; z += 2.6) {
    for (const s of [-1, 1]) {
      add(bay, gPillar, mMetal, s * (BW / 2 - 0.2), BH / 2, z); add(bay, gStrut, mMetal, s * (BW / 2 - 0.75), BH - 0.75, z).rotation.z = s * 0.75; add(bay, gClamp, mDark, s * 4.3, 4.56, z);
      if (z + 1.3 < Z1) { add(bay, gSlit, slitMat, s * (BW / 2 - 0.04), 2.6, z + 1.3); add(bay, gPan, mPanel, s * (BW / 2 - 0.07), 0.75, z + 1.3); add(bay, gPan, mMetal, s * (BW / 2 - 0.07), 4.05, z + 1.3); add(bay, gTray, mDark, s * 1.0, 4.82, z + 1.3); }
    }
    add(bay, gBeam, mMetal, 0, BH - 0.16, z); add(bay, gBar, barMat, 0, BH - 0.345, z); add(bay, gShaft, shaftMat, 0, BH - 0.37 - 2.2, z);
  }
  for (const [x, y, r] of [[-4.6, 4.5, 0.09], [4.6, 4.5, 0.09], [-3.9, 4.72, 0.14], [3.9, 4.72, 0.06], [-4.25, 4.55, 0.05], [4.25, 4.6, 0.045]])
    add(bay, new THREE.CylinderGeometry(r, r, BL, 10), mMetal, x, y, ZC).rotation.x = PI / 2;
  add(bay, rbox(2.6, 3.4, 0.2, 0.08), mMetal, 0, 1.7, Z1 - 0.1); add(bay, new THREE.BoxGeometry(1.2, 0.05, 0.05), glow(COL.coral, 2), 0, 3.6, Z1 - 0.22);
  bay.add(new THREE.AmbientLight(0x5a7088, 0.16)); bay.add(new THREE.HemisphereLight(0x7d9cbd, 0x0b0d11, 0.3));
  W.shadowLights = [];
  for (const z of [10.5, -10.5]) { const f = new THREE.PointLight(0xb9d6f2, 16, 16, 2); f.position.set(0, BH - 0.7, z); bay.add(f); }
  { const sp = new THREE.SpotLight(0xd6e6f5, 150, 20, 1.12, 0.85, 1.6); sp.position.set(0, BH - 0.42, 1); sp.target.position.set(0, 0, 1); sp.castShadow = true;
    sp.shadow.mapSize.set(1536, 1536); sp.shadow.camera.near = 0.4; sp.shadow.camera.far = 11; sp.shadow.bias = -0.0005; sp.shadow.normalBias = 0.03; sp.shadow.autoUpdate = false; sp.shadow.needsUpdate = true; bay.add(sp, sp.target); W.shadowLights.push(sp); W.keyLight = sp; }
  const es = new THREE.PointLight(0xe0a868, 9, 11, 2); es.position.set(-0.6, 2.4, Z0 + 1.2); bay.add(es); const esBase = new THREE.Color(0xe0a868), esArc = new THREE.Color(0xbfe0ff), keyBase = new THREE.Color(0xd6e6f5), keyAmber = new THREE.Color(COL.amber);
  W.beacon = { intensity: 0 }; // gyrophare de réveil : il teinte le projecteur principal (voir update)
  // signalétique holographique (contexte)
  const sgn = textPlane(['PONT 12 — BAIE CRYO C', 'cohorte R-26   ·   2 000 sujets en stase niv. 4', 'réveillés : 0001   ·   cycle J+173 141'], { color: '#7fe3e6', w: 620, size: 54, sub: 27, scale: 2.1, align: 'center' }); sgn.position.set(0, 3.0, -5.2); bay.add(sgn);
  const chrono = textPlane(['JOURNAL DE BORD — SPES-07', '2026 · embarquement de la cohorte R-26', '2140 · indice de Voile > 9 : la Grande Poussière', '2318 · dernier signal terrestre capté', '2500 · protocole RÉSONANCE — sujet R26-0417'], { color: '#f5c400', w: 660, size: 44, sub: 27, scale: 2.5 });
  chrono.position.set(-BW / 2 + 0.3, 2.5, -11.6); chrono.rotation.y = PI / 2; bay.add(chrono);
  for (const [txt, z] of [['▲ OBSERVATION', -7], ['C-12', 8]]) { const d = textPlane([txt], { color: '#c8d2dc', w: 640, size: 84, scale: 1.9, align: 'center' }); d.material.blending = THREE.NormalBlending; d.material.opacity = 0.32; d.rotation.x = -PI / 2; d.position.set(0, 0.034, z); bay.add(d); }

  // --- caissons ---
  const gBase = rbox(2.5, 0.55, 1.05, 0.12), gBed = rbox(2.2, 0.12, 0.8, 0.05), gPlinth = new THREE.BoxGeometry(2.0, 0.12, 0.8), gLid = new THREE.CylinderGeometry(0.52, 0.52, 2.2, 28, 1, true, 0, PI),
    gFrost = new THREE.CylinderGeometry(0.512, 0.512, 2.19, 28, 1, true, 0, PI), gHead = rbox(0.35, 0.9, 1.05, 0.08), gFoot = rbox(0.25, 0.7, 1.05, 0.08), gEdge = new THREE.BoxGeometry(2.0, 0.025, 0.025),
    gStat = new THREE.BoxGeometry(0.02, 0.07, 0.5), gBody = bodyGeo(), gBedGlow = new THREE.PlaneGeometry(2.1, 0.74), gRib = new THREE.TorusGeometry(0.53, 0.018, 6, 20, PI), gVent = new THREE.BoxGeometry(0.02, 0.3, 0.6);
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-1.42, 0.95, 0), new V3(-1.8, 1.5, 0.12), new V3(-1.98, 2.4, 0.05), new V3(-2.0, 3.4, 0)]), 16, 0.035, 6);
  const edgeMat = glow(COL.cyan, 1.1), bedGlow = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(0.55), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  W.statMats = []; const bodies = [], headSlots = [], gPillow = rbox(0.3, 0.05, 0.34, 0.02), gBand = new THREE.TorusGeometry(0.094, 0.007, 6, 28);
  function pod(mine, num) {
    const g = new THREE.Group();
    add(g, gPlinth, mDark, 0, 0.06, 0); add(g, gBase, mMetal, 0, 0.36, 0); add(g, gBed, mDark, 0, 0.66, 0); add(g, gHead, mPanel, -1.3, 0.6, 0); add(g, gFoot, mPanel, 1.28, 0.5, 0);
    add(g, gEdge, edgeMat, 0, 0.72, 0.43); add(g, gEdge, edgeMat, 0, 0.72, -0.43); add(g, cable, mDark); add(g, cable, mDark, 0, 0, 0.3); add(g, gVent, mDark, 1.41, 0.32, 0);
    if (!mine) add(g, gBedGlow, bedGlow, 0, 0.727, 0).rotation.x = -PI / 2;
    const sm2 = glow(mine ? COL.amber : COL.cyan, 2); sm2.userData.mine = mine; W.statMats.push(sm2); add(g, gStat, sm2, 1.41, 0.62, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.66, -0.5); g.add(pivot);
    add(pivot, gLid, mGlass, 0, 0, 0.5).rotation.z = PI / 2;
    for (const x of [-1.06, 0, 1.06]) add(pivot, gRib, mMetal, x, 0, 0.5).rotation.y = PI / 2;
    if (!mine) { add(pivot, gFrost, frostMats[(Math.random() * 3) | 0], 0, 0, 0.5).rotation.z = PI / 2; const b = add(g, gBody, mBody, 0.04, 0.72, 0); b.scale.setScalar(rnd(0.94, 1.02)); b.userData.ph = rnd(6); bodies.push(b);
      add(g, gPillow, mDark, -0.9, 0.745, 0); const hs = new THREE.Group(); hs.position.set(-0.782, 0.862, 0); g.add(hs); headSlots.push(hs);
      const hb = add(hs, gBand, mBotD, -0.125, 0.0, 0); hb.rotation.y = PI / 2; add(hs, new THREE.SphereGeometry(0.008, 6, 6), glow(COL.cyan, 3), -0.125, 0.092, 0.03); }
    if (!mine) { const lb = textPlane([num, 'STASE NIV.4 · ' + ((rnd(5) | 0) + 6) + ' bpm'], { color: '#7fe3e6', w: 320, size: 46, sub: 26, scale: 0.56 }); lb.position.set(1.42, 1.18, 0); lb.rotation.y = PI / 2; g.add(lb); }
    g.userData.pivot = pivot; return g;
  }
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) {
    if (s === 1 && i === 0) continue; // emplacement du poste de liaison
    const z = -11.7 + i * 2.6, mine = (s === -1 && i === 5), p = pod(mine, 'R26-0' + (s === -1 ? 412 + i : 436 + i)); p.position.set(s * 3.5, 0, z); if (s === 1) { p.rotation.y = PI; p.traverse((o) => { o.userData.right = true; }); } bay.add(p);
    if (mine) {
      W.lidPivot = p.userData.pivot;
      const frost = U(new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime: { value: 0 }, uClear: { value: 0 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float uTime,uClear;varying vec2 vUv;${NOISE}
          void main(){ vec2 p=vUv*vec2(5.,9.); float n=fbm(p)+fbm(p*4.)*.5; float d=distance(vUv,vec2(.5,.74))*1.7;
            float frost=smoothstep(uClear*1.9-.35,uClear*1.9,d+n*.22); float cr=pow(fbm(p*9.),3.)*2.;
            vec3 col=mix(vec3(.30,.42,.50),vec3(.80,.92,1.),n*.7)+cr; gl_FragColor=vec4(col*.36,frost*(.74+n*.22)); }` }));
      W.frost = frost.uniforms.uClear; add(W.lidPivot, new THREE.CylinderGeometry(0.5, 0.5, 2.18, 22, 1, true, 0, PI), frost, 0, 0, 0.5).rotation.z = PI / 2;
    }
  }
  upd.push((t) => { for (const b of bodies) b.scale.y = b.scale.x * (1 + Math.sin(t * 0.5 + b.userData.ph) * 0.035); });
  const mist = [], mistMat = new THREE.SpriteMaterial({ map: soft, color: 0x9fc4d8, transparent: true, opacity: 0.08, depthWrite: false });
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(mistMat); s.position.set(rnd(-5, 5), rnd(0.2, 1.1), rnd(Z0, Z1)); const k = rnd(3, 6.5); s.scale.set(k, k * 0.55, 1); s.userData.v = rnd(-0.25, 0.25); bay.add(s); mist.push(s); }

  /* ---------- vie robotique ---------- */
  const beamGeo = new THREE.ConeGeometry(0.55, 1.7, 24, 1, true);
  // bras de maintenance sur rail (un par rangée) : va de caisson en caisson, descend, scanne, repart
  function gantry(side, seq, off, hold) {
    add(bay, new THREE.BoxGeometry(0.12, 0.1, BL), mMetal, side * 2.2, 4.64, ZC); add(bay, new THREE.BoxGeometry(0.03, 0.02, BL), glow(COL.steel, 1.2), side * 2.2, 4.585, ZC);
    const car = new THREE.Group(); car.position.set(side * 2.2, 4.5, 0); bay.add(car); add(car, rbox(0.5, 0.22, 0.42, 0.05), mBot); add(car, new THREE.BoxGeometry(0.52, 0.03, 0.1), glow(COL.safran, 1.6), 0, 0, 0.17);
    const sh = new THREE.Group(); sh.position.y = -0.12; car.add(sh); add(sh, new THREE.SphereGeometry(0.1, 14, 10), mBotD); add(sh, rbox(0.11, 1.3, 0.11, 0.03), mBot, 0, -0.65, 0); add(sh, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), mBotD, 0.08, -0.65, 0);
    const el = new THREE.Group(); el.position.y = -1.3; sh.add(el); add(el, new THREE.SphereGeometry(0.085, 14, 10), mBotD); add(el, rbox(0.085, 1.3, 0.085, 0.03), mBot, 0, -0.65, 0);
    const wr = new THREE.Group(); wr.position.y = -1.3; el.add(wr); add(wr, new THREE.CylinderGeometry(0.07, 0.04, 0.2, 14), mBotD, 0, -0.1, 0);
    const tip = add(wr, new THREE.SphereGeometry(0.03, 8, 8), glow(COL.cyan, 4), 0, -0.22, 0), beam = add(wr, beamGeo, addGlow(COL.cyan, 1, 0.09), 0, -1.07, 0), lt = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); lt.position.y = -0.24; lt.scale.setScalar(0.5); wr.add(lt);
    for (const f of [-1, 1]) add(wr, new THREE.BoxGeometry(0.015, 0.14, 0.03), mBot, f * 0.045, -0.26, 0).rotation.z = f * 0.25;
    let rel = null; upd.push((t) => { const T = 11; let tt = t + off; if (hold) { if (W.wakeHold) tt = T * 0.4; else { if (rel === null) rel = t; tt = t - rel + T * 0.6; } } const n = Math.floor(tt / T), u = (tt % T) / T, L = seq.length, zA = -11.7 + seq[((n % L) + L) % L] * 2.6, zB = -11.7 + seq[(((n + 1) % L) + L) % L] * 2.6;
      const work = sm(0.02, 0.16, u) * (1 - sm(0.62, 0.76, u)); car.position.z = zA + (zB - zA) * sm(0.76, 1, u);
      sh.rotation.z = side * (1.25 - work * 0.5 + Math.sin(t * 1.3) * 0.02 * work); el.rotation.z = side * (-2.3 + work * 2.05); wr.rotation.z = side * (0.5 - work * 0.95) + Math.sin(t * 2.1) * 0.1 * work;
      const on = work > 0.9 ? 1 : 0; beam.material.opacity = (hold && W.wakeHold ? 0 : on) * (0.045 + 0.02 * Math.sin(t * 17)); lt.material.opacity = on * (0.75 + 0.25 * Math.sin(t * 23)); tip.material.color.setHex(on ? COL.cyan : COL.safran).multiplyScalar(4); });
  }
  W.wakeHold = true; gantry(-1, [5, 9, 2, 7, 0, 11, 4], 0, true); gantry(1, [3, 8, 1, 10, 6], 6.5, false);
  // drones de surveillance : balayent les rangées avec un faisceau
  function drone(path) {
    const d = new THREE.Group(); add(d, rbox(0.4, 0.13, 0.28, 0.05), mBot); add(d, rbox(0.2, 0.08, 0.2, 0.03), mBotD, 0, 0.09, 0); add(d, new THREE.SphereGeometry(0.045, 12, 10), glow(COL.coral, 3), 0, 0, 0.14);
    for (const [x, z] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]]) { add(d, new THREE.CylinderGeometry(0.035, 0.05, 0.06, 10), mBotD, x, -0.08, z); add(d, new THREE.CircleGeometry(0.03, 10), glow(COL.pale, 3), x, -0.112, z).rotation.x = PI / 2; }
    add(d, new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), mBotD, -0.12, 0.2, -0.08);
    const beam = add(d, beamGeo, addGlow(COL.pale, 1, 0.07), 0, -0.92, 0); bay.add(d);
    let px = 0, pz = 0; upd.push((t) => { const p = path(t); d.position.set(p[0], p[1] + Math.sin(t * 1.9 + p[2]) * 0.04, p[2]); const dx = p[0] - px, dz = p[2] - pz; if (Math.abs(dx) + Math.abs(dz) > 1e-5) { const ta = Math.atan2(dx, dz); d.rotation.y += Math.atan2(Math.sin(ta - d.rotation.y), Math.cos(ta - d.rotation.y)) * 0.05; } px = p[0]; pz = p[2]; d.rotation.z = Math.sin(t * 0.8) * 0.05; beam.material.opacity = 0.05 + 0.03 * Math.sin(t * 9 + p[2]); });
  }
  drone((t) => [-4.35 + Math.sin(t * 0.21) * 0.22, 3.05, 1 + Math.sin(t * 0.09 + 0.5) * 12.5]);
  drone((t) => [4.35 + Math.sin(t * 0.17 + 2) * 0.22, 3.2, 1 + Math.sin(t * 0.075 + 2.4) * 12.5]);
  drone((t) => [Math.sin(t * 0.13) * 2.4, 3.9, -9.5 + Math.cos(t * 0.13) * 2.4]);
  // robots d'entretien au sol
  function rover(x, sp, ph) {
    const r = new THREE.Group(); add(r, rbox(0.56, 0.14, 0.38, 0.06), mBotD, 0, 0.11, 0); add(r, rbox(0.3, 0.07, 0.24, 0.03), mBot, -0.04, 0.2, 0); add(r, new THREE.SphereGeometry(0.05, 10, 8, 0, PI * 2, 0, PI / 2), glow(COL.amber, 2.5), 0.12, 0.23, 0);
    add(r, new THREE.BoxGeometry(0.02, 0.03, 0.3), glow(COL.pale, 3), 0.285, 0.12, 0); for (const z of [-0.2, 0.2]) add(r, new THREE.BoxGeometry(0.4, 0.015, 0.01), glow(COL.amber, 1.4), 0, 0.12, z);
    add(r, new THREE.CircleGeometry(0.5, 20), addGlow(COL.amber, 1, 0.1), 0.25, 0.012, 0).rotation.x = -PI / 2; bay.add(r);
    upd.push((t) => { const L = BL - 5, u = ((t * sp + ph) % (2 * L) + 2 * L) % (2 * L), fw = u < L; r.position.set(x, 0, Z0 + 2.5 + (fw ? u : 2 * L - u)); r.rotation.y = fw ? -PI / 2 : PI / 2; });
  }
  rover(-1.72, 0.55, 3); rover(1.72, 0.42, 21);
  upd.push((t) => {
    for (const s of mist) { s.position.x += s.userData.v * 0.016; if (s.position.x > 5.5) s.position.x = -5.5; if (s.position.x < -5.5) s.position.x = 5.5; }
    W.statMats.forEach((m, i) => { const on = Math.sin(t * 1.4 + i * 1.9) > -0.6; m.color.setHex(m.userData.mine ? COL.amber : COL.cyan).multiplyScalar(on ? 2 : 0.5); });
  });

  // --- mur des hublots ---
  const sh = new THREE.Shape(); sh.moveTo(-BW / 2, 0); sh.lineTo(BW / 2, 0); sh.lineTo(BW / 2, BH); sh.lineTo(-BW / 2, BH); sh.closePath();
  const WC = { x: 0, y: 2.55, r: 2.05 }, HOLES = [[WC.x, WC.y, WC.r], [-3.95, 2.7, 0.72], [3.95, 2.7, 0.72]];
  for (const [x, y, r] of HOLES) { const h = new THREE.Path(); h.absarc(x, y, r, 0, PI * 2, true); sh.holes.push(h); }
  add(bay, new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false, curveSegments: 48 }), mMetal, 0, 0, Z0 - 0.55);
  for (const [x, y, r] of HOLES) {
    add(bay, new THREE.TorusGeometry(r + 0.1, r > 1 ? 0.13 : 0.08, 14, 72), mPanel, x, y, Z0 + 0.02); add(bay, new THREE.TorusGeometry(r - 0.03, 0.016, 8, 72), glow(COL.steel, 2.2), x, y, Z0 + 0.06);
    add(bay, new THREE.TorusGeometry(r + 0.02, 0.05, 10, 72), mDark, x, y, Z0 - 0.5);
    add(bay, new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.3, depthWrite: false }), x, y, Z0 - 0.3);
  }
  const mt = new THREE.Matrix4(), bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), mMetal, 28);
  for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; mt.makeTranslation(WC.x + Math.cos(a) * 2.33, WC.y + Math.sin(a) * 2.33, Z0 + 0.03); bolts.setMatrixAt(i, mt); } bay.add(bolts);
  add(bay, rbox(4.4, 0.85, 0.7, 0.1), mPanel, 0, 0.42, Z0 + 0.75); add(bay, new THREE.BoxGeometry(4.2, 0.02, 0.03), glow(COL.cyan, 1.6), 0, 0.86, Z0 + 1.08);
  add(bay, new THREE.CylinderGeometry(0.025, 0.025, 4.6, 8), mBot, 0, 1.05, Z0 + 1.35).rotation.z = PI / 2; for (const x of [-2.2, 0, 2.2]) add(bay, new THREE.CylinderGeometry(0.02, 0.02, 1.05, 8), mBot, x, 0.52, Z0 + 1.35);
  const scr1 = textPlane(['ORBITE BASSE — TERRE', 'indice de Voile : 9,7 / 10', 'surface habitable : 3 %'], { color: '#ff4f38', w: 560, size: 44, sub: 28, scale: 1.45 }); scr1.position.set(-1.25, 1.14, Z0 + 0.8); scr1.rotation.x = -0.5; bay.add(scr1);
  const scr2 = textPlane(['FLOTTE HOPE', '212 arches en attente', 'SPES-07 · arche sensorielle'], { color: '#7fe3e6', w: 560, size: 44, sub: 28, scale: 1.45 }); scr2.position.set(1.25, 1.14, Z0 + 0.8); scr2.rotation.x = -0.5; bay.add(scr2);

  // --- poste de liaison neurale : fauteuil, câble cervical, casque ---
  const link = new THREE.Group(); link.position.set(3.25, 0, -11.4); link.rotation.y = 0.74; bay.add(link); // l'avant du fauteuil = -Z local (face au hublot)
  add(link, new THREE.CylinderGeometry(0.5, 0.6, 0.22, 28), mMetal, 0, 0.11, 0); add(link, new THREE.CylinderGeometry(0.52, 0.52, 0.02, 28), glow(COL.cyan, 0.9), 0, 0.225, 0); add(link, new THREE.CylinderGeometry(0.09, 0.12, 0.26, 12), mBotD, 0, 0.34, 0);
  const pad = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.85, metalness: 0.1 });
  add(link, rbox(0.62, 0.13, 0.62, 0.05), pad, 0, 0.52, -0.08); add(link, rbox(0.62, 1.0, 0.13, 0.05), pad, 0, 1.0, 0.36).rotation.x = 0.36; add(link, rbox(0.36, 0.24, 0.13, 0.05), pad, 0, 1.5, 0.56).rotation.x = 0.36;
  add(link, rbox(0.52, 0.11, 0.5, 0.05), pad, 0, 0.4, -0.62).rotation.x = -0.5; for (const s of [-1, 1]) { add(link, rbox(0.1, 0.08, 0.52, 0.03), mBot, s * 0.38, 0.74, -0.06); add(link, new THREE.BoxGeometry(0.012, 0.012, 0.5), glow(COL.cyan, 1.4), s * 0.435, 0.74, -0.06); add(link, rbox(0.06, 0.24, 0.06, 0.02), mBotD, s * 0.38, 0.62, 0.12); }
  add(link, new THREE.TorusGeometry(0.78, 0.05, 12, 64), mMetal, 0, 1.5, 0.74); W.linkGlow = glow(COL.cyan, 2.2); add(link, new THREE.TorusGeometry(0.7, 0.016, 8, 64), W.linkGlow, 0, 1.5, 0.74);
  const lr = [add(link, new THREE.TorusGeometry(0.56, 0.007, 6, 48), glow(COL.pale, 1.6), 0, 1.5, 0.74), add(link, new THREE.TorusGeometry(0.42, 0.007, 6, 48), glow(COL.cyan, 1.6), 0, 1.5, 0.74)];
  const sign = textPlane(['LIAISON N-7', 'danse sensorielle · lot 42-SE'], { color: '#7fe3e6', w: 560, size: 46, sub: 26, scale: 1.4, align: 'center' }); sign.position.set(0, 2.62, 0.74); sign.rotation.y = PI; link.add(sign);
  W.linkSpin = 1; upd.push((t, dt) => { lr[0].rotation.y += dt * 0.8 * W.linkSpin; lr[1].rotation.x += dt * 1.1 * W.linkSpin; });
  // casque : descend d'un bras télescopique et se pose sur les yeux
  const EYE = new V3(0, 1.42, 0.26), visor = new THREE.Group(); link.add(visor);
  { const bg = new THREE.TorusGeometry(0.118, 0.02, 10, 40, PI * 1.3); bg.rotateZ(PI / 2 - 0.65 * PI); bg.rotateX(-PI / 2); add(visor, bg, mBot);
    add(visor, rbox(0.27, 0.14, 0.05, 0.02), mBotD, 0, 0, -0.122); add(visor, new THREE.BoxGeometry(0.2, 0.006, 0.004), glow(COL.cyan, 3), 0, 0.02, -0.149); add(visor, new THREE.BoxGeometry(0.05, 0.006, 0.004), glow(COL.coral, 3), 0.07, -0.03, -0.149);
    add(visor, new THREE.PlaneGeometry(0.25, 0.12), addGlow(COL.cyan, 0.3, 0.3), 0, 0, -0.094); for (const s of [-1, 1]) add(visor, rbox(0.035, 0.07, 0.09, 0.012), mBotD, s * 0.128, 0, -0.03);
    add(visor, new THREE.CylinderGeometry(0.011, 0.011, 3.4, 8), mBot, 0, 1.82, 0.02); add(visor, rbox(0.07, 0.05, 0.07, 0.01), mBotD, 0, 0.1, 0.02); }
  const vRest = new V3(0, 2.02, -0.62), vMid = new V3(0, 1.52, -0.6), va = new V3(), vb = new V3();
  W.setVisor = (k) => { const e = k * k * (3 - 2 * k); va.lerpVectors(vRest, vMid, e); vb.lerpVectors(vMid, EYE, e); visor.position.lerpVectors(va, vb, e); visor.rotation.x = -0.35 * (1 - e) + 0.1 * e; }; W.setVisor(0);
  // câble cervical : la fiche se présente devant toi puis se branche derrière la nuque
  const cabA = new V3(0.3, 1.6, 0.68), cabPath = new THREE.CatmullRomCurve3([new V3(0.46, 1.2, 0.56), new V3(0.42, 1.3, -0.1), new V3(0.11, 1.4, -0.4), new V3(0.17, 1.37, -0.05), new V3(0.08, 1.34, 0.34)]);
  const plug = new THREE.Group(); link.add(plug); add(plug, new THREE.CylinderGeometry(0.017, 0.02, 0.09, 12), mBotD); add(plug, new THREE.CylinderGeometry(0.021, 0.021, 0.012, 12), glow(COL.cyan, 3), 0, 0.02, 0); add(plug, new THREE.CylinderGeometry(0.008, 0.004, 0.03, 8), glow(COL.safran, 3), 0, 0.06, 0);
  let cabMesh = null; const up = new V3(0, 1, 0);
  W.setCable = (k) => { const p = cabPath.getPoint(k), tg = cabPath.getTangent(Math.min(0.999, Math.max(0.001, k))); plug.position.copy(p); plug.quaternion.setFromUnitVectors(up, tg);
    const mid = cabA.clone().lerp(p, 0.5); mid.y -= 0.2; mid.x += 0.14; const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([cabA, mid, p.clone().addScaledVector(tg, -0.05)]), 18, 0.011, 6);
    if (cabMesh) { cabMesh.geometry.dispose(); cabMesh.geometry = geo; } else { cabMesh = new THREE.Mesh(geo, mBotD); link.add(cabMesh); } }; W.setCable(0);
  link.updateMatrixWorld(true); W.seat = { eye: link.localToWorld(EYE.clone()), yaw: link.rotation.y, front: link.localToWorld(new V3(0, 1.62, -1.75)), chair: link.localToWorld(new V3(0, 1.5, 0.1)) };

  bay.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) { o.castShadow = !(o.geometry.type === 'PlaneGeometry'); o.receiveShadow = true; } });
  new GLTFLoader().load('assets/models/head/LeePerrySmith.glb', (gl) => { let src = null; gl.scene.traverse((o) => { if (o.isMesh && !src) src = o; }); if (!src) return;
    const hg = src.geometry.clone(); hg.computeBoundingBox(); const bb = hg.boundingBox, c = bb.getCenter(new V3()), k = 0.4 / (bb.max.y - bb.min.y);
    hg.translate(-c.x, -c.y, -c.z); hg.scale(k, k, k); hg.rotateX(-PI / 2); hg.rotateY(PI / 2); // allongé : visage vers le haut, sommet du crâne vers -X
    const col = loader.load('assets/models/head/Map-COL.jpg'); col.colorSpace = THREE.SRGBColorSpace; const nor = loader.load('assets/models/head/Infinite-Level_02_Tangent_SmoothUV.jpg');
    const mk = (pl) => new THREE.MeshStandardMaterial({ map: col, normalMap: nor, roughness: 0.6, metalness: 0, envMapIntensity: 0.35, clippingPlanes: [pl], clipShadows: true });
    const hmL = mk(new THREE.Plane(new V3(-1, 0, 0), -4.225)), hmR = mk(new THREE.Plane(new V3(1, 0, 0), -4.225));
    for (const hs of headSlots) { const h = new THREE.Mesh(hg, hs.userData.right ? hmR : hmL); h.castShadow = true; h.receiveShadow = true; hs.add(h); } });

  /* ================= ESPACE ================= */
  const space = new THREE.Group(); scene.add(space); W.space = space;
  const SUN = new V3(1, 0.32, 0.28).normalize(), EC = new V3(-150, -100, -330);
  const sN = 2600, sp = new Float32Array(sN * 3);
  for (let i = 0; i < sN; i++) { const v = new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 0.2)).normalize().multiplyScalar(700); sp.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  space.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe9f5, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  // Terre endommagée : continents désertifiés, océans retirés (croûtes de sel), tempêtes de poussière, foyers côté nuit
  const day = loader.load('assets/space/earth.jpg'); day.colorSpace = THREE.SRGBColorSpace;
  const earthMat = U(new THREE.ShaderMaterial({ uniforms: { uDay: { value: day }, uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D uDay;uniform vec3 uSun;uniform float uTime;varying vec2 vUv;varying vec3 vN;${NOISE}
      void main(){ vec3 d=texture2D(uDay,vUv).rgb; float lum=dot(d,vec3(.3,.59,.11));
        float ob=d.b-max(d.r,d.g)*.92; float ocean=smoothstep(.0,.06,ob); float shore=smoothstep(.0,.03,ob)*(1.-smoothstep(.03,.09,ob));
        vec3 land=mix(vec3(.26,.15,.07),vec3(.58,.39,.2),clamp(lum*1.9,0.,1.));
        vec3 sea=mix(vec3(.07,.06,.055),vec3(.24,.19,.15),clamp(lum*2.4,0.,1.));
        vec3 col=mix(land,sea,ocean); col=mix(col,vec3(.7,.66,.58),shore*.55);
        vec2 q=vUv*vec2(9.,4.5)+vec2(uTime*.003,0.); float storm=fbm(q); col=mix(col,vec3(.56,.4,.24),smoothstep(.56,.84,storm)*.6);
        float scar=smoothstep(.62,.7,fbm(vUv*vec2(26.,13.)+3.)); col=mix(col,vec3(.05,.04,.04),scar*.55*(1.-ocean));
        float ndl=dot(normalize(vN),uSun); float dayk=smoothstep(-.12,.4,ndl);
        float fire=smoothstep(.7,.82,fbm(vUv*vec2(70.,35.)))*(1.-ocean)*(1.-dayk);
        gl_FragColor=vec4(col*dayk*.7+vec3(1.,.36,.08)*fire*2.4+col*.012,1.); }` }));
  const earth = add(space, new THREE.SphereGeometry(150, 96, 64), earthMat, EC.x, EC.y, EC.z); earth.rotation.set(0.35, 2.1, 0.2);
  const cl = loader.load('assets/space/clouds.png');
  const dustS = add(space, new THREE.SphereGeometry(151.6, 72, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: cl }, uSun: { value: SUN } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D uC;uniform vec3 uSun;varying vec2 vUv;varying vec3 vN;void main(){float a=texture2D(uC,vUv).a;float l=smoothstep(-.1,.45,dot(normalize(vN),uSun));gl_FragColor=vec4(vec3(.5,.37,.23)*l,a*.3*l);}' }), EC.x, EC.y, EC.z);
  dustS.rotation.copy(earth.rotation);
  add(space, new THREE.SphereGeometry(157, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vW=normalize(mat3(modelMatrix)*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uSun;varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){float f=pow(1.-max(dot(vN,normalize(-vP)),0.),3.2);float l=smoothstep(-.3,.5,dot(-vW,uSun));gl_FragColor=vec4(vec3(.95,.62,.34)*f*l*1.4,f);}' }), EC.x, EC.y, EC.z);
  upd.push((t, dt) => { earth.rotation.y += dt * 0.0035; dustS.rotation.y += dt * 0.006; });
  const spaceMat = (base, win = 0, ws = [8, 3]) => new THREE.ShaderMaterial({ uniforms: { uBase: { value: new THREE.Color(base) }, uSun: { value: SUN }, uWin: { value: win }, uWS: { value: new THREE.Vector2(ws[0], ws[1]) } },
    vertexShader: 'varying vec3 vN;varying vec2 vUv;void main(){vUv=uv;vec4 n=vec4(normal,0.);\n#ifdef USE_INSTANCING\n n=instanceMatrix*n;\n vec4 p=instanceMatrix*vec4(position,1.);\n#else\n vec4 p=vec4(position,1.);\n#endif\n vN=normalize(mat3(modelMatrix)*n.xyz);gl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: `uniform vec3 uBase;uniform vec3 uSun;uniform float uWin;uniform vec2 uWS;varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ float l=max(dot(normalize(vN),uSun),0.); vec2 pg=vUv*uWS*.5; float pl=.86+.14*hash(floor(pg)); vec2 pf=abs(fract(pg)-.5); float seam=1.-smoothstep(.46,.5,max(pf.x,pf.y))*.35;
        vec3 c=uBase*pl*seam*(l*1.3+.03);
        if(uWin>0.){ vec2 g=vUv*uWS; vec2 f=fract(g); float on=step(.78,hash(floor(g))); float w=step(.25,f.x)*step(f.x,.75)*step(.3,f.y)*step(f.y,.62); c+=vec3(1.,.8,.5)*on*w*uWin; }
        gl_FragColor=vec4(c,1.); }` });
  const rockGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 2)); { const rp = rockGeo.attributes.position, v = new V3(); for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i); const n = 0.72 + 0.2 * Math.sin(v.x * 3.1 + v.y * 1.7) + 0.16 * Math.sin(v.y * 4.3 + v.z * 2.9) + 0.12 * Math.sin(v.z * 6.1 + v.x * 5.3); v.multiplyScalar(n); rp.setXYZ(i, v.x, v.y, v.z); } rockGeo.computeVertexNormals(); }
  const dN = 420, deb = new THREE.InstancedMesh(rockGeo, spaceMat(0x7d7061), dN), q = new THREE.Quaternion(), sc = new V3(), ps = new V3(), eu = new THREE.Euler();
  for (let i = 0; i < dN; i++) {
    const near = i < 60, a = rnd(PI * 2), r = rnd(175, 250);
    if (near) ps.set(rnd(-70, 70), rnd(-30, 40), rnd(-160, -40)); else ps.set(Math.cos(a) * r, rnd(-6, 6) + Math.sin(a * 2) * 4, Math.sin(a) * r);
    const k = near ? rnd(0.08, 0.55) : rnd(0.4, 2.6); sc.set(k * rnd(0.5, 1.6), k * rnd(0.4, 1.2), k * rnd(0.5, 1.8)); eu.set(rnd(6), rnd(6), rnd(6)); q.setFromEuler(eu);
    mt.compose(ps, q, sc); if (!near) mt.premultiply(new THREE.Matrix4().makeRotationZ(0.42).setPosition(EC.x, EC.y, EC.z)); deb.setMatrixAt(i, mt);
  }
  deb.frustumCulled = false; space.add(deb);
  const glowTex = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0x9fd0ff).multiplyScalar(1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  function ship(len, withRing) {
    const g = new THREE.Group(), hull = 0x8e959c, dk = 0x4b5158; const b = (w, h, d, x, y, z, col = hull, win = 1.8) => add(g, rbox(w, h, d, Math.min(w, h, d) * 0.12), spaceMat(col, win, [Math.max(3, w * 46 / len), Math.max(2, h * 52 / len)]), x, y, z);
    add(g, new THREE.CylinderGeometry(len * 0.05, len * 0.058, len * 0.94, 20), spaceMat(hull, 1.5, [70, 5]), 0, 0, 0).rotation.z = PI / 2; add(g, new THREE.SphereGeometry(len * 0.05, 18, 12, 0, PI * 2, 0, PI / 2), spaceMat(0xa7adb3, 1.2, [30, 6]), len * 0.47, 0, 0).rotation.z = -PI / 2;
    b(len * 0.62, len * 0.05, len * 0.13, -len * 0.05, -len * 0.01, 0, dk, 1.2);
    for (let i = 0; i < 22; i++) { const a = rnd(PI * 2), r = len * rnd(0.045, 0.062); b(len * rnd(0.03, 0.11), len * rnd(0.015, 0.05), len * rnd(0.02, 0.06), len * rnd(-0.44, 0.4), Math.sin(a) * r, Math.cos(a) * r, i % 3 ? hull : dk).rotation.x = -a; }
    b(len * 0.12, len * 0.06, len * 0.09, len * 0.36, len * 0.07, 0, 0xa7adb3, 2.4);
    for (let i = 0; i < 5; i++) add(g, new THREE.CylinderGeometry(len * 0.022, len * 0.022, len * 0.09, 12), spaceMat(0xb9bec4), len * (-0.3 + i * 0.09), -len * 0.055, 0).rotation.z = PI / 2;
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(len * 0.22, len * 0.004, len * 0.2), spaceMat(0x24364f), -len * 0.12, 0, s * len * 0.17).rotation.x = s * 0.12;
    if (withRing) { const r = add(g, new THREE.TorusGeometry(len * 0.17, len * 0.014, 10, 56), spaceMat(hull, 1.6, [60, 2]), len * 0.12, 0, 0); r.rotation.y = PI / 2; g.userData.ring = r; for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(len * 0.006, len * 0.34, len * 0.006), spaceMat(dk), len * 0.12, 0, 0).rotation.x = i * PI / 4; }
    for (const z of [-0.035, 0, 0.035]) { add(g, new THREE.CylinderGeometry(len * 0.016, len * 0.024, len * 0.07, 14), spaceMat(dk), -len * 0.53, 0, len * z).rotation.z = PI / 2; add(g, new THREE.CircleGeometry(len * 0.02, 14), glow(0xa8d8ff, 5), -len * 0.566, 0, len * z).rotation.y = -PI / 2; }
    const gl = new THREE.Sprite(glowTex); gl.scale.set(len * 0.13, len * 0.1, 1); gl.position.set(-len * 0.6, 0, 0); g.add(gl);
    add(g, new THREE.CylinderGeometry(len * 0.002, len * 0.002, len * 0.16, 4), spaceMat(hull), len * 0.2, len * 0.12, 0); add(g, new THREE.SphereGeometry(len * 0.004, 6, 6), glow(COL.coral, 5), len * 0.2, len * 0.2, 0);
    return g;
  }
  const fleet = [[70, true, 46, 16, -190, 0.5], [30, false, -22, 12, -120, -0.4], [22, false, 20, -9, -84, 0.9], [46, true, -6, 26, -280, 0.2], [16, false, 44, -4, -140, -0.9], [26, false, -52, 30, -230, 0.6]];
  W.ships = fleet.map(([len, ring, x, y, z, ry]) => { const s = ship(len, ring); s.position.set(x, y, z); s.rotation.y = ry; space.add(s); return s; });
  const shuttle = ship(6, false), shuttle2 = ship(4, false); space.add(shuttle, shuttle2);
  // robot soudeur accroché au bord extérieur du grand hublot
  const wa = 0.72, welder = new THREE.Group(); welder.position.set(Math.cos(wa) * 1.86, WC.y + Math.sin(wa) * 1.86, Z0 - 0.78); welder.rotation.z = wa; space.add(welder);
  add(welder, rbox(0.3, 0.2, 0.22, 0.04), spaceMat(0xb9bec4)); add(welder, new THREE.SphereGeometry(0.035, 8, 8), glow(COL.safran, 3), -0.12, 0.06, 0.1);
  for (const [x, y] of [[0.12, 0.12], [0.12, -0.12], [-0.1, 0.12], [-0.1, -0.12]]) add(welder, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), spaceMat(0x4b5158), x + 0.06, y, 0).rotation.z = PI / 2 + (y > 0 ? 0.5 : -0.5);
  add(welder, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 5), spaceMat(0x8e959c), 0.2, 0, 0.06).rotation.z = PI / 2 - 0.3;
  const arc = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0xbfe0ff).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); arc.position.set(0.34, -0.04, 0.08); welder.add(arc);
  const spN = 40, spp = new Float32Array(spN * 3), spv = []; for (let i = 0; i < spN; i++) { spv.push([0, 0, 0, 0]); spp.set([0, 99, 0], i * 3); }
  const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(spp, 3));
  const sparks = new THREE.Points(spg, new THREE.PointsMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4), size: 0.035, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.position.copy(arc.position); sparks.frustumCulled = false; welder.add(sparks);
  upd.push((t, dt) => {
    W.ships.forEach((s, i) => { s.position.x += Math.cos(s.rotation.y) * dt * (0.25 + i * 0.05); if (s.userData.ring) s.userData.ring.rotation.x += dt * 0.15; });
    const k = (t * 0.03) % 1; shuttle.position.set(34 - k * 68, 3.2 + Math.sin(k * 6) * 0.6, -30 - k * 6); shuttle.rotation.y = PI + 0.08;
    const k2 = (t * 0.021 + 0.4) % 1; shuttle2.position.set(-30 + k2 * 60, 7 - k2 * 5, -52 + k2 * 10); shuttle2.rotation.y = -0.15; deb.rotation.y += dt * 0.0006;
    const on = (t % 5.2) < 2.6, f = on ? 0.5 + Math.random() * 0.5 : 0; arc.scale.setScalar(f * 0.2 + 0.001); es.color.copy(esBase).lerp(esArc, f * 0.7); es.intensity = 9 + f * 9;
    const bk = Math.min(1, W.beacon.intensity / 26); W.keyLight.color.copy(keyBase).lerp(keyAmber, bk * 0.75);
    for (let i = 0; i < spN; i++) { const v = spv[i]; v[3] -= dt; if (v[3] <= 0 && on) { v[0] = rnd(-0.6, 0.9); v[1] = rnd(-0.9, 0.3); v[2] = rnd(-0.5, 0.5); v[3] = rnd(0.3, 1); spp.set([0, 0, 0], i * 3); } else if (v[3] > 0) { spp[i * 3] += v[0] * dt; spp[i * 3 + 1] += v[1] * dt; spp[i * 3 + 2] += v[2] * dt; } else spp.set([0, 99, 0], i * 3); } spg.attributes.position.needsUpdate = true;
  });

  /* ================= DANSE SENSORIELLE ================= */
  const ds = new THREE.Group(); ds.position.y = -400; ds.visible = false; scene.add(ds); W.ds = ds; W.DSY = -400;
  const DL = 96, SZ = [-14, -32, -50, -68], FW = 5.4, FH = 3.9, AX = 2.05;
  const artPos = works.map((w, i) => new V3((i % 2 ? 1 : -1) * AX, w.cy, SZ[i]));
  // sol : grille de projection, ondes sous tes pas, halos de station
  const floorMat = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new V3() }, uSt: { value: artPos.map((p) => new THREE.Vector2(p.x, p.z)) }, uSc: { value: works.map((w) => new THREE.Color(w.col)) }, uK: { value: [0, 0, 0, 0] } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime;uniform vec3 uCam;uniform vec2 uSt[4];uniform vec3 uSc[4];uniform float uK[4];varying vec3 vW;
      void main(){ vec2 p=vW.xz; vec2 g=abs(fract(p)-.5); float l1=smoothstep(.47,.5,max(g.x,g.y)); vec2 g5=abs(fract(p/5.)-.5); float l5=smoothstep(.49,.5,max(g5.x,g5.y));
        float dc=distance(p,uCam.xz); float fade=exp(-dc*.055); vec3 col=vec3(.42,.6,.78)*(l1*.2+l5*.55)*fade;
        float ring=smoothstep(.44,.5,abs(fract(dc*.32-uTime*.32)-.5))*exp(-dc*.16); col+=vec3(.5,.89,.9)*ring*.22;
        for(int i=0;i<4;i++){ float d=distance(p,uSt[i]); col+=uSc[i]*(exp(-d*d*.16)*.1+smoothstep(.04,0.,abs(d-2.2))*.35+smoothstep(.03,0.,abs(d-2.7))*.2*l1)*uK[i]; }
        gl_FragColor=vec4(col+vec3(.004,.007,.011),.86); }` }));
  W.floorU = floorMat.uniforms; add(ds, new THREE.PlaneGeometry(40, DL + 30), floorMat, 0, 0, -DL / 2 + 6).rotation.x = -PI / 2;
  // portiques + reflets (géométrie dupliquée sous le sol)
  const fN = 33, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), fN * 8), col = new THREE.Color(); let bi = 0;
  for (let i = 0; i < fN; i++) {
    const z = 4 - i * 3; let c = COL.steel, kk = 0.7; SZ.forEach((s, j) => { if (Math.abs(z - s) < 7.5) { c = works[j].col; kk = 1.25 - Math.abs(z - s) * 0.08; } });
    for (const my of [1, -1]) for (const [x, y, w, h] of [[-FW / 2, FH / 2, 0.02, FH], [FW / 2, FH / 2, 0.02, FH], [0, FH, FW, 0.02], [0, 0.02, FW, 0.02]]) {
      if ((my < 0 && y < 0.1) || SZ.includes(z)) mt.makeScale(0, 0, 0); else { mt.makeScale(w, h, 0.02); mt.setPosition(x, y * my, z); }
      bars.setMatrixAt(bi, mt); bars.setColorAt(bi, col.setHex(c).multiplyScalar(my > 0 ? kk * 0.8 : kk * 0.22)); bi++;
    }
  }
  bars.frustumCulled = false; ds.add(bars); add(ds, new THREE.BoxGeometry(0.03, 0.01, DL), glow(COL.pale, 1.2), 0, 0.012, -DL / 2 + 6);
  // rideaux de données + tracés de circuit (effets du Canva)
  const curtain = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ float c=vUv.x*300.; float id=floor(c); float fx=fract(c); float y=vUv.y*16.+uTime*(.2+hash(vec2(id,1.))*.7)+hash(vec2(id,7.))*30.; float sg=floor(y);
        float on=step(.6,hash(vec2(id,sg)))*step(.5,hash(vec2(id,3.))); float a=on*step(.12,fract(y))*step(.25,fx)*step(fx,.5)*(.25+.75*hash(vec2(sg,id)));
        a*=smoothstep(0.,.2,vUv.y)*smoothstep(1.,.45,vUv.y); gl_FragColor=vec4(mix(vec3(.3,.4,.51),vec3(.72,.84,.95),hash(vec2(id,5.)))*a*.55,1.); }` }));
  const circ = circuitTex(); circ.repeat.set(5, 1); const cm = new THREE.MeshBasicMaterial({ map: circ, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { add(ds, new THREE.PlaneGeometry(DL + 20, 9), curtain, s * 6.4, 4.5, -DL / 2 + 6).rotation.y = s * PI / 2; add(ds, new THREE.PlaneGeometry(DL + 20, 7), cm, s * 8.5, 3.4, -DL / 2 + 6).rotation.y = s * PI / 2; }
  const ddN = 800, ddp = new Float32Array(ddN * 3); for (let i = 0; i < ddN; i++) ddp.set([rnd(-6, 6), rnd(0, 6), rnd(-DL, 8)], i * 3);
  const ddg = new THREE.BufferGeometry(); ddg.setAttribute('position', new THREE.BufferAttribute(ddp, 3));
  const dust = new THREE.Points(ddg, new THREE.PointsMaterial({ map: soft, color: 0xb9d6f2, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); dust.frustumCulled = false; ds.add(dust);
  W.dsTime = 1; upd.push((t, dt) => { for (let i = 1; i < ddp.length; i += 3) { ddp[i] += dt * 0.12 * W.dsTime; if (ddp[i] > 6) ddp[i] = 0; } ddg.attributes.position.needsUpdate = true; circ.offset.x += dt * 0.004 * W.dsTime; });
  add(ds, new THREE.PlaneGeometry(FW, FH), glow(COL.white, 1.15), 0, FH / 2, -DL + 4);
  const dsl = new THREE.PointLight(COL.pale, 10, 30, 2); dsl.position.set(0, 3, 0); ds.add(dsl); W.dsLight = dsl;

  // --- une œuvre reconstituée à taille réelle : mosaïque de fragments qui se rassemblent ---
  function tiles(tex, wk) {
    const cols = Math.round(wk.w / wk.cell), rows = Math.round(wk.h / wk.cell), n = cols * rows, pa = wk.w / wk.h, cover = pa > wk.ar ? new THREE.Vector2(1, wk.ar / pa) : new THREE.Vector2(pa / wk.ar, 1);
    const base = new THREE.PlaneGeometry(wk.w / cols * 0.96, wk.h / rows * 0.96), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const ce = new Float32Array(n * 2), r4 = new Float32Array(n * 4); for (let i = 0; i < n; i++) { ce.set([i % cols, (i / cols) | 0], i * 2); r4.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(ce, 2)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r4, 4));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTex: { value: tex }, uColor: { value: new THREE.Color(wk.col) }, uTime: { value: 0 }, uAsm: { value: 0 }, uMode: { value: wk.mode }, uKey: { value: new THREE.Vector3(wk.key ? wk.key[0] : 0.17, wk.key ? wk.key[1] : 0.4, wk.base || 0) }, uRelief: { value: wk.relief || 0 }, uHit: { value: new THREE.Vector2(9, 9) }, uAmp: { value: 0 },
        uGrid: { value: new THREE.Vector2(cols, rows) }, uSize: { value: new THREE.Vector2(wk.w, wk.h) }, uCover: { value: cover }, uTx: { value: new THREE.Vector2(1 / 600, 1 / 600) } },
      vertexShader: `attribute vec2 aCell;attribute vec4 aRnd;uniform sampler2D uTex;uniform float uTime,uAsm,uRelief,uAmp;uniform vec2 uGrid,uSize,uCover,uHit;varying vec2 vUv;varying float vK;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vUv=((aCell+uv)/uGrid-.5)*uCover+.5; vec2 cuv=((aCell+.5)/uGrid-.5)*uCover+.5; vec3 home=vec3((aCell+.5)/uGrid-.5,0.)*vec3(uSize,1.);
          vec3 tc=texture2D(uTex,cuv).rgb; float sat=max(tc.r,max(tc.g,tc.b))-min(tc.r,min(tc.g,tc.b));
          float d=distance(home.xy,uHit); home.z+=uRelief*sat*.22+(exp(-d*d*9.)*.26+sin(d*16.-uTime*5.)*exp(-d*2.6)*.07)*uAmp;
          float k=smoothstep(0.,1.,clamp(uAsm*1.6-aRnd.w*.6,0.,1.)); vK=k;
          vec3 sc=(aRnd.xyz-.5)*vec3(6.,3.6,6.); sc.y+=sin(uTime*.7+aRnd.w*6.28)*.25; sc.z+=1.4;
          vec3 p=position; float ang=(1.-k)*(aRnd.x*6.28+uTime*(aRnd.y-.5)*1.4); p.xz=rot(ang)*p.xz; p.xy=rot(ang*.6)*p.xy;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(home+sc,home,k)+p*mix(3.2,1.,k),1.); }`,
      fragmentShader: `uniform sampler2D uTex;uniform vec3 uColor;uniform float uTime;uniform int uMode;uniform vec3 uKey;uniform vec2 uTx;varying vec2 vUv;varying float vK;
        float lum(vec2 u){return dot(texture2D(uTex,u).rgb,vec3(.3,.59,.11));}
        void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=dot(t,vec3(.3,.59,.11)); vec3 c;
          if(uMode==0){ float s=max(t.r,max(t.g,t.b))-min(t.r,min(t.g,t.b)); c=t*(smoothstep(uKey.x,uKey.y,s)*1.35+uKey.z)+uColor*.025; }
          else if(uMode==1){ c=pow(l,1.15)*mix(vec3(1.,.6,.33),uColor,.22)*1.25+t*.2; }
          else { float e=abs(lum(vUv+vec2(uTx.x,0.))-lum(vUv-vec2(uTx.x,0.)))+abs(lum(vUv+vec2(0.,uTx.y))-lum(vUv-vec2(0.,uTx.y))); c=uColor*(smoothstep(.03,.16,e)*1.5+l*.09)+vec3(1.)*smoothstep(.14,.4,e)*.5; }
          float scan=.9+.1*sin(vUv.y*640.-uTime*5.); float fl=.96+.04*sin(uTime*31.+vUv.y*9.);
          gl_FragColor=vec4(c*scan*fl*mix(.5,1.,vK),1.); }` }));
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
  }
  function dimLine(len, label, color) { // cote holographique (dimension réelle de l'œuvre)
    const g = new THREE.Group(), p = [-len / 2, 0, 0, len / 2, 0, 0, -len / 2, -0.03, 0, -len / 2, 0.03, 0, len / 2, -0.03, 0, len / 2, 0.03, 0], bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }))); const t = textPlane([label], { color: hexCss(color), w: 240, size: 44, scale: 0.26, align: 'center' }); t.position.y = -0.06; g.add(t); return g;
  }
  const ringGeo = (r) => new THREE.TorusGeometry(r, 0.006, 6, 96);
  W.stations = works.map((wk, i) => {
    const side = i % 2 ? 1 : -1, z = SZ[i], g = new THREE.Group(); g.position.set(0, 0, z); ds.add(g);
    const tex = loader.load(wk.img, (t) => { st.u.uTx.value.set(1 / t.image.width, 1 / t.image.height); }); tex.colorSpace = THREE.SRGBColorSpace;
    const ry = Math.atan2(-side * 3.9, 3.6), art = new THREE.Group(); art.position.set(side * AX, wk.cy, 0); art.rotation.y = ry; g.add(art);
    const tl = tiles(tex, wk); art.add(tl); const deco = new THREE.Group(); art.add(deco); const dm = [];
    const fm = new THREE.LineBasicMaterial({ color: wk.col, transparent: true, opacity: 0.9 }); deco.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(wk.w + 0.06, wk.h + 0.06)), fm));
    const hd = dimLine(wk.w, wk.dw, wk.col); hd.position.set(0, -wk.h / 2 - 0.12, 0); deco.add(hd); const vd = dimLine(wk.h, wk.dh, wk.col); vd.rotation.z = PI / 2; vd.position.set(-(wk.w / 2 + 0.12), 0, 0); deco.add(vd);
    const cw = Math.min(1.25, Math.max(0.66, wk.w * 0.85)), cart = textPlane([wk.title, wk.artist, wk.tech], { color: hexCss(wk.col), w: 640, size: 54, sub: 30, scale: cw }); cart.position.set(wk.w / 2 + 0.16 + cw / 2, -wk.h / 2 + 0.16, 0.03); deco.add(cart);
    deco.traverse((o) => { if (o.material && !dm.includes(o.material)) { o.material.userData.op = o.material.opacity; o.material.opacity = 0; dm.push(o.material); } });
    // socle de projection + anneaux de station
    const ped = new THREE.Group(); ped.position.set(side * AX, 0, 0); g.add(ped); const pm = addGlow(wk.col, 1.3, 0), ph = Math.max(0.3, wk.cy - wk.h / 2 - 0.1);
    add(ped, ringGeo(Math.max(0.45, wk.w * 0.42)), pm, 0, 0.02, 0).rotation.x = PI / 2; const r2 = add(ped, new THREE.RingGeometry(Math.max(0.3, wk.w * 0.3), Math.max(0.34, wk.w * 0.33), 48, 1, 0, PI * 1.4), pm, 0, 0.025, 0); r2.rotation.x = -PI / 2;
    const cone = add(ped, new THREE.CylinderGeometry(wk.w * 0.5, 0.18, ph, 32, 1, true), addGlow(wk.col, 1, 0), 0, ph / 2, 0);
    const gate = [add(g, ringGeo(4.7), addGlow(wk.col, 0.9, 0), 0, 2, 0.6), add(g, ringGeo(5.3), addGlow(COL.pale, 0.7, 0), 0, 2, -0.6)];
    const pl = new THREE.PointLight(wk.col, 0, 12, 2); pl.position.set(side * 0.9, 2.2, 1); g.add(pl);
    const n = new V3(Math.sin(ry), 0, Math.cos(ry));
    const st = { i, z, side, g, art, n, ax: side * AX, u: tl.material.uniforms, light: pl, k: 0, a: 0,
      stop: { pos: new V3(side * AX, 0, z).addScaledVector(n, wk.dist).setY(1.66 + W.DSY), look: new V3(side * AX, wk.cy + W.DSY, z) } };
    upd.push((t, dt) => { st.u.uAsm.value += (st.k - st.u.uAsm.value) * (1 - Math.exp(-dt * 1.5)); st.a += ((st.u.uAsm.value > 0.75 ? 1 : 0) - st.a) * (1 - Math.exp(-dt * 2.5)); dm.forEach((m) => { m.opacity = m.userData.op * st.a; });
      pm.opacity = st.k * 0.8; cone.material.opacity = st.k * (0.035 + 0.01 * Math.sin(t * 3)); r2.rotation.z += dt * 0.5; gate[0].material.opacity = st.k * 0.5; gate[1].material.opacity = st.k * 0.3; gate[0].rotation.z += dt * 0.07; gate[1].rotation.x = Math.sin(t * 0.2) * 0.12;
      st.light.intensity += ((st.k > 0 ? 14 : 0) - st.light.intensity) * 0.04; W.floorU.uK.value[i] += (st.k - W.floorU.uK.value[i]) * 0.03; });
    return st;
  });
  const S = W.stations;

  // 01 Kinesthésie — les plumes se détachent de la feuille et tombent autour de toi
  { const n = 70, base = new THREE.PlaneGeometry(0.085, 0.19), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const pal = [[1, 0.55, 0.62], [0.52, 0.72, 1], [0.58, 0.9, 0.66], [1, 0.84, 0.42], [1, 0.62, 0.36], [0.92, 0.38, 0.44], [0.86, 0.86, 0.92]], hw = works[0].w / 2 - 0.07;
    const p = new Float32Array(n * 3), r = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p.set([rnd(-hw, hw), rnd(-hw, hw), 0.02], i * 3); r.set([Math.random(), Math.random(), Math.random()], i * 3); c.set(pal[(rnd(pal.length)) | 0], i * 3); }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r, 3)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(c, 3));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 }, uFloor: { value: works[0].cy } },
      vertexShader: `attribute vec3 aPos;attribute vec3 aRnd;attribute vec3 aCol;uniform float uT,uFloor;varying vec2 vUv;varying vec3 vC;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vUv=uv; vC=aCol; float t=max(uT-aRnd.z*3.,0.); float sw=sin(t*1.1+aRnd.y*6.28); vec3 p=position;
          p.xy=rot(aRnd.x*6.28+sw*.8*min(t,1.))*p.xy; p.yz=rot(min(t,1.)*(aRnd.y-.5)*2.)*p.yz;
          vec3 o=aPos; float span=uFloor+1.5; o.y=mod(aPos.y-t*(.14+aRnd.x*.2)+uFloor,span)-uFloor; o.x+=sw*.3*min(t*.5,1.); o.z+=min(t*.45,1.)*(.15+aRnd.y*2.1);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(o+p,1.); }`,
      fragmentShader: `uniform float uA;varying vec2 vUv;varying vec3 vC;
        void main(){ vec2 q=vUv*2.-1.; float w=(1.-q.y*q.y)*.78*(.7+.3*q.y); float ins=smoothstep(w,w-.2,abs(q.x)); float barbs=.6+.4*sin(q.y*40.-abs(q.x)*30.); float rach=smoothstep(.06,0.,abs(q.x))*step(-.96,q.y);
          gl_FragColor=vec4(vC*(ins*(.3+.4*barbs)+rach*.55)*uA*.75,1.); }` });
    const f = new THREE.Mesh(g, m); f.frustumCulled = false; S[0].art.add(f); S[0].fx = { on: false };
    upd.push((t, dt) => { m.uniforms.uA.value = S[0].a; if (S[0].fx.on) m.uniforms.uT.value += dt * W.dsTime; }); }

  // 02 Toucher haptique virtuel — le grillage et la résine se soulèvent sous le regard
  { const pts = [], w = works[1].w, h = works[1].h, NX = 40, NY = 40;
    for (let j = 0; j <= NY; j += 2) for (let i = 0; i < NX; i++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, (i + 1) / NX * w - w / 2, j / NY * h - h / 2, 0);
    for (let i = 0; i <= NX; i += 2) for (let j = 0; j < NY; j++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, i / NX * w - w / 2, (j + 1) / NY * h - h / 2, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uHit: S[1].u.uHit, uAmp: S[1].u.uAmp, uA: { value: 0 } },
      vertexShader: 'uniform float uTime,uAmp;uniform vec2 uHit;varying float vD;void main(){vec3 p=position;float d=distance(p.xy,uHit);vD=d;p.z+=-.02+(exp(-d*d*9.)*.26+sin(d*16.-uTime*5.)*exp(-d*2.6)*.07)*uAmp;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'uniform float uA,uAmp;varying float vD;void main(){float h=exp(-vD*vD*6.)*uAmp;gl_FragColor=vec4(vec3(.55,.66,.76)*(.16+h*1.6)*uA,1.);}' }));
    S[1].art.add(new THREE.LineSegments(g, m)); const hitPlane = add(S[1].art, new THREE.PlaneGeometry(w * 2.4, h * 2.4), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0.05);
    S[1].fx = { on: false, hitPlane, mesh: S[1].art };
    upd.push(() => { m.uniforms.uA.value = S[1].a; S[1].u.uAmp.value += ((S[1].fx.on ? 1 : 0) - S[1].u.uAmp.value) * 0.05; }); }

  // 03 Proprioception — les troncs débordent du cadre et te dominent
  { const grp = new THREE.Group(); S[2].g.add(grp); const trunks = [], cx = S[2].stop.pos.x, cz = S[2].stop.pos.z - S[2].z, ax = artPos[2].x;
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8793c).multiplyScalar(0.3), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), core = glow(works[2].col, 1.4);
    for (let i = 0; i < 20; i++) { const a = rnd(PI * 2), r = rnd(1.5, 7.5), rad = rnd(0.08, 0.36), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const tx = ax - cx, tz = -cz, px = x - cx, pz = z - cz, along = (px * tx + pz * tz) / (tx * tx + tz * tz), off = Math.abs(px * tz - pz * tx) / Math.hypot(tx, tz); if (along > 0 && along < 1.15 && off < 1.2) continue;
      const t = new THREE.Group(); add(t, new THREE.CylinderGeometry(rad * 0.75, rad, 20, 10, 1, true), tm, 0, 10, 0); add(t, new THREE.CylinderGeometry(0.012, 0.012, 20, 4), core, 0, 10, 0);
      t.position.set(x, 0, z); t.scale.y = 0.0001; t.userData.d = rnd(0, 1.2); grp.add(t); trunks.push(t); }
    S[2].fx = { on: false, t: 0 };
    upd.push((tt, dt) => { if (S[2].fx.on) S[2].fx.t += dt; for (const t of trunks) { const k = Math.min(1, Math.max(0, (S[2].fx.t - t.userData.d) / 2.4)); t.scale.y = Math.max(0.0001, 1 - Math.pow(1 - k, 3)); } }); }

  // 04 Intéroception — le pouls, les bocaux, le temps qui se dilate
  { const grp = new THREE.Group(); S[3].art.add(grp); const rings = [], w = works[3].w, hh = works[3].h;
    for (let i = 0; i < 4; i++) rings.push(add(grp, new THREE.TorusGeometry(1, 0.005, 6, 72), addGlow(works[3].col, 1.6, 0), 0, 0, 0.02));
    const jm = new THREE.MeshBasicMaterial({ color: new THREE.Color(works[3].col).multiplyScalar(0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }), lid = addGlow(works[3].col, 1.3, 0);
    for (let i = 0; i < 5; i++) { const x = -w / 2 + 0.04 + i * (w - 0.08) / 4; add(grp, new THREE.CylinderGeometry(0.034, 0.034, 0.085, 14, 2, true), jm, x, -hh / 2 - 0.3, 0.06); add(grp, new THREE.CylinderGeometry(0.037, 0.037, 0.012, 14), lid, x, -hh / 2 - 0.25, 0.06); }
    S[3].fx = { on: false, beat: 0, pulse: 0 };
    upd.push((t, dt) => { const fx = S[3].fx; fx.pulse *= 0.93; jm.opacity = S[3].a * 0.6; lid.opacity = S[3].a * 0.9; rings.forEach((r, i) => { const ph = ((fx.beat + i / 4) % 1), s = 0.12 + ph * 0.75; r.scale.set(s, s, 1); r.material.opacity = fx.on ? (1 - ph) * 0.7 : 0; }); if (fx.on) fx.beat += dt * 0.36 * W.dsTime; }); }

  W.update = (t, dt, cam) => { for (const u of W.timeU) u.value = t; if (cam) W.floorU.uCam.value.copy(cam); for (const f of upd) f(t, dt); };
  W.setScene = (name) => { const d = name === 'ds'; bay.visible = !d; space.visible = !d; ds.visible = d; };
  return W;
}
