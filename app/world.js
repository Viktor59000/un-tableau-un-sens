// SPES — décors 3D : baie cryogénique, hublots, espace, couloir de danse sensorielle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Palette du Canva (page « Couleurs »)
export const COL = { steel: 0x4c6783, cyan: 0x7fe3e6, pale: 0xb9d6f2, coral: 0xff4f38, lime: 0xa8e61d,
  safran: 0xf5c400, amber: 0xfca311, ocre: 0xd59639, white: 0xf1f2f4 };

const PI = Math.PI;
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }`;

const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function textPlane(lines, { color = '#7fe3e6', w = 512, h = 160, size = 44, font = 'Rajdhani', weight = 600, sub = 22, scale = 1.6, align = 'left' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.textAlign = align; const x = align === 'center' ? w / 2 : 16;
  g.fillStyle = color; g.font = `${weight} ${size}px ${font}, sans-serif`; g.fillText(lines[0], x, h * 0.36);
  if (lines[1]) { g.globalAlpha = 0.75; g.font = `500 ${sub}px Rajdhani, sans-serif`; g.fillText(lines[1], x, h * 0.72); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * h / w), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  return m;
}
function circuitTex() { // motif « circuit » du Canva (page effets)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  g.strokeStyle = '#7fe3e6'; g.fillStyle = '#7fe3e6'; g.lineWidth = 2;
  for (let i = 0; i < 64; i++) {
    let x = rnd(1024), y = rnd(512); const dirs = [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1]]; let d = dirs[0];
    g.globalAlpha = rnd(0.25, 0.9); g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { const len = rnd(30, 150); x += d[0] * len; y += d[1] * len; g.lineTo(x, y); d = dirs[(Math.random() * 3) | 0]; }
    g.stroke(); g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildWorld(scene, loader, works) {
  const W = { timeU: [] }; const upd = [];
  const soft = softTex();
  const U = (m) => { W.timeU.push(m.uniforms.uTime); return m; };

  /* ================= MATÉRIAUX ================= */
  const mMetal = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.55 });
  const mPanel = new THREE.MeshStandardMaterial({ color: 0x2c343c, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.4 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x0c0f13, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.3 });
  const mFloor = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.92, roughness: 0.26, envMapIntensity: 0.7 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: 0xa9dce6, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2 });
  const mBody = new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.9, metalness: 0 });

  /* ================= BAIE CRYOGÉNIQUE ================= */
  const bay = new THREE.Group(); scene.add(bay); W.bay = bay;
  const BW = 11, BH = 5, Z0 = -15, Z1 = 17, BL = Z1 - Z0, ZC = (Z0 + Z1) / 2;
  add(bay, new THREE.PlaneGeometry(BW, BL), mFloor, 0, 0, ZC).rotation.x = -PI / 2;
  add(bay, new THREE.PlaneGeometry(BW, BL), mDark, 0, BH, ZC).rotation.x = PI / 2;
  add(bay, new THREE.PlaneGeometry(BL, BH), mPanel, -BW / 2, BH / 2, ZC).rotation.y = PI / 2;
  add(bay, new THREE.PlaneGeometry(BL, BH), mPanel, BW / 2, BH / 2, ZC).rotation.y = -PI / 2;
  add(bay, new THREE.PlaneGeometry(BW, BH), mPanel, 0, BH / 2, Z1).rotation.y = PI;
  add(bay, new THREE.BoxGeometry(2.3, 0.03, BL), mDark, 0, 0.015, ZC);
  W.guideMat = glow(COL.cyan, 1.3);
  add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, -1.25, 0.035, ZC);
  add(bay, new THREE.BoxGeometry(0.05, 0.02, BL), W.guideMat, 1.25, 0.035, ZC);
  const barMat = glow(COL.pale, 2.6), slitMat = glow(COL.steel, 1.5);
  const gPillar = rbox(0.4, BH, 0.45, 0.08), gBeam = rbox(BW, 0.32, 0.45, 0.08), gStrut = new THREE.BoxGeometry(0.14, 1.5, 0.3),
    gBar = new THREE.BoxGeometry(2.4, 0.05, 0.14), gSlit = new THREE.BoxGeometry(0.05, 1.5, 0.1), gPan = rbox(0.14, 1.1, 1.9, 0.05);
  for (let z = Z0 + 1.3; z < Z1; z += 2.6) {
    for (const s of [-1, 1]) {
      add(bay, gPillar, mMetal, s * (BW / 2 - 0.2), BH / 2, z);
      add(bay, gStrut, mMetal, s * (BW / 2 - 0.75), BH - 0.75, z).rotation.z = s * 0.75;
      if (z + 1.3 < Z1) {
        add(bay, gSlit, slitMat, s * (BW / 2 - 0.04), 2.6, z + 1.3);
        add(bay, gPan, (z | 0) % 2 ? mPanel : mMetal, s * (BW / 2 - 0.07), 0.75, z + 1.3);
        add(bay, gPan, mMetal, s * (BW / 2 - 0.07), 4.05, z + 1.3);
      }
    }
    add(bay, gBeam, mMetal, 0, BH - 0.16, z);
    add(bay, gBar, barMat, 0, BH - 0.345, z);
  }
  for (const [x, y, r] of [[-4.6, 4.5, 0.09], [4.6, 4.5, 0.09], [-3.9, 4.72, 0.14], [3.9, 4.72, 0.06]])
    add(bay, new THREE.CylinderGeometry(r, r, BL, 10), mMetal, x, y, ZC).rotation.x = PI / 2;
  add(bay, rbox(2.6, 3.4, 0.2, 0.08), mMetal, 0, 1.7, Z1 - 0.1);
  add(bay, new THREE.BoxGeometry(1.2, 0.05, 0.05), glow(COL.coral, 2), 0, 3.6, Z1 - 0.22);
  bay.add(new THREE.AmbientLight(0x5a7088, 0.5));
  for (const z of [11, 3, -5, -12]) { const p = new THREE.PointLight(0xb9d6f2, 22, 13, 2); p.position.set(0, 4.3, z); bay.add(p); }
  { const es = new THREE.PointLight(0xe0a868, 16, 11, 2); es.position.set(-0.6, 2.4, Z0 + 1.2); bay.add(es); const rim = new THREE.PointLight(0xb9d6f2, 9, 8, 2); rim.position.set(2.6, 3.6, Z0 + 2.4); bay.add(rim); } // lueur de la Terre par le hublot
  W.beacon = new THREE.PointLight(COL.amber, 0, 12, 2); W.beacon.position.set(-3.2, 3.4, 1.3); bay.add(W.beacon);

  // --- caissons ---
  const gBase = rbox(2.5, 0.55, 1.05, 0.12), gBed = rbox(2.2, 0.12, 0.8, 0.05), gPlinth = new THREE.BoxGeometry(2.0, 0.12, 0.8),
    gLid = new THREE.CylinderGeometry(0.52, 0.52, 2.2, 22, 1, true, 0, PI), gHead = rbox(0.35, 0.9, 1.05, 0.08), gFoot = rbox(0.25, 0.7, 1.05, 0.08),
    gEdge = new THREE.BoxGeometry(2.0, 0.025, 0.025), gStat = new THREE.BoxGeometry(0.02, 0.07, 0.5),
    gSleeper = new THREE.CapsuleGeometry(0.2, 1.15, 4, 10), gSkull = new THREE.SphereGeometry(0.125, 12, 10);
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.42, 0.95, 0), new THREE.Vector3(-1.8, 1.5, 0.12), new THREE.Vector3(-1.98, 2.4, 0.05), new THREE.Vector3(-2.0, 3.4, 0)]), 16, 0.035, 6);
  const edgeMat = glow(COL.cyan, 1.1); W.statMats = [];
  function pod(mine) {
    const g = new THREE.Group();
    add(g, gPlinth, mDark, 0, 0.06, 0); add(g, gBase, mMetal, 0, 0.36, 0); add(g, gBed, mDark, 0, 0.66, 0);
    add(g, gHead, mPanel, -1.3, 0.6, 0); add(g, gFoot, mPanel, 1.28, 0.5, 0);
    add(g, gEdge, edgeMat, 0, 0.72, 0.43); add(g, gEdge, edgeMat, 0, 0.72, -0.43);
    add(g, cable, mDark); add(g, cable, mDark, 0, 0, 0.3);
    const sm = glow(mine ? COL.amber : COL.cyan, 2); W.statMats.push(sm); add(g, gStat, sm, 1.41, 0.62, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.66, -0.5); g.add(pivot);
    const lid = add(pivot, gLid, mGlass, 0, 0, 0.5); lid.rotation.z = PI / 2;
    if (!mine) { const b = add(g, gSleeper, mBody, 0.1, 0.9, 0); b.rotation.z = PI / 2; add(g, gSkull, mBody, -0.82, 0.92, 0); }
    g.userData.pivot = pivot; return g;
  }
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) {
    const z = -11.7 + i * 2.6, mine = (s === -1 && i === 5);
    const p = pod(mine); p.position.set(s * 3.5, 0, z); if (s === 1) p.rotation.y = PI; bay.add(p);
    if (mine) {
      W.lidPivot = p.userData.pivot;
      const frost = U(new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime: { value: 0 }, uClear: { value: 0 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float uTime,uClear;varying vec2 vUv;${NOISE}
          void main(){ vec2 p=vUv*vec2(5.,9.); float n=fbm(p)+fbm(p*4.)*.5; float d=distance(vUv,vec2(.5,.86))*1.7;
            float frost=smoothstep(uClear*1.9-.35,uClear*1.9,d+n*.22);
            float cr=pow(fbm(p*9.),3.)*2.; vec3 col=mix(vec3(.30,.42,.50),vec3(.80,.92,1.),n*.7)+cr;
            gl_FragColor=vec4(col*.36,frost*(.74+n*.22)); }` }));
      W.frost = frost.uniforms.uClear;
      const f = add(W.lidPivot, new THREE.CylinderGeometry(0.5, 0.5, 2.18, 22, 1, true, 0, PI), frost, 0, 0, 0.5); f.rotation.z = PI / 2;
    }
  }
  // brume de cryogénie + drone de maintenance (vie)
  const mist = []; const mistMat = new THREE.SpriteMaterial({ map: soft, color: 0x9fc4d8, transparent: true, opacity: 0.07, depthWrite: false });
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(mistMat); s.position.set(rnd(-5, 5), rnd(0.2, 1.1), rnd(Z0, Z1)); const k = rnd(3, 6.5); s.scale.set(k, k * 0.55, 1); s.userData.v = rnd(-0.25, 0.25); bay.add(s); mist.push(s); }
  const drone = new THREE.Group(); add(drone, new THREE.SphereGeometry(0.16, 16, 12), mMetal); add(drone, new THREE.TorusGeometry(0.24, 0.02, 6, 24), mPanel).rotation.x = PI / 2;
  add(drone, new THREE.SphereGeometry(0.04, 8, 8), glow(COL.safran, 4), 0, -0.15, 0.08); const dl = new THREE.PointLight(COL.pale, 4, 6, 2); drone.add(dl); bay.add(drone);
  upd.push((t) => {
    for (const s of mist) { s.position.x += s.userData.v * 0.016; if (s.position.x > 5.5) s.position.x = -5.5; if (s.position.x < -5.5) s.position.x = 5.5; }
    drone.position.set(2.2 + Math.sin(t * 0.31) * 1.2, 4.0 + Math.sin(t * 1.7) * 0.05, 1 + Math.sin(t * 0.13) * 13); drone.rotation.y = t * 0.6;
    W.statMats.forEach((m, i) => { const on = Math.sin(t * 1.4 + i * 1.9) > -0.6; m.color.setHex(i === 10 ? COL.amber : COL.cyan).multiplyScalar(on ? 2 : 0.5); });
  });

  // --- mur des hublots ---
  const sh = new THREE.Shape(); sh.moveTo(-BW / 2, 0); sh.lineTo(BW / 2, 0); sh.lineTo(BW / 2, BH); sh.lineTo(-BW / 2, BH); sh.closePath();
  const WC = { x: 0, y: 2.55, r: 2.05 };
  for (const [x, y, r] of [[WC.x, WC.y, WC.r], [-3.95, 2.7, 0.72], [3.95, 2.7, 0.72]]) { const h = new THREE.Path(); h.absarc(x, y, r, 0, PI * 2, true); sh.holes.push(h); }
  add(bay, new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false, curveSegments: 48 }), mMetal, 0, 0, Z0 - 0.55);
  for (const [x, y, r] of [[WC.x, WC.y, WC.r], [-3.95, 2.7, 0.72], [3.95, 2.7, 0.72]]) {
    add(bay, new THREE.TorusGeometry(r + 0.1, r > 1 ? 0.13 : 0.08, 14, 72), mPanel, x, y, Z0 + 0.02);
    add(bay, new THREE.TorusGeometry(r - 0.03, 0.016, 8, 72), glow(COL.steel, 2.2), x, y, Z0 + 0.06);
    add(bay, new THREE.CircleGeometry(r, 48), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.3, depthWrite: false }), x, y, Z0 - 0.3);
  }
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), mMetal, 28); const mt = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; mt.setPosition(WC.x + Math.cos(a) * 2.33, WC.y + Math.sin(a) * 2.33, Z0 + 0.03); bolts.setMatrixAt(i, mt); } bay.add(bolts);
  // pupitre d'observation
  add(bay, rbox(4.4, 0.85, 0.7, 0.1), mPanel, 0, 0.42, Z0 + 0.75);
  add(bay, new THREE.BoxGeometry(4.2, 0.02, 0.03), glow(COL.cyan, 1.6), 0, 0.86, Z0 + 1.08);
  const scr1 = textPlane(['ORBITE BASSE — TERRE', 'surface habitable : 3 %  ·  poussière : critique'], { color: '#ff4f38', w: 640, h: 150, size: 40, scale: 1.5 });
  scr1.position.set(-1.25, 1.12, Z0 + 0.8); scr1.rotation.x = -0.5; bay.add(scr1);
  const scr2 = textPlane(['FLOTTE HOPE', '212 vaisseaux  ·  2 000 dormeurs à bord du SPES'], { color: '#7fe3e6', w: 640, h: 150, size: 40, scale: 1.5 });
  scr2.position.set(1.25, 1.12, Z0 + 0.8); scr2.rotation.x = -0.5; bay.add(scr2);

  // --- liaison neurale ---
  const link = new THREE.Group(); link.position.set(3.3, 0, -12.4); link.rotation.y = -0.74; bay.add(link);
  add(link, new THREE.CylinderGeometry(0.72, 0.82, 0.16, 32), mMetal, 0, 0.08, 0);
  add(link, new THREE.CylinderGeometry(0.6, 0.6, 0.02, 32), glow(COL.cyan, 0.9), 0, 0.17, 0);
  add(link, new THREE.TorusGeometry(0.98, 0.07, 12, 64), mMetal, 0, 1.35, 0);
  W.linkGlow = glow(COL.cyan, 2.2); add(link, new THREE.TorusGeometry(0.88, 0.02, 8, 64), W.linkGlow, 0, 1.35, 0);
  const lr = [add(link, new THREE.TorusGeometry(0.7, 0.008, 6, 48), glow(COL.pale, 1.6), 0, 1.35, 0), add(link, new THREE.TorusGeometry(0.52, 0.008, 6, 48), glow(COL.cyan, 1.6), 0, 1.35, 0)];
  const sign = textPlane(['LIAISON NEURALE', 'danse sensorielle — canal ouvert'], { color: '#7fe3e6', w: 560, h: 140, size: 42, scale: 1.5, align: 'center' }); sign.position.set(0, 2.72, 0); link.add(sign);
  const ll = new THREE.PointLight(COL.cyan, 6, 6, 2); ll.position.set(0, 1.4, 0.6); link.add(ll);
  W.linkSpin = 1; upd.push((t, dt) => { lr[0].rotation.y += dt * 0.8 * W.linkSpin; lr[1].rotation.x += dt * 1.1 * W.linkSpin; });

  /* ================= ESPACE ================= */
  const space = new THREE.Group(); scene.add(space); W.space = space;
  const SUN = new THREE.Vector3(1, 0.32, 0.28).normalize();
  const sN = 2600, sp = new Float32Array(sN * 3);
  for (let i = 0; i < sN; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 0.2)).normalize().multiplyScalar(700); sp.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  space.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe9f5, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  // Terre endommagée : continents désertifiés, bassins océaniques à sec, tempêtes de poussière, foyers côté nuit
  const day = loader.load('assets/space/earth.jpg'); day.colorSpace = THREE.SRGBColorSpace;
  const earthMat = U(new THREE.ShaderMaterial({ uniforms: { uDay: { value: day }, uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D uDay;uniform vec3 uSun;uniform float uTime;varying vec2 vUv;varying vec3 vN;${NOISE}
      void main(){ vec3 d=texture2D(uDay,vUv).rgb; float lum=dot(d,vec3(.3,.59,.11));
        float ocean=smoothstep(.0,.06,d.b-max(d.r,d.g)*.92);
        vec3 land=mix(vec3(.34,.22,.11),vec3(.78,.60,.36),clamp(lum*1.9,0.,1.));
        vec3 sea=mix(vec3(.07,.06,.055),vec3(.26,.20,.15),clamp(lum*2.4,0.,1.));
        vec3 col=mix(land,sea,ocean);
        float storm=fbm(vUv*vec2(9.,4.5)+vec2(uTime*.003,0.)); col=mix(col,vec3(.80,.66,.46),smoothstep(.5,.78,storm)*.75);
        float scar=smoothstep(.62,.7,fbm(vUv*vec2(26.,13.)+3.)); col=mix(col,vec3(.05,.04,.04),scar*.55*(1.-ocean));
        float ndl=dot(normalize(vN),uSun); float dayk=smoothstep(-.12,.4,ndl);
        float fire=smoothstep(.7,.82,fbm(vUv*vec2(70.,35.)))*(1.-ocean)*(1.-dayk);
        vec3 c=col*dayk*1.25+vec3(1.,.36,.08)*fire*2.4+col*.012;
        gl_FragColor=vec4(c,1.); }` }));
  const earth = add(space, new THREE.SphereGeometry(150, 96, 64), earthMat, -150, -100, -330); earth.rotation.set(0.35, 2.1, 0.2);
  add(space, new THREE.SphereGeometry(156, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vW=normalize(mat3(modelMatrix)*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uSun;varying vec3 vN;varying vec3 vW;varying vec3 vP;void main(){float f=pow(1.-max(dot(vN,normalize(-vP)),0.),3.2);float l=smoothstep(-.3,.5,dot(-vW,uSun));gl_FragColor=vec4(vec3(.95,.62,.34)*f*l*1.3,f);}' }), -150, -100, -330);
  upd.push((t, dt) => { earth.rotation.y += dt * 0.0035; });
  // matériau « éclairé par le soleil » (coques + débris), fenêtres procédurales
  const spaceMat = (base, win = 0, ws = [8, 3]) => new THREE.ShaderMaterial({ uniforms: { uBase: { value: new THREE.Color(base) }, uSun: { value: SUN }, uWin: { value: win }, uWS: { value: new THREE.Vector2(ws[0], ws[1]) } },
    vertexShader: 'varying vec3 vN;varying vec2 vUv;void main(){vUv=uv;vec4 n=vec4(normal,0.);\n#ifdef USE_INSTANCING\n n=instanceMatrix*n;\n vec4 p=instanceMatrix*vec4(position,1.);\n#else\n vec4 p=vec4(position,1.);\n#endif\n vN=normalize(mat3(modelMatrix)*n.xyz);gl_Position=projectionMatrix*modelViewMatrix*p;}',
    fragmentShader: `uniform vec3 uBase;uniform vec3 uSun;uniform float uWin;uniform vec2 uWS;varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ float l=max(dot(normalize(vN),uSun),0.); vec3 c=uBase*(l*1.3+.03);
        if(uWin>0.){ vec2 g=vUv*uWS; vec2 f=fract(g); float on=step(.78,hash(floor(g)));
          float w=step(.25,f.x)*step(f.x,.75)*step(.3,f.y)*step(f.y,.62); c+=vec3(1.,.8,.5)*on*w*uWin; }
        gl_FragColor=vec4(c,1.); }` });
  // débris en orbite
  const dN = 420, deb = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), spaceMat(0x8a7d6c), dN); const q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), eu = new THREE.Euler();
  for (let i = 0; i < dN; i++) {
    const near = i < 60; const a = rnd(PI * 2), r = near ? rnd(30, 120) : rnd(175, 250);
    if (near) ps.set(rnd(-70, 70), rnd(-30, 40), rnd(-160, -40)); else ps.set(Math.cos(a) * r, rnd(-6, 6) + Math.sin(a * 2) * 4, Math.sin(a) * r);
    const k = near ? rnd(0.08, 0.55) : rnd(0.4, 2.6); sc.set(k * rnd(0.5, 1.6), k * rnd(0.4, 1.2), k * rnd(0.5, 1.8)); eu.set(rnd(6), rnd(6), rnd(6)); q.setFromEuler(eu);
    mt.compose(ps, q, sc); if (!near) { const o = new THREE.Matrix4().makeRotationZ(0.42).setPosition(-150, -100, -330); mt.premultiply(o); } deb.setMatrixAt(i, mt);
  }
  deb.frustumCulled = false; space.add(deb);
  // flotte
  const glowTex = new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(0x9fd0ff).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  function ship(len, withRing) {
    const g = new THREE.Group(), hull = 0x8e959c, dk = 0x4b5158; const b = (w, h, d, x, y, z, col = hull, win = 1.8) => add(g, rbox(w, h, d, Math.min(w, h, d) * 0.12), spaceMat(col, win, [Math.max(2, w * 26 / len), Math.max(1, h * 30 / len)]), x, y, z);
    b(len, len * 0.085, len * 0.11, 0, 0, 0);
    for (let i = 0; i < 9; i++) b(len * rnd(0.05, 0.16), len * rnd(0.05, 0.15), len * rnd(0.08, 0.2), len * rnd(-0.42, 0.4), len * rnd(-0.03, 0.05), len * rnd(-0.03, 0.03), i % 3 ? hull : dk);
    b(len * 0.12, len * 0.06, len * 0.09, len * 0.36, len * 0.07, 0, 0xa7adb3, 2.4);
    for (const s of [-1, 1]) { const pnl = add(g, new THREE.BoxGeometry(len * 0.22, len * 0.004, len * 0.2), spaceMat(0x24364f), -len * 0.12, 0, s * len * 0.17); pnl.rotation.x = s * 0.12; }
    if (withRing) { const r = add(g, new THREE.TorusGeometry(len * 0.17, len * 0.014, 10, 56), spaceMat(hull, 1.6, [60, 2]), len * 0.12, 0, 0); r.rotation.y = PI / 2; g.userData.ring = r;
      for (let i = 0; i < 4; i++) { const s = add(g, new THREE.BoxGeometry(len * 0.006, len * 0.34, len * 0.006), spaceMat(dk), len * 0.12, 0, 0); s.rotation.x = i * PI / 4; } }
    for (const z of [-0.035, 0, 0.035]) { const e = add(g, new THREE.CylinderGeometry(len * 0.016, len * 0.024, len * 0.07, 14), spaceMat(dk), -len * 0.53, 0, len * z); e.rotation.z = PI / 2;
      add(g, new THREE.CircleGeometry(len * 0.02, 14), glow(0xa8d8ff, 5), -len * 0.566, 0, len * z).rotation.y = -PI / 2; }
    const gl = new THREE.Sprite(glowTex); gl.scale.set(len * 0.16, len * 0.09, 1); gl.position.set(-len * 0.6, 0, 0); g.add(gl);
    add(g, new THREE.CylinderGeometry(len * 0.002, len * 0.002, len * 0.16, 4), spaceMat(hull), len * 0.2, len * 0.12, 0);
    return g;
  }
  const fleet = [[70, true, 46, 16, -190, 0.5], [30, false, -22, 12, -120, -0.4], [22, false, 20, -9, -84, 0.9], [46, true, -6, 26, -280, 0.2], [16, false, 44, -4, -140, -0.9], [26, false, -52, 30, -230, 0.6]];
  W.ships = fleet.map(([len, ring, x, y, z, ry]) => { const s = ship(len, ring); s.position.set(x, y, z); s.rotation.y = ry; space.add(s); return s; });
  const shuttle = ship(6, false); space.add(shuttle);
  upd.push((t, dt) => {
    W.ships.forEach((s, i) => { s.position.x += Math.cos(s.rotation.y) * dt * (0.25 + i * 0.05); if (s.userData.ring) s.userData.ring.rotation.x += dt * 0.15; });
    const k = (t * 0.03) % 1; shuttle.position.set(34 - k * 68, 3.2 + Math.sin(k * 6) * 0.6, -30 - k * 6); shuttle.rotation.y = PI + 0.08;
    deb.rotation.y += dt * 0.0006;
  });

  /* ================= DANSE SENSORIELLE (couloir) ================= */
  const ds = new THREE.Group(); ds.position.y = -400; ds.visible = false; scene.add(ds); W.ds = ds; W.DSY = -400;
  const DL = 96;
  add(ds, new THREE.PlaneGeometry(9, DL + 20), new THREE.MeshStandardMaterial({ color: 0x06090c, metalness: 1, roughness: 0.2, transparent: true, opacity: 0.86, envMapIntensity: 0.25 }), 0, 0, -DL / 2 + 6).rotation.x = -PI / 2;
  const SZ = [-14, -32, -50, -68];
  const fN = 33, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), fN * 8); const col = new THREE.Color();
  const FW = 5.4, FH = 3.9; let bi = 0;
  for (let i = 0; i < fN; i++) {
    const z = 4 - i * 3; let c = COL.steel, kk = 0.7; SZ.forEach((s, j) => { if (Math.abs(z - s) < 7.5) { c = works[j].col; kk = 1.25 - Math.abs(z - s) * 0.08; } });
    for (const my of [1, -1]) for (const [x, y, w, h] of [[-FW / 2, FH / 2, 0.02, FH], [FW / 2, FH / 2, 0.02, FH], [0, FH, FW, 0.02], [0, 0.02, FW, 0.02]]) {
      if (my < 0 && y < 0.1) { mt.makeScale(0, 0, 0); } else { mt.makeScale(w, h, 0.02); mt.setPosition(x, y * my, z); }
      bars.setMatrixAt(bi, mt); bars.setColorAt(bi, col.setHex(c).multiplyScalar(my > 0 ? kk * 0.8 : kk * 0.22)); bi++;
    }
  }
  bars.frustumCulled = false; ds.add(bars);
  add(ds, new THREE.BoxGeometry(0.03, 0.01, DL), glow(COL.pale, 1.2), 0, 0.012, -DL / 2 + 6);
  const circ = circuitTex(); circ.repeat.set(5, 1);
  const cm = new THREE.MeshBasicMaterial({ map: circ, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) add(ds, new THREE.PlaneGeometry(DL + 20, 7), cm, s * 5.6, 3.2, -DL / 2 + 6).rotation.y = s * PI / 2;
  const ddN = 700, ddp = new Float32Array(ddN * 3); for (let i = 0; i < ddN; i++) ddp.set([rnd(-5, 5), rnd(0, 5), rnd(-DL, 8)], i * 3);
  const ddg = new THREE.BufferGeometry(); ddg.setAttribute('position', new THREE.BufferAttribute(ddp, 3));
  const dust = new THREE.Points(ddg, new THREE.PointsMaterial({ map: soft, color: 0xb9d6f2, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); ds.add(dust);
  W.dsTime = 1; upd.push((t, dt) => { const a = ddp; for (let i = 1; i < a.length; i += 3) { a[i] += dt * 0.12 * W.dsTime; if (a[i] > 5) a[i] = 0; } ddg.attributes.position.needsUpdate = true; circ.offset.x += dt * 0.004 * W.dsTime; });
  add(ds, new THREE.PlaneGeometry(FW, FH), glow(COL.white, 3.2), 0, FH / 2, -DL + 4); // la porte de sortie
  const dsl = new THREE.PointLight(COL.pale, 10, 30, 2); dsl.position.set(0, 3, 0); ds.add(dsl); W.dsLight = dsl;

  // --- fragments holographiques d'une œuvre (bribes qui se rassemblent) ---
  function shards(tex, color, cols = 9, rows = 7, w = 4.4, h = 3.2) {
    const base = new THREE.PlaneGeometry(w / cols * 0.93, h / rows * 0.93), n = cols * rows;
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const cell = new Float32Array(n * 2), r4 = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { cell.set([i % cols, (i / cols) | 0], i * 2); r4.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r4, 4));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTex: { value: tex }, uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAsm: { value: 0 }, uGain: { value: 1 }, uGrid: { value: new THREE.Vector2(cols, rows) }, uSize: { value: new THREE.Vector2(w, h) } },
      vertexShader: `attribute vec2 aCell;attribute vec4 aRnd;uniform float uTime,uAsm;uniform vec2 uGrid,uSize;varying vec2 vUv;varying float vK;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vUv=(aCell+uv)/uGrid; vec3 home=vec3((aCell+.5)/uGrid-.5,0.)*vec3(uSize,1.);
          float k=smoothstep(0.,1.,clamp(uAsm*1.5-aRnd.w*.5,0.,1.)); vK=k;
          vec3 sc=(aRnd.xyz-.5)*vec3(8.,4.6,7.); sc.y+=sin(uTime*.7+aRnd.w*6.28)*.3; sc.z+=1.5;
          vec3 p=position; float ang=(1.-k)*(aRnd.x*6.28+uTime*(aRnd.y-.5)*1.4); p.xz=rot(ang)*p.xz; p.xy=rot(ang*.6)*p.xy;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(home+sc,home,k)+p,1.); }`,
      fragmentShader: `uniform sampler2D uTex;uniform vec3 uColor;uniform float uTime,uGain;varying vec2 vUv;varying float vK;
        void main(){ vec3 t=texture2D(uTex,vUv).rgb; float l=pow(dot(t,vec3(.3,.59,.11)),.8);
          float scan=.82+.18*sin(vUv.y*520.-uTime*6.); float fl=.94+.06*sin(uTime*31.+vUv.y*9.);
          vec3 c=uColor*(l*1.0+.035)*scan*fl*uGain*mix(.55,1.,vK); gl_FragColor=vec4(c,1.); }` }));
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
  }

  W.stations = works.map((wk, i) => {
    const side = i % 2 ? 1 : -1, z = SZ[i], g = new THREE.Group(); g.position.set(0, 0, z); ds.add(g);
    const tex = loader.load(wk.img); tex.colorSpace = THREE.SRGBColorSpace;
    const art = new THREE.Group(); art.position.set(side * 3.2, 2.05, 0); art.rotation.y = Math.atan2(-side * 3.9, 3.6); g.add(art);
    const sh2 = shards(tex, wk.col); art.add(sh2);
    const lbl = textPlane(['0' + (i + 1) + '  ' + wk.tag, wk.by], { color: '#' + new THREE.Color(wk.col).getHexString(), w: 720, h: 150, size: 46, scale: 2.4 }); lbl.position.set(-1.0, -1.95, 0.05); lbl.material.opacity = 0; art.add(lbl);
    const pl = new THREE.PointLight(wk.col, 0, 12, 2); pl.position.set(side * 1.6, 2.2, 1); g.add(pl);
    const st = { i, z, side, g, art, u: sh2.material.uniforms, lbl, light: pl, k: 0,
      stop: { pos: new THREE.Vector3(-side * 0.7, 1.7 + W.DSY, z + 3.7), look: new THREE.Vector3(side * 3.2, 2.0 + W.DSY, z) } };
    return st;
  });
  const S = W.stations;

  // 01 Kinesthésie — plumes en suspension, puis qui tombent
  { const n = 110, base = new THREE.PlaneGeometry(0.12, 0.38), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.instanceCount = n;
    const p = new Float32Array(n * 3), r = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p.set([rnd(-3.4, 3.4), rnd(0.2, 4), rnd(-4, 5)], i * 3); r.set([Math.random(), Math.random(), Math.random()], i * 3); }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(r, 3));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(works[0].col) }, uA: { value: 0 } },
      vertexShader: `attribute vec3 aPos;attribute vec3 aRnd;uniform float uT;varying vec2 vUv;varying float vR;
        mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
        void main(){ vUv=uv; vR=aRnd.z; vec3 p=position; float sw=sin(uT*1.1+aRnd.y*6.28);
          p.xy=rot(aRnd.x*6.28+sw*.7*min(uT,1.))*p.xy; p.xz=rot(aRnd.y*6.28+uT*(aRnd.z-.5))*p.xz;
          vec3 o=aPos; o.y=mod(aPos.y-uT*(.22+aRnd.z*.3),4.)+.15; o.x+=sw*.45*min(uT*.5,1.);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(o+p,1.); }`,
      fragmentShader: `uniform vec3 uColor;uniform float uA;varying vec2 vUv;varying float vR;
        void main(){ vec2 q=vUv*2.-1.; float w=(1.-q.y*q.y)*.5*(.72+.28*q.y); float ins=smoothstep(w,w-.1,abs(q.x));
          float barbs=.5+.5*sin(q.y*30.+abs(q.x)*44.); float rach=smoothstep(.07,0.,abs(q.x))*step(-.96,q.y);
          float a=ins*(.3+.45*barbs)+rach*.7; gl_FragColor=vec4(uColor*a*uA*(.25+vR*.45),1.); }` });
    const f = new THREE.Mesh(g, m); f.frustumCulled = false; S[0].g.add(f); S[0].fx = { u: m.uniforms, on: false };
    upd.push((t, dt) => { m.uniforms.uA.value += ((S[0].k > 0 ? 1 : 0) - m.uniforms.uA.value) * 0.04; if (S[0].fx.on) m.uniforms.uT.value += dt * W.dsTime; }); }

  // 02 Toucher haptique virtuel — un grillage qui réagit au regard
  { const pts = [], NX = 52, NY = 34, w = 4.6, h = 3.3;
    for (let j = 0; j <= NY; j += 2) for (let i = 0; i < NX; i++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, (i + 1) / NX * w - w / 2, j / NY * h - h / 2, 0);
    for (let i = 0; i <= NX; i += 2) for (let j = 0; j < NY; j++) pts.push(i / NX * w - w / 2, j / NY * h - h / 2, 0, i / NX * w - w / 2, (j + 1) / NY * h - h / 2, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = U(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uHit: { value: new THREE.Vector2(0, 0) }, uAmp: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color(works[1].col) } },
      vertexShader: `uniform float uTime,uAmp;uniform vec2 uHit;varying float vD;
        void main(){ vec3 p=position; float d=distance(p.xy,uHit); vD=d;
          p.z+=(exp(-d*d*2.2)*.55+sin(d*8.-uTime*5.)*exp(-d*1.3)*.16)*uAmp; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: 'uniform vec3 uColor;uniform float uA,uAmp;varying float vD;void main(){float h=exp(-vD*vD*1.6)*uAmp;gl_FragColor=vec4(uColor*(.5+h*2.6)*uA,1.);}' }));
    const mesh = new THREE.LineSegments(g, m); mesh.position.z = 0.35; S[1].art.add(mesh);
    const hitPlane = add(S[1].art, new THREE.PlaneGeometry(w * 1.6, h * 1.6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0.35);
    S[1].fx = { u: m.uniforms, on: false, hitPlane, mesh };
    upd.push(() => { m.uniforms.uA.value += ((S[1].k > 0 ? 1 : 0) - m.uniforms.uA.value) * 0.04; m.uniforms.uAmp.value += ((S[1].fx.on ? 1 : 0) - m.uniforms.uAmp.value) * 0.05; }); }

  // 03 Proprioception — des troncs qui te dominent
  { const grp = new THREE.Group(); S[2].g.add(grp); const trunks = [];
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(works[2].col).multiplyScalar(0.34), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), core = glow(works[2].col, 1.5);
    for (let i = 0; i < 16; i++) { const a = rnd(PI * 2), r = rnd(1.9, 7), rad = rnd(0.12, 0.42), x = -S[2].side * 0.7 + Math.cos(a) * r, z = 3.7 + Math.sin(a) * r;
      if (Math.abs(x - S[2].side * 1.4) < 1.6 && z < 3 && z > -0.5) continue;
      const t = new THREE.Group(); add(t, new THREE.CylinderGeometry(rad * 0.8, rad, 18, 10, 1, true), tm, 0, 9, 0); add(t, new THREE.CylinderGeometry(0.012, 0.012, 18, 4), core, 0, 9, 0);
      t.position.set(x, 0, z); t.scale.y = 0.0001; t.userData.d = rnd(0, 1.2); grp.add(t); trunks.push(t); }
    S[2].fx = { on: false, t: 0 };
    upd.push((tt, dt) => { if (S[2].fx.on) S[2].fx.t += dt; for (const t of trunks) { const k = Math.min(1, Math.max(0, (S[2].fx.t - t.userData.d) / 2.4)); t.scale.y = Math.max(0.0001, 1 - Math.pow(1 - k, 3)); } }); }

  // 04 Intéroception — le pouls, les bocaux, le temps qui se dilate
  { const grp = new THREE.Group(); S[3].art.add(grp); const rings = [];
    for (let i = 0; i < 4; i++) { const r = add(grp, new THREE.TorusGeometry(1, 0.012, 6, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color(works[3].col).multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0.3); rings.push(r); }
    const jm = new THREE.MeshBasicMaterial({ color: new THREE.Color(works[3].col).multiplyScalar(0.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
    for (let i = 0; i < 7; i++) { const j = add(grp, new THREE.CylinderGeometry(0.11, 0.11, 0.24, 14, 2, true), jm, -1.5 + i * 0.5, -1.9, 0.5); add(grp, new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14), glow(works[3].col, 1.2), -1.5 + i * 0.5, -1.76, 0.5); j.userData = {}; }
    S[3].fx = { on: false, beat: 0, pulse: 0 };
    upd.push((t, dt) => { const fx = S[3].fx; fx.pulse *= 0.93; rings.forEach((r, i) => { const ph = ((fx.beat + i / 4) % 1); const s = 0.3 + ph * 2.6; r.scale.set(s, s, 1); r.material.opacity = fx.on ? (1 - ph) * 0.7 : 0; }); if (fx.on) fx.beat += dt * 0.36 * W.dsTime; }); }

  upd.push((t) => { for (const st of S) { st.u.uAsm.value += (st.k - st.u.uAsm.value) * 0.025; st.lbl.material.opacity += ((st.k > 0.5 ? 0.95 : 0) - st.lbl.material.opacity) * 0.04; st.light.intensity += ((st.k > 0 ? 14 : 0) - st.light.intensity) * 0.04; } });

  W.update = (t, dt) => { for (const u of W.timeU) u.value = t; for (const f of upd) f(t, dt); };
  W.setScene = (name) => { const d = name === 'ds'; bay.visible = !d; space.visible = !d; ds.visible = d; };
  return W;
}
