// SPES — décors 3D : baie cryogénique, hublots, espace, danse sensorielle (la galerie reconstituée).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawEmblem } from './embleme.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildGallery } from './galerie.js';

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

export function buildWorld(scene, loader, works, TX, opts = {}) {
  const W = { timeU: [] }; const upd = [];
  const soft = softTex(), shaft = shaftTex();
  const U = (m) => { W.timeU.push(m.uniforms.uTime); return m; };

  /* ================= MATÉRIAUX ================= */
  const pbr = (name, rx, ry, o, rough) => { const mk = (suf, srgb) => { const t = loader.load('assets/tex/pbr/' + name + '_' + suf + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = srgb ? 8 : 2; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return new THREE.MeshStandardMaterial(Object.assign({ map: mk('diff', true), normalMap: mk('nor', false), envMapIntensity: 0.55 }, rough ? { roughnessMap: mk('rough', false) } : {}, o)); };
  const mMetal = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.55 });
  const mPanel = new THREE.MeshStandardMaterial({ color: 0x2c343c, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.4 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x0c0f13, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.3 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0xc4e8f0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2 });
  const mSteel = new THREE.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 0.95, roughness: 0.24, envMapIntensity: 1 });
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
  const BW = 11, BH = 5, Z0 = -15, Z1 = 18.2, BL = Z1 - Z0, ZC = (Z0 + Z1) / 2;
  // La baie est modélisée dans Blender (tools/baie_blender.py) en pièces répétées tous les 2,6 m : « travee » (sol en plaques,
  // caniveau, alcôve technique derrière chaque caisson, pan coupé et conduites, plafond à gaines), « couple » (structure),
  // « avant » (les 2 m devant les hublots), « fond » (cloison et porte étanche). Chaque matière du modèle porte un nom, repris ici.
  const TILE = { sol: 2.75, passerelle: 1.44, paroi: 2.9 }; // taille d'un motif de texture, en mètres
  const boxUV = (g, size) => { const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2); // les modèles n'ont pas de coordonnées de texture : on les projette selon la face
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v; if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); } uv[i * 2] = u / size; uv[i * 2 + 1] = v / size; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const slitMat = glow(COL.steel, 1.5), edgeMat = glow(COL.cyan, 1.1);
  const ecranMat = (wall) => U(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uWall: { value: wall ? 1 : 0 } }, // écrans : des lignes de relevés qui défilent
    vertexShader: 'varying vec3 vO;void main(){vO=position;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\n p=instanceMatrix*p;\n#endif\n gl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: 'uniform float uTime,uWall;varying vec3 vO;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float r=(uWall>.5?vO.y:vO.z+vO.y)*52.;float a=uWall>.5?vO.z:vO.x;float row=floor(r);float on=step(.35,h(vec2(row,floor(uTime*1.4+row*.17))));float bar=step(fract(a*7.+.5),.15+.7*h(vec2(row,3.)))*on*step(.4,fract(r));gl_FragColor=vec4(vec3(.25,.85,.95)*(.05+bar*.85),1.);}' }));
  const bayMats = { sol: pbr('metal_plate_02', 1, 1, { color: 0x858d95, metalness: 0.8, roughness: 0.9, envMapIntensity: 0.45 }, true), passerelle: pbr('metal_plate', 1, 1, { color: 0xc4ccd4, metalness: 0.85, roughness: 0.5 }),
    paroi: pbr('blue_metal_plate', 1, 1, { color: 0xaab4bf, metalness: 0.55, roughness: 0.58 }), structure: mMetal, panneau: mPanel, sombre: mDark, acier: mSteel, coque: new THREE.MeshStandardMaterial({ color: 0x29313a, metalness: 0.7, roughness: 0.46, envMapIntensity: 0.6 }),
    cuivre: new THREE.MeshStandardMaterial({ color: 0x7a5236, metalness: 0.9, roughness: 0.42, envMapIntensity: 0.7 }), givre: new THREE.MeshStandardMaterial({ color: 0xbcd0dc, metalness: 0.15, roughness: 0.82, envMapIntensity: 0.5 }),
    matelas: new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.7, metalness: 0.02 }), rouge: new THREE.MeshStandardMaterial({ color: 0x8a1f16, roughness: 0.5, metalness: 0.3 }), jaune: new THREE.MeshStandardMaterial({ color: 0xa67c12, roughness: 0.6, metalness: 0.2 }),
    lueur: slitMat, lueur_c: edgeMat, ambre: glow(COL.amber, 2), ecran: ecranMat(true), verre: mGlass };
  const parts = (node) => { const out = []; node.traverse((o) => { if (!o.isMesh) return; const name = o.material.name, g = o.geometry; if (TILE[name]) boxUV(g, TILE[name]); out.push([g, bayMats[name] || mPanel]); }); return out; };
  const shade = (m) => { m.castShadow = !!m.material.isMeshStandardMaterial && !m.material.transparent; m.receiveShadow = true; return m; };
  const RIB0 = -13.0, NB = 12; // premier couple, nombre de travées
  // Tri de profondeur des instances : dans un lot, les pièces sont dessinées dans l'ordre de leur liste. Rangées du plus près au plus loin de l'œil,
  // les pièces proches masquent les lointaines AVANT que celles-ci soient éclairées. On retrie quand le visiteur a avancé de 80 cm.
  const sorted = [], sortZ = { z: 1e9 }, sm4 = new THREE.Matrix4(), sv = new V3(); const nearFirst = (im) => { const n = im.count, src = im.instanceMatrix.array.slice(), zs = []; for (let i = 0; i < n; i++) { sm4.fromArray(src, i * 16); zs.push(sv.setFromMatrixPosition(sm4).z); } sorted.push([im, src, zs]); return im; };
  upd.push((t, dt, cam) => { if (!cam || !bay.visible || Math.abs(cam.z - sortZ.z) < 0.8) return; sortZ.z = cam.z; for (const [im, src, zs] of sorted) { const order = zs.map((z, i) => i).sort((a, b) => Math.abs(zs[a] - cam.z) - Math.abs(zs[b] - cam.z)); order.forEach((i, k) => im.instanceMatrix.array.set(src.subarray(i * 16, i * 16 + 16), k * 16)); im.instanceMatrix.needsUpdate = true; } });
  new GLTFLoader().load('assets/models/baie.glb', (res) => { const mx = new THREE.Matrix4();
    const repeat = (name, n) => { for (const [g, m] of parts(res.scene.getObjectByName(name))) for (let c = 0; c < n; c += 4) { const k = Math.min(4, n - c), im = shade(new THREE.InstancedMesh(g, m, k)); im.castShadow = false; for (let i = 0; i < k; i++) im.setMatrixAt(i, mx.makeTranslation(0, 0, RIB0 + (c + i) * 2.6)); im.computeBoundingSphere(); bay.add(nearFirst(im)); } }; /* l'architecture reçoit les ombres mais n'en porte pas : la passe d'ombre ne redessine que caissons, robots et fauteuil */
    const once = (name, z) => { for (const [g, m] of parts(res.scene.getObjectByName(name))) { const me = shade(new THREE.Mesh(g, m)); me.castShadow = false; me.position.z = z; bay.add(me); } };
    repeat('travee', NB); repeat('couple', NB + 1); once('avant', Z0); once('fond', Z1); for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  W.guideMat = glow(COL.cyan, 1.3);
  add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, -1.25, 0.035, ZC); add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, 1.25, 0.035, ZC);
  const barMat = glow(COL.pale, 2.6), shaftMat = new THREE.MeshBasicMaterial({ map: shaft, color: 0xb9d6f2, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const gBar = new THREE.BoxGeometry(2.4, 0.03, 0.14), gShaft = new THREE.PlaneGeometry(3.0, 4.4);
  for (let i = 0; i < NB; i++) { const z = RIB0 + i * 2.6; add(bay, gBar, barMat, 0, 4.545, z); add(bay, gShaft, shaftMat, 0, 4.53 - 2.2, z); } // une rampe lumineuse sous chaque couple
  // lueur froide au fond de chaque alcôve, sous sa rampe
  { const wash = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.3, 3.4), new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.steel).multiplyScalar(0.55), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), NB * 2), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < NB; i++) for (const s of [-1, 1]) { e.set(0, -s * PI / 2, 0); q.setFromEuler(e); mx.compose(new V3(s * 5.9, 2.0, RIB0 + i * 2.6 + 1.3), q, new V3(1, 1, 1)); wash.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), mx); } wash.frustumCulled = false; bay.add(wash); }
  add(bay, new THREE.BoxGeometry(1.2, 0.05, 0.05), glow(COL.coral, 2), 0, 3.8, Z1 - 0.24);
  bay.add(new THREE.AmbientLight(0x5a7088, 0.16)); bay.add(new THREE.HemisphereLight(0x7d9cbd, 0x0b0d11, 0.3));
  W.shadowLights = [];
  for (const z of [10.5, -10.5]) { const f = new THREE.PointLight(0xb9d6f2, 16, 16, 2); f.position.set(0, BH - 0.7, z); bay.add(f); }
  { const sp = new THREE.SpotLight(0xd6e6f5, 150, 20, 1.12, 0.85, 1.6); sp.position.set(0, BH - 0.42, 1); sp.target.position.set(0, 0, 1); sp.castShadow = true;
    sp.shadow.mapSize.set(1536, 1536); sp.shadow.camera.near = 0.4; sp.shadow.camera.far = 11; sp.shadow.bias = -0.0005; sp.shadow.normalBias = 0.03; sp.shadow.autoUpdate = false; sp.shadow.needsUpdate = true; bay.add(sp, sp.target); W.shadowLights.push(sp); W.keyLight = sp; }
  const es = new THREE.PointLight(0x9cc8dc, 9, 11, 2); es.position.set(-0.6, 2.4, Z0 + 1.2); bay.add(es); const esBase = new THREE.Color(0x9cc8dc), esArc = new THREE.Color(0xbfe0ff), esSun = new THREE.Color(0xfff0dc), keyBase = new THREE.Color(0xd6e6f5), keyAmber = new THREE.Color(COL.amber);
  W.beacon = { intensity: 0 }; // gyrophare de réveil : il teinte le projecteur principal (voir update)
  // signalétique holographique (contexte)
  const sgn = textPlane(TX.bay, { color: '#7fe3e6', w: 620, size: 54, sub: 27, scale: 2.1, align: 'center' }); sgn.position.set(0, 3.0, -5.2); bay.add(sgn);
  // l'emblème du programme HOPE : projeté au-dessus de l'enseigne de la baie, et peint au sol à l'entrée de l'allée
  { const ec = document.createElement('canvas'); ec.width = ec.height = 512; const et = new THREE.CanvasTexture(drawEmblem(ec)); et.colorSpace = THREE.SRGBColorSpace; et.anisotropy = 8;
    const eh = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshBasicMaterial({ map: et, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); eh.position.set(0, 3.86, -5.2); bay.add(eh);
    const ef = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: et, transparent: true, depthWrite: false, opacity: 0.34, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); ef.rotation.x = -PI / 2; ef.position.set(0, 0.036, 5.4); bay.add(ef); }
  const chrono = textPlane(TX.log, { color: '#f5c400', w: 660, size: 44, sub: 27, scale: 2.5 });
  chrono.position.set(-BW / 2 + 0.3, 2.5, -11.6); chrono.rotation.y = PI / 2; bay.add(chrono);
  { const ch = textPlane(TX.charte, { color: '#7fe3e6', w: 700, size: 40, sub: 27, scale: 2.3 }); ch.position.set(BW / 2 - 0.3, 2.62, -8.4); ch.rotation.y = -PI / 2; bay.add(ch); } /* l'article de la charte qui explique pourquoi il y a de l'art à bord, sur la cloison d'en face */
  // l'école qui porte le projet : son logo, projeté sur la même cloison que le journal de bord (fichier officiel, assets/brand)
  new THREE.TextureLoader().load('assets/brand/telecom-saint-etienne.svg', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const lm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }), logo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5 * 103.6 / 362.2), lm);
    logo.position.set(-BW / 2 + 0.3, 2.62, -8.9); logo.rotation.y = PI / 2; bay.add(logo); upd.push((t) => { lm.opacity = 0.72 + 0.08 * Math.sin(t * 1.7) + (Math.sin(t * 23) > 0.985 ? -0.3 : 0); }); });
  for (const [txt, z] of [[TX.obs, -7], ['C-12', 8]]) { const d = textPlane([txt], { color: '#c8d2dc', w: 640, size: 84, scale: 1.9, align: 'center' }); d.material.blending = THREE.NormalBlending; d.material.opacity = 0.32; d.rotation.x = -PI / 2; d.position.set(0, 0.034, z); bay.add(d); }

  // --- caissons : modèle Blender (« caisson » et son « capot » articulé) ; le verre, le givre, le corps et les témoins restent ici ---
  const gLid = new THREE.CylinderGeometry(0.52, 0.52, 2.2, 28, 1, true, 0, PI), gFrost = new THREE.CylinderGeometry(0.512, 0.512, 2.19, 28, 1, true, 0, PI),
    gStat = new THREE.BoxGeometry(0.02, 0.07, 0.5), gBedGlow = new THREE.PlaneGeometry(2.1, 0.74);
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-1.42, 0.95, 0), new V3(-1.8, 1.5, 0.12), new V3(-1.98, 2.4, 0.05), new V3(-2.0, 3.4, 0)]), 16, 0.035, 6);
  const bedGlow = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(0.55), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  W.statMats = []; const bodySlots = [], headSlots = [], gPillow = rbox(0.3, 0.05, 0.34, 0.02), pods = [];
  new GLTFLoader().load('assets/models/caisson.glb', (res) => { const base = parts(res.scene.getObjectByName('caisson')), lid = parts(res.scene.getObjectByName('capot'));
    const mine = pods.find((p) => p.userData.pivot === W.lidPivot), halves = [pods.filter((p) => p !== mine && p.position.z < 1.3), pods.filter((p) => p !== mine && p.position.z >= 1.3)]; bay.updateMatrixWorld(true);
    for (const [g, m] of base) mine.add(shade(new THREE.Mesh(g, m))); for (const [g, m] of lid) mine.userData.pivot.add(shade(new THREE.Mesh(g, m)));
    const inst = (list, mat) => { for (const [g, m] of list) for (const half of halves) { const im = shade(new THREE.InstancedMesh(g, m, half.length)); half.forEach((p, i) => im.setMatrixAt(i, mat(p))); im.computeBoundingSphere(); bay.add(nearFirst(im)); } };
    inst(base, (p) => p.matrixWorld); inst(lid, (p) => p.userData.pivot.matrixWorld); for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  function pod(mine, num) {
    const g = new THREE.Group(); pods.push(g);
    add(g, cable, mDark); add(g, cable, mDark, 0, 0, 0.3);
    if (!mine) add(g, gBedGlow, bedGlow, 0, 0.727, 0).rotation.x = -PI / 2;
    const sm2 = glow(mine ? COL.amber : COL.cyan, 2); sm2.userData.mine = mine; W.statMats.push(sm2); add(g, gStat, sm2, 1.415, 0.62, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.66, -0.5); g.add(pivot);
    add(pivot, gLid, mGlass, 0, 0, 0.5).rotation.z = PI / 2;
    if (!mine) { add(pivot, gFrost, frostMats[(Math.random() * 3) | 0], 0, 0, 0.5).rotation.z = PI / 2; const bs = new THREE.Group(); bs.position.set(-0.735, 0.726, 0); bs.scale.setScalar(rnd(0.93, 1.03)); bs.userData.ph = rnd(6); g.add(bs); bodySlots.push(bs); // le corps y est accroché au chargement (origine = base du cou)
      add(g, gPillow, mDark, -0.9, 0.745, 0); }
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

  // Vapeur cryogénique : à l'ouverture de ton caisson, une nappe de gaz froid déborde du rebord et coule vers le sol (W.vent, appelée par le récit).
  { const N = 22, puffs = [], pm = new THREE.SpriteMaterial({ map: soft, color: 0x9fbdd2, transparent: true, opacity: 0, depthWrite: false }); let t0 = -1;
    for (let i = 0; i < N; i++) { const sp = new THREE.Sprite(pm.clone()); sp.visible = false; sp.userData = { d: rnd(0, 2.2), x: rnd(-0.9, 0.9), s: rnd(0.5, 1.1), v: rnd(0.5, 1), w: rnd(6) }; bay.add(sp); puffs.push(sp); }
    W.vent = () => { t0 = 0; }; upd.push((t, dt) => { if (t0 < 0) return; t0 += dt; let alive = false; for (const sp of puffs) { const u = sp.userData, a = (t0 - u.d) / 4.2; if (a < 0 || a > 1) { sp.visible = false; if (a < 0) alive = true; continue; } alive = true; sp.visible = true;
        const out = Math.min(1, a * 1.8), fall = Math.max(0, a - 0.2) / 0.8; sp.position.set(-3.5 + u.x * (1 + a * 0.5) + Math.sin(t * 0.7 + u.w) * 0.06, 1 + Math.sin(Math.min(1, a * 3) * PI) * 0.05 - fall * fall * 0.86 * u.v, 2.02 + out * 0.3 * u.v + fall * 0.75); const k = u.s * (0.6 + a * 1.9); sp.scale.set(k * 1.3, k * 0.62, 1);
        sp.material.opacity = 0.34 * Math.sin(Math.min(1, a * 5) * PI / 2) * Math.pow(1 - a, 1.4); } if (!alive) t0 = -1; }); }
  // Poussières en suspension : de fines particules dérivent dans la baie et s'allument en passant sous les rampes lumineuses.
  if (!opts.lite) { const N = opts.touch ? 260 : 620, p = new Float32Array(N * 3), a = new Float32Array(N); for (let i = 0; i < N; i++) { p.set([rnd(-5, 5), rnd(0.2, 4.6), rnd(Z0 + 0.5, Z1 - 0.5)], i * 3); a[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(a, 1));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: 'attribute float aR;uniform float uTime,uPx;varying float vA;void main(){vec3 q=position;q.x+=sin(uTime*.11+aR*40.)*.35;q.y+=sin(uTime*.07+aR*61.)*.25+fract(aR*7.+uTime*.004)*.3;q.z+=cos(uTime*.09+aR*23.)*.4;vec4 mv=modelViewMatrix*vec4(q,1.);float ramp=.5+.5*cos(q.z/2.6*6.2832);float lit=smoothstep(.55,1.,ramp)*smoothstep(1.2,4.4,q.y)*smoothstep(2.6,.4,abs(q.x));vA=(.12+.88*lit)*(.5+.5*sin(uTime*(.6+aR)+aR*90.))*smoothstep(.25,1.2,-mv.z);gl_PointSize=uPx*(1.4+2.2*aR)*min(2.4,3.2/max(.6,-mv.z));gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(.78,.88,1.)*vA*.55*smoothstep(.5,.1,d),1.);}' }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; bay.add(pts); W.dustU = m.uniforms; }
  /* ---------- vie robotique ---------- */
  // faisceaux : cône unité (pointe à l'origine, vers le bas) dont l'intensité fond sur les bords et le long de l'axe — plus de silhouette dure
  const beamGeo = new THREE.ConeGeometry(1, 1, 40, 1, true); beamGeo.translate(0, -0.5, 0);
  const beamMat = (hex) => U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(hex) }, uOp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uColor;uniform float uOp,uTime;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=clamp(abs(dot(normalize(vN),normalize(vV))),.0001,1.);float y=clamp(vUv.y,0.,1.);float along=pow(y,1.6)*smoothstep(0.,.14,y);float dust=.84+.16*sin(y*31.-uTime*2.2+vUv.x*12.57);gl_FragColor=vec4(uColor*pow(f,2.4)*along*dust*uOp,1.);}' }));
  const poolMat = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.pale).multiplyScalar(0.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  // Les Veilleurs sont modélisés dans Blender (tools/robots_blender.py). Chaque pièce mobile arrive avec son origine sur son
  // articulation : on prépare ici les pivots (slot), on y accroche les pièces au chargement, et le décor n'anime que les pivots.
  const botMats = { coque: mBot, metal: mBotD, acier: mSteel, cable: mDark, verre: new THREE.MeshStandardMaterial({ color: 0x05080c, metalness: 0.3, roughness: 0.14, envMapIntensity: 1.4 }), lueur: glow(COL.cyan, 1.2), ambre: glow(COL.safran, 1.6) };
  const botSlots = [], slot = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); botSlots.push([name, g]); return g; };
  new GLTFLoader().load('assets/models/robots.glb', (res) => { const src = {};
    for (const [name] of botSlots) { if (src[name]) continue; const o = res.scene.getObjectByName(name); if (!o) continue; o.position.set(0, 0, 0); o.traverse((m) => { if (m.isMesh) { m.material = botMats[m.material.name] || mBot; m.castShadow = !!m.material.isMeshStandardMaterial; m.receiveShadow = true; } }); src[name] = o; }
    for (const [name, g] of botSlots) if (src[name]) g.add(src[name].clone()); for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  // rails des bras, portique de liaison et robot soudeur : modélisés dans Blender (tools/equipements_blender.py)
  const gear = new Promise((ok) => new GLTFLoader().load('assets/models/equipements.glb', (res) => ok(res.scene)));
  gear.then((sc) => { const mx = new THREE.Matrix4(), wm = Object.assign({}, bayMats, { lueur: glow(COL.steel, 1.2), metal: mDark }), n = Math.ceil(BL / 2.6);
    sc.getObjectByName('rail').traverse((o) => { if (!o.isMesh) return; const im = shade(new THREE.InstancedMesh(o.geometry, wm[o.material.name] || mMetal, n * 2)); im.castShadow = false;
      for (let i = 0; i < n * 2; i++) im.setMatrixAt(i, mx.makeTranslation(i < n ? -2.2 : 2.2, 4.64, Z0 + 1.3 + (i % n) * 2.6)); im.frustumCulled = false; bay.add(im); }); });
  // bras de maintenance sur rail (un par rangée) : va de caisson en caisson, descend, scanne, repart
  function gantry(side, seq, off, hold) {
    const car = new THREE.Group(); car.position.set(side * 2.2, 4.5, 0); bay.add(car); slot('chariot', car);
    const sh = slot('bras1', car, 0, -0.12, 0), el = slot('bras2', sh, 0, -1.3, 0), wr = slot('outil', el, 0, -1.3, 0); /* épaule, coude, poignet */
    const tip = add(wr, new THREE.SphereGeometry(0.022, 10, 8), glow(COL.cyan, 4), 0, -0.212, 0), beam = add(wr, beamGeo, beamMat(COL.cyan), 0, -0.22, 0), lt = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(COL.cyan).multiplyScalar(1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); lt.position.y = -0.25; lt.scale.setScalar(0.22); wr.add(lt); beam.scale.set(0.2, 1.0, 0.2);
    let rel = null; upd.push((t) => { const T = 11; let tt = t + off; if (hold) { if (W.wakeHold) tt = T * 0.4; else { if (rel === null) rel = t; tt = t - rel + T * 0.6; } } const n = Math.floor(tt / T), u = (tt % T) / T, L = seq.length, zA = -11.7 + seq[((n % L) + L) % L] * 2.6, zB = -11.7 + seq[(((n + 1) % L) + L) % L] * 2.6;
      const work = sm(0.02, 0.16, u) * (1 - sm(0.62, 0.76, u)); car.position.z = zA + (zB - zA) * sm(0.76, 1, u);
      sh.rotation.z = side * (1.25 - work * 0.5 + Math.sin(t * 1.3) * 0.02 * work); el.rotation.z = side * (-2.3 + work * 2.05); wr.rotation.z = side * (0.5 - work * 0.95) + Math.sin(t * 2.1) * 0.1 * work;
      const on = work > 0.9 ? 1 : 0; beam.material.uniforms.uOp.value = (hold && W.wakeHold ? 0 : on) * (0.5 + 0.14 * Math.sin(t * 17)); lt.material.opacity = on * (0.75 + 0.25 * Math.sin(t * 23)); tip.material.color.setHex(on ? COL.cyan : COL.safran).multiplyScalar(4); });
  }
  W.wakeHold = true; gantry(-1, [5, 9, 2, 7, 0, 11, 4], 0, true); gantry(1, [3, 8, 1, 10, 6], 6.5, false);
  // drones de surveillance : quatre rotors carénés, un œil à l'avant, un objectif sous le ventre qui balaie les rangées
  function drone(path, len) {
    const d = new THREE.Group(); slot('drone', d); add(d, new THREE.SphereGeometry(0.022, 10, 8), glow(COL.coral, 3), 0, 0, 0.172);
    const props = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => { const h = slot('helice', d, sx * 0.215, 0.024, sz * 0.165); h.userData.s = sx * sz; return h; });
    const beam = add(d, beamGeo, beamMat(COL.pale), 0, -0.1, 0.02); beam.scale.set(0.2 * len, len, 0.2 * len); const pool = add(d, new THREE.PlaneGeometry(1, 1), poolMat, 0, -0.08 - len, 0.02); pool.rotation.x = -PI / 2; pool.scale.setScalar(0.62 * len); bay.add(d);
    let px = 0, pz = 0; upd.push((t, dt) => { const p = path(t); d.position.set(p[0], p[1] + Math.sin(t * 1.9 + p[2]) * 0.04, p[2]); const dx = p[0] - px, dz = p[2] - pz; if (Math.abs(dx) + Math.abs(dz) > 1e-5) { const ta = Math.atan2(dx, dz); d.rotation.y += Math.atan2(Math.sin(ta - d.rotation.y), Math.cos(ta - d.rotation.y)) * 0.05; } px = p[0]; pz = p[2]; d.rotation.z = Math.sin(t * 0.8) * 0.05; d.rotation.x = 0.06 + Math.sin(t * 0.6 + p[2]) * 0.02;
      for (const h of props) h.rotation.y += dt * 41 * h.userData.s; beam.material.uniforms.uOp.value = 0.3 + 0.05 * Math.sin(t * 9 + p[2]); });
  }
  drone((t) => [-4.35 + Math.sin(t * 0.21) * 0.22, 3.05, 1 + Math.sin(t * 0.09 + 0.5) * 12.5], 1.9);
  drone((t) => [4.35 + Math.sin(t * 0.17 + 2) * 0.22, 3.2, 1 + Math.sin(t * 0.075 + 2.4) * 12.5], 2.05);
  drone((t) => [Math.sin(t * 0.13) * 2.2, 3.9, -8.4 + Math.cos(t * 0.13) * 2.2], 3.78);
  // robots d'entretien au sol : six roues, une brosse, une tourelle de relevé qui balaie les caissons
  function rover(x, sp, ph) {
    const r = new THREE.Group(); slot('rover', r); const wheels = [-0.19, 0, 0.19].flatMap((wx) => [-1, 1].map((s) => slot('roue', r, wx, 0.056, s * 0.172))), mast = slot('mat', r, -0.08, 0.2, 0);
    add(r, new THREE.SphereGeometry(0.034, 10, 8, 0, PI * 2, 0, PI / 2), glow(COL.amber, 2.5), 0.12, 0.214, 0); add(r, new THREE.BoxGeometry(0.004, 0.018, 0.26), glow(COL.pale, 3), 0.297, 0.097, 0);
    add(r, new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(COL.amber).multiplyScalar(0.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 0.6, 0.036, 0).rotation.x = -PI / 2; bay.add(r);
    upd.push((t) => { const L = BL - 5, d = t * sp + ph, u = (d % (2 * L) + 2 * L) % (2 * L), fw = u < L; r.position.set(x, 0, Z0 + 2.5 + (fw ? u : 2 * L - u)); r.rotation.y = fw ? -PI / 2 : PI / 2;
      for (const w of wheels) w.rotation.z = -d / 0.056; mast.rotation.y = Math.sin(t * 0.7 + ph) * 1.15; });
  }
  rover(-1.6, 0.55, 3); rover(1.6, 0.42, 21);
  upd.push((t) => {
    for (const s of mist) { s.position.x += s.userData.v * 0.016; if (s.position.x > 5.5) s.position.x = -5.5; if (s.position.x < -5.5) s.position.x = 5.5; }
    W.statMats.forEach((m, i) => { const on = Math.sin(t * 1.4 + i * 1.9) > -0.6; m.color.setHex(m.userData.mine ? COL.amber : COL.cyan).multiplyScalar(on ? 2 : 0.5); });
  });

  // --- mur des hublots : modélisé dans Blender (tools/hublots_blender.py) — cloison percée, grand hublot à volet-iris, hublots
  // latéraux, pupitre, garde-corps. Seuls le verre et les relevés projetés au-dessus du pupitre restent dessinés ici.
  const WC = { x: 0, y: 2.55, r: 2.05 }, HOLES = [[WC.x, WC.y, WC.r], [-3.95, 2.7, 0.72], [3.95, 2.7, 0.72]]; /* à garder en accord avec le script */
  // Le verre du grand hublot. Ce n'est plus une teinte : il renvoie l'intérieur de la baie. Le reflet est une vraie vue de la scène, prise depuis le
  // symétrique de l'œil par rapport au vitrage (W.reflect, appelée par le récit quand on s'arrête à la barre) ; chaque point du verre va y lire ce que
  // l'œil verrait s'y réfléchir. Intensité selon l'angle (Fresnel), image fantôme de la seconde face du vitrage, poussière que la lumière accroche.
  const glassU = { tR: { value: null }, uVP: { value: new THREE.Matrix4() }, uEye: { value: new V3() }, uK: { value: 0 }, uSun: { value: 0 }, uTime: W.timeU[0] };
  const glassMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: glassU,
    vertexShader: 'varying vec3 vW;varying vec2 vP;void main(){vP=position.xy;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform sampler2D tR;uniform mat4 uVP;uniform vec3 uEye;uniform float uK,uSun;varying vec3 vW;varying vec2 vP;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec4 c=uVP*vec4(vW,1.); vec2 uv=c.xy/c.w*.5+.5; float in_=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        vec3 V=normalize(uEye-vW); float F=.045+.955*pow(1.-clamp(abs(V.z),0.,1.),5.);                    /* le verre réfléchit peu de face, beaucoup en rasant */
        vec3 r=texture2D(tR,uv).rgb+texture2D(tR,uv+vec2(.0045,.003)).rgb*.42;                            /* deux faces : une image, et son double décalé */
        vec3 col=min(r,vec3(5.))*F*1.7*uK*in_;
        float dust=smoothstep(.72,1.,n(vP*90.))*.6+smoothstep(.9,1.,n(vP*vec2(14.,260.)+7.))*.5+smoothstep(.93,1.,n(vP.yx*vec2(11.,300.)+3.))*.35;   /* grains et fines rayures */
        float rim=smoothstep(1.2,2.05,length(vP));                                                        /* le pourtour, moins bien nettoyé */
        col+=vec3(.62,.72,.85)*dust*(.006+.07*uSun)*(.5+rim)+vec3(.5,.62,.78)*rim*rim*(.004+.02*uSun);
        gl_FragColor=vec4(col,.03+.03*rim); }` });
  HOLES.forEach(([x, y, r], i) => add(bay, new THREE.CircleGeometry(r, i ? 48 : 72), i ? new THREE.MeshBasicMaterial({ color: 0x8fb4d8, transparent: true, opacity: 0.035, depthWrite: false }) : glassMat, x, y, Z0 - 0.3));
  const mt = new THREE.Matrix4();
  // Touches du pupitre : plastique sombre, légende rétroéclairée. La légende n'est pas une texture : la matière retrouve, à partir de la position sur
  // le plateau incliné, à quelle touche appartient le pixel, et y allume un caractère en matrice de points propre à cette touche (quelques-unes en ambre).
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.5, metalness: 0.15, envMapIntensity: 0.6 });
  keyMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = W.timeU[0];
    sh.vertexShader = 'varying vec3 vOp;varying vec3 vOn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOp=position; vOn=normal;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vOp;varying vec3 vOn;uniform float uTime;
      float kh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
      void main() {`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 q=vOp-vec3(0.,.845,.8); float v=dot(q,vec3(0.,-.29552,.95534)); float up=dot(normalize(vOn),vec3(0.,.95534,.29552)); float sd=sign(vOp.x); float au=abs(vOp.x)-.6;
        float fn=step(v,-.06); float pu=mix(.065,.047,fn), pv=.055; float ci=floor(au/pu+.5), rj=mix(floor((v+.02)/pv+.5),-3.,fn); vec2 k=vec2(au/pu-ci,mix((v+.02)/pv-rj,(v+.085)/.03,fn));
        vec2 g=k*vec2(1.5,1.55)+.5; vec2 gi=floor(g*vec2(3.,5.)); vec2 gf=fract(g*vec2(3.,5.));
        float inb=step(0.,g.x)*step(g.x,1.)*step(0.,g.y)*step(g.y,1.)*step(.9,up)*step(au,1.3)*step(-.05,au);
        float on=step(.5,kh(vec3(ci+sd*13.,rj,gi.x+gi.y*3.)))*smoothstep(.5,.3,max(abs(gf.x-.5),abs(gf.y-.5)))*(1.-fn*.4);
        float sp=step(.86,kh(vec3(ci,rj,sd))); float blink=.75+.25*sin(uTime*(1.+kh(vec3(rj,ci,7.))*3.)+ci);
        totalEmissiveRadiance+=mix(vec3(.25,.85,.95),vec3(1.,.62,.12),sp)*on*inb*(.55+.6*sp)*blink; }`); };
  keyMat.customProgramCacheKey = () => 'touche';
  // Écrans du pupitre et des deux moniteurs muraux : de vraies pages (orbite, atmosphère, cohorte, flux, volet), dessinées sur des canevas et
  // rafraîchies à tour de rôle. Elles sont posées juste au-dessus des dalles du modèle.
  { const con = new THREE.Group(); con.position.z = Z0; bay.add(con); const L = TX.con, DC = L[8], CY = '#7fe3e6', AM = '#fca311', CO = '#ff4f38', DIM = 'rgba(127,227,230,.35)', A = 0.3, O = [0.845, 0.8];
    const num = (v, d) => v.toFixed(d).replace('.', DC), F = (g, px, w = 600) => { g.font = w + ' ' + px + 'px Rajdhani, sans-serif'; };
    const frame = (g, w, h, title, code) => { g.fillStyle = '#04161a'; g.fillRect(0, 0, w, h); g.strokeStyle = DIM; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = CY; F(g, 26, 700); g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText(title, 18, 14);
      g.textAlign = 'right'; g.fillStyle = DIM; F(g, 18); g.fillText(code, w - 18, 20); g.textAlign = 'left'; g.fillStyle = DIM; g.fillRect(18, 48, w - 36, 2); };
    const pages = [
      (g, w, h, t) => { frame(g, w, h, L[0], 'ATM-12C'); const rows = [['O2', 20.9 + Math.sin(t * 0.7) * 0.05, 2, ' %', 0.209 * 4], ['N2', 78.1, 1, ' %', 0.781], ['CO2', 0.04 + Math.sin(t) * 0.004, 3, ' %', 0.06], ['kPa', 101.2 + Math.sin(t * 0.3) * 0.2, 1, '', 0.92], ['°C', 17.4 + Math.sin(t * 0.2) * 0.1, 1, '', 0.48]];
        rows.forEach(([n, v, d, u, k], i) => { const y = 66 + i * 36; g.fillStyle = CY; F(g, 24, 700); g.fillText(n, 20, y); g.fillStyle = 'rgba(127,227,230,.16)'; g.fillRect(96, y + 6, w - 270, 14); g.fillStyle = i === 2 ? AM : CY; g.fillRect(96, y + 6, (w - 270) * Math.min(1, k + Math.sin(t * 1.3 + i) * 0.01), 14);
          g.fillStyle = '#e8f6f8'; F(g, 24); g.textAlign = 'right'; g.fillText(num(v, d) + u, w - 20, y); g.textAlign = 'left'; }); },
      (g, w, h, t) => { frame(g, w, h, L[1], 'NAV-07'); const cx = w * 0.3, cy = h * 0.62, R = h * 0.26; g.strokeStyle = DIM; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(cx, cy, R * (0.4 + i * 0.45), 0, 6.29); g.stroke(); }
        g.fillStyle = 'rgba(86,186,192,.5)'; g.beginPath(); g.arc(cx, cy, R, 0, 6.29); g.fill(); g.strokeStyle = CY; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, R * 1.75, R * 1.05, -0.35, 0, 6.29); g.stroke();
        const a = t * 0.25, px = cx + Math.cos(a) * R * 1.75 * Math.cos(-0.35) - Math.sin(a) * R * 1.05 * Math.sin(-0.35), py = cy + Math.cos(a) * R * 1.75 * Math.sin(-0.35) + Math.sin(a) * R * 1.05 * Math.cos(-0.35); g.fillStyle = AM; g.beginPath(); g.arc(px, py, 6, 0, 6.29); g.fill(); F(g, 18, 700); g.textAlign = px > cx ? 'right' : 'left'; g.fillText('SPES-07', px + (px > cx ? -12 : 12), py - 22); g.textAlign = 'left';
        const x0 = w * 0.6; [['ALT', num(845 + Math.sin(t * 0.2) * 0.4, 1) + ' km'], ['V', num(7.43, 2) + ' km/s'], ['INCL', num(51.6, 1) + '°'], ['T+', String(173141) + ' j']].forEach(([n, v], i) => { const y = 66 + i * 40; g.fillStyle = DIM; F(g, 20); g.fillText(n, x0, y); g.fillStyle = '#e8f6f8'; F(g, 26, 700); g.fillText(v, x0 + 62, y - 4); }); },
      (g, w, h, t) => { frame(g, w, h, L[2], 'CRYO-C'); const cw = (w - 60) / 12, on = Math.floor(t * 2) % 2; for (let i = 0; i < 23; i++) { const r = i < 12 ? 0 : 1, c = r ? i - 12 : i, x = 24 + c * cw + (r ? cw * 0.5 : 0), y = 70 + r * 52, mine = i === 5; g.fillStyle = mine ? (on ? AM : 'rgba(252,163,17,.35)') : 'rgba(127,227,230,.5)'; g.fillRect(x, y, cw - 8, 36);
          g.fillStyle = '#04161a'; F(g, 13, 700); g.fillText(String(412 + i), x + 4, y + 20); }
        g.fillStyle = CY; F(g, 24, 700); g.fillText(L[3] + ' 22', 24, h - 64); g.fillStyle = AM; g.fillText(L[4] + ' 01 · R26-0417', 24, h - 36); },
      (g, w, h, t) => { frame(g, w, h, L[5], '4' + DC + '0 K'); g.strokeStyle = DIM; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(14, 56 + i * (h - 80) / 6); g.lineTo(w - 14, 56 + i * (h - 80) / 6); g.stroke(); }
        g.strokeStyle = CY; g.lineWidth = 3; g.beginPath(); for (let x = 14; x < w - 14; x += 3) { const y = h * 0.6 + Math.sin(x * 0.045 + t * 2.4) * 22 + Math.sin(x * 0.13 - t * 3.1) * 9; x === 14 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
        g.fillStyle = AM; F(g, 22, 700); g.fillText(num(97.4 + Math.sin(t) * 0.3, 1) + ' %', 20, h - 36); },
      (g, w, h, t) => { frame(g, w, h, L[6], 'IR-01'); const cx = w / 2, cy = h * 0.58, R = h * 0.26; for (let i = 0; i < 12; i++) { const a = i * 6.2832 / 12 + t * 0.05; g.strokeStyle = i % 3 ? CY : AM; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, R, a + 0.06, a + 0.46); g.stroke(); }
        g.fillStyle = '#e8f6f8'; F(g, 34, 700); g.textAlign = 'center'; g.fillText('100 %', cx, cy - 18); g.fillStyle = CY; F(g, 20); g.fillText(L[7], cx, cy + 20); g.textAlign = 'left'; }];
    const scr = (page, pw, ph, cw, pos, onDesk) => { const c = document.createElement('canvas'); c.width = cw; c.height = Math.round(cw * ph / pw); const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      if (onDesk) { const [x, yl, zl] = pos; m.position.set(x, O[0] + yl * Math.cos(A) - zl * Math.sin(A), O[1] + yl * Math.sin(A) + zl * Math.cos(A)); m.rotation.x = -PI / 2 + A; } else m.position.set(...pos);
      con.add(m); const draw = (t) => { pages[page](g, c.width, c.height, t); tex.needsUpdate = true; }; draw(0); return draw; };
    const draws = [scr(1, 0.64, 0.3, 640, [0, 0.0445, 0.04], true), scr(0, 0.54, 0.24, 560, [-1.5, 0.0445, 0.06], true), scr(2, 0.54, 0.24, 560, [1.5, 0.0445, 0.06], true), scr(3, 0.34, 0.24, 400, [-3.5, 1.68, 0.042], false), scr(4, 0.34, 0.24, 400, [3.5, 1.68, 0.042], false)];
    let n = 0; upd.push((t, dt, cam) => { if (!bay.visible || !cam || cam.z > -3) return; if (++n % 7 === 0) draws[(n / 7) % draws.length | 0](t); }); /* une page redessinée toutes les sept images, et seulement quand on est près du pupitre */ }
  new GLTFLoader().load('assets/models/hublots.glb', (res) => { const g = new THREE.Group(); g.position.z = Z0; bay.add(g); const wm = Object.assign({}, bayMats, { lueur: glow(COL.steel, 2.2), lueur_c: glow(COL.cyan, 1.6), ecran: ecranMat(false), touche: keyMat, rampe: new THREE.MeshStandardMaterial({ color: 0x6f767d, metalness: 0.6, roughness: 0.62, envMapIntensity: 0.5 }) });
    res.scene.traverse((o) => { if (!o.isMesh) return; const name = o.material.name; if (TILE[name]) boxUV(o.geometry, TILE[name]); const me = shade(new THREE.Mesh(o.geometry, wm[name] || mPanel)); if (/^cloison/.test(o.name)) me.castShadow = false; g.add(me); }); for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  // Le reflet. Le corps du visiteur n'a pas de tête (on est dedans) : pour la vue réfléchie, on lui en pose une — celle du modèle allégé des dormeurs,
  // coupée au cou, calée sur l'œil — le temps de la prise de vue seulement.
  { const GZ = Z0 - 0.3, head = new THREE.Group(); head.visible = false; scene.add(head); const off = new V3();
    const rcam = new THREE.PerspectiveCamera(120, 1.3, 0.5, 70), rRT = new THREE.WebGLRenderTarget(1024, 788, { type: THREE.HalfFloatType }); glassU.tR.value = rRT.texture; const at = new V3(1e9, 0, 0);
    new GLTFLoader().load('assets/models/dormeur-lod.glb', (res) => { res.scene.updateMatrixWorld(true); const up = new THREE.Matrix4().makeBasis(new V3(0, -1, 0), new V3(0, 0, 1), new V3(-1, 0, 0)), parts = []; let top = -1e9; /* allongé -> debout, face à la baie */
      res.scene.traverse((o) => { if (!o.isMesh || !/peau|bonnet|combinaison/.test(o.material.name)) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(up); g.computeBoundingBox(); top = Math.max(top, g.boundingBox.max.y); parts.push([g, o.material.name]); });
      const neck = top - 0.3, bb = new THREE.Box3(), mats = { peau: new THREE.MeshStandardMaterial({ color: 0x8a6551, roughness: 0.6 }), bonnet: new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.7 }), combinaison: new THREE.MeshStandardMaterial({ color: 0x3b434d, roughness: 0.8 }) };
      for (const [g, name] of parts) { const p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count, keep = []; for (let i = 0; i < n; i += 3) { const a = ix ? ix[i] : i, b = ix ? ix[i + 1] : i + 1, c = ix ? ix[i + 2] : i + 2; if (p.getY(a) > neck && p.getY(b) > neck && p.getY(c) > neck) keep.push(a, b, c); }
        if (!keep.length) continue; g.setIndex(keep); const m = new THREE.Mesh(g, mats[name]); m.frustumCulled = false; head.add(m); for (let i = 0; i < keep.length; i++) bb.expandByPoint(new V3(p.getX(keep[i]), p.getY(keep[i]), p.getZ(keep[i]))); }
      off.set((bb.min.x + bb.max.x) / 2, top - 0.125, (bb.min.z + bb.max.z) / 2 - 0.085); }); /* l'œil du modèle : à 12 cm sous le sommet du crâne, à l'avant de la tête */
    // eye : position de l'œil. Tout ce qui est derrière le vitrage (l'espace) est coupé par le plan proche de la caméra de reflet, posé exactement sur le verre.
    W.reflect = (renderer, eye) => { if (opts.lite) return; const d = eye.z - GZ; if (d < 0.6 || d > 6) return; rcam.position.set(eye.x, eye.y, GZ - d); rcam.near = d; rcam.lookAt(eye.x, eye.y, GZ + 10); rcam.updateProjectionMatrix(); rcam.updateMatrixWorld();
      head.position.set(eye.x - off.x, eye.y - off.y, eye.z - off.z); head.visible = true; const rt = renderer.getRenderTarget(), sa = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
      glassMat.visible = false; renderer.setRenderTarget(rRT); renderer.clear(); renderer.render(scene, rcam); renderer.setRenderTarget(rt); renderer.shadowMap.autoUpdate = sa; head.visible = false; glassMat.visible = true; /* le verre ne se reflète pas lui-même */
      glassU.uVP.value.multiplyMatrices(rcam.projectionMatrix, rcam.matrixWorldInverse); at.copy(eye); };
    upd.push((t, dt, cam) => { if (!cam) return; glassU.uEye.value.copy(cam); glassU.uSun.value = W.sunIn || 0; glassU.uK.value = sm(0.9, 0.25, cam.distanceTo(at)) * (1 - 0.55 * Math.min(1, (W.sunIn || 0) * 1.4)); }); } /* le reflet n'est juste que depuis l'endroit de la prise : il s'efface dès qu'on s'en éloigne */
  const scr1 = textPlane(TX.earth, { color: '#a8e61d', w: 560, size: 44, sub: 28, scale: 1.45 }); scr1.position.set(-1.25, 1.17, Z0 + 0.52); scr1.rotation.x = -0.5; bay.add(scr1);
  const scr2 = textPlane(TX.fleet, { color: '#7fe3e6', w: 560, size: 44, sub: 28, scale: 1.45 }); scr2.position.set(1.25, 1.17, Z0 + 0.52); scr2.rotation.x = -0.5; bay.add(scr2);

  // --- poste de liaison neurale : fauteuil, câble cervical, casque ---
  const link = new THREE.Group(); link.position.set(3.25, 0, -11.4); link.rotation.y = 0.74; bay.add(link); // l'avant du fauteuil = -Z local (face au hublot)
  // Le fauteuil est modélisé dans Blender (tools/fauteuil_blender.py) : pied à vérins, assise et dossier en coussins, têtière
  // enveloppante, repose-pieds, dos technique. Les accoudoirs et le casque sont des pièces à part, que le récit anime.
  const pad = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.5, metalness: 0.04, envMapIntensity: 0.75 });
  const seatGlow = glow(COL.cyan, 0.5), seatMats = { cuir: pad, coque: mBot, metal: mBotD, acier: mSteel, lueur: seatGlow, ambre: glow(COL.safran, 2.2),
    ecran: U(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: 'varying vec3 vO;void main(){vO=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', // pupitres et intérieur du casque : des lignes de relevés qui défilent
      fragmentShader: 'uniform float uTime;varying vec3 vO;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float r=(vO.z+vO.y)*52.;float row=floor(r);float on=step(.35,h(vec2(row,floor(uTime*1.4+row*.17))));float bar=step(fract(vO.x*7.+.5),.15+.7*h(vec2(row,3.)))*on*step(.4,fract(r));gl_FragColor=vec4(vec3(.25,.85,.95)*(.05+bar*.85),1.);}' })) };
  const armG = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(s * 0.285, 0.6, 0.62); g.userData.s = s; link.add(g); return g; }); // charnières des accoudoirs
  const EYE = new V3(0, 1.42, 0.26), visArm = new THREE.Group(); visArm.position.set(0, 1.66, 0.52); link.add(visArm); // axe du casque, au-dessus de la têtière
  new GLTFLoader().load('assets/models/fauteuil.glb', (res) => {
    const dress = (n) => { n.traverse((m) => { if (m.isMesh) { m.material = seatMats[m.material.name] || mBot; m.castShadow = !!m.material.isMeshStandardMaterial; m.receiveShadow = true; } }); return n; };
    const take = (name, to) => { const n = dress(res.scene.getObjectByName(name)); n.position.set(0, 0, 0); to.add(n); };
    link.add(dress(res.scene.getObjectByName('fauteuil'))); take('accoudoir_g', armG[0]); take('accoudoir_d', armG[1]); take('casque', visArm); { const dark = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.92, metalness: 0, envMapIntensity: 0.08 }), sw = (m) => (m === seatMats.ecran ? visScr : m === mBot || m === mBotD || m === mSteel ? dark : m); /* vu de l'intérieur, un casque est sombre et mat */
      visArm.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(sw) : sw(o.material); }); } for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  // halo de liaison derrière la tête : couronne, anneaux qui tournent, enseigne
  gear.then((sc) => { const n = sc.getObjectByName('portique'); n.traverse((m) => { if (m.isMesh) { m.material = seatMats[m.material.name] || mBotD; m.castShadow = !!m.material.isMeshStandardMaterial; m.receiveShadow = true; } }); n.position.set(0, 0, 0); link.add(n); for (const l of W.shadowLights) l.shadow.needsUpdate = true; });
  W.linkGlow = glow(COL.cyan, 2.2); add(link, new THREE.TorusGeometry(0.7, 0.016, 8, 64), W.linkGlow, 0, 1.5, 0.88);
  /* les anneaux tournants ont été retirés (retour du commanditaire, 17/11) : la liaison se lit par les émetteurs du portique */
  const sign = textPlane(TX.link, { color: '#7fe3e6', w: 560, size: 46, sub: 26, scale: 1.4, align: 'center' }); sign.position.set(0, 2.62, 0.88); sign.rotation.y = PI; link.add(sign);
  // six filets de lumière vont des émetteurs du portique vers la tête quand la liaison monte en puissance (W.linkSpin : 1 au repos, 7 à la synchronisation)
  W.linkSpin = 1; { const pts = [], RR = 0.555; for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; pts.push(Math.cos(a) * RR, 1.5 + Math.sin(a) * RR, 0.9, 0, 1.47, 0.4); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const lm = new THREE.LineBasicMaterial({ color: new THREE.Color(COL.cyan).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ln = new THREE.LineSegments(lg, lm); ln.frustumCulled = false; link.add(ln); let k = 0; upd.push((t, dt) => { k += (Math.min(1, Math.max(0, (W.linkSpin - 1) / 6)) - k) * Math.min(1, dt * 2); lm.opacity = k * (0.55 + 0.25 * Math.sin(t * 23) + 0.2 * Math.sin(t * 7.3)); }); }
  // bracelets de maintien : quatre arceaux articulés sur les accoudoirs, qui se referment sur les avant-bras une fois assis
  const clampGlow = glow(COL.cyan, 1.4), clamps = [];
  for (const g of armG) for (const z of [0.27, 0.13]) { const s = g.userData.s, R = 0.071, pv = new THREE.Group(); pv.position.set(s * R, 0.305, z - 0.62); g.add(pv); const arc = new THREE.TorusGeometry(R, 0.009, 8, 22, PI); arc.translate(-s * R, 0, 0);
    add(pv, arc, mBot); const lg = new THREE.TorusGeometry(R, 0.0035, 6, 22, PI * 0.6); lg.rotateZ(PI * 0.2); lg.translate(-s * R, 0, 0.0105); add(pv, lg, clampGlow); add(pv, new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10), mBotD).rotation.x = PI / 2; pv.userData.s = s; clamps.push(pv); }
  W.setClamp = (k) => { for (const c of clamps) c.rotation.z = -c.userData.s * 1.95 * (1 - k); clampGlow.color.setHex(k > 0.98 ? COL.safran : COL.cyan).multiplyScalar(1.4 + k * 1.6); }; W.setClamp(0);
  W.setArms = (k) => { for (const g of armG) g.rotation.y = -g.userData.s * 0.62 * (1 - k); }; W.setArms(0); // au repos, les accoudoirs sont écartés : le fauteuil s'ouvre ; assis, ils se referment
  W.seatWake = (k) => { seatGlow.color.setHex(COL.cyan).multiplyScalar(0.3 + 1.5 * k); }; W.seatWake(0); // les filets du fauteuil s'allument à l'approche
  // casque : il attend relevé au-dessus de la tête et se rabat sur les yeux
  // L'écran intérieur du casque a sa propre matière, éteinte tant que le casque n'est pas en place (W.visorOn) : pendant la descente, c'est une coque sombre.
  const visScr = U(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, vertexShader: seatMats.ecran.vertexShader,
    fragmentShader: seatMats.ecran.fragmentShader.replace('uniform float uTime;', 'uniform float uTime,uOn;').replace('*(.05+bar*.85)', '*(.004+bar*.4)*uOn') }));
  W.visorOn = (k) => { visScr.uniforms.uOn.value = k; }; W.visArm = visArm;
  W.setVisor = (k) => { visArm.rotation.x = 2.0 * (1 - k); }; W.setVisor(0); /* k linéaire (le récit donne la courbe) ; un peu plus de 1 = mousses en appui */
  // câble cervical : la fiche se présente devant toi, ouvre ses trois griffes, puis va se verrouiller derrière la nuque
  const cabA = new V3(0.3, 1.6, 0.68), cabPath = new THREE.CatmullRomCurve3([new V3(0.46, 1.2, 0.56), new V3(0.42, 1.3, -0.1), new V3(0.11, 1.4, -0.4), new V3(0.17, 1.37, -0.05), new V3(0.08, 1.34, 0.34)]);
  const plug = new THREE.Group(); link.add(plug); add(plug, new THREE.CylinderGeometry(0.017, 0.02, 0.09, 16), mBotD); add(plug, new THREE.CylinderGeometry(0.0215, 0.0215, 0.012, 16), glow(COL.cyan, 3), 0, 0.02, 0); add(plug, new THREE.CylinderGeometry(0.008, 0.004, 0.03, 8), glow(COL.safran, 3), 0, 0.06, 0);
  for (const y of [-0.03, -0.012]) add(plug, new THREE.TorusGeometry(0.0205, 0.002, 6, 20), mBot, 0, y, 0).rotation.x = PI / 2; // bagues du corps de fiche
  const claws = [0, 1, 2].map((i) => { const pv = new THREE.Group(); pv.rotation.y = i * PI * 2 / 3; plug.add(pv); const c = new THREE.Group(); c.position.set(0.019, 0.038, 0); pv.add(c); add(c, new THREE.BoxGeometry(0.004, 0.034, 0.008), mBot, 0, 0.017, 0); add(c, new THREE.BoxGeometry(0.009, 0.004, 0.008), mBot, -0.0035, 0.034, 0); return c; }); // griffes de verrouillage
  const plugLight = new THREE.PointLight(COL.cyan, 0, 1.6, 2); plugLight.position.y = 0.09; plug.add(plugLight);
  const cabU = { uT: { value: 0 }, uOn: { value: 0 } }, mCab = new THREE.ShaderMaterial({ uniforms: cabU, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', // gaine annelée ; une fois branché, des impulsions courent vers la nuque
    fragmentShader: 'uniform float uT,uOn;varying vec2 vUv;void main(){float rib=.72+.28*step(.5,fract(vUv.x*90.));float p=smoothstep(.09,0.,abs(fract(vUv.x*3.-uT*1.6)-.5));gl_FragColor=vec4(vec3(.034,.04,.048)*rib+vec3(.3,.9,1.)*p*uOn*2.4,1.);}' });
  let cabMesh = null; const up = new V3(0, 1, 0);
  W.setCable = (k) => { const p = cabPath.getPoint(k), tg = cabPath.getTangent(Math.min(0.999, Math.max(0.001, k))); plug.position.copy(p); plug.quaternion.setFromUnitVectors(up, tg);
    const open = sm(0.25, 0.5, k) * (1 - sm(0.9, 1, k)); claws.forEach((c) => { c.rotation.z = -open * 0.7; }); plugLight.intensity = sm(0.05, 0.45, k) * 0.6 + cabU.uOn.value * 1.4;
    const mid = cabA.clone().lerp(p, 0.5); mid.y -= 0.2; mid.x += 0.14; const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([cabA, mid, p.clone().addScaledVector(tg, -0.05)]), 26, 0.011, 8);
    if (cabMesh) { cabMesh.geometry.dispose(); cabMesh.geometry = geo; } else { cabMesh = new THREE.Mesh(geo, mCab); link.add(cabMesh); } }; W.setCable(0);
  W.cableOn = (v) => { cabU.uOn.value = v; plugLight.intensity = 0.6 + v * 1.4; }; upd.push((t) => { cabU.uT.value = t; });
  link.updateMatrixWorld(true); W.seat = { eye: link.localToWorld(EYE.clone()), yaw: link.rotation.y, front: link.localToWorld(new V3(0, 1.62, -1.75)), chair: link.localToWorld(new V3(0, 1.5, 0.1)) };

  bay.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) { o.castShadow = !(o.geometry.type === 'PlaneGeometry'); o.receiveShadow = true; } });
  // dormeurs : de vrais corps, une femme et un homme (Human Base Meshes de la Blender Foundation, préparés par tools/humains_blender.py).
  // Allongés dans le repère du caisson, en combinaison de stase, avec bonnet, bandeau sur les yeux, port cervical et câble vers le chevet.
  { const mSkin = [0xe8c4a8, 0xc99673, 0x8d6548, 0xf0d5c2, 0xb07e5e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.58, metalness: 0, envMapIntensity: 0.35 }));
    const suit = (c) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.74, metalness: 0.06, envMapIntensity: 0.45 }); // coutures, ceinture, genouillères et témoin de poitrine dessinés dans la matière
      m.onBeforeCompile = (sh) => { sh.uniforms.uTime = W.timeU[0];
        sh.vertexShader = 'varying vec3 vSp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSp=position;');
        sh.fragmentShader = 'varying vec3 vSp;uniform float uTime;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float sb=smoothstep(.014,.008,abs(vSp.x-.44))+smoothstep(.02,.012,abs(vSp.x-.99))*step(.02,abs(vSp.z))+smoothstep(.006,.002,abs(vSp.x-.21))+smoothstep(.006,.002,abs(vSp.x-.72));
          float sz=smoothstep(.004,.0015,abs(vSp.z))*step(.02,vSp.x)*step(vSp.x,.45); diffuseColor.rgb*=1.-min(1.,sb*.45+sz*.6);`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float sl=smoothstep(.011,.007,length(vSp.xz-vec2(.13,.055)))*step(.05,vSp.y); totalEmissiveRadiance+=vec3(.3,.9,1.)*sl*(1.2+.8*sin(uTime*1.3+vSp.z*40.));'); };
      m.customProgramCacheKey = () => 'stase'; return m; };
    const SKIN = [0xe8c4a8, 0xc99673, 0x8d6548, 0xf0d5c2, 0xb07e5e].map((c) => new THREE.Color(c)), SUIT = [0x7c8794, 0x5f6c80, 0x8a8377].map((c) => new THREE.Color(c));
    const mSkin1 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0, envMapIntensity: 0.35 }), mSuit1 = suit(0xffffff), mCap = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.4 }), mBand = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: 0.24, metalness: 0.55, envMapIntensity: 1 }), mLed = glow(COL.cyan, 3);
    // Un appel de rendu par matière, par modèle (femme, homme) et par niveau de détail, au lieu d'un par morceau de chaque dormeur. À chaque image,
    // chaque dormeur prend le modèle complet s'il est à moins de 7 m du visiteur, l'allégé sinon (tools/lod_blender.py) : la bascule ne se voit pas
    // sous la verrière givrée. La carnation et la teinte de la combinaison sont portées par l'instance.
    const who = [[], []], sets = [[null, null], [null, null]], cp = new V3(); bodySlots.forEach((bs, i) => who[(i + (i >> 2)) % 2].push([bs, i])); /* une femme, un homme, sans alternance trop régulière */
    const matOf = (mn) => (mn === 'peau' ? mSkin1 : mn === 'combinaison' ? mSuit1 : mn === 'bonnet' ? mCap : mn === 'bandeau' ? mBand : mn === 'temoin' ? mLed : mn === 'cable' ? mBotD : mBot);
    [['dormeuse', 0, 0], ['dormeuse-lod', 0, 1], ['dormeur', 1, 0], ['dormeur-lod', 1, 1]].forEach(([name, gi, lod]) => new GLTFLoader().load('assets/models/' + name + '.glb', (res) => { const ims = []; res.scene.updateMatrixWorld(true);
      res.scene.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); const mn = o.material.name, im = new THREE.InstancedMesh(g, matOf(mn), who[gi].length);
        im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.userData.tint = mn === 'peau' ? SKIN : mn === 'combinaison' ? SUIT : null; bay.add(im); ims.push(im); }); sets[gi][lod] = ims; }));
    upd.push((t, dt, cam) => { if (!bay.visible) return; for (let gi = 0; gi < 2; gi++) { const hi = sets[gi][0], lo = sets[gi][1]; if (!hi && !lo) continue; let nh = 0, nl = 0;
      for (const [bs, i] of who[gi]) { bs.updateWorldMatrix(true, false); const near = !lo || (!!hi && !!cam && cp.setFromMatrixPosition(bs.matrixWorld).distanceToSquared(cam) < 49), k = near ? nh++ : nl++;
        for (const im of (near ? hi : lo)) { im.setMatrixAt(k, bs.matrixWorld); const tn = im.userData.tint; if (tn) im.setColorAt(k, tn === SKIN ? SKIN[(i * 3 + (i >> 2)) % 5] : SUIT[i % 3]); } }
      for (const [set, n] of [[hi, nh], [lo, nl]]) if (set) for (const im of set) { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } } }); }

  /* ================= ESPACE ================= */
  const space = new THREE.Group(); scene.add(space); W.space = space;
  const SUN = new V3(1, 0.32, 0.28).normalize();
  // ALMA — la planète où la flotte est arrivée, vue d'une orbite basse : elle n'est pas « un globe au loin », elle remplit le bas du hublot et son
  // horizon barre le ciel. Rayon apparent de 62° (altitude ≈ 0,13 rayon). À cette échelle une sphère maillée devrait être plus loin que le plan
  // de coupe et que la flotte : la planète est donc calculée dans la matière du ciel (intersection rayon-sphère), derrière tout le reste.
  // dirAE : direction donnée par son azimut (positif vers la droite du hublot) et sa hauteur, en degrés.
  const dirAE = (az, el) => new V3(Math.sin(az * PI / 180) * Math.cos(el * PI / 180), Math.sin(el * PI / 180), -Math.cos(az * PI / 180) * Math.cos(el * PI / 180));
  const V0 = new V3(0.12, 1.7, -13.4), PA = 62 * PI / 180, PD = 3000, PR = PD * Math.sin(PA), EDIR = dirAE(-24.4, -42), EC = V0.clone().addScaledVector(EDIR, PD);
  // repère de la planète : son axe Z pointe vers nous (centre de la carte), son axe Y vers l'horizon ; elle tourne lentement sous l'arche
  const PB = (() => { const z = EDIR.clone().negate(), y = new V3(0, 1, 0).addScaledVector(z, -z.y).normalize().applyAxisAngle(z, 0.3), x = new V3().crossVectors(y, z); return [x, y, z]; })(), pRot = new THREE.Matrix3();
  const setSpin = (a) => { const c = Math.cos(a), s = Math.sin(a), [x, y, z] = PB; pRot.set(c * x.x - s * z.x, c * x.y - s * z.y, c * x.z - s * z.z, y.x, y.y, y.z, s * x.x + c * z.x, s * x.y + c * z.y, s * x.z + c * z.z); }; setSpin(0.12);
  const pMap = loader.load('assets/space/alma.jpg'), pDet = loader.load('assets/space/grain.jpg'); pMap.anisotropy = 4; pDet.anisotropy = 2; pDet.wrapS = pDet.wrapT = THREE.RepeatWrapping; /* cartes de grandeurs (altitude, humidité, nuages) et bruit de détail : tools/planete.py */
  // ciel : étoiles fines sur trois échelles + Voie lactée, et la planète (un dôme, un seul appel de rendu)
  const skyU = { uTime: { value: 0 }, uK: { value: 1 }, uSun: { value: SUN }, uPC: { value: EC }, uPR: { value: PR }, uRot: { value: pRot }, uMap: { value: pMap }, uDet: { value: pDet } }, sky = add(space, new THREE.SphereGeometry(1300, 32, 20), U(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD;varying vec3 vWp;void main(){vD=normalize(position);vec4 w=modelMatrix*vec4(position,1.);vWp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime;uniform float uK;uniform vec3 uSun;uniform vec3 uPC;uniform float uPR;uniform mat3 uRot;uniform sampler2D uMap;uniform sampler2D uDet;varying vec3 vD;varying vec3 vWp;${NOISE}
      float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float stars(vec3 d,float sc,float th,float r){ vec3 p=d*sc; vec3 c=floor(p); vec3 f=fract(p)-.5; float o=h3(c+7.3);
        float hr=h3(c); float dd=length(f-(vec3(h3(c+1.1),h3(c+2.2),h3(c+3.3))-.5)*.5); return step(th,hr)*smoothstep(r,0.,dd)*(.35+o)*(.78+.22*sin(uTime*(1.+o*3.)+o*40.)); }
      void main(){
        // où le rayon de ce pixel touche-t-il la planète ? (calculé pour tous : les dérivées servent au choix du niveau de détail des cartes)
        vec3 ro=cameraPosition, rd=normalize(vWp-cameraPosition), oc=uPC-ro; float b=dot(oc,rd); float d2=dot(oc,oc)-b*b; float dist=sqrt(max(d2,0.));
        float fw=fwidth(dist)*.8+.01; float hit=(1.-smoothstep(uPR-fw,uPR+fw,dist))*step(0.,b);
        vec3 n=normalize(ro+rd*(b-sqrt(max(uPR*uPR-d2,0.)))-uPC); vec3 p=uRot*n; float lat=asin(clamp(p.y,-1.,1.)); vec2 q=vec2(atan(p.x,p.z),lat)*57.2958; /* longitude, latitude en degrés */
        vec2 gx=dFdx(q), gy=dFdy(q); vec3 col=vec3(0.);
        if(hit<.999){ // le ciel : étoiles, Voie lactée, et la tranche d'air de la planète vue par la tranche
          vec3 d=normalize(vD); float s=stars(d,60.,.6,.075)+stars(d,110.,.84,.13)*.6+stars(d,190.,.934,.21)*.32;
          vec3 ax=normalize(vec3(.35,.8,-.48)); float bd=dot(d,ax)*3.2; float band=exp(-bd*bd); vec2 q0=vec2(atan(d.z,d.x)*3.,d.y*6.); float neb=fbm(q0*1.6)*fbm(q0*4.+3.);
          col=(vec3(.82,.88,1.)*s*(1.+band*1.6)+vec3(.20,.24,.34)*band*neb*.5+vec3(.34,.22,.16)*band*neb*neb*neb*.9)*uK;
          float hg=clamp((dist-uPR)/(uPR*.016),0.,1.); float g=exp(-hg*4.2)*(1.-smoothstep(.8,1.,hg))*step(0.,b);
          vec3 nl=normalize(ro+rd*b-uPC); float dy=smoothstep(-.22,.3,dot(nl,uSun)); float fwd=max(dot(rd,uSun),0.); /* à contre-jour, le halo s'embrase là où le soleil va paraître */
          col+=vec3(.2,.58,1.)*g*dy*.85+vec3(1.,.66,.38)*g*(pow(fwd,90.)*9.+pow(fwd,10.)*.9)+vec3(.03,.13,.17)*g*.3; }
        if(hit>.001){ // la planète. Les cartes sont lues avec des dérivées explicites (textureGrad) pour que ce bloc soit réellement sauté ailleurs
          mat2 R2=mat2(.8,.6,-.6,.8); vec2 K=1./vec2(120.,90.); float px=length(gx)+length(gy); /* taille d'un pixel, en degrés de planète */
          vec3 m=textureGrad(uMap,q*K+.5,gx*K,gy*K).rgb; vec3 dA=textureGrad(uDet,q*.125,gx*.125,gy*.125).rgb; vec3 dB=textureGrad(uDet,R2*q*.83,R2*gx*.83,R2*gy*.83).rgb;
          // relief : la carte donne la forme, le bruit ajoute le détail des côtes ; le seuil est tranché après coup, donc net à toute distance
          float h=m.r+(dA.r-.5)*.09+(dB.r-.5)*.028; float fh=clamp(px*.12,.0012,.03); float land=smoothstep(.5-fh,.5+fh,h); float e=max(h-.5,0.)*2.; float dep=clamp((.5-h)*6.,0.,1.);
          vec3 sea=mix(vec3(.025,.31,.33),vec3(.005,.055,.105),smoothstep(0.,.75,dep)); sea=mix(sea,vec3(.10,.52,.47),smoothstep(.1,0.,dep)*.55);
          float M=m.g+(dA.g-.5)*.3+(dB.g-.5)*.12; float al=abs(lat);
          vec3 lush=mix(vec3(.022,.13,.055),vec3(.06,.21,.085),dB.g); vec3 dry=mix(vec3(.33,.2,.105),vec3(.46,.3,.18),dA.g);
          vec3 gr=mix(dry,lush,smoothstep(.36,.6,M-e*.3)); gr=mix(gr,vec3(.5,.45,.36),smoothstep(.018,0.,e)*.75); gr=mix(gr,vec3(.2,.175,.16),smoothstep(.3,.56,e)); gr=mix(gr,vec3(.78,.82,.88),smoothstep(.56,.7,e+al*.4+(dB.r-.5)*.16));
          vec3 sf=mix(sea,gr,land);
          float ndl=dot(n,uSun), day=smoothstep(-.08,.22,ndl); vec3 V=-rd; float nv=max(dot(n,V),0.);
          // nuages : couverture de la carte, bords rongés par le bruit qui dérive. Un second relevé, décalé vers le soleil, donne à la fois
          // l'ombre qu'ils portent et la pente du terrain (un versant tourné vers le soleil est plus clair)
          float tt=uTime*.0005; vec2 c1=vec2(tt,tt*.3), c2=vec2(-tt*2.,tt*.4); float cB=textureGrad(uDet,R2*q*.62+c2,R2*gx*.62,R2*gy*.62).b;
          float cl=smoothstep(.47,.74,m.b+(textureGrad(uDet,q*.11+c1,gx*.11,gy*.11).b-.5)*.4+(cB-.5)*.2);
          vec3 so=uRot*uSun, ea=normalize(vec3(p.z,0.,-p.x)), no=cross(p,ea); vec2 qs=q+vec2(dot(so,ea)/max(cos(lat),.3),dot(so,no))*.4;
          vec3 mS=textureGrad(uMap,qs*K+.5,gx*K,gy*K).rgb; float sh=smoothstep(.47,.74,mS.b+(textureGrad(uDet,qs*.11+c1,gx*.11,gy*.11).b-.5)*.4+(cB-.5)*.2);
          float dif=max(ndl,0.)*(1.+clamp((m.r-mS.r)*7.,-.45,.6)*land); sf*=1.-.5*sh*(1.-cl);
          vec3 hv=normalize(uSun+V); float nh=max(dot(n,hv),0.); float sp=pow(nh,220.)*1.5+pow(nh,26.)*.1; /* le soleil sur la mer */
          vec3 lit=sf*(dif*.9+.015)*day+vec3(1.,.9,.74)*sp*(1.-land)*(1.-cl)*day;
          vec3 cc=mix(vec3(1.,.6,.4),vec3(1.),smoothstep(-.02,.13,ndl))*(max(ndl,0.)*.56+.05)*day; lit=mix(lit,cc,cl*.92);
          lit+=mix(sf,vec3(.45),cl)*.0035; /* côté nuit : presque rien, la lueur des lunes */
          // atmosphère : voile bleu qui s'épaissit vers l'horizon, bande chaude au terminateur, liseré de nuit
          float fr=pow(1.-nv,2.6); float dusk=smoothstep(-.1,.03,ndl)*(1.-smoothstep(.03,.16,ndl));
          lit=mix(lit,vec3(.2,.53,.95)*(.08+.6*day),clamp(fr*.8+.05,0.,1.)*(.25+.75*day))+vec3(1.,.45,.2)*dusk*fr*.32+vec3(.03,.13,.17)*pow(1.-nv,5.)*.3;
          col=mix(col,lit,hit); }
        gl_FragColor=vec4(col,1.); }` }))); sky.renderOrder = 1; // dessiné après les parois : seuls les pixels des hublots sont calculés
  upd.push((t) => setSpin(Math.max(-0.5, 0.12 - t * 0.001))); // le sol défile vers la gauche : l'arche avance vers le lever du soleil
  // deux lunes : ce ciel n'est pas celui de la Terre
  const moonMat = (c) => new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN }, uC: { value: new THREE.Color(c) } },
    vertexShader: 'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(mat3(modelMatrix)*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 uSun;uniform vec3 uC;varying vec3 vN;varying vec3 vP;${NOISE}
      void main(){ vec3 p=normalize(vP); vec2 q=vec2(atan(p.x,p.z)*2.,p.y*3.); float a=fbm(q*2.2), cr=smoothstep(.5,.6,fbm(q*5.+9.));
        vec3 c=uC*(.5+.6*a)*(1.-.4*cr)*(.85+.3*fbm(q*9.+4.)); float l=smoothstep(-.03,.3,dot(normalize(vN),uSun)); gl_FragColor=vec4(c*(l*.8+.01),1.); }` });
  for (const [az, el, dd, r, c] of [[-21, 31, 1150, 31, 0xb9b3a8], [15, 41, 1210, 8, 0xa98a72]]) { const mo = add(space, new THREE.SphereGeometry(r, 48, 32), moonMat(c), 0, 0, 0); mo.position.copy(V0).addScaledVector(dirAE(az, el), dd); mo.rotation.set(0.4, az, 0.2); }
  // matériau « éclairé par le soleil » (coques, roches) : tôles, lignes de hublots le long de la coque, reflet terrestre
  const spaceMat = (base, win = 0, ws = [8, 3]) => new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uBase: { value: new THREE.Color(base) }, uSun: { value: SUN }, uEarth: { value: EDIR }, uWin: { value: win }, uWS: { value: new THREE.Vector2(ws[0], ws[1]) } },
    vertexShader: 'varying vec3 vN;varying vec2 vUv;void main(){vUv=uv;vec4 n=vec4(normal,0.);\n#ifdef USE_INSTANCING\n n=instanceMatrix*n;\n vec4 p=instanceMatrix*vec4(position,1.);\n#else\n vec4 p=vec4(position,1.);\n#endif\n vN=normalize(mat3(modelMatrix)*n.xyz);gl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: `uniform vec3 uBase;uniform vec3 uSun;uniform vec3 uEarth;uniform float uWin;uniform vec2 uWS;varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ vec3 n=normalize(vN); float l=max(dot(n,uSun),0.); vec2 pg=vUv*uWS*.5; float pl=.84+.16*hash(floor(pg)); vec2 pf=abs(fract(pg)-.5); float seam=1.-smoothstep(.47,.5,max(pf.x,pf.y))*.4;
        vec3 c=uBase*pl*seam*(l*1.25+.025)+uBase*vec3(.34,.52,.6)*max(dot(n,uEarth),0.)*.22;
        if(uWin>0.){ vec2 g=vUv*uWS; vec2 f=fract(g); float row=step(.72,hash(vec2(floor(g.x),3.))); float on=step(.45,hash(floor(g)));
          float w=step(.3,f.x)*step(f.x,.7)*step(.25,f.y)*step(f.y,.6); c+=vec3(1.,.82,.55)*row*on*w*uWin; }
        gl_FragColor=vec4(c,1.); }` });
  const rockGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 2)); { const rp = rockGeo.attributes.position, v = new V3(); for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i); const n = 0.72 + 0.2 * Math.sin(v.x * 3.1 + v.y * 1.7) + 0.16 * Math.sin(v.y * 4.3 + v.z * 2.9) + 0.12 * Math.sin(v.z * 6.1 + v.x * 5.3); v.multiplyScalar(n); rp.setXYZ(i, v.x, v.y, v.z); } rockGeo.computeVertexNormals(); }
  const dN = 90, deb = new THREE.InstancedMesh(rockGeo, spaceMat(0x7d7061), dN), q = new THREE.Quaternion(), sc = new V3(), ps = new V3(), eu = new THREE.Euler();
  for (let i = 0; i < dN; i++) {
    const near = i < 26, a = rnd(PI * 2), r = rnd(175, 250);
    if (near) ps.set(rnd(-80, 80), rnd(-34, 44), rnd(-190, -60)); else ps.set(rnd(-420, 560), rnd(-60, 150) + Math.sin(a * 2) * 12, rnd(-640, -170));
    const k = near ? rnd(0.06, 0.4) : rnd(0.4, 2.6); sc.set(k * rnd(0.5, 1.6), k * rnd(0.4, 1.2), k * rnd(0.5, 1.8)); eu.set(rnd(6), rnd(6), rnd(6)); q.setFromEuler(eu);
    mt.compose(ps, q, sc); deb.setMatrixAt(i, mt);
  }
  deb.frustumCulled = false; space.add(deb);

  // --- arches, navette, pont avant de SPES-07 : modèles Blender (tools/arche_blender.py, tools/pont_blender.py) ---
  // Une seule matière pour toute une coque : les matières du modèle deviennent un numéro par sommet (aMat), et le détail
  // fin (tôles, joints, rangées de hublots, trame des panneaux, feux) est calculé dans la matière, donc net à toute distance.
  const MATID = { coque: 0, clair: 1, sombre: 2, panneau: 3, moteur: 4, feu_r: 5, feu_v: 6, feu_b: 7, vitre: 8 };
  const SK = { sun: { value: 0 }, earth: { value: 0.2 } }; // part de soleil reçue (0 dans l'ombre de la Terre), force du clair de Terre
  const HULL_V = 'attribute float aMat;varying vec3 vN;varying vec3 vO;varying vec3 vNo;varying vec3 vW;varying float vM;void main(){vM=aMat;vO=position;vNo=normal;\n#ifdef USE_INSTANCING\n mat4 mm=modelMatrix*instanceMatrix;\n#else\n mat4 mm=modelMatrix;\n#endif\n vec4 w=mm*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(mm)*normal);gl_Position=projectionMatrix*viewMatrix*w;}';
  const HULL_F = `uniform vec3 uSun;uniform vec3 uEC;uniform vec3 uTint;uniform float uSunK,uEarthK,uTime,uScale,uMode,uRad,uLive,uFill;uniform vec2 uCut;
    varying vec3 vN;varying vec3 vO;varying vec3 vNo;varying vec3 vW;varying float vM;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){ float m=floor(vM+.5); vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; vec3 v=normalize(cameraPosition-vW);
      vec2 q; float side; // repère de surface : enroulé autour de l'axe pour une arche, à plat pour le pont et la navette
      if(uMode<.5){ q=vec2(vO.x,atan(vO.z,vO.y)*uRad)*uScale; side=1.-smoothstep(.45,.7,abs(vNo.x)); }
      else { vec3 an=abs(vNo); q=(an.y>.6?vO.xz:an.x>an.z?vO.zy:vO.xy)*uScale; side=1.-step(.6,an.y); }
      float chr=0.; // épave : la coque est tranchée, la cassure est noircie
      if(uCut.x!=0.){ float a=atan(vO.z,vO.y); float e=uCut.y+(h(vec2(floor(a*9.),1.))-.5)*.05+sin(a*5.)*.012; float d=(vO.x-e)*uCut.x; if(d<0.) discard; chr=1.-smoothstep(0.,.09,d); }
      float px=max(fwidth(q).x,fwidth(q).y);
      vec2 q1=q; q1.x+=h(vec2(floor(q.y),7.))*.7; vec2 c1=floor(q1); vec2 f1=abs(fract(q1)-.5); float r1=h(c1);
      float tint=(.7+.3*r1)*(r1>.93?.55:r1<.06?1.25:1.); float s1=smoothstep(.45-px,.5-px*.5,max(f1.x,f1.y))*clamp(1.-px*2.5,0.,1.);
      vec2 q2=q*4.; q2.x+=h(vec2(floor(q2.y),3.))*.5; vec2 c2=floor(q2); vec2 f2=abs(fract(q2)-.5); float p2=px*4.; float k2=clamp(1.-p2*2.5,0.,1.);
      tint*=1.-(.5-h(c2))*.3*k2; float s2=smoothstep(.43-p2,.5-p2*.5,max(f2.x,f2.y))*k2; float streak=.92+.08*h(vec2(floor(q.y*9.),2.));
      vec3 base=m<.5?vec3(.37,.39,.42):m<1.5?vec3(.55,.55,.53):m<2.5?vec3(.13,.145,.165):vec3(.03,.055,.12); float shine=.4; float gloss=30.;
      if(m>2.5&&m<3.5){ vec2 g=q*5.; vec2 gf=abs(fract(g)-.5); float gp=px*5.; base=mix(base,vec3(.22,.27,.36),smoothstep(.42-gp,.5-gp*.5,max(gf.x,gf.y))*clamp(1.-gp*2.5,0.,1.)*.6); shine=3.; gloss=120.; }
      else base*=tint*streak*(1.-s1*.55)*(1.-s2*.3);
      base=mix(base*uTint,vec3(.02,.018,.016),chr*.9);
      float nl=dot(n,uSun); vec3 ed=normalize(uEC-vW);
      vec3 c=base*max(nl,0.)*uSunK*1.25+base*vec3(.36,.56,.64)*max(dot(n,ed)*.6+.4,0.)*.3*uEarthK+base*vec3(.5,.6,.8)*uFill*(.5+.5*dot(n,v));
      c+=vec3(1.,.95,.88)*pow(max(dot(n,normalize(uSun+v)),0.),gloss)*shine*step(0.,nl)*uSunK*(1.-chr);
      if(m<.5&&uLive>0.){ vec2 g=q*vec2(3.3,2.2); vec2 gc=floor(g); vec2 gf=fract(g); float gp=max(fwidth(g).x,fwidth(g).y); // hublots : des ponts entiers allumés, d'autres éteints
        float on=step(.42,h(gc))*step(.5,h(vec2(gc.y,5.))); float w=step(.28,gf.x)*step(gf.x,.72)*step(.3,gf.y)*step(gf.y,.62);
        c+=mix(vec3(1.,.8,.5),vec3(.7,.86,1.),step(.82,h(gc+3.)))*on*mix(w,.14,clamp(gp*1.6-.3,0.,1.))*side*uLive*2.4; }
      if(m>3.5){ float bl=fract(uTime/1.6); float lv=step(.01,uLive);
        if(m<4.5) c=vec3(.5,.78,1.)*(2.6+sin(uTime*23.+vO.y*40.)*.3)*uLive;
        else if(m<5.5) c=vec3(1.,.2,.14)*(bl<.1?5.:.25)*lv;
        else if(m<6.5) c=vec3(.2,.92,.45)*(bl<.1?5.:.25)*lv;
        else if(m<7.5) c=vec3(1.)*(fract(uTime/1.6+.5)<.06?6.:.3)*lv;
        else c=vec3(1.,.8,.5)*(h(floor(q*1.4)+floor(vO.xy*.37))>.25?2.6:.08)*uLive; }
      if(uCut.x!=0.) c+=vec3(1.,.32,.06)*step(.9,h(c2))*chr*chr*1.2*(.6+.4*sin(uTime*2.+r1*30.));
      gl_FragColor=vec4(c,1.); }`;
  const hullMat = (o = {}) => U(new THREE.ShaderMaterial({ side: o.cut ? THREE.DoubleSide : THREE.FrontSide, vertexShader: HULL_V, fragmentShader: HULL_F,
    uniforms: { uSun: { value: SUN }, uEC: { value: EC }, uSunK: SK.sun, uEarthK: SK.earth, uTime: { value: 0 }, uScale: { value: o.scale || 80 }, uMode: { value: o.mode || 0 }, uRad: { value: o.rad || 0.055 }, uLive: { value: o.live ?? 1 }, uFill: { value: o.fill ?? 0.035 },
      uCut: { value: new THREE.Vector2(...(o.cut || [0, 0])) }, uTint: { value: new THREE.Color(o.tint || 0xffffff) } } }));
  // un nœud du fichier glTF (une matière par morceau) -> une seule géométrie numérotée
  const pack = (node) => { const gs = []; node.traverse((o) => { if (!o.isMesh) return; const g = new THREE.BufferGeometry(), a = o.geometry.attributes; g.setAttribute('position', a.position); g.setAttribute('normal', a.normal); g.setIndex(o.geometry.index);
    g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(a.position.count).fill(MATID[o.material.name] || 0), 1)); gs.push(g); }); return mergeGeometries(gs); };
  const GEO = {}, waiting = []; let pending = 4; const whenModels = (f) => { if (pending) waiting.push(f); else f(); };
  for (const n of ['arche', 'arche-lod', 'pont', 'navette']) new GLTFLoader().load('assets/models/' + n + '.glb', (r) => {
    if (n === 'pont' || n === 'navette') GEO[n] = pack(r.scene); else GEO[n] = { hull: pack(r.scene.getObjectByName('arche')), ring: pack(r.scene.getObjectByName('anneau')) };
    if (!--pending) { waiting.forEach((f) => f()); waiting.length = 0; } });
  const glowTex = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0x9fd0ff).multiplyScalar(0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  // panache des moteurs : un cône de lumière qui s'effile derrière les tuyères
  const plumeGeo = new THREE.CylinderGeometry(0.012, 0.05, 0.34, 14, 1, true); plumeGeo.rotateZ(PI / 2); plumeGeo.translate(-0.67, 0, 0);
  const plumeMat = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying float vT;varying vec3 vN;varying vec3 vV;void main(){vT=(-.5-position.x)/.34;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform float uTime;varying float vT;varying vec3 vN;varying vec3 vV;void main(){float e=pow(abs(dot(normalize(vN),vV)),1.5);float a=e*pow(1.-clamp(vT,0.,1.),2.2)*(.85+.15*sin(uTime*31.+vT*20.));gl_FragColor=vec4(vec3(.42,.68,1.)*a*.55,1.);}' }));
  // une arche de longueur L, proue vers +X. o : live (0 = éteinte), cut (épave tranchée), ring (false = sans anneau), fill
  function ark(L, o = {}) {
    const g = new THREE.Group(), rg = new THREE.Group(); rg.position.x = 0.2 * L; g.add(rg); g.userData.ring = rg;
    whenModels(() => { const src = GEO.arche, h = new THREE.Mesh(src.hull, hullMat({ ...o, rad: 0.055 })); h.scale.setScalar(L); h.frustumCulled = false; g.add(h);
      if (o.ring !== false) { const r = new THREE.Mesh(src.ring, hullMat({ ...o, rad: 0.136 })); r.scale.setScalar(L); r.frustumCulled = false; rg.add(r); } });
    if (o.live !== 0) { const p = new THREE.Mesh(plumeGeo, plumeMat); p.scale.setScalar(L); g.add(p); const gl = new THREE.Sprite(glowTex); gl.scale.set(L * 0.1, L * 0.065, 1); gl.position.set(-L * 0.525, 0, 0); g.add(gl); }
    return g;
  }
  // Test « portail » : depuis la baie, l'espace ne se voit qu'à travers les trois hublots. Chaque vaisseau inscrit ici (avec le rayon de sa sphère
  // englobante) n'est dessiné que si cette sphère, vue depuis l'œil, recoupe l'une des ouvertures. Rien ne change à l'image ; depuis l'allée,
  // la plupart des coques (60 000 triangles pièce) ne sont plus envoyées à la carte graphique.
  const portal = [], pc = new V3(), viaPortal = (o, r) => { o.userData.on = true; portal.push([o, r]); return o; };
  upd.push((t, dt, cam) => { if (!cam || !space.visible) return; const dz = cam.z - (Z0 - 0.3); for (const [o, r] of portal) { let vis = o.userData.on; if (vis && dz > 0.2) { o.getWorldPosition(pc); const dd = cam.z - pc.z;
      if (dd > dz) { const k = dz / dd, px = cam.x + (pc.x - cam.x) * k, py = cam.y + (pc.y - cam.y) * k, rr = r * k + 0.3; vis = false; for (const [hx, hy, hr] of HOLES) if (Math.hypot(px - hx, py - hy) < hr + rr) vis = true; } } o.visible = vis; } });
  // la flotte proche : quatre arches au-dessus de l'horizon terrestre, flanc droit tourné vers le soleil et vers nous
  const fleet = [[110, -30, 99, -230, 2.3], [60, -143, 167, -260, 2.6], [44, 36, 125, -179, 2.2], [30, -45, 28, -153, 2.5]];
  W.ships = fleet.map(([len, x, y, z, ry]) => { const s = ark(len); s.position.set(x, y, z); s.rotation.y = ry; s.rotation.z = rnd(-0.06, 0.06); s.rotation.x = rnd(-0.5, 0.5); space.add(s); return viaPortal(s, len * 0.8); });
  // une arche qui n'a pas tenu : coque brisée en deux, feux éteints, braises dans la cassure, nuage d'éclats
  const wreck = new THREE.Group(); wreck.position.set(91, 62, -237); wreck.rotation.set(0.5, 0.9, -0.3); space.add(wreck); viaPortal(wreck, 74);
  { const a = ark(74, { live: 0, cut: [1, 0.03], tint: 0x8a8580 }), b = ark(74, { live: 0, cut: [-1, -0.01], ring: false, tint: 0x8a8580 }); a.position.set(9, 3, -2); a.rotation.set(0.5, -0.32, 0.22); a.userData.ring.rotation.set(0, 0.12, 0.08); wreck.add(a, b);
    const n = 70, sh = new THREE.InstancedMesh(rockGeo, spaceMat(0x5d5f63), n); for (let i = 0; i < n; i++) { const k = rnd(0.12, 1.1) * (i < 8 ? 2.2 : 1); ps.set(rnd(-6, 16), rnd(-9, 9), rnd(-9, 9)); sc.set(k * rnd(0.3, 1.6), k * rnd(0.1, 0.6), k * rnd(0.3, 1.6)); eu.set(rnd(6), rnd(6), rnd(6)); q.setFromEuler(eu); mt.compose(ps, q, sc); sh.setMatrixAt(i, mt); }
    sh.frustumCulled = false; wreck.add(sh); upd.push((t, dt) => { wreck.rotation.x += dt * 0.006; a.rotation.z += dt * 0.004; sh.rotation.x += dt * 0.01; });
    // Elle appelle encore. À la poupe, une balise de détresse lance deux éclats rouges toutes les trois secondes, pour personne ; à côté, le relevé
    // que le pont en garde (nom, avarie, année), tourné vers le regard. C'est la seule lumière de l'épave.
    const bm = new THREE.SpriteMaterial({ map: soft, color: 0xff3a22, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), beacon = new THREE.Sprite(bm); beacon.position.set(-33, 4.5, 0); beacon.renderOrder = 6; b.add(beacon); /* après le fond étoilé (renderOrder 1), qui sinon les recouvre */
    const tag = textPlane(TX.wreck, { color: '#ff4f38', w: 560, size: 50, sub: 30, scale: 56 }); tag.position.set(91 + 30, 62 + 26, -237); tag.material.depthWrite = false; tag.material.fog = false; tag.renderOrder = 6; space.add(tag); /* sans brume : à cette distance elle les éteindrait */ const tagOp = tag.material.opacity;
    upd.push((t, dt, cam) => { tag.visible = wreck.visible; if (!wreck.visible) return; const u = (t % 3.2) / 3.2, f = Math.max(Math.exp(-Math.pow((u - 0.06) * 30, 2)), Math.exp(-Math.pow((u - 0.16) * 30, 2)));
      bm.opacity = 0.06 + f * 0.94; beacon.scale.setScalar(6 + f * 22); if (cam) tag.lookAt(cam); tag.material.opacity = tagOp * (0.55 + 0.45 * f + 0.1 * Math.sin(t * 2.1)); }); }
  // l'arche géante qui nous dépasse, tout près, au-dessus de la baie (W.flyby, appelée par le récit)
  const giant = ark(420, { fill: 0.05 }), gA = new V3(60, 95, 330), gB = new V3(-226, 220, -855), gDir = gB.clone().sub(gA).normalize(); giant.visible = false; space.add(giant);
  giant.quaternion.setFromUnitVectors(new V3(1, 0, 0), gDir).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), PI / 2)); // voilures à plat : elles nous couvrent le ciel
  W.flyby = (k) => { giant.visible = k > 0; giant.position.lerpVectors(gA, gB, k); };
  // les navettes de liaison
  const shuttle = new THREE.Group(), shuttle2 = new THREE.Group(); space.add(shuttle, shuttle2); viaPortal(shuttle, 9); viaPortal(shuttle2, 8);
  whenModels(() => { const m = hullMat({ mode: 1, scale: 1.3, fill: 0.06 }); for (const s of [shuttle, shuttle2]) { s.add(new THREE.Mesh(GEO.navette, m)); for (const y of [-2.55, 2.55]) { const gl = new THREE.Sprite(glowTex); gl.scale.set(3.2, 1.7, 1); gl.position.set(-5.6, 0.3, y); s.add(gl); } } shuttle2.scale.setScalar(0.8); });
  // le pont avant de notre propre arche, en contrebas à droite du hublot, et la perche d'instruments au premier plan
  whenModels(() => { const d = new THREE.Mesh(GEO.pont, hullMat({ mode: 1, scale: 0.66, fill: 0.03 })); d.position.set(0, 0, Z0); d.frustumCulled = false; space.add(d); });
  // la flotte au loin : des dizaines d'arches, réduites mais entières, sur l'arc de l'orbite
  whenModels(() => { const ring = GEO['arche-lod'].ring.clone(); ring.translate(0.2, 0, 0); const far = mergeGeometries([GEO['arche-lod'].hull, ring]);
    const fN = opts.touch || opts.lite ? 26 : 64, fm = new THREE.InstancedMesh(far, hullMat({ fill: 0.03 }), fN);
    for (let i = 0; i < fN; i++) { const u = i / fN; ps.set(-260 + u * 980 + rnd(-40, 40), -30 + u * 190 + rnd(-26, 26), -520 - Math.sin(u * PI) * 420 + rnd(-60, 60)); const k = rnd(16, 34); sc.set(k, k, k); eu.set(rnd(6), 2.4 + rnd(-0.25, 0.25), rnd(-0.1, 0.1)); q.setFromEuler(eu); mt.compose(ps, q, sc); fm.setMatrixAt(i, mt); }
    fm.frustumCulled = false; space.add(fm);
    // même test « portail », arche par arche : seules celles qui se voient à travers un hublot restent dans la liste dessinée (recalculée quand l'œil bouge)
    const all = fm.instanceMatrix.array.slice(), ctr = [], last = new V3(1e9, 0, 0), m4 = new THREE.Matrix4(); for (let i = 0; i < fN; i++) { m4.fromArray(all, i * 16); ctr.push([new V3().setFromMatrixPosition(m4), m4.getMaxScaleOnAxis() * 0.75]); }
    upd.push((t, dt, cam) => { if (!cam || !space.visible || last.distanceToSquared(cam) < 0.0009) return; last.copy(cam); const dz = cam.z - (Z0 - 0.3); let n = 0;
      for (let i = 0; i < fN; i++) { const [c, r] = ctr[i], dd = cam.z - c.z; let vis = true; if (dz > 0.2 && dd > dz) { const k = dz / dd, px = cam.x + (c.x - cam.x) * k, py = cam.y + (c.y - cam.y) * k, rr = r * k + 0.3; vis = false; for (const [hx, hy, hr] of HOLES) if (Math.hypot(px - hx, py - hy) < hr + rr) vis = true; }
        if (vis) { fm.instanceMatrix.array.set(all.subarray(i * 16, i * 16 + 16), n * 16); n++; } }
      fm.count = n; fm.instanceMatrix.needsUpdate = true; }); });
  // poussière de glace devant la baie : elle scintille quand le soleil arrive de face
  const iceMat = new THREE.PointsMaterial({ map: soft, size: 0.16, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: 0x000000 });
  { const n = opts.touch || opts.lite ? 260 : 700, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([rnd(-34, 46), rnd(-9, 30), Z0 - rnd(3, 80)], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const ice = new THREE.Points(g, iceMat); ice.frustumCulled = false; space.add(ice); upd.push((t, dt) => { ice.position.x = Math.sin(t * 0.02) * 3; ice.position.y = Math.sin(t * 0.013) * 1.5; }); }

  /* ----- le soleil : il se lève derrière l'horizon d'Alma (W.setSun, appelée par le récit) ----- */
  // Tout l'éclairage de l'espace lit le même vecteur SUN : le déplacer suffit. k = 0 : caché derrière le globe, tout est
  // dans l'ombre, on ne voit que des feux et des hublots ; k ≈ 0,05 : il perce au limbe ; k = 1 : haut sur la droite.
  const S1 = new V3(0.93, 0.33, 0.12).normalize(), limb = (() => { let a = -30, b = 60; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (dirAE(12, m).angleTo(EDIR) < PA) a = m; else b = m; } return dirAE(12, a); })(),
    sunAxis = new V3().crossVectors(limb, S1).normalize(), SA = limb.clone().applyAxisAngle(sunAxis, -5.5 * PI / 180), SWEEP = SA.angleTo(S1);
  W.setSun = (k) => { W.sunK = k; SUN.copy(SA).applyAxisAngle(sunAxis, SWEEP * k); sky.quaternion.setFromAxisAngle(sunAxis, SWEEP * k * 0.3); };
  // disque et halo : un panneau face caméra posé juste devant la coque, que seuls les murs de la baie peuvent masquer
  const flareU = { uVis: { value: 0 }, uSize: { value: 1 } };
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: flareU,
    vertexShader: 'uniform float uSize;varying vec2 vP;void main(){vP=position.xy;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*uSize;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float uVis;varying vec2 vP;
      void main(){ float r=length(vP); float a=atan(vP.y,vP.x);
        float core=smoothstep(.03,.014,r)*16.; float halo=exp(-r*13.)*2.+.035/(r*9.+.3)*exp(-r*2.6);
        float spikes=pow(abs(cos(a*3.+.5)),90.)*exp(-r*5.5)*.6+pow(abs(cos(a*2.-.3)),160.)*exp(-r*3.4)*.3;
        float streak=exp(-abs(vP.y)*70.)*exp(-abs(vP.x)*2.4)*1.1; float ringH=smoothstep(.02,.0,abs(r-.42))*.05;
        vec3 c=vec3(1.,.93,.8)*(core+halo+spikes)+vec3(.55,.75,1.)*streak+vec3(1.,.6,.35)*ringH;
        gl_FragColor=vec4(c*uVis*(1.-smoothstep(.75,1.,r)),1.); }` })); flare.frustumCulled = false; flare.renderOrder = 5; flare.visible = false; space.add(flare);
  // dans la baie : la lumière entre par le grand hublot (projecteur étroit, sans ombre portée) et dessine un faisceau dans l'air
  const WCv = new V3(WC.x, WC.y, Z0 - 0.3), sunL = new THREE.SpotLight(0xfff0dc, 0, 0, 0.03, 0.35, 0); bay.add(sunL, sunL.target);
  const beamU = { uK: { value: 0 } }, beamG = new THREE.CylinderGeometry(1, 1, 1, 36, 1, true); beamG.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: beamU,
    vertexShader: 'varying float vT;varying vec3 vN;varying vec3 vV;void main(){vT=position.y;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*vec3(normal.x,0.,normal.z));vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform float uK;varying float vT;varying vec3 vN;varying vec3 vV;void main(){float e=pow(abs(dot(normalize(vN),vV)),1.7);gl_FragColor=vec4(vec3(1.,.9,.74)*e*(1.-vT)*(1.-vT)*uK,1.);}' })); beam.frustumCulled = false; beam.position.copy(WCv); bay.add(beam);
  const tv = new V3(), UP = new V3(0, 1, 0), DOWN = new V3();
  upd.push((t, dt, cam) => { if (!cam) return;
    const d = tv.copy(EC).sub(cam).length(), aR = Math.asin(PR / d), vis = sm(aR - 0.004, aR + 0.02, SUN.angleTo(tv)), thru = sm(0.03, 0.3, -SUN.z); W.sunVis = vis; W.sunIn = vis * thru;
    SK.sun.value = vis; SK.earth.value = 0.15 + 0.85 * (0.5 - 0.5 * SUN.dot(EDIR)); skyU.uK.value = 1 - 0.5 * vis * thru; iceMat.color.setRGB(1, 0.92, 0.8).multiplyScalar(vis * (0.12 + 0.6 * thru));
    const tz = SUN.z < -0.03 ? (Z0 - 1.6 - cam.z) / SUN.z : 0; flare.visible = tz > 0 && vis > 0.002; if (flare.visible) { flare.position.copy(cam).addScaledVector(SUN, tz); flareU.uSize.value = tz * 0.5; flareU.uVis.value = vis; }
    sunL.intensity = vis * thru * 7; sunL.position.copy(WCv).addScaledVector(SUN, 70); sunL.target.position.copy(WCv).addScaledVector(SUN, -10); sunL.angle = Math.atan(1.95 * Math.sqrt(Math.max(0.05, -SUN.z)) / 70);
    beamU.uK.value = vis * thru * 0.13; beam.visible = beamU.uK.value > 0.001; if (beam.visible) { const r = 1.95 * Math.sqrt(Math.max(0.05, -SUN.z)); beam.scale.set(r, 15, r); beam.quaternion.setFromUnitVectors(UP, DOWN.copy(SUN).negate()); } });
  W.setSun(0);
  // robot soudeur accroché au bord extérieur du grand hublot
  const wa = 0.72, welder = new THREE.Group(); welder.position.set(Math.cos(wa) * 1.86, WC.y + Math.sin(wa) * 1.86, Z0 - 0.78); welder.rotation.z = wa; space.add(welder);
  add(welder, new THREE.SphereGeometry(0.022, 8, 8), glow(COL.safran, 3), -0.12, 0.06, 0.095);
  gear.then((sc) => { const wm = { coque: spaceMat(0xb9bec4), metal: spaceMat(0x3c4249), acier: spaceMat(0x9aa1a8), ambre: glow(COL.safran, 1.6), cuivre: spaceMat(0xa06a40) }, n = sc.getObjectByName('soudeur'); n.traverse((m) => { if (m.isMesh) m.material = wm[m.material.name] || wm.metal; }); n.position.set(0, 0, 0); welder.add(n); });
  const arc = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0xbfe0ff).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); arc.position.set(0.34, -0.04, 0.15); welder.add(arc);
  const spN = 40, spp = new Float32Array(spN * 3), spv = []; for (let i = 0; i < spN; i++) { spv.push([0, 0, 0, 0]); spp.set([0, 99, 0], i * 3); }
  const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(spp, 3));
  const sparks = new THREE.Points(spg, new THREE.PointsMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4), size: 0.03, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.position.copy(arc.position); sparks.frustumCulled = false; welder.add(sparks);
  upd.push((t, dt) => {
    W.ships.forEach((s, i) => { const v = dt * (0.25 + i * 0.05); s.position.x += Math.cos(s.rotation.y) * v; s.position.z -= Math.sin(s.rotation.y) * v; s.userData.ring.rotation.x += dt * 0.12; }); giant.userData.ring.rotation.x += dt * 0.1;
    const k = (t * 0.03) % 1; shuttle.position.set(46 - k * 92, 3.2 + Math.sin(k * 6) * 0.6, -36 - k * 6); shuttle.rotation.set(Math.sin(k * 6) * 0.08, PI + 0.065, 0);
    const k2 = (t * 0.021 + 0.4) % 1; shuttle2.position.set(-38 + k2 * 76, 12 - k2 * 5, -62 + k2 * 10); shuttle2.rotation.y = -0.13; 
    const on = (t % 5.2) < 2.6, f = on ? 0.5 + Math.random() * 0.5 : 0; arc.scale.setScalar(f * 0.2 + 0.001); es.color.copy(esBase).lerp(esArc, f * 0.7).lerp(esSun, (W.sunIn || 0) * 0.85); es.intensity = (9 + f * 9) * (0.3 + 0.7 * SK.earth.value) + (W.sunIn || 0) * 46; es.distance = 11 + (W.sunIn || 0) * 9; // le soleil de face inonde l'avant de la baie
    const bk = Math.min(1, W.beacon.intensity / 26); W.keyLight.color.copy(keyBase).lerp(keyAmber, bk * 0.75);
    for (let i = 0; i < spN; i++) { const v = spv[i]; v[3] -= dt; if (v[3] <= 0 && on) { v[0] = rnd(-0.6, 0.9); v[1] = rnd(-0.9, 0.3); v[2] = rnd(-0.5, 0.5); v[3] = rnd(0.3, 1); spp.set([0, 0, 0], i * 3); } else if (v[3] > 0) { spp[i * 3] += v[0] * dt; spp[i * 3 + 1] += v[1] * dt; spp[i * 3 + 2] += v[2] * dt; } else spp.set([0, 99, 0], i * 3); } spg.attributes.position.needsUpdate = true;
  });

  /* ================= DANSE SENSORIELLE : la galerie Ceysson & Bénétière reconstituée (app/galerie.js) ================= */
  buildGallery({ scene, loader, works, TX, W, upd, U, lite: opts.lite, touch: opts.touch, reel: opts.reel });
  const ds = W.ds;

  // plan du pont pour la mini-carte : coque, caissons, allée, grand hublot, poste de liaison
  W.planShip = { walls: [[-BW / 2, Z0, BW / 2, Z0], [BW / 2, Z0, BW / 2, Z1], [BW / 2, Z1, -BW / 2, Z1], [-BW / 2, Z1, -BW / 2, Z0]], soft: [[-1.25, Z0 + 2, -1.25, Z1], [1.25, Z0 + 2, 1.25, Z1], [-2.05, Z0 - 0.5, 2.05, Z0 - 0.5]], boxes: [[3.25, -11.4, 1.1, 1.1]], path: null };
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) if (!(s === 1 && i === 0)) W.planShip.boxes.push([s * 3.5, -11.7 + i * 2.6, 2.5, 1.05]);
  // Une lumière d'intensité nulle coûte autant qu'une lumière allumée dans chaque pixel éclairé : le soleil (avant son lever) et la lampe de la
  // fiche cervicale (avant le branchement) sortent donc du calcul tant qu'elles sont éteintes. Chaque combinaison demande ses propres
  // programmes : W.warm les prépare pendant le chargement, pour qu'aucun à-coup ne se produise à l'allumage.
  upd.push(() => { sunL.visible = sunL.intensity > 0.004; plugLight.visible = plugLight.intensity > 0.004; });
  W.warm = (renderer, camera) => { const a = sunL.visible, b = plugLight.visible; for (const [x, y] of [[true, true], [true, false], [false, true], [false, false]]) { sunL.visible = x; plugLight.visible = y; renderer.compile(scene, camera); } sunL.visible = a; plugLight.visible = b; };
  W.update = (t, dt, cam) => { for (const u of W.timeU) u.value = t; for (const f of upd) f(t, dt, cam); };
  W.setScene = (name) => { const d = name === 'ds'; bay.visible = !d; space.visible = !d; ds.visible = d; bay.matrixWorldAutoUpdate = space.matrixWorldAutoUpdate = !d; ds.matrixWorldAutoUpdate = d; /* le décor masqué ne recalcule plus ses positions */ if (d && W.dsSun) W.dsSun.shadow.needsUpdate = true; };
  return W;
}
