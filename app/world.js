// SPES — décors 3D : baie cryogénique, hublots, espace, danse sensorielle (la galerie reconstituée).
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

export function buildWorld(scene, loader, works, TX) {
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
  const sgn = textPlane(TX.bay, { color: '#7fe3e6', w: 620, size: 54, sub: 27, scale: 2.1, align: 'center' }); sgn.position.set(0, 3.0, -5.2); bay.add(sgn);
  const chrono = textPlane(TX.log, { color: '#f5c400', w: 660, size: 44, sub: 27, scale: 2.5 });
  chrono.position.set(-BW / 2 + 0.3, 2.5, -11.6); chrono.rotation.y = PI / 2; bay.add(chrono);
  for (const [txt, z] of [[TX.obs, -7], ['C-12', 8]]) { const d = textPlane([txt], { color: '#c8d2dc', w: 640, size: 84, scale: 1.9, align: 'center' }); d.material.blending = THREE.NormalBlending; d.material.opacity = 0.32; d.rotation.x = -PI / 2; d.position.set(0, 0.034, z); bay.add(d); }

  // --- caissons ---
  const gBase = rbox(2.5, 0.55, 1.05, 0.12), gBed = rbox(2.2, 0.12, 0.8, 0.05), gPlinth = new THREE.BoxGeometry(2.0, 0.12, 0.8), gLid = new THREE.CylinderGeometry(0.52, 0.52, 2.2, 28, 1, true, 0, PI),
    gFrost = new THREE.CylinderGeometry(0.512, 0.512, 2.19, 28, 1, true, 0, PI), gHead = rbox(0.35, 0.9, 1.05, 0.08), gFoot = rbox(0.25, 0.7, 1.05, 0.08), gEdge = new THREE.BoxGeometry(2.0, 0.025, 0.025),
    gStat = new THREE.BoxGeometry(0.02, 0.07, 0.5), gBedGlow = new THREE.PlaneGeometry(2.1, 0.74), gRib = new THREE.TorusGeometry(0.53, 0.018, 6, 20, PI), gVent = new THREE.BoxGeometry(0.02, 0.3, 0.6);
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-1.42, 0.95, 0), new V3(-1.8, 1.5, 0.12), new V3(-1.98, 2.4, 0.05), new V3(-2.0, 3.4, 0)]), 16, 0.035, 6);
  const edgeMat = glow(COL.cyan, 1.1), bedGlow = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(0.55), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  W.statMats = []; const bodySlots = [], headSlots = [], gPillow = rbox(0.3, 0.05, 0.34, 0.02), gBand = new THREE.TorusGeometry(0.094, 0.007, 6, 28);
  function pod(mine, num) {
    const g = new THREE.Group();
    add(g, gPlinth, mDark, 0, 0.06, 0); add(g, gBase, mMetal, 0, 0.36, 0); add(g, gBed, mDark, 0, 0.66, 0); add(g, gHead, mPanel, -1.3, 0.6, 0); add(g, gFoot, mPanel, 1.28, 0.5, 0);
    add(g, gEdge, edgeMat, 0, 0.72, 0.43); add(g, gEdge, edgeMat, 0, 0.72, -0.43); add(g, cable, mDark); add(g, cable, mDark, 0, 0, 0.3); add(g, gVent, mDark, 1.41, 0.32, 0);
    if (!mine) add(g, gBedGlow, bedGlow, 0, 0.727, 0).rotation.x = -PI / 2;
    const sm2 = glow(mine ? COL.amber : COL.cyan, 2); sm2.userData.mine = mine; W.statMats.push(sm2); add(g, gStat, sm2, 1.41, 0.62, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.66, -0.5); g.add(pivot);
    add(pivot, gLid, mGlass, 0, 0, 0.5).rotation.z = PI / 2;
    for (const x of [-1.06, 0, 1.06]) add(pivot, gRib, mMetal, x, 0, 0.5).rotation.y = PI / 2;
    if (!mine) { add(pivot, gFrost, frostMats[(Math.random() * 3) | 0], 0, 0, 0.5).rotation.z = PI / 2; const bs = new THREE.Group(); bs.position.set(-0.735, 0.726, 0); bs.scale.setScalar(rnd(0.93, 1.03)); bs.userData.ph = rnd(6); g.add(bs); bodySlots.push(bs); // le corps y est accroché au chargement (origine = base du cou)
      add(g, gPillow, mDark, -0.9, 0.745, 0); const hs = new THREE.Group(); hs.position.set(-0.782, 0.878, 0); g.add(hs); headSlots.push(hs);
      const hb = add(hs, gBand, mBotD, -0.125, 0.0, 0); hb.rotation.y = PI / 2; add(hs, new THREE.SphereGeometry(0.008, 6, 6), glow(COL.cyan, 3), -0.125, 0.092, 0.03); }
    if (!mine) { const lb = textPlane([num, TX.stase + ' · ' + ((rnd(5) | 0) + 6) + ' bpm'], { color: '#7fe3e6', w: 320, size: 46, sub: 26, scale: 0.56 }); lb.position.set(1.42, 1.18, 0); lb.rotation.y = PI / 2; g.add(lb); }
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
  upd.push((t) => { for (const b of bodySlots) b.scale.y = b.scale.x * (1 + Math.sin(t * 0.5 + b.userData.ph) * 0.03); }); // respiration lente
  const mist = [], mistMat = new THREE.SpriteMaterial({ map: soft, color: 0x9fc4d8, transparent: true, opacity: 0.08, depthWrite: false });
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(mistMat); s.position.set(rnd(-5, 5), rnd(0.2, 1.1), rnd(Z0, Z1)); const k = rnd(3, 6.5); s.scale.set(k, k * 0.55, 1); s.userData.v = rnd(-0.25, 0.25); bay.add(s); mist.push(s); }

  /* ---------- vie robotique ---------- */
  // faisceaux : cône unité (pointe à l'origine, vers le bas) dont l'intensité fond sur les bords et le long de l'axe — plus de silhouette dure
  const beamGeo = new THREE.ConeGeometry(1, 1, 40, 1, true); beamGeo.translate(0, -0.5, 0);
  const beamMat = (hex) => U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(hex) }, uOp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uColor;uniform float uOp,uTime;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=clamp(abs(dot(normalize(vN),normalize(vV))),.0001,1.);float y=clamp(vUv.y,0.,1.);float along=pow(y,1.6)*smoothstep(0.,.14,y);float dust=.84+.16*sin(y*31.-uTime*2.2+vUv.x*12.57);gl_FragColor=vec4(uColor*pow(f,2.4)*along*dust*uOp,1.);}' }));
  const poolMat = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.pale).multiplyScalar(0.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  // bras de maintenance sur rail (un par rangée) : va de caisson en caisson, descend, scanne, repart
  function gantry(side, seq, off, hold) {
    add(bay, new THREE.BoxGeometry(0.12, 0.1, BL), mMetal, side * 2.2, 4.64, ZC); add(bay, new THREE.BoxGeometry(0.03, 0.02, BL), glow(COL.steel, 1.2), side * 2.2, 4.585, ZC);
    const car = new THREE.Group(); car.position.set(side * 2.2, 4.5, 0); bay.add(car); add(car, rbox(0.5, 0.22, 0.42, 0.05), mBot); add(car, new THREE.BoxGeometry(0.52, 0.03, 0.1), glow(COL.safran, 1.6), 0, 0, 0.17);
    const sh = new THREE.Group(); sh.position.y = -0.12; car.add(sh); add(sh, new THREE.SphereGeometry(0.1, 14, 10), mBotD); add(sh, rbox(0.11, 1.3, 0.11, 0.03), mBot, 0, -0.65, 0); add(sh, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), mBotD, 0.08, -0.65, 0);
    const el = new THREE.Group(); el.position.y = -1.3; sh.add(el); add(el, new THREE.SphereGeometry(0.085, 14, 10), mBotD); add(el, rbox(0.085, 1.3, 0.085, 0.03), mBot, 0, -0.65, 0);
    const wr = new THREE.Group(); wr.position.y = -1.3; el.add(wr); add(wr, new THREE.CylinderGeometry(0.07, 0.04, 0.2, 14), mBotD, 0, -0.1, 0);
    const tip = add(wr, new THREE.SphereGeometry(0.03, 8, 8), glow(COL.cyan, 4), 0, -0.22, 0), beam = add(wr, beamGeo, beamMat(COL.cyan), 0, -0.2, 0), lt = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); lt.position.y = -0.24; lt.scale.setScalar(0.22); wr.add(lt); beam.scale.set(0.2, 1.0, 0.2);
    for (const f of [-1, 1]) add(wr, new THREE.BoxGeometry(0.015, 0.14, 0.03), mBot, f * 0.045, -0.26, 0).rotation.z = f * 0.25;
    let rel = null; upd.push((t) => { const T = 11; let tt = t + off; if (hold) { if (W.wakeHold) tt = T * 0.4; else { if (rel === null) rel = t; tt = t - rel + T * 0.6; } } const n = Math.floor(tt / T), u = (tt % T) / T, L = seq.length, zA = -11.7 + seq[((n % L) + L) % L] * 2.6, zB = -11.7 + seq[(((n + 1) % L) + L) % L] * 2.6;
      const work = sm(0.02, 0.16, u) * (1 - sm(0.62, 0.76, u)); car.position.z = zA + (zB - zA) * sm(0.76, 1, u);
      sh.rotation.z = side * (1.25 - work * 0.5 + Math.sin(t * 1.3) * 0.02 * work); el.rotation.z = side * (-2.3 + work * 2.05); wr.rotation.z = side * (0.5 - work * 0.95) + Math.sin(t * 2.1) * 0.1 * work;
      const on = work > 0.9 ? 1 : 0; beam.material.uniforms.uOp.value = (hold && W.wakeHold ? 0 : on) * (0.5 + 0.14 * Math.sin(t * 17)); lt.material.opacity = on * (0.75 + 0.25 * Math.sin(t * 23)); tip.material.color.setHex(on ? COL.cyan : COL.safran).multiplyScalar(4); });
  }
  W.wakeHold = true; gantry(-1, [5, 9, 2, 7, 0, 11, 4], 0, true); gantry(1, [3, 8, 1, 10, 6], 6.5, false);
  // drones de surveillance : balayent les rangées avec un faisceau
  function drone(path, len) {
    const d = new THREE.Group(); add(d, rbox(0.4, 0.13, 0.28, 0.05), mBot); add(d, rbox(0.2, 0.08, 0.2, 0.03), mBotD, 0, 0.09, 0); add(d, new THREE.SphereGeometry(0.045, 12, 10), glow(COL.coral, 3), 0, 0, 0.14);
    for (const [x, z] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]]) { add(d, new THREE.CylinderGeometry(0.035, 0.05, 0.06, 10), mBotD, x, -0.08, z); add(d, new THREE.CircleGeometry(0.03, 10), glow(COL.pale, 3), x, -0.112, z).rotation.x = PI / 2; }
    add(d, new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), mBotD, -0.12, 0.2, -0.08);
    const beam = add(d, beamGeo, beamMat(COL.pale), 0, -0.1, 0); beam.scale.set(0.2 * len, len, 0.2 * len); const pool = add(d, new THREE.PlaneGeometry(1, 1), poolMat, 0, -0.08 - len, 0); pool.rotation.x = -PI / 2; pool.scale.setScalar(0.62 * len); bay.add(d);
    let px = 0, pz = 0; upd.push((t) => { const p = path(t); d.position.set(p[0], p[1] + Math.sin(t * 1.9 + p[2]) * 0.04, p[2]); const dx = p[0] - px, dz = p[2] - pz; if (Math.abs(dx) + Math.abs(dz) > 1e-5) { const ta = Math.atan2(dx, dz); d.rotation.y += Math.atan2(Math.sin(ta - d.rotation.y), Math.cos(ta - d.rotation.y)) * 0.05; } px = p[0]; pz = p[2]; d.rotation.z = Math.sin(t * 0.8) * 0.05; beam.material.uniforms.uOp.value = 0.3 + 0.05 * Math.sin(t * 9 + p[2]); });
  }
  drone((t) => [-4.35 + Math.sin(t * 0.21) * 0.22, 3.05, 1 + Math.sin(t * 0.09 + 0.5) * 12.5], 1.9);
  drone((t) => [4.35 + Math.sin(t * 0.17 + 2) * 0.22, 3.2, 1 + Math.sin(t * 0.075 + 2.4) * 12.5], 2.05);
  drone((t) => [Math.sin(t * 0.13) * 2.2, 3.9, -8.4 + Math.cos(t * 0.13) * 2.2], 3.78);
  // robots d'entretien au sol
  function rover(x, sp, ph) {
    const r = new THREE.Group(); add(r, rbox(0.56, 0.14, 0.38, 0.06), mBotD, 0, 0.11, 0); add(r, rbox(0.3, 0.07, 0.24, 0.03), mBot, -0.04, 0.2, 0); add(r, new THREE.SphereGeometry(0.05, 10, 8, 0, PI * 2, 0, PI / 2), glow(COL.amber, 2.5), 0.12, 0.23, 0);
    add(r, new THREE.BoxGeometry(0.02, 0.03, 0.3), glow(COL.pale, 3), 0.285, 0.12, 0); for (const z of [-0.2, 0.2]) add(r, new THREE.BoxGeometry(0.4, 0.015, 0.01), glow(COL.amber, 1.4), 0, 0.12, z);
    add(r, new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.amber).multiplyScalar(0.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 0.55, 0.036, 0).rotation.x = -PI / 2; bay.add(r);
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
    add(bay, new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0x8fb4d8, transparent: true, opacity: 0.035, depthWrite: false }), x, y, Z0 - 0.3);
  }
  const mt = new THREE.Matrix4(), bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), mMetal, 28);
  for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; mt.makeTranslation(WC.x + Math.cos(a) * 2.33, WC.y + Math.sin(a) * 2.33, Z0 + 0.03); bolts.setMatrixAt(i, mt); } bay.add(bolts);
  add(bay, rbox(4.4, 0.85, 0.7, 0.1), mPanel, 0, 0.42, Z0 + 0.75); add(bay, new THREE.BoxGeometry(4.2, 0.02, 0.03), glow(COL.cyan, 1.6), 0, 0.86, Z0 + 1.08);
  add(bay, new THREE.CylinderGeometry(0.025, 0.025, 4.6, 8), mBot, 0, 1.05, Z0 + 1.35).rotation.z = PI / 2; for (const x of [-2.2, 0, 2.2]) add(bay, new THREE.CylinderGeometry(0.02, 0.02, 1.05, 8), mBot, x, 0.52, Z0 + 1.35);
  const scr1 = textPlane(TX.earth, { color: '#ff4f38', w: 560, size: 44, sub: 28, scale: 1.45 }); scr1.position.set(-1.25, 1.14, Z0 + 0.8); scr1.rotation.x = -0.5; bay.add(scr1);
  const scr2 = textPlane(TX.fleet, { color: '#7fe3e6', w: 560, size: 44, sub: 28, scale: 1.45 }); scr2.position.set(1.25, 1.14, Z0 + 0.8); scr2.rotation.x = -0.5; bay.add(scr2);

  // --- poste de liaison neurale : fauteuil, câble cervical, casque ---
  const link = new THREE.Group(); link.position.set(3.25, 0, -11.4); link.rotation.y = 0.74; bay.add(link); // l'avant du fauteuil = -Z local (face au hublot)
  add(link, new THREE.CylinderGeometry(0.5, 0.6, 0.22, 28), mMetal, 0, 0.11, 0); add(link, new THREE.CylinderGeometry(0.52, 0.52, 0.02, 28), glow(COL.cyan, 0.9), 0, 0.225, 0); add(link, new THREE.CylinderGeometry(0.09, 0.12, 0.26, 12), mBotD, 0, 0.34, 0);
  const pad = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.85, metalness: 0.1 });
  add(link, rbox(0.62, 0.13, 0.62, 0.05), pad, 0, 0.52, -0.08); add(link, rbox(0.62, 1.0, 0.13, 0.05), pad, 0, 1.0, 0.36).rotation.x = 0.36; add(link, rbox(0.36, 0.24, 0.13, 0.05), pad, 0, 1.5, 0.56).rotation.x = 0.36;
  add(link, rbox(0.52, 0.11, 0.5, 0.05), pad, 0, 0.4, -0.62).rotation.x = -0.5; for (const s of [-1, 1]) { add(link, rbox(0.1, 0.08, 0.52, 0.03), mBot, s * 0.38, 0.74, -0.06); add(link, new THREE.BoxGeometry(0.012, 0.012, 0.5), glow(COL.cyan, 1.4), s * 0.435, 0.74, -0.06); add(link, rbox(0.06, 0.24, 0.06, 0.02), mBotD, s * 0.38, 0.62, 0.12); }
  add(link, new THREE.TorusGeometry(0.78, 0.05, 12, 64), mMetal, 0, 1.5, 0.74); W.linkGlow = glow(COL.cyan, 2.2); add(link, new THREE.TorusGeometry(0.7, 0.016, 8, 64), W.linkGlow, 0, 1.5, 0.74);
  const lr = [add(link, new THREE.TorusGeometry(0.56, 0.007, 6, 48), glow(COL.pale, 1.6), 0, 1.5, 0.74), add(link, new THREE.TorusGeometry(0.42, 0.007, 6, 48), glow(COL.cyan, 1.6), 0, 1.5, 0.74)];
  const sign = textPlane(TX.link, { color: '#7fe3e6', w: 560, size: 46, sub: 26, scale: 1.4, align: 'center' }); sign.position.set(0, 2.62, 0.74); sign.rotation.y = PI; link.add(sign);
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
    const plL = new THREE.Plane(new V3(-1, 0, 0), -4.225), plR = new THREE.Plane(new V3(1, 0, 0), -4.225), tints = [0xffffff, 0xe3c4ad, 0xb98d70, 0xf3dccf, 0x8f6a52];
    const mk = (pl, c) => new THREE.MeshStandardMaterial({ color: c, map: col, normalMap: nor, roughness: 0.6, metalness: 0, envMapIntensity: 0.35, clippingPlanes: [pl], clipShadows: true });
    const hm = tints.map((c) => [mk(plL, c), mk(plR, c)]); // un seul scan : on varie la carnation, les proportions et l'inclinaison pour que les dormeurs ne soient pas des clones
    headSlots.forEach((hs, i) => { const h = new THREE.Mesh(hg, hm[(i * 3 + (i >> 2)) % tints.length][hs.userData.right ? 1 : 0]); h.castShadow = true; h.receiveShadow = true; h.rotation.x = rnd(-0.16, 0.16); h.scale.set(rnd(0.95, 1.03), rnd(0.95, 1.04), rnd(0.93, 1.05)); hs.add(h); }); });
  // corps : mannequin posé puis allégé hors ligne (tools/corps.py), en combinaison de stase
  fetch('assets/models/sleeper.bin').then((r) => r.arrayBuffer()).then((buf) => { const [nv, ni] = new Uint32Array(buf, 0, 2), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nv * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(buf, 8 + nv * 12, nv * 4), 4, true)); geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, 8 + nv * 16, ni), 1));
    geo.translate(0.735, 0, 0); geo.computeVertexNormals();
    const mats = [0x7c8794, 0x5f6c80, 0x8a8377].map((c) => new THREE.MeshStandardMaterial({ color: c, vertexColors: true, roughness: 0.72, metalness: 0.08, envMapIntensity: 0.5 })), gCollar = new THREE.TorusGeometry(0.064, 0.016, 8, 22); gCollar.rotateY(PI / 2);
    bodySlots.forEach((bs, i) => { const b = add(bs, geo, mats[i % 3]); b.castShadow = true; b.receiveShadow = true; add(bs, gCollar, mBotD, 0.014, 0.157, 0).castShadow = true; }); }).catch(() => {});

  /* ================= ESPACE ================= */
  const space = new THREE.Group(); scene.add(space); W.space = space;
  const SUN = new V3(1, 0.32, 0.28).normalize(), EC = new V3(-150, -100, -330), EDIR = EC.clone().normalize();
  // ciel : étoiles fines sur trois échelles + Voie lactée (un dôme, un seul appel de rendu)
  add(space, new THREE.SphereGeometry(1300, 32, 20), U(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec3 vD;${NOISE}
      float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float stars(vec3 d,float sc,float th,float r){ vec3 p=d*sc; vec3 c=floor(p); vec3 f=fract(p)-.5; float o=h3(c+7.3);
        float hr=h3(c); float dd=length(f-(vec3(h3(c+1.1),h3(c+2.2),h3(c+3.3))-.5)*.5); return step(th,hr)*smoothstep(r,0.,dd)*(.35+o)*(.78+.22*sin(uTime*(1.+o*3.)+o*40.)); }
      void main(){ vec3 d=normalize(vD); float s=stars(d,60.,.6,.075)+stars(d,110.,.84,.13)*.6+stars(d,190.,.934,.21)*.32;
        vec3 ax=normalize(vec3(.35,.8,-.48)); float bd=dot(d,ax)*3.2; float band=exp(-bd*bd); vec2 q=vec2(atan(d.z,d.x)*3.,d.y*6.); float neb=fbm(q*1.6)*fbm(q*4.+3.);
        gl_FragColor=vec4(vec3(.82,.88,1.)*s*(1.+band*1.6)+vec3(.20,.24,.34)*band*neb*.5+vec3(.34,.22,.16)*band*neb*neb*neb*.9,1.); }` }))).renderOrder = 1; // dessiné après les parois : seuls les pixels des hublots sont calculés
  // Terre endommagée : continents désertifiés, océans retirés (croûtes de sel), tempêtes de poussière, foyers côté nuit, voile au limbe
  const day = loader.load('assets/space/earth.jpg'); day.colorSpace = THREE.SRGBColorSpace;
  const earthMat = U(new THREE.ShaderMaterial({ uniforms: { uDay: { value: day }, uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vNv;varying vec3 vPv;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vNv=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vPv=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform sampler2D uDay;uniform vec3 uSun;uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vNv;varying vec3 vPv;${NOISE}
      void main(){ vec3 d=texture2D(uDay,vUv).rgb; float lum=dot(d,vec3(.3,.59,.11));
        float ob=d.b-max(d.r,d.g)*.92; float ocean=smoothstep(.0,.06,ob); float shore=smoothstep(.0,.03,ob)*(1.-smoothstep(.03,.09,ob));
        vec3 land=mix(vec3(.26,.15,.07),vec3(.58,.39,.2),clamp(lum*1.9,0.,1.));
        vec3 sea=mix(vec3(.07,.06,.055),vec3(.24,.19,.15),clamp(lum*2.4,0.,1.));
        vec3 col=mix(land,sea,ocean); col=mix(col,vec3(.7,.66,.58),shore*.55);
        vec2 q=vUv*vec2(9.,4.5)+vec2(uTime*.003,0.); float storm=fbm(q); col=mix(col,vec3(.56,.4,.24),smoothstep(.56,.84,storm)*.6);
        float scar=smoothstep(.62,.7,fbm(vUv*vec2(26.,13.)+3.)); col=mix(col,vec3(.05,.04,.04),scar*.55*(1.-ocean));
        float ndl=dot(normalize(vN),uSun); float dayk=smoothstep(-.12,.4,ndl); float dusk=smoothstep(-.12,.1,ndl)*(1.-smoothstep(.1,.42,ndl));
        float fire=smoothstep(.7,.82,fbm(vUv*vec2(70.,35.)))*(1.-ocean)*(1.-dayk);
        float fr=pow(clamp(1.-dot(normalize(vNv),normalize(-vPv)),0.,1.),2.6);
        vec3 c=col*dayk*.7+vec3(.9,.34,.1)*dusk*.16+vec3(1.,.36,.08)*fire*2.4+col*.012; c=mix(c,vec3(.72,.5,.32)*dayk,fr*.55);
        gl_FragColor=vec4(c,1.); }` }));
  const earth = add(space, new THREE.SphereGeometry(150, 96, 64), earthMat, EC.x, EC.y, EC.z); earth.rotation.set(0.35, 2.1, 0.2);
  const cl = loader.load('assets/space/clouds.png');
  const dustS = add(space, new THREE.SphereGeometry(151.6, 72, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: cl }, uSun: { value: SUN } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D uC;uniform vec3 uSun;varying vec2 vUv;varying vec3 vN;void main(){float a=texture2D(uC,vUv).a;float l=smoothstep(-.1,.45,dot(normalize(vN),uSun));gl_FragColor=vec4(vec3(.5,.37,.23)*l,a*.3*l);}' }), EC.x, EC.y, EC.z);
  dustS.rotation.copy(earth.rotation);
  add(space, new THREE.SphereGeometry(157, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vW=normalize(mat3(modelMatrix)*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uSun;varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){float f=pow(clamp(1.-dot(normalize(vN),normalize(-vP)),0.,1.),3.2);float l=smoothstep(-.3,.5,dot(-vW,uSun));gl_FragColor=vec4(vec3(.95,.62,.34)*f*l*1.4,f);}' }), EC.x, EC.y, EC.z);
  upd.push((t, dt) => { earth.rotation.y += dt * 0.0035; dustS.rotation.y += dt * 0.006; });
  // matériau « éclairé par le soleil » (coques, roches) : tôles, lignes de hublots le long de la coque, reflet terrestre
  const spaceMat = (base, win = 0, ws = [8, 3]) => new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uBase: { value: new THREE.Color(base) }, uSun: { value: SUN }, uEarth: { value: EDIR }, uWin: { value: win }, uWS: { value: new THREE.Vector2(ws[0], ws[1]) } },
    vertexShader: 'varying vec3 vN;varying vec2 vUv;void main(){vUv=uv;vec4 n=vec4(normal,0.);\n#ifdef USE_INSTANCING\n n=instanceMatrix*n;\n vec4 p=instanceMatrix*vec4(position,1.);\n#else\n vec4 p=vec4(position,1.);\n#endif\n vN=normalize(mat3(modelMatrix)*n.xyz);gl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: `uniform vec3 uBase;uniform vec3 uSun;uniform vec3 uEarth;uniform float uWin;uniform vec2 uWS;varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ vec3 n=normalize(vN); float l=max(dot(n,uSun),0.); vec2 pg=vUv*uWS*.5; float pl=.84+.16*hash(floor(pg)); vec2 pf=abs(fract(pg)-.5); float seam=1.-smoothstep(.47,.5,max(pf.x,pf.y))*.4;
        vec3 c=uBase*pl*seam*(l*1.25+.025)+uBase*vec3(.6,.42,.26)*max(dot(n,uEarth),0.)*.22;
        if(uWin>0.){ vec2 g=vUv*uWS; vec2 f=fract(g); float row=step(.72,hash(vec2(floor(g.x),3.))); float on=step(.45,hash(floor(g)));
          float w=step(.3,f.x)*step(f.x,.7)*step(.25,f.y)*step(f.y,.6); c+=vec3(1.,.82,.55)*row*on*w*uWin; }
        gl_FragColor=vec4(c,1.); }` });
  const rockGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 2)); { const rp = rockGeo.attributes.position, v = new V3(); for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i); const n = 0.72 + 0.2 * Math.sin(v.x * 3.1 + v.y * 1.7) + 0.16 * Math.sin(v.y * 4.3 + v.z * 2.9) + 0.12 * Math.sin(v.z * 6.1 + v.x * 5.3); v.multiplyScalar(n); rp.setXYZ(i, v.x, v.y, v.z); } rockGeo.computeVertexNormals(); }
  const dN = 380, deb = new THREE.InstancedMesh(rockGeo, spaceMat(0x7d7061), dN), q = new THREE.Quaternion(), sc = new V3(), ps = new V3(), eu = new THREE.Euler();
  for (let i = 0; i < dN; i++) {
    const near = i < 26, a = rnd(PI * 2), r = rnd(175, 250);
    if (near) ps.set(rnd(-80, 80), rnd(-34, 44), rnd(-190, -60)); else ps.set(Math.cos(a) * r, rnd(-6, 6) + Math.sin(a * 2) * 4, Math.sin(a) * r);
    const k = near ? rnd(0.06, 0.4) : rnd(0.4, 2.6); sc.set(k * rnd(0.5, 1.6), k * rnd(0.4, 1.2), k * rnd(0.5, 1.8)); eu.set(rnd(6), rnd(6), rnd(6)); q.setFromEuler(eu);
    mt.compose(ps, q, sc); if (!near) mt.premultiply(new THREE.Matrix4().makeRotationZ(0.42).setPosition(EC.x, EC.y, EC.z)); deb.setMatrixAt(i, mt);
  }
  deb.frustumCulled = false; space.add(deb);

  // --- arches : coque profilée (tour), treillis, réservoirs, anneau d'habitat, radiateurs, tuyères, feux de position ---
  const lathe = (pts, seg = 30) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.rotateZ(-PI / 2); return g; }; // l'axe du vaisseau devient X, l'avant vers +X
  const glowTex = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0x9fd0ff).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const navMats = [glow(0xff3b30, 4), glow(0x34e07a, 4), glow(0xf1f2f4, 4)];
  function ark(L, big) {
    const g = new THREE.Group(), hull = 0x9aa1a8, dk = 0x4a5057, s = (pts) => pts.map(([r, y]) => [r * L, y * L]);
    add(g, lathe(s([[0, 0.02], [0.034, 0.02], [0.05, 0.06], [0.054, 0.2], [0.05, 0.33], [0.036, 0.42], [0.014, 0.485], [0, 0.5]])), spaceMat(hull, 1.5, [56, 44]));
    add(g, lathe(s([[0.056, 0.085], [0.06, 0.09], [0.06, 0.11], [0.056, 0.115]]), 30), spaceMat(dk)); add(g, lathe(s([[0.052, 0.3], [0.056, 0.305], [0.056, 0.32], [0.051, 0.325]]), 30), spaceMat(dk));
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; add(g, new THREE.BoxGeometry(L * 0.33, L * 0.003, L * 0.003), spaceMat(dk), -L * 0.145, Math.sin(a) * L * 0.027, Math.cos(a) * L * 0.027); }
    for (let i = 0; i < 8; i++) add(g, new THREE.TorusGeometry(L * 0.038, L * 0.0016, 6, 20), spaceMat(dk), -L * 0.305 + i * L * 0.046, 0, 0).rotation.y = PI / 2;
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; add(g, new THREE.SphereGeometry(L * 0.024, 14, 10), spaceMat(0xc2c7cc), -L * (i % 2 ? 0.2 : 0.11), Math.sin(a) * L * 0.045, Math.cos(a) * L * 0.045); }
    add(g, lathe(s([[0, -0.5], [0.026, -0.5], [0.05, -0.46], [0.046, -0.36], [0.03, -0.31], [0, -0.31]])), spaceMat(dk, 0.8, [40, 16]));
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3, y = Math.sin(a) * L * 0.022, z = Math.cos(a) * L * 0.022; add(g, lathe(s([[0.02, -0.545], [0.011, -0.515], [0.006, -0.5]]), 16), spaceMat(0x2b3036), 0, y, z).material.side = THREE.DoubleSide;
      add(g, new THREE.CircleGeometry(L * 0.013, 14), glow(0xa8d8ff, 5), -L * 0.512, y, z).rotation.y = -PI / 2; }
    const gl = new THREE.Sprite(glowTex); gl.scale.set(L * 0.14, L * 0.09, 1); gl.position.set(-L * 0.57, 0, 0); g.add(gl);
    for (const z of [-1, 1]) { add(g, new THREE.BoxGeometry(L * 0.24, L * 0.0016, L * 0.075), spaceMat(0x1c2c46, 0, [26, 8]), -L * 0.14, 0, z * L * 0.085); add(g, new THREE.BoxGeometry(L * 0.003, L * 0.003, L * 0.1), spaceMat(dk), -L * 0.14, 0, z * L * 0.045);
      add(g, new THREE.BoxGeometry(L * 0.07, L * 0.0012, L * 0.11), spaceMat(0x16233c, 0, [10, 16]), L * 0.26, z * L * 0.004, z * L * 0.115); }
    if (big) { const rg = new THREE.Group(); rg.position.x = L * 0.2; g.add(rg); add(rg, new THREE.TorusGeometry(L * 0.135, L * 0.013, 12, 64), spaceMat(hull, 1.7, [120, 6])).rotation.y = PI / 2;
      for (let i = 0; i < 6; i++) add(rg, new THREE.BoxGeometry(L * 0.004, L * 0.27, L * 0.004), spaceMat(dk)).rotation.x = i * PI / 6; g.userData.ring = rg; }
    const dish = add(g, lathe(s([[0, 0], [0.012, 0.002], [0.022, 0.008], [0.028, 0.017]]), 20), spaceMat(0xc2c7cc), L * 0.36, L * 0.075, 0); dish.rotation.z = 0.9; dish.material.side = THREE.DoubleSide;
    add(g, new THREE.CylinderGeometry(L * 0.0015, L * 0.0015, L * 0.05, 5), spaceMat(dk), L * 0.36, L * 0.055, 0);
    add(g, new THREE.SphereGeometry(L * 0.0035, 6, 6), navMats[0], L * 0.3, 0, -L * 0.056); add(g, new THREE.SphereGeometry(L * 0.0035, 6, 6), navMats[1], L * 0.3, 0, L * 0.056); add(g, new THREE.SphereGeometry(L * 0.0035, 6, 6), navMats[2], -L * 0.3, L * 0.052, 0);
    return g;
  }
  const fleet = [[92, true, 34, 9, -235, 0.42], [48, true, -46, 30, -360, -0.3], [30, false, 62, -14, -170, 0.85], [22, false, -30, 14, -150, -0.5]];
  W.ships = fleet.map(([len, big, x, y, z, ry]) => { const s = ark(len, big); s.position.set(x, y, z); s.rotation.y = ry; s.rotation.z = rnd(-0.06, 0.06); space.add(s); return s; });
  const shuttle = ark(7, false), shuttle2 = ark(5, false); space.add(shuttle, shuttle2);
  // la flotte au loin : des dizaines d'arches réduites à une silhouette et un feu
  { const far = mergeGeometries([lathe([[0, -0.5], [0.05, -0.46], [0.05, 0.3], [0.02, 0.46], [0, 0.5]], 8), (() => { const t = new THREE.TorusGeometry(0.13, 0.014, 5, 16); t.rotateY(PI / 2); t.translate(0.2, 0, 0); return t; })()].map((x) => { const n = x.toNonIndexed(); for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; }));
    const fN = 64, fm = new THREE.InstancedMesh(far, spaceMat(0x9aa1a8), fN), lp = new Float32Array(fN * 3);
    for (let i = 0; i < fN; i++) { const u = i / fN; ps.set(-260 + u * 980 + rnd(-40, 40), -30 + u * 190 + rnd(-26, 26), -520 - Math.sin(u * PI) * 420 + rnd(-60, 60)); const k = rnd(16, 34); sc.set(k, k, k); eu.set(0, 0.5 + rnd(-0.25, 0.25), rnd(-0.1, 0.1)); q.setFromEuler(eu); mt.compose(ps, q, sc); fm.setMatrixAt(i, mt); lp.set([ps.x, ps.y, ps.z], i * 3); }
    fm.frustumCulled = false; space.add(fm); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(2.4), size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lights.frustumCulled = false; space.add(lights); }
  // robot soudeur accroché au bord extérieur du grand hublot
  const wa = 0.72, welder = new THREE.Group(); welder.position.set(Math.cos(wa) * 1.86, WC.y + Math.sin(wa) * 1.86, Z0 - 0.78); welder.rotation.z = wa; space.add(welder);
  add(welder, rbox(0.3, 0.2, 0.22, 0.04), spaceMat(0xb9bec4)); add(welder, new THREE.SphereGeometry(0.035, 8, 8), glow(COL.safran, 3), -0.12, 0.06, 0.1);
  for (const [x, y] of [[0.12, 0.12], [0.12, -0.12], [-0.1, 0.12], [-0.1, -0.12]]) add(welder, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), spaceMat(0x4b5158), x + 0.06, y, 0).rotation.z = PI / 2 + (y > 0 ? 0.5 : -0.5);
  add(welder, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 5), spaceMat(0x8e959c), 0.2, 0, 0.06).rotation.z = PI / 2 - 0.3;
  const arc = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0xbfe0ff).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); arc.position.set(0.34, -0.04, 0.08); welder.add(arc);
  const spN = 40, spp = new Float32Array(spN * 3), spv = []; for (let i = 0; i < spN; i++) { spv.push([0, 0, 0, 0]); spp.set([0, 99, 0], i * 3); }
  const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(spp, 3));
  const sparks = new THREE.Points(spg, new THREE.PointsMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4), size: 0.03, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.position.copy(arc.position); sparks.frustumCulled = false; welder.add(sparks);
  upd.push((t, dt) => {
    W.ships.forEach((s, i) => { s.position.x += Math.cos(s.rotation.y) * dt * (0.25 + i * 0.05); if (s.userData.ring) s.userData.ring.rotation.x += dt * 0.12; });
    const k = (t * 0.03) % 1; shuttle.position.set(40 - k * 80, 3.2 + Math.sin(k * 6) * 0.6, -34 - k * 6); shuttle.rotation.y = PI + 0.08;
    const k2 = (t * 0.021 + 0.4) % 1; shuttle2.position.set(-34 + k2 * 68, 8 - k2 * 5, -58 + k2 * 10); shuttle2.rotation.y = -0.15; deb.rotation.y += dt * 0.0006;
    const bl = (t % 1.6) < 0.16 ? 4 : 0.3; navMats[0].color.setHex(0xff3b30).multiplyScalar(bl); navMats[1].color.setHex(0x34e07a).multiplyScalar(bl); navMats[2].color.setHex(0xf1f2f4).multiplyScalar((t + 0.8) % 1.6 < 0.1 ? 5 : 0.3);
    const on = (t % 5.2) < 2.6, f = on ? 0.5 + Math.random() * 0.5 : 0; arc.scale.setScalar(f * 0.2 + 0.001); es.color.copy(esBase).lerp(esArc, f * 0.7); es.intensity = 9 + f * 9;
    const bk = Math.min(1, W.beacon.intensity / 26); W.keyLight.color.copy(keyBase).lerp(keyAmber, bk * 0.75);
    for (let i = 0; i < spN; i++) { const v = spv[i]; v[3] -= dt; if (v[3] <= 0 && on) { v[0] = rnd(-0.6, 0.9); v[1] = rnd(-0.9, 0.3); v[2] = rnd(-0.5, 0.5); v[3] = rnd(0.3, 1); spp.set([0, 0, 0], i * 3); } else if (v[3] > 0) { spp[i * 3] += v[0] * dt; spp[i * 3 + 1] += v[1] * dt; spp[i * 3 + 2] += v[2] * dt; } else spp.set([0, 99, 0], i * 3); } spg.attributes.position.needsUpdate = true;
  });

  /* ================= DANSE SENSORIELLE : la galerie Ceysson & Bénétière reconstituée ================= */
  // Plan relevé sur la page « Parcours » du Canva (1 px du plan ≈ 0,1 m ; entrée en z = 0, le fond de la nef vers -z).
  // Repères réels : narthex d'accueil avec la librairie et la vue sur le Bistrot, grande nef aux murs blancs, sol en béton ciré, ~6 m sous plafond.
  const ds = new THREE.Group(); ds.position.y = -400; ds.visible = false; scene.add(ds); W.ds = ds; W.DSY = -400;
  const GH = 6, L1 = 3.2, PALE = 0xdbe8f7;
  const lineMat = (hex, op) => new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = (arr, mat, parent = ds) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(g, mat); l.frustumCulled = false; parent.add(l); return l; };
  const boxEdges = (out, x, y, z, w, h, d) => { const a = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)).attributes.position.array; for (let i = 0; i < a.length; i += 3) out.push(a[i] + x, a[i + 1] + y, a[i + 2] + z); };
  // sol : béton ciré évoqué par une trame très fine, ondes sous tes pas, halos de station
  const floorMat = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new V3() }, uSt: { value: [0, 1, 2, 3].map(() => new THREE.Vector2()) }, uSc: { value: works.map((w) => new THREE.Color(w.col)) }, uK: { value: [0, 0, 0, 0] } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime;uniform vec3 uCam;uniform vec2 uSt[4];uniform vec3 uSc[4];uniform float uK[4];varying vec3 vW;
      void main(){ vec2 p=vW.xz; vec2 g=abs(fract(p)-.5); float l1=smoothstep(.488,.5,max(g.x,g.y)); vec2 g5=abs(fract(p/4.)-.5); float l5=smoothstep(.4955,.5,max(g5.x,g5.y));
        float dc=distance(p,uCam.xz); float fade=exp(-dc*.07); vec3 col=vec3(.55,.68,.84)*(l1*.1+l5*.3)*fade;
        float ring=smoothstep(.47,.5,abs(fract(dc*.45-uTime*.3)-.5))*exp(-dc*.3); col+=vec3(.6,.86,.9)*ring*.16;
        for(int i=0;i<4;i++){ float d=distance(p,uSt[i]); col+=uSc[i]*(exp(-d*d*.5)*.07+smoothstep(.012,0.,abs(d-1.05))*.5+smoothstep(.01,0.,abs(d-1.3))*.22*l1)*uK[i]; }
        gl_FragColor=vec4(col+vec3(.006,.008,.011),.84); }` }));
  W.floorU = floorMat.uniforms; // ordre de dessin : reflets (-2), puis le sol qui les atténue (-1), puis tout le reste
  for (const [w, d, x, y, z] of [[60, 60, 0, 0, -16], [8.1, 13, 11.25, L1, -6.5]]) { const f = add(ds, new THREE.PlaneGeometry(w, d), floorMat, x, y, z); f.rotation.x = -PI / 2; f.renderOrder = -1; }
  // murs : voiles blancs presque invisibles, arêtes en filets fins
  const wallMat = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform float uTime;varying vec2 vUv;varying vec3 vW;void main(){float sweep=smoothstep(.985,1.,sin(vW.y*1.3-uTime*.5+vW.x*.05)*.5+.5);float k=1.-vUv.y;float a=.006+.02*k*k+sweep*.02;gl_FragColor=vec4(vec3(.82,.9,1.)*a,1.);}' }));
  const edge = [], edgeHi = [];
  const wall = (x1, z1, x2, z2, y0 = 0, y1 = GH) => { const len = Math.hypot(x2 - x1, z2 - z1), m = add(ds, new THREE.PlaneGeometry(len, y1 - y0), wallMat, (x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    edgeHi.push(x1, y1, z1, x2, y1, z2); edge.push(x1, y0, z1, x2, y0, z2, x1, y0, z1, x1, y1, z1, x2, y0, z2, x2, y1, z2); };
  [[-15.2, 0, -9, 0], [-5.2, 0, 15.3, 0], [15.3, 0, 15.3, -32.3], [15.3, -32.3, -15.2, -32.3], [-15.2, -32.3, -15.2, -18.9], [-15.2, -18.9, -18.6, -18.9], [-18.6, -18.9, -18.6, -11.5], [-18.6, -11.5, -15.2, -11.5], [-15.2, -11.5, -15.2, 0],
    [7.2, -3.5, 7.2, -13], [7.2, -13, 15.3, -13]].forEach((w) => wall(...w));
  [[-0.8, -22.5, -0.8, -29.5], [-11.2, -20, -2, -20], [1.7, -20, 10, -20], [-0.8, -10.9, -0.8, -16.7], [1.7, -9.7, 6.2, -9.7]].forEach((w) => wall(w[0], w[1], w[2], w[3], 0, 4.2)); // cimaises
  edge.push(-9, 0, 0, -9, 3, 0, -5.2, 0, 0, -5.2, 3, 0); edgeHi.push(-9, 3, 0, -5.2, 3, 0);                       // porte d'entrée
  edgeHi.push(7.2, L1, 0, 7.2, L1, -3.5, 7.2, L1, 0, 15.3, L1, 0); for (const z of [0, -0.6, -1.2, -3.2, -3.5]) edge.push(7.2, L1, z, 7.2, L1 + 1, z); edge.push(7.2, L1 + 1, 0, 7.2, L1 + 1, -1.2, 7.2, L1 + 1, -3.2, 7.2, L1 + 1, -3.5);
  for (const z of [-1.4, -3.0]) { edge.push(2.6, 0.95, z, 7.2, L1 + 0.95, z); for (let i = 0; i <= 16; i += 4) { const x = 2.6 + i * (4.6 / 16), y = i * (L1 / 16); edge.push(x, y, z, x, y + 0.95, z); } } // mains courantes // rive du niveau 1 + garde-corps
  for (let i = 0; i <= 16; i++) { const x = 2.6 + i * (4.6 / 16), y = i * (L1 / 16); edge.push(x, y, -1.4, x, y, -3.0); if (i < 16) edge.push(x, y, -1.4, x + 4.6 / 16, y, -1.4, x, y, -3.0, x + 4.6 / 16, y, -3.0, x + 4.6 / 16, y, -1.4, x + 4.6 / 16, y + L1 / 16, -1.4, x + 4.6 / 16, y, -3.0, x + 4.6 / 16, y + L1 / 16, -3.0); } // escalier
  boxEdges(edge, -12.4, 0.55, -2.2, 3.2, 1.1, 0.8); for (const z of [-4.6, -6.6, -8.6]) boxEdges(edge, -14.7, 1.1, z, 0.5, 2.2, 1.5); for (const [x, z] of [[-17, -13.2], [-17, -15.2], [-17, -17.2]]) boxEdges(edge, x, 0.38, z, 0.8, 0.76, 0.8); // banque d'accueil, librairie, tables du Bistrot
  const ceil = []; for (let x = -14; x <= 15; x += 4) ceil.push(x, GH, 0, x, GH, -32.3); for (let z = -2; z >= -32; z -= 4) ceil.push(-15.2, GH, z, 15.3, GH, z); for (let z = -4; z >= -32; z -= 8) for (let x = -14; x < 15; x += 4) ceil.push(x, GH, z, x + 2, GH + 1.1, z, x + 2, GH + 1.1, z, x + 4, GH, z); // verrière et sheds
  const mEdge = lineMat(PALE, 0.34), mEdgeHi = lineMat(PALE, 0.6), mCeil = lineMat(COL.steel, 0.28); segs(edge, mEdge); segs(edgeHi, mEdgeHi); segs(ceil, mCeil);
  for (const [arr, op] of [[edge, 0.34], [edgeHi, 0.6]]) { const r = segs(arr, lineMat(PALE, op)); r.scale.y = -1; r.renderOrder = -2; } // reflet de l'architecture dans le béton ciré
  { const bk = []; for (const z of [-4.6, -6.6, -8.6]) for (const y0 of [0.08, 0.52, 0.96, 1.4, 1.84]) { bk.push(-14.45, y0 - 0.03, z - 0.72, -14.45, y0 - 0.03, z + 0.72); for (let zz = z - 0.7; zz < z + 0.7; zz += rnd(0.03, 0.07)) { if (Math.random() < 0.12) continue; bk.push(-14.45, y0, zz, -14.45, y0 + rnd(0.24, 0.37), zz); } } segs(bk, lineMat(PALE, 0.2)); } // les livres de la librairie
  const label = (txt, x, y, z, ry, sc = 1.2, flat = false, op = 0.6) => { const t = textPlane([txt], { color: '#dbe8f7', w: 640, size: 60, scale: sc, align: 'center' }); t.material.opacity = op; t.position.set(x, y, z); if (flat) t.rotation.x = -PI / 2; else t.rotation.y = ry; ds.add(t); return t; };
  const TXG = TX;
  label(TXG.entree || 'ENTRÉE', -7.1, 0.02, -1.1, 0, 1.5, true, 0.5); label(TXG.narthex || 'NARTHEX · ACCUEIL', -11.6, 0.02, -4.2, 0, 2.6, true, 0.32); label(TXG.librairie || 'LIBRAIRIE', -15.1, 2.9, -6.6, PI / 2, 1.5);
  label(TXG.bistrot || 'LE BISTROT', -18.5, 2.6, -15.2, PI / 2, 1.6); label(TXG.nef || 'NEF · NIV. 0', 6, 0.02, -26, 0, 3.2, true, 0.22); label(TXG.niv1 || 'NIV. 1', 7.1, 4.5, -8.2, -PI / 2, 1.2); label('CEYSSON & BÉNÉTIÈRE', -7.1, 3.62, 0.06, 0, 3.4, false, 0.75);
  // poussière fine en suspension
  { const n = 1400, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([rnd(-15, 15), rnd(0, GH), rnd(-32, 1)], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: soft, color: PALE, size: 0.022, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; ds.add(pts);
    W.dsTime = 1; upd.push((t, dt) => { for (let i = 1; i < p.length; i += 3) { p[i] += dt * 0.05 * W.dsTime; if (p[i] > GH) p[i] = 0; } g.attributes.position.needsUpdate = true; }); }

  // --- le parcours, tel que dessiné sur le plan : chemin pointillé au sol, qui s'allume devant toi ---
  const P = (x, z, y = 0) => new V3(x, y, z), ART = [
    { pos: P(-0.86, -13.4), n: new V3(-1, 0, 0), lv: 0 }, { pos: P(-15.14, -24.8), n: new V3(1, 0, 0), lv: 0 },
    { pos: P(9.2, -12.94), n: new V3(0, 0, 1), lv: L1 }, { pos: P(15.24, -7.7), n: new V3(-1, 0, 0), lv: L1 }];
  const stopOf = (i) => ART[i].pos.clone().addScaledVector(ART[i].n, works[i].dist).setY(ART[i].lv);
  W.legs = [ [P(-7.1, 3.2), P(-7.1, -2.5), P(-5.6, -8.6), P(-4.2, -12.2), stopOf(0)],
    [stopOf(0), P(-4.4, -15.2), P(-12.6, -15.4), P(-13.3, -21.5), stopOf(1)],
    [stopOf(1), P(-11, -24.4), P(-4.2, -24), P(-2.2, -21.7), P(0.3, -19.6), P(0.5, -12), P(0.5, -5), P(1.2, -2.6), P(2.6, -2.2), P(3.75, -2.2, 0.8), P(4.9, -2.2, 1.6), P(6.05, -2.2, 2.4), P(7.3, -2.2, L1), P(9.1, -3.4, L1), stopOf(2)],
    [stopOf(2), P(11.6, -8.9, L1), stopOf(3)] ].map((pts) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25));
  { const pp = [], ss = []; let acc = 0; W.legLen = []; for (const c of W.legs) { const len = c.getLength(), n = Math.ceil(len / 0.22); W.legLen.push([acc, len]); for (let i = 0; i <= n; i++) { const p = c.getPointAt(i / n); pp.push(p.x, p.y + 0.03, p.z); ss.push(acc + len * i / n); } acc += len; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(ss, 1));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uHead: { value: 0 }, uPx: { value: 1 }, uAll: { value: 0 } },
      vertexShader: 'attribute float aS;uniform float uHead,uTime,uPx,uAll;varying float vA;void main(){float d=aS-uHead;float e=(d-2.2)/2.6;e=exp(-e*e);vA=(d<-1.?.07:.2)+uAll*.55+.8*e+.25*smoothstep(.9,1.,sin(aS*1.4-uTime*3.));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uPx*(4.+3.*e)/max(1.,-mv.z*.35);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){vec2 q=gl_PointCoord-.5;float a=smoothstep(.5,.15,length(q));gl_FragColor=vec4(vec3(1.,.5,.38)*a*vA,1.);}' }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; ds.add(pts); W.pathU = m.uniforms;
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); const pl = new THREE.Line(lg, lineMat(COL.coral, 0.1)); pl.frustumCulled = false; ds.add(pl); W.pathLine = pl.material; } // filet continu : c'est lui qu'on voit de loin

  // --- une œuvre reconstituée à taille réelle : poussière de fragments qui se rassemble en image continue ---
  function tiles(tex, wk) {
    const cols = Math.round(wk.w / wk.cell), rows = Math.round(wk.h / wk.cell), n = cols * rows, pa = wk.w / wk.h, cover = pa > wk.ar ? new THREE.Vector2(1, wk.ar / pa) : new THREE.Vector2(pa / wk.ar, 1);
    const base = new THREE.PlaneGeometry(wk.w / cols, wk.h / rows), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const ce = new Float32Array(n * 2), r4 = new Float32Array(n * 4); for (let i = 0; i < n; i++) { ce.set([i % cols, (i / cols) | 0], i * 2); r4.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(ce, 2)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r4, 4));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: tex }, uColor: { value: new THREE.Color(wk.col) }, uTime: { value: 0 }, uAsm: { value: 0 }, uMode: { value: wk.mode }, uKey: { value: new V3(wk.ck ? wk.ck[0] : 0.17, wk.ck ? wk.ck[1] : 0.4, wk.base || 0) }, uRelief: { value: wk.relief || 0 }, uBg: { value: wk.bg || 0 }, uHit: { value: new THREE.Vector2(9, 9) }, uAmp: { value: 0 },
        uGrid: { value: new THREE.Vector2(cols, rows) }, uSize: { value: new THREE.Vector2(wk.w, wk.h) }, uCover: { value: cover }, uTx: { value: new THREE.Vector2(1 / 600, 1 / 600) } },
      vertexShader: `attribute vec2 aCell;attribute vec4 aRnd;uniform sampler2D uTex;uniform float uTime,uAsm,uRelief,uAmp;uniform vec2 uGrid,uSize,uCover,uHit;varying vec2 vUv;varying vec2 vL;varying float vK;varying float vRow;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vL=uv; vRow=(aCell.y+uv.y)/uGrid.y; vUv=((aCell+uv)/uGrid-.5)*uCover+.5; vec2 cuv=((aCell+.5)/uGrid-.5)*uCover+.5; vec3 home=vec3((aCell+.5)/uGrid-.5,0.)*vec3(uSize,1.);
          vec3 tc=texture2D(uTex,cuv).rgb; float sat=max(tc.r,max(tc.g,tc.b))-min(tc.r,min(tc.g,tc.b));
          float d=distance(home.xy,uHit); home.z+=uRelief*sat*.12+(exp(-d*d*9.)*.22+sin(d*18.-uTime*5.)*exp(-d*2.6)*.05)*uAmp;
          float k=smoothstep(0.,1.,clamp(uAsm*1.9-(1.-(aCell.y+.5)/uGrid.y)*.6-aRnd.w*.3,0.,1.)); vK=k; // l'image s'imprime de haut en bas
          float R=max(uSize.x,uSize.y); float th=aRnd.x*6.28+uTime*(.15+aRnd.y*.3), rad=(.35+aRnd.z*1.05)*R; vec3 sc=vec3(cos(th)*rad,((aRnd.y-.5)*1.7+sin(uTime*.5+aRnd.w*6.28)*.12)*R,.06+abs(sin(th))*rad*.55+aRnd.w*.3*R); // nuage en lente rotation, toujours devant la cimaise
          vec3 p=position*mix(.55,1.,k); float ang=(1.-k)*(aRnd.x*6.28+uTime*(aRnd.y-.5)*2.); p.xz=rot(ang)*p.xz; p.xy=rot(ang*.6)*p.xy;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(home+sc,home,k*k*(3.-2.*k))+p,1.); }`,
      fragmentShader: `uniform sampler2D uTex;uniform vec3 uColor;uniform vec3 uKey;uniform float uTime,uAsm,uBg;uniform int uMode;uniform vec2 uTx;varying vec2 vUv;varying vec2 vL;varying float vK;varying float vRow;
        float lum(vec2 u){return dot(texture2D(uTex,u).rgb,vec3(.3,.59,.11));}
        void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=dot(t,vec3(.3,.59,.11)); vec3 c;
          if(uMode==0){ float s=max(t.r,max(t.g,t.b))-min(t.r,min(t.g,t.b)); c=t*(smoothstep(uKey.x,uKey.y,s)*1.35+uKey.z)+uColor*.02+vec3(.3,.36,.46)*smoothstep(.24,.38,uBg-l)*step(.01,uBg)*.5; }
          else if(uMode==1){ c=pow(l,1.15)*mix(vec3(1.,.6,.33),uColor,.18)*1.25+t*.22; }
          else { float e=abs(lum(vUv+vec2(uTx.x,0.))-lum(vUv-vec2(uTx.x,0.)))+abs(lum(vUv+vec2(0.,uTx.y))-lum(vUv-vec2(0.,uTx.y))); c=uColor*(smoothstep(.03,.16,e)*1.5+l*.09)+vec3(1.)*smoothstep(.14,.4,e)*.5; }
          float scan=.955+.045*sin(vUv.y*900.-uTime*4.); float grain=mix(smoothstep(.5,.2,length(vL-.5)),1.,smoothstep(.55,1.,vK)); // en vol : des grains ronds ; posés : l'image continue
          float front=smoothstep(.016,0.,abs((1.-vRow)-(uAsm*1.9-.65)/.6))*vK; // filet lumineux du front d'impression
          gl_FragColor=vec4((mix(uColor*.5+vec3(.25),c,vK)*scan*mix(.42,1.,vK)+uColor*front*1.5)*grain,1.); }` }));
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
  }
  function dimLine(len, label2, color) { // cote (dimension réelle de l'œuvre)
    const g = new THREE.Group(), p = [-len / 2, 0, 0, len / 2, 0, 0, -len / 2, -0.02, 0, -len / 2, 0.02, 0, len / 2, -0.02, 0, len / 2, 0.02, 0], bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }))); const t = textPlane([label2], { color: hexCss(color), w: 240, size: 44, scale: 0.2, align: 'center' }); t.position.y = -0.045; g.add(t); return g;
  }
  W.stations = works.map((wk, i) => {
    const A = ART[i], g = new THREE.Group(); g.position.set(A.pos.x, A.lv + wk.cy, A.pos.z); g.rotation.y = Math.atan2(A.n.x, A.n.z); ds.add(g); // +Z local = vers la salle
    const tex = loader.load(wk.img, (t) => { st.u.uTx.value.set(1 / t.image.width, 1 / t.image.height); }); tex.colorSpace = THREE.SRGBColorSpace;
    const tl = tiles(tex, wk); tl.position.z = 0.03; g.add(tl);
    if (!A.lv) { const rf = new THREE.Group(); rf.position.y = -2 * wk.cy; rf.scale.y = -1; g.add(rf); const rm = new THREE.Mesh(tl.geometry, tl.material); rm.position.z = 0.03; rm.frustumCulled = false; rm.renderOrder = -2; rf.add(rm); } /* reflet de l'œuvre dans le sol */
    const deco = new THREE.Group(); deco.position.z = 0.03; g.add(deco); const dm = [], info = new THREE.Group(), im = []; info.position.z = 0.03; g.add(info);
    deco.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(wk.w + 0.03, wk.h + 0.03)), new THREE.LineBasicMaterial({ color: wk.col, transparent: true, opacity: 0.75 })));
    { const bl = 0.07, hw = wk.w / 2 + 0.05, hh = wk.h / 2 + 0.05, br = []; for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) br.push(sx * hw, sy * hh, 0, sx * (hw - bl), sy * hh, 0, sx * hw, sy * hh, 0, sx * hw, sy * (hh - bl), 0);
      segs(br, new THREE.LineBasicMaterial({ color: PALE, transparent: true, opacity: 0.8 }), deco); const idl = textPlane(['CB-0' + (i + 1)], { color: hexCss(wk.col), w: 200, size: 46, scale: 0.16 }); idl.position.set(-wk.w / 2 + 0.08, wk.h / 2 + 0.09, 0); info.add(idl); } // équerres de repérage + référence d'inventaire
    const hd = dimLine(wk.w, wk.dw, wk.col); hd.position.set(0, -wk.h / 2 - 0.09, 0); info.add(hd); const vd = dimLine(wk.h, wk.dh, wk.col); vd.rotation.z = PI / 2; vd.position.set(-(wk.w / 2 + 0.09), 0, 0); info.add(vd);
    const cw = Math.min(1.05, Math.max(0.64, wk.w * 0.72)), cart = textPlane([wk.title, wk.artist, wk.tech], { color: '#dbe8f7', w: 640, size: 52, sub: 35, scale: cw }); cart.position.set(wk.w / 2 + 0.14 + cw / 2, -wk.h / 2 + 0.17, 0); info.add(cart);
    // éclairage de galerie : halo sur la cimaise + filets du projecteur de plafond
    const bw = [5, 6.4, 4, 5.2][i], bh = A.lv ? GH - L1 : 4.2, by = bh / 2 - wk.cy; // cimaise : pan de mur opaque (il masque les filets situés derrière) avec le halo du projecteur autour de l'œuvre
    const back = add(g, new THREE.PlaneGeometry(bw, bh), new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uB: { value: new THREE.Vector4(bw, bh, by, Math.max(wk.w, wk.h)) }, uA: { value: new THREE.Vector2(wk.w / 2 + 0.02, wk.h / 2 + 0.02) } },
      vertexShader: 'uniform vec4 uB;varying vec2 vP;void main(){vP=(uv-.5)*uB.xy+vec2(0.,uB.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float uK;uniform vec4 uB;uniform vec2 uA;varying vec2 vP;void main(){vec2 d=vP/vec2(uB.w*1.25,uB.w*1.1);float pool=exp(-dot(d,d));float ins=step(abs(vP.x),uA.x)*step(abs(vP.y),uA.y);float ex=smoothstep(uB.x*.5,uB.x*.5-1.1,abs(vP.x))*smoothstep(uB.y*.5+uB.z,uB.y*.5+uB.z-.9,vP.y);vec3 c=vec3(.014,.019,.026)+vec3(.06,.066,.075)*pool*uK*(1.-ins*.8);gl_FragColor=vec4(mix(vec3(.004,.006,.009),c,ex),1.);}' }), 0, by, 0.004);
    const plumb = lineMat(wk.col, 0); segs([0, wk.h / 2 + 0.2, 0.02, 0, (A.lv ? GH - L1 : GH) - wk.cy, 0.02, 0, -wk.h / 2 - 0.24, 0.02, 0, -wk.cy, 0.02], plumb, g); // fil de couleur : repère l'œuvre de loin une fois le canal rouvert
    const cy0 = (A.lv ? GH : 4.4) - A.lv - wk.cy, sl = []; for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) sl.push(0, cy0, 1.5, sx * wk.w / 2, sy * wk.h / 2, 0.03); const spot = segs(sl, lineMat(PALE, 0), g);
    for (const [grp, list] of [[deco, dm], [info, im]]) grp.traverse((o) => { if (o.material && !list.includes(o.material)) { o.material.userData.op = o.material.opacity; o.material.opacity = 0; list.push(o.material); } });
    const stop = stopOf(i), st = { i, g, n: A.n, lv: A.lv, u: tl.material.uniforms, k: 0, a: 0, b: 1, wallPos: A.pos.clone().setY(A.lv + wk.cy),
      stop: { pos: stop.clone().setY(A.lv + 1.66 + W.DSY), look: A.pos.clone().setY(A.lv + wk.cy + W.DSY) } };
    W.floorU.uSt.value[i].set(stop.x, stop.z);
    upd.push((t, dt) => { st.u.uAsm.value = Math.min(1, Math.max(0, st.u.uAsm.value + (st.k > st.u.uAsm.value ? dt : -dt) / 3.4)); st.a += ((st.u.uAsm.value > 0.93 ? 1 : 0) - st.a) * (1 - Math.exp(-dt * 2.5)); /* impression en 3,4 s, puis cadre, cotes et cartel */ st.b += ((st.near ? 0 : 1) - st.b) * (1 - Math.exp(-dt * 3)); dm.forEach((m) => { m.opacity = m.userData.op * st.a; }); im.forEach((m) => { m.opacity = m.userData.op * st.a * st.b; });
      back.material.uniforms.uK.value = st.u.uAsm.value; plumb.opacity += ((st.done ? 0.8 : 0) - plumb.opacity) * 0.04; spot.material.opacity = st.u.uAsm.value * 0.16; W.floorU.uK.value[i] += (st.k - W.floorU.uK.value[i]) * (1 - Math.exp(-dt * 2)); });
    return st;
  });
  const S = W.stations;

  // 01 Kinesthésie — les plumes se détachent de la feuille et tombent autour de toi
  { const n = 64, base = new THREE.PlaneGeometry(0.07, 0.17), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const pal = [[1, 0.55, 0.62], [0.52, 0.72, 1], [0.58, 0.9, 0.66], [1, 0.84, 0.42], [1, 0.62, 0.36], [0.92, 0.38, 0.44], [0.86, 0.86, 0.92]], hw = works[0].w / 2 - 0.07;
    const p = new Float32Array(n * 3), r = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p.set([rnd(-hw, hw), rnd(-hw, hw), 0.05], i * 3); r.set([Math.random(), Math.random(), Math.random()], i * 3); c.set(pal[(rnd(pal.length)) | 0], i * 3); }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r, 3)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(c, 3));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 }, uFloor: { value: works[0].cy } },
      vertexShader: `attribute vec3 aPos;attribute vec3 aRnd;attribute vec3 aCol;uniform float uT,uFloor;varying vec2 vUv;varying vec3 vC;varying float vF;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vUv=uv; vC=aCol; float t=max(uT-aRnd.z*3.,0.); vF=min(t,1.); float sw=sin(t*1.1+aRnd.y*6.28); vec3 p=position;
          p.xy=rot(aRnd.x*6.28+sw*.8*min(t,1.))*p.xy; p.yz=rot(min(t,1.)*(aRnd.y-.5)*2.+sw*.5*min(t,1.))*p.yz;
          vec3 o=aPos; float span=uFloor+1.5; o.y=mod(aPos.y-t*(.13+aRnd.x*.18)+uFloor,span)-uFloor; o.x+=sw*.3*min(t*.5,1.); o.z+=min(t*.45,1.)*(.15+aRnd.y*1.45);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(o+p,1.); }`,
      fragmentShader: `uniform float uA;varying vec2 vUv;varying vec3 vC;varying float vF;
        void main(){ vec2 q=vUv*2.-1.; q.x+=.1*sin(q.y*2.2); float w=(1.-q.y*q.y)*.74*(.66+.34*q.y); float ins=smoothstep(w,w-.22,abs(q.x)); float barbs=.62+.38*sin(q.y*58.-abs(q.x)*36.); float rach=smoothstep(.045,0.,abs(q.x))*step(-.97,q.y);
          gl_FragColor=vec4(vC*(ins*(.2+.42*barbs)+rach*.6)*uA*.75*vF,1.); }` });
    const f = new THREE.Mesh(g, m); f.frustumCulled = false; S[0].g.add(f); S[0].fx = { on: false };
    upd.push((t, dt) => { m.uniforms.uA.value = S[0].a; if (S[0].fx.on) m.uniforms.uT.value += dt * W.dsTime; }); }

  // 02 Toucher haptique virtuel — le grillage et la résine se soulèvent sous le regard
  { const pts = [], w = works[1].w, h = works[1].h, NX = 56, NY = 56;
    for (let j = 0; j <= NY; j += 2) for (let i = 0; i < NX; i++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, (i + 1) / NX * w - w / 2, j / NY * h - h / 2, 0);
    for (let i = 0; i <= NX; i += 2) for (let j = 0; j < NY; j++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, i / NX * w - w / 2, (j + 1) / NY * h - h / 2, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uHit: S[1].u.uHit, uAmp: S[1].u.uAmp, uA: { value: 0 } },
      vertexShader: 'uniform float uTime,uAmp;uniform vec2 uHit;varying float vD;void main(){vec3 p=position;float d=distance(p.xy,uHit);vD=d;p.z+=.02+(exp(-d*d*9.)*.22+sin(d*18.-uTime*5.)*exp(-d*2.6)*.05)*uAmp;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'uniform float uA,uAmp;varying float vD;void main(){float h=exp(-vD*vD*6.)*uAmp;gl_FragColor=vec4(vec3(.55,.66,.76)*(.1+h*1.3)*uA,1.);}' }));
    S[1].g.add(new THREE.LineSegments(g, m)); const hitPlane = add(S[1].g, new THREE.PlaneGeometry(w * 2.4, h * 2.4), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0.05);
    S[1].fx = { on: false, hitPlane, mesh: S[1].g };
    upd.push(() => { m.uniforms.uA.value = S[1].a; S[1].u.uAmp.value += ((S[1].fx.on ? 1 : 0) - S[1].u.uAmp.value) * 0.05; }); }

  // 03 Proprioception — les troncs débordent du cadre, traversent la verrière et te dominent
  { const grp = new THREE.Group(); grp.position.y = -works[2].cy; S[2].g.add(grp); const trunks = [], dz = works[2].dist;
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8793c).multiplyScalar(0.22), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), bark = lineMat(0xe0a070, 0.3), core = lineMat(works[2].col, 0.55);
    for (let i = 0; i < 46; i++) { const front = i < 26, a = rnd(PI * 2), r = rnd(1.3, 6.2), rad = rnd(0.04, 0.14), x = front ? (Math.random() < 0.5 ? -1 : 1) * rnd(0.95, 4.2) : Math.cos(a) * r, z = front ? rnd(0.25, dz + 1.2) : dz + Math.sin(a) * r; // la moitié devant toi, de part et d'autre de l'œuvre if (Math.abs(x) < 0.95 && z > -0.2 && z < dz + 0.7) continue; if (z < 0.15) continue;
      const t = new THREE.Group(); add(t, new THREE.CylinderGeometry(rad * 0.7, rad, 16, 9, 1, true), tm, 0, 8, 0); const ln = [0, 0, 0, 0, 16, 0]; for (let k = 0; k < 8; k++) { const b = k * 0.7854 + i, bx = Math.cos(b) * rad, bz = Math.sin(b) * rad; ln.push(bx, 0, bz, bx * 0.7, 16, bz * 0.7); }
      segs(ln.slice(0, 6), core, t); segs(ln.slice(6), bark, t); t.position.set(x, 0, z); t.scale.y = 0.0001; t.userData.d = rnd(0, 1.4); grp.add(t); trunks.push(t); }
    S[2].fx = { on: false, t: 0 };
    upd.push((tt, dt) => { if (S[2].fx.on) S[2].fx.t += dt; else S[2].fx.t = Math.max(0, Math.min(S[2].fx.t, 4) - dt * 2.4); for (const t of trunks) { const k = Math.min(1, Math.max(0, (S[2].fx.t - t.userData.d) / 2.6)); t.scale.y = Math.max(0.0001, 1 - Math.pow(1 - k, 3)); } }); }

  // 04 Intéroception — le pouls, les bocaux, le temps qui se dilate
  { const grp = new THREE.Group(); grp.position.z = 0.04; S[3].g.add(grp); const rings = [], w = works[3].w, hh = works[3].h;
    for (let i = 0; i < 5; i++) rings.push(add(grp, new THREE.TorusGeometry(1, 0.0011, 6, 128), addGlow(works[3].col, 1.15, 0), 0, 0, 0));
    const jm = lineMat(works[3].col, 0), jl = []; for (let i = 0; i < 5; i++) { const x = -w / 2 + 0.04 + i * (w - 0.08) / 4, y0 = -hh / 2 - 0.3; for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2, b = (k + 1) / 14 * PI * 2, r = 0.034; for (const y of [0, 0.075, 0.087]) jl.push(x + Math.cos(a) * r, y0 + y, 0.08 + Math.sin(a) * r, x + Math.cos(b) * r, y0 + y, 0.08 + Math.sin(b) * r); if (k % 2 === 0) jl.push(x + Math.cos(a) * r, y0, 0.08 + Math.sin(a) * r, x + Math.cos(a) * r, y0 + 0.075, 0.08 + Math.sin(a) * r); } } segs(jl, jm, grp);
    S[3].fx = { on: false, beat: 0, pulse: 0 };
    upd.push((t, dt) => { const fx = S[3].fx; fx.pulse *= 0.93; jm.opacity = S[3].a * 0.75; rings.forEach((r, i) => { const ph = ((fx.beat + i / 5) % 1), s = 0.05 + ph * 0.42; r.scale.set(s, s, 1); r.material.opacity = fx.on ? (1 - ph) * (1 - ph) * 0.75 : 0; }); if (fx.on) fx.beat += dt * 0.36 * W.dsTime; }); }

  // échos de visiteurs : silhouettes en nuage de points, comme un souvenir de la galerie ouverte (poses : debout, en marche, tête baissée)
  fetch('assets/models/echo.bin').then((r) => r.arrayBuffer()).then((buf) => { const [np, n] = new Uint32Array(buf, 0, 2), geos = [], mats = [];
    for (let k = 0; k < np; k++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8 + k * n * 12, n * 3), 3)); geos.push(g); }
    for (const [x, z, y, ry, k] of [[-2.9, -10.6, 0, 2.51, 0], [-13.9, -6.6, 0, -PI / 2, 2], [-8.5, -22.5, 0, PI / 2, 1], [4.4, -26, 0, 2.3, 0], [5.3, -26.8, 0, -0.84, 0], [12.9, -11.2, L1, 0.59, 2], [-17, -14.2, 0, PI / 2, 0], [5.5, -18.4, 0, PI, 2], [-10.2, -2.4, 0, 0.4, 1]]) {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: W.pathU.uPx, uOp: { value: 0.3 } }, // points de taille constante en pixels, atténués avec la distance : la silhouette reste diaphane de près comme de loin
        vertexShader: 'uniform float uPx,uOp;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float s=uPx*4.2/max(-mv.z,.4);gl_PointSize=max(s,1.);vA=uOp*min(1.,s*s);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'varying float vA;void main(){gl_FragColor=vec4(vec3(.86,.91,.97)*vA*smoothstep(.5,.15,length(gl_PointCoord-.5)),1.);}' }), e = new THREE.Points(geos[k % np], m); e.position.set(x, y, z); e.rotation.y = ry; ds.add(e); mats.push(m); }
    upd.push((t) => { mats.forEach((m, i) => { m.uniforms.uOp.value = 0.14 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.35 + i * 1.7)); }); }); }).catch(() => {});

  W.update = (t, dt, cam) => { for (const u of W.timeU) u.value = t; if (cam) W.floorU.uCam.value.copy(cam); for (const f of upd) f(t, dt); };
  W.setScene = (name) => { const d = name === 'ds'; bay.visible = !d; space.visible = !d; ds.visible = d; };
  return W;
}
