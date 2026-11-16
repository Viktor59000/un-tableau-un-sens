// SPES — moteur, mise en scène narrative, HUD, voix, son.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, COL } from './world.js';
import { LANG, T as UI, WTX, LOG, TX, SPEECH, DEC, QUO, localizeDom } from './i18n.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
// paramètres de test : ?act=2|3 ?st=0..3 ?auto ?quick ?lite ?hold=<point> ?lang=fr|en|es ?msaa=0 (voir REPRISE.md)
const ACT = +Q.get('act') || 1, ST0 = +Q.get('st') || 0, AUTO = Q.has('auto'), QUICK = Q.has('quick'), LITE = Q.has('lite'), HOLD = Q.get('hold');
const NOAO = Q.has('noao'), NOSH = Q.has('nosh');
const dbg = (n) => (HOLD === n ? new Promise(() => {}) : Promise.resolve());
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer:coarse)').matches || Q.has('touch');
if (touch) document.body.classList.add('touch');
const V3 = THREE.Vector3, PI = Math.PI, sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// Les quatre artefacts du lot 42-SE, reconstitués à taille réelle (dimensions en mètres). Les textes traduits viennent de i18n.js.
// ck/base : seuils de saturation de la matérialisation ; bg : luminance du fond à effacer ; cell : taille d'un fragment ; cy : hauteur du centre ; dist : recul du visiteur.
const WORKS = [
  { id: 's1', col: COL.amber, css: '#fca311', img: 'assets/works/ouie.jpg', title: 'Plume sur Rhodoïde', artist: 'Louis Cane, 1998', w: 0.975, h: 0.975, ar: 653 / 558, mode: 0, ck: [0.17, 0.4], base: 0.03, bg: 0.47, cell: 0.012, cy: 1.5, dist: 1.9 },
  { id: 's2', col: COL.cyan, css: '#7fe3e6', img: 'assets/works/toucher.jpg', title: 'Résine sur grillage', artist: 'Louis Cane, 2018', w: 1.41, h: 1.41, ar: 587 / 552, mode: 0, relief: 1, ck: [0.03, 0.2], base: 0.3, cell: 0.016, cy: 1.55, dist: 2.5 },
  { id: 's3', col: COL.lime, css: '#a8e61d', img: 'assets/works/odorat.jpg', title: 'Arpenter ⅔', artist: 'Aurélie Pétrel, 2025', w: 1.0, h: 1.92, ar: 300 / 764, mode: 1, cell: 0.013, cy: 1.3, dist: 2.9 },
  { id: 's4', col: COL.coral, css: '#ff4f38', img: 'assets/works/gout.jpg', title: 'n°60', artist: 'Philippe Favier, 2025', w: 0.44, h: 0.35, ar: 682 / 460, mode: 2, cell: 0.0055, cy: 1.5, dist: 1.15 }
];
WORKS.forEach((w, i) => Object.assign(w, WTX[i])); // sense, canal, verb, tech, dw, dh, def, cns dans la langue choisie

/* ============================== SON ============================== */
const A = { ctx: null, out: null, on: true };
function audioInit() { if (A.ctx) return; try {
  const c = A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.out = c.createGain(); A.out.gain.value = 0.5; A.out.connect(c.destination);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const dg = c.createGain(); dg.gain.value = 0.0001; lp.connect(dg); dg.connect(A.out);
  [46, 46.4, 69.2].forEach((f) => { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(lp); o.start(); });
  const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; A.noise = nb;
  const n = c.createBufferSource(); n.buffer = nb; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5; const ng = c.createGain(); ng.gain.value = 0.03; n.connect(bp); bp.connect(ng); ng.connect(dg); n.start();
  dg.gain.setTargetAtTime(0.9, c.currentTime, 2);
  // chaîne de la voix de Gladys : léger filtre « liaison radio », écho court, analyseur pour la bouche du portrait
  A.vIn = c.createGain(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170; const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 3;
  A.vOut = c.createGain(); A.vOut.gain.value = 1; A.vAna = c.createAnalyser(); A.vAna.fftSize = 512; A.vBuf = new Uint8Array(512);
  const dl = c.createDelay(0.5); dl.delayTime.value = 0.105; const fb = c.createGain(); fb.gain.value = 0.22; const wet = c.createGain(); wet.gain.value = 0.2;
  A.vIn.connect(hp); hp.connect(pk); pk.connect(A.vAna); pk.connect(A.vOut); pk.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(A.vOut); A.vOut.connect(c.destination);
} catch (e) { A.ctx = null; } }
const env = (g, t, a, peak, r) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); };
const sfx = {
  tone(f, dur = 0.12, vol = 0.12, type = 'sine', when = 0) { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.connect(g); g.connect(A.out); const t = c.currentTime + when; env(g, t, 0.008, vol, dur); o.start(t); o.stop(t + dur + 0.1); },
  blip() { this.tone(880, 0.08, 0.1, 'triangle'); this.tone(1320, 0.1, 0.07, 'triangle', 0.06); },
  noise(dur, freq, q, vol, to = 0.35) { if (!A.ctx) return; const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(A.out); const t = c.currentTime; env(g, t, 0.05, vol, dur); f.frequency.exponentialRampToValueAtTime(freq * to, t + dur); s.start(t); s.stop(t + dur + 0.2); },
  hiss() { this.noise(2.4, 5200, 0.7, 0.3); },
  servo(dur) { this.noise(dur, 700, 6, 0.22, 1.6); this.tone(92, dur, 0.06, 'sawtooth'); },
  clack() { this.tone(160, 0.07, 0.5, 'square'); this.tone(2400, 0.04, 0.12, 'square', 0.02); this.noise(0.14, 3200, 1, 0.35); },
  thump() { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(74, c.currentTime); o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.22); o.connect(g); g.connect(A.out); env(g, c.currentTime, 0.01, 0.9, 0.3); o.start(); o.stop(c.currentTime + 0.4); },
  glitch(dur = 2) { if (!A.ctx) return; for (let i = 0; i < dur * 14; i++) this.tone(120 + Math.random() * 3000, 0.03 + Math.random() * 0.05, 0.05, 'square', Math.random() * dur); this.noise(dur, 1800, 0.4, 0.2); },
  type() { this.tone(1500 + Math.random() * 500, 0.02, 0.025, 'square'); },
  ring() { let alive = true; const go = () => { if (!alive) return; this.tone(660, 0.16, 0.12, 'sine'); this.tone(990, 0.16, 0.1, 'sine'); this.tone(660, 0.16, 0.12, 'sine', 0.24); this.tone(990, 0.16, 0.1, 'sine', 0.24); setTimeout(go, 1500); }; go(); return () => { alive = false; }; }
};

/* ============================== VOIX ============================== */
// Répliques pré-enregistrées (assets/voice/<langue>) ; à défaut, synthèse du navigateur ; à défaut, sous-titres minutés.
let LINES = {}; const VB = {}, VFAIL = {};
const synth = window.speechSynthesis || null; let voice = null, voiceOn = true, talking = false, skipLine = null;
function pickVoice() { if (!synth) return; const v = synth.getVoices() || [], re = new RegExp('^' + LANG, 'i'); voice = v.find((x) => re.test(x.lang) && /natural|neural|google|denise|vivienne|sonia|elvira/i.test(x.name)) || v.find((x) => re.test(x.lang)) || null; }
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
function loadVoices() { if (!A.ctx) return; for (const id of Object.keys(LINES)) fetch('assets/voice/' + LANG + '/' + id + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => A.ctx.decodeAudioData(b)).then((buf) => { VB[id] = buf; }).catch(() => { VFAIL[id] = 1; }); }
const subEl = $('#sub'), subT = $('#subT');
async function say(id) {
  const L = LINES[id] || { t: id }, text = L.t; subT.textContent = text; subEl.classList.add('on'); talking = true;
  if (!QUICK && voiceOn && A.ctx && !VB[id] && !VFAIL[id]) for (let i = 0; i < 20 && !VB[id] && !VFAIL[id]; i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((res) => {
    const t0 = performance.now(), est = QUICK ? 300 : (L.d ? L.d * 1000 + 250 : Math.max(1900, text.length * 66)); let done = false, to, src = null;
    const fin = () => { if (done) return; done = true; clearTimeout(to); if (src) { src.onended = null; try { src.stop(); } catch (e) { /* déjà arrêtée */ } } talking = false; skipLine = null; setTimeout(() => { if (!talking) subEl.classList.remove('on'); res(); }, QUICK ? 40 : 420); };
    if (!QUICK && voiceOn && A.ctx && VB[id]) { if (A.ctx.state === 'suspended') A.ctx.resume(); src = A.ctx.createBufferSource(); src.buffer = VB[id]; src.connect(A.vIn); src.onended = fin; src.start(); to = setTimeout(fin, est + 1500); }
    else if (!QUICK && voiceOn && synth) { to = setTimeout(fin, est * 1.6 + 2500); try { if (synth.speaking || synth.pending) synth.cancel(); const u = new SpeechSynthesisUtterance(L.say || text); u.lang = SPEECH; if (voice) u.voice = voice; u.rate = 1.02; u.pitch = 0.92; window.__utt = u;
      u.onend = () => { const left = est * 0.4 - (performance.now() - t0); if (left > 0) { clearTimeout(to); to = setTimeout(fin, left); } else fin(); }; u.onerror = () => { clearTimeout(to); to = setTimeout(fin, Math.max(200, est - (performance.now() - t0))); }; setTimeout(() => synth.speak(u), 70); } catch (e) { /* minuterie de secours */ } }
    else to = setTimeout(fin, est);
    skipLine = () => { if (synth) synth.cancel(); fin(); };
  });
}

/* ============================== HUD ============================== */
const hud = $('#hud'), promptEl = $('#prompt'), promptT = $('#promptT'), callEl = $('#call'), callS = $('#callS'), callT = $('#callT'), choEl = $('#choices');
let pending = null, callStart = 0, pick = null;
function ask(label) { return new Promise((res) => { promptT.textContent = label; promptEl.classList.add('on'); pending = () => { pending = null; promptEl.classList.remove('on'); sfx.blip(); res(); }; if (AUTO && HOLD !== 'ask:' + label) setTimeout(() => pending && pending(), QUICK ? 150 : 900); }); }
function choose(opts) { return new Promise((res) => { choEl.innerHTML = ''; opts.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<kbd>' + (i + 1) + '</kbd><span></span>'; b.lastChild.textContent = o; b.addEventListener('click', () => pick && pick(i)); choEl.appendChild(b); });
  choEl.classList.add('on'); pick = (i) => { if (i >= opts.length) return; pick = null; choEl.classList.remove('on'); sfx.blip(); res(i); }; if (AUTO) setTimeout(() => pick && pick(+Q.get('c') || 0), QUICK ? 150 : 1200); }); }
function quest(title, obj) { $('#qT').textContent = title; const o = $('#qO'); o.classList.remove('in'); void o.offsetWidth; o.textContent = obj; o.classList.add('in'); }
function card(n, t) { $('#cardN').textContent = n; $('#cardT').textContent = t; const c = $('#card'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
function callState(s) { callEl.dataset.s = s; callEl.classList.toggle('on', s !== 'off'); callS.textContent = s === 'ring' ? UI.ring : UI.live; if (s === 'live') callStart = performance.now(); }
function scan(i) { const w = WORKS[i], el = $('#scan'); el.style.setProperty('--sig', w.css); $('#scN').textContent = 'CB-0' + (i + 1) + ' · ' + UI.lot; $('#scS').textContent = w.sense; $('#scBy').textContent = w.title + ' — ' + w.artist; $('#scDef').textContent = w.def; $('#scC').textContent = QUO[0] + w.cns + QUO[1]; el.classList.add('on'); }
function mark(i) { W.stations[i].done = true; const li = document.querySelector('#qL li[data-i="' + i + '"]'); if (li) li.classList.add('done'); sfx.tone(523, 0.12, 0.1, 'triangle'); sfx.tone(784, 0.2, 0.1, 'triangle', 0.1); }
const vit = { bpm: 8, tmp: 4, loc: '' };
function vitals() { $('#bpm').textContent = Math.round(vit.bpm); $('#tmp').textContent = vit.tmp.toFixed(1).replace('.', DEC); $('#loc').textContent = vit.loc; }

// portrait de Gladys : visage en lignes de contour (relevé holographique), bouche pilotée par le signal de la voix
const fcv = $('#face'), fc = fcv.getContext('2d'); let mouth = 0;
function headZ(u, v, open) {
  if (v > 0.98) return (Math.abs(u) < 0.3 && v < 1.14) ? 0.34 * Math.sqrt(Math.max(0, 1 - (u / 0.3) ** 2)) : 0;
  const rx = v < 0.1 ? 0.74 : 0.74 - (v - 0.1) * 0.36, r2 = (u / rx) ** 2 + v * v; if (r2 >= 1) return 0;
  const G = (cx, cy, sx, sy) => Math.exp(-(((u - cx) / sx) ** 2) - (((v - cy) / sy) ** 2));
  let z = Math.sqrt(1 - r2) * 0.9;
  z += 0.3 * G(0, 0.1, 0.085, 0.2) + 0.12 * G(0, 0.2, 0.13, 0.06);
  z -= 0.17 * (G(-0.3, -0.12, 0.15, 0.08) + G(0.3, -0.12, 0.15, 0.08));
  z += 0.06 * (G(-0.3, -0.27, 0.2, 0.05) + G(0.3, -0.27, 0.2, 0.05)) + 0.07 * (G(-0.42, 0.12, 0.16, 0.14) + G(0.42, 0.12, 0.16, 0.14));
  z += 0.09 * G(0, 0.43 - open * 0.03, 0.2, 0.035) + 0.09 * G(0, 0.56 + open * 0.06, 0.17, 0.04);
  z -= (0.05 + open * 0.22) * G(0, 0.495, 0.15, 0.03 + open * 0.035);
  return z + 0.08 * G(0, 0.8, 0.2, 0.1);
}
function drawFace(t) {
  const w = fcv.width, h = fcv.height, ring = callEl.dataset.s === 'ring'; fc.clearRect(0, 0, w, h);
  const yaw = Math.sin(t * 0.55) * 0.24, tilt = 0.44, cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), stl = Math.sin(tilt);
  fc.lineWidth = 1.6;
  for (let j = 0; j < 48; j++) {
    const v = -1.08 + j * (2.24 / 47); let pen = false; fc.beginPath();
    const jit = ring ? (Math.random() - 0.5) * 6 * (Math.random() < 0.15 ? 1 : 0) : 0;
    for (let i = 0; i <= 60; i++) { const u = -1 + i / 30, z = headZ(u, v, mouth); if (z <= 0) { pen = false; continue; }
      const px = w / 2 + (u * cy + z * sy * 0.7) * 96 + jit, py = h * 0.5 + (v * ct - z * stl * 0.55) * 104; if (pen) fc.lineTo(px, py); else { fc.moveTo(px, py); pen = true; } }
    fc.strokeStyle = ring ? 'rgba(255,79,56,' + (0.25 + 0.3 * Math.abs(Math.sin(t * 6 + j))) + ')' : 'rgba(127,227,230,' + (j % 3 ? 0.42 : 0.85) + ')'; fc.stroke();
  }
  if (!ring && (t % 4.3) > 0.13) { fc.fillStyle = 'rgba(241,242,244,.95)'; for (const ex of [-0.3, 0.3]) { const z = headZ(ex, -0.12, 0); fc.fillRect(w / 2 + (ex * cy + z * sy * 0.7) * 96 - 7, h * 0.5 + (-0.12 * ct - z * stl * 0.55) * 104 - 1, 14, 3); } }
}

/* ============================== MOTEUR ============================== */
let renderer, composer, bloom, gtao, fx, scene, camera, W, running = false, T = 0, frameN = 0;
const clock = new THREE.Clock();
const S = { pos: new V3(), yaw: 0, pitch: 0, roll: 0, fov: 60, mx: 0, my: 0, lx: 0, ly: 0, free: 1, walk: 0, sway: 0 };
const FX = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAb: { value: 0.0018 }, uFade: { value: 0 }, uWhite: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uGlitch,uAb,uFade,uWhite;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){ vec2 uv=vUv; float g=uGlitch;
      if(g>.001){ float band=floor(uv.y*mix(14.,56.,h(vec2(floor(uTime*13.),1.)))); float r=h(vec2(band,floor(uTime*21.)));
        uv.x+=(r-.5)*.3*g*step(.6,r); uv.y+=(h(vec2(floor(uTime*9.),band))-.5)*.03*g; }
      vec2 d=uv-.5; float ab=uAb*(.4+dot(d,d)*3.)+g*.03;
      vec3 c=vec3(texture2D(tDiffuse,uv+d*ab).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-d*ab).b);
      if(g>.15){ float b=h(floor(uv*vec2(26.,15.))+floor(uTime*17.)); if(b>1.-g*.16) c=c.gbr*1.7+vec3(.02,.0,.03); }
      c*=1.-dot(d,d)*.95; c+=(h(uv*vec2(1731.,977.)+uTime*61.)-.5)*.022;
      c=mix(c*uFade,vec3(2.2),uWhite); gl_FragColor=vec4(c,1.); }` };
// qualité adaptative : si l'appareil peine, on baisse la résolution puis on coupe le bloom (les images d'un onglet en arrière-plan ne comptent pas)
const QL = { dpr: 1, lvl: touch ? 1 : 0, n: 0, acc: 0, warm: 2 }, MSAA = LITE || touch ? 0 : (Q.has('msaa') ? +Q.get('msaa') : 4); // anticrénelage : indispensable aux filets fins de la galerie
function adapt(raw) { if (LITE || Q.has('noadapt') || QL.lvl > 5 || raw > 0.4 || document.hidden) return; QL.acc += raw; if (++QL.n < 50) return; const avg = QL.acc / QL.n; QL.n = 0; QL.acc = 0;
  if (QL.warm-- > 0 || avg < 0.0215) return; // on vise ~50 images/s ; les premières mesures (compilation des shaders) sont ignorées
  QL.lvl++; // ordre des sacrifices : occlusion ambiante, résolution (deux crans), ombres, anticrénelage, bloom
  if (QL.lvl === 5 && msRT) { msRT.dispose(); msRT = null; }
  if (QL.lvl === 2 || QL.lvl === 3) { const d = Math.max(0.6, QL.dpr * (QL.lvl === 2 ? 0.85 : 0.7)); renderer.setPixelRatio(d); composer.setPixelRatio(d); msSize(); }
  if (QL.lvl === 4) for (const l of W.shadowLights) l.castShadow = false; if (QL.lvl === 6) bloom.enabled = false; }
// La scène est rendue dans une cible multi-échantillonnée, résolue UNE fois, puis recopiée dans la chaîne de post-traitement :
// donner des échantillons aux tampons du composer coûtait une résolution par passe (≈ +17 ms par image sur carte intégrée).
let msRT = null; const msSize = () => { if (msRT) { const r = renderer.getPixelRatio(); msRT.setSize(Math.floor(innerWidth * r), Math.floor(innerHeight * r)); } };
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
  const dpr = LITE ? 0.5 : Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.25); QL.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = !LITE && !NOSH; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.localClippingEnabled = true;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020306); scene.fog = new THREE.FogExp2(0x0a1016, 0.034);
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1600);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  W = buildWorld(scene, new THREE.TextureLoader(), WORKS, TX); window.__spes = { renderer, QL, scene, W, S };
  composer = new EffectComposer(renderer); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); const rp = new RenderPass(scene, camera); composer.addPass(rp);
  if (MSAA) { msRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MSAA }); msSize(); const base = rp.render.bind(rp), quad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null } }, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=vec4(clamp(texture2D(tDiffuse,vUv).rgb,0.,24.),1.);}' })); // la recopie borne aussi les pics de reflet avant le bloom
    rp.render = (r, wb, rb, d, mk) => { if (!msRT) return base(r, wb, rb, d, mk); base(r, wb, msRT, d, mk); quad.material.uniforms.tDiffuse.value = msRT.texture; r.setRenderTarget(rb); quad.render(r); }; }
  // occlusion ambiante (demi-résolution) : ancre les objets au sol ; les objets transparents/lumineux n'y participent pas
  gtao = new GTAOPass(scene, camera, 256, 256); const gs = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => gs(Math.ceil(w * 0.5), Math.ceil(h * 0.5));
  gtao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.4, thickness: 1.3, scale: 1.25, samples: 8 }); gtao.blendIntensity = 0.95;
  gtao.overrideVisibility = function () { const c = this._visibilityCache; this.scene.traverse((o) => { c.set(o, o.visible); if (o.isPoints || o.isLine || o.isSprite || (o.isMesh && o.material && (o.material.transparent || o.material.isMeshBasicMaterial))) o.visible = false; }); };
  gtao.enabled = !LITE; composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.92); bloom.enabled = !LITE; composer.addPass(bloom);
  fx = new ShaderPass(FX); composer.addPass(fx); composer.addPass(new OutputPass()); Object.assign(window.__spes, { composer, bloom, gtao, camera });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); msSize(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}
const tweens = [];
const io = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2), lin = (k) => k, out = (k) => 1 - Math.pow(1 - k, 3);
function tween(dur, fn, ease = io) { if (QUICK) dur *= 0.12; return new Promise((res) => { tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, ease, res }); }); }
const wait = (s) => tween(s, () => {}, lin);
function aim(from, to) { const d = new V3().subVectors(to, from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; }
function camTo(o, dur = 2, ease = io) {
  const p0 = S.pos.clone(), p1 = o.pos || p0.clone(); let y1 = S.yaw, q1 = S.pitch; if (o.look) { const a = aim(p1, o.look); y1 = a.yaw; q1 = a.pitch; }
  if (o.yaw != null) y1 = o.yaw; if (o.pitch != null) q1 = o.pitch;
  const y0 = S.yaw, dy = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)), q0 = S.pitch, f0 = S.fov, f1 = o.fov || f0;
  return tween(dur, (k) => { S.pos.lerpVectors(p0, p1, k); S.yaw = y0 + dy * k; S.pitch = q0 + (q1 - q0) * k; S.fov = f0 + (f1 - f0) * k; }, ease);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitL = new V3(), hit2 = new THREE.Vector2();
let heart = null;
function frame() {
  if (!running) return; requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1), tdt = Math.min(raw, 0.6); T += dt; adapt(raw);
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += tdt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
  if (touch && !drag) { S.mx *= 0.97; S.my *= 0.97; } S.lx += (S.mx - S.lx) * 0.06; S.ly += (S.my - S.ly) * 0.06;
  camera.position.copy(S.pos); camera.position.y += (S.walk ? Math.sin(T * 7.4) * 0.034 * S.walk : 0) + Math.sin(T * 0.9) * 0.006;
  camera.rotation.set(S.pitch - S.ly * 0.24 * S.free, S.yaw - S.lx * 0.42 * S.free, S.roll + Math.sin(T * 0.7) * S.sway + (S.walk ? Math.sin(T * 3.7) * 0.006 : 0), 'YXZ');
  const asp = camera.aspect, vf = asp >= 1.15 ? S.fov : Math.min(104, 2 * Math.atan(Math.tan(S.fov * 0.95 * PI / 360) / Math.max(0.4, asp * 0.98)) * 180 / PI);
  if (Math.abs(camera.fov - vf) > 0.01) { camera.fov = vf; camera.updateProjectionMatrix(); }
  // station 2 : la matière se soulève là où porte le regard
  const s1 = W.stations[1]; if (s1.fx.on) { if (gaze.x > 2) ndc.set(Math.sin(T * 0.7) * 0.2, Math.cos(T * 0.9) * 0.16); else ndc.copy(gaze);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(s1.fx.hitPlane)[0]; if (hit) { hitL.copy(hit.point); s1.fx.mesh.worldToLocal(hitL); s1.u.uHit.value.lerp(hit2.set(hitL.x, hitL.y), 0.18); } }
  // station 4 : le pouls
  if (heart) { heart.t -= dt; if (heart.t <= 0) { heart.gap = Math.min(1.35, heart.gap + 0.07); heart.t = heart.gap; sfx.thump(); W.stations[3].fx.pulse = 1; vit.bpm = 60 / heart.gap; vitals(); } }
  bloom.strength = 0.5 + W.stations[3].fx.pulse * 0.7;
  // bouche du portrait : amplitude réelle de la voix quand elle joue, sinon mouvement générique
  let m = 0; if (talking) { if (A.vAna) { A.vAna.getByteTimeDomainData(A.vBuf); let s = 0; for (let i = 0; i < 512; i += 4) { const x = (A.vBuf[i] - 128) / 128; s += x * x; } m = Math.min(1, Math.sqrt(s / 128) * 5.5); }
    if (m < 0.02 && (!A.ctx || QUICK || !voiceOn)) m = Math.abs(Math.sin(T * 21) * Math.sin(T * 6.7)) * 0.8; }
  mouth += (m - mouth) * 0.4;
  if (callEl.classList.contains('on')) { drawFace(T); if (callEl.dataset.s === 'live') { const s = ((performance.now() - callStart) / 1000) | 0; callT.textContent = String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); } }
  frameN++; if (W.bay.visible) { const kz = Math.max(-10.5, Math.min(12, S.pos.z - 0.6)); W.keyLight.position.z = kz; W.keyLight.target.position.z = kz; if (frameN % 2 === 0) W.keyLight.shadow.needsUpdate = true; } // le projecteur principal suit le visiteur ; son ombre est recalculée une image sur deux
  gtao.enabled = !LITE && !NOAO && QL.lvl < 1 && W.bay.visible; if (gtao.enabled) { gtao.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix); gtao.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); gtao.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); }
  W.update(T, dt, camera.position); fx.uniforms.uTime.value = T; composer.render();
}

/* ============================== RÉCIT ============================== */
const DSY = -400, P1 = UI.proto + ' · 1/3', P2 = UI.proto + ' · 2/3', P3 = UI.proto + ' · 3/3';
async function prologue() {
  if (QUICK) return; const el = $('#prologue'), h = $('#proH'), p = $('#proT'); el.classList.add('on');
  for (const [head, text] of LOG) {
    h.textContent = head; p.textContent = ''; let skip = false; skipLine = () => { skip = true; };
    for (let i = 0; i <= text.length && !skip; i++) { p.textContent = text.slice(0, i); if (i % 3 === 0) sfx.type(); await new Promise((r) => setTimeout(r, 26)); }
    p.textContent = text; for (let i = 0; i < 24 && !skip; i++) await new Promise((r) => setTimeout(r, 100));
  }
  skipLine = null; el.classList.remove('on'); await new Promise((r) => setTimeout(r, 900));
}
async function act1() {
  W.setScene('ship'); S.pos.set(-4.32, 0.94, 1.3); S.yaw = -PI / 2; S.pitch = 1.28; S.free = 0.22; S.fov = 66; vit.loc = UI.loc[0]; vitals();
  quest(P1, UI.q.thaw); card('01', UI.card[0]);
  tween(3, (k) => { fx.uniforms.uFade.value = k; });
  tween(9, (k) => { W.frost.value = k * 0.5; vit.tmp = 4 + k * 22; vit.bpm = 8 + k * 60; vitals(); }, lin);
  await wait(4.2);
  callState('ring'); const stop = sfx.ring(); quest(P1, UI.q.call); await ask(UI.a.answer); stop(); callState('live');
  await say('g01');
  tween(5, (k) => { W.frost.value = 0.5 + k * 0.5; vit.tmp = 26 + k * 10.8; vit.bpm = 68 + k * 24; vitals(); }, lin);
  quest(P1, UI.q.askG); const c = await choose(UI.ch1); await say(c ? 'g02b' : 'g02a');
  await say('g03');
  quest(P1, UI.q.exit); await ask(UI.a.exit);
  sfx.hiss(); W.wakeHold = false; tween(3, (k) => { W.frost.value = 1 + k * 0.4; }); W.guideMat.color.setHex(COL.safran).multiplyScalar(1.5);
  tween(8, (k) => { W.beacon.intensity = 26 * Math.abs(Math.sin(k * 14)) * (1 - k * k); }, lin);
  await tween(2.6, (k) => { W.lidPivot.rotation.x = -k * 1.9; }, out); quest(P1, UI.q.sit);
  await camTo({ pos: new V3(-4.0, 1.3, 1.3), yaw: -PI / 2, pitch: -0.04, fov: 60 }, 3); S.free = 1; await dbg('sit');
  quest(P1, UI.q.look); const l1 = say('g04');
  await camTo({ pos: new V3(-2.9, 1.66, 2.3), look: new V3(-4.2, 0.95, 3.9) }, 3.2); await camTo({ pos: new V3(-3.72, 1.58, 2.86), look: new V3(-4.36, 0.86, 3.9), fov: 50 }, 3.4); await dbg('voisin'); await wait(2.2);
  await camTo({ pos: new V3(-1.3, 1.68, 1.9), yaw: -PI / 2 + 0.4, pitch: 0.04, fov: 60 }, 3); await l1; await dbg('stand');
  quest(P1, UI.q.obs); await ask(UI.a.walk); vit.loc = UI.loc[1]; vitals();
  S.walk = 1; await camTo({ pos: new V3(0, 1.68, 0.6), look: new V3(0, 2.2, -15) }, 2.6); await dbg('aisle');
  const l2 = say('g05');
  await camTo({ pos: new V3(0, 1.68, -10.6), look: new V3(-0.4, 2.3, -15) }, 10.5, lin); S.walk = 0; await l2;
}
async function visorBoot() {
  const v = $('#visor'), rows = UI.visor, ul = $('#vRows'); ul.innerHTML = '';
  sfx.glitch(3.2);
  await tween(3.4, (k) => { $('#vPct').textContent = String(Math.round(k * 100)).padStart(3, '0'); $('#vBar').style.transform = 'scaleX(' + k + ')'; const n = Math.min(rows.length, Math.floor(k * (rows.length + 0.6)));
    while (ul.children.length < n) { const li = document.createElement('li'); li.textContent = rows[ul.children.length]; ul.appendChild(li); sfx.blip(); } fx.uniforms.uGlitch.value = k * k; v.style.setProperty('--g', k); }, lin);
}
async function act2() {
  W.lidPivot.rotation.x = -1.9; W.frost.value = 1.4; W.wakeHold = false; vit.bpm = 92; vit.tmp = 36.8; vit.loc = UI.loc[2]; vitals(); callState('live');
  card('02', UI.card[1]); quest(P2, UI.q.earth);
  await dbg('window'); await camTo({ pos: new V3(0.2, 1.72, -12.3), look: new V3(-0.55, 2.05, -15), fov: 56 }, 3.4); await dbg('earth');
  await say('g06');
  const pan = camTo({ pos: new V3(0.3, 1.72, -12.5), look: new V3(1.4, 2.7, -15) }, 7); await say('g07'); await pan; await dbg('fleet');
  quest(P2, UI.q.askG); const c = await choose(UI.ch2); await say(c ? 'g08b' : 'g08a');
  await say('g09');
  quest(P2, UI.q.link); const l = say('g10'); S.walk = 1;
  await camTo({ pos: W.seat.front.clone().setY(1.68), look: W.seat.chair, fov: 60 }, 3.8); S.walk = 0; await l; await dbg('link');
  await ask(UI.a.seat); vit.loc = UI.loc[3]; vitals();
  await camTo({ pos: W.seat.eye, yaw: W.seat.yaw, pitch: 0.1 }, 3.4); S.free = 0.45; await dbg('seat');
  quest(P2, UI.q.cable); const l2 = say('g10b'); sfx.servo(2.4);
  await tween(2.6, (k) => W.setCable(k * 0.52)); await dbg('plug'); await wait(0.9); await tween(0.6, (k) => W.setCable(0.52 + k * 0.48), out);
  sfx.clack(); tween(0.7, (k) => { S.roll = Math.sin(k * PI * 3) * 0.035 * (1 - k); fx.uniforms.uGlitch.value = 0.55 * (1 - k); }, lin); vit.bpm = 104; vitals(); await dbg('cable'); await wait(1.1);
  quest(P2, UI.q.visor); W.linkSpin = 7; sfx.servo(2.8); const v = $('#visor');
  await tween(1.6, (k) => W.setVisor(k * 0.55)); await dbg('visor0'); await tween(1.6, (k) => { W.setVisor(0.55 + k * 0.45); if (k > 0.55) v.classList.add('on'); }); await dbg('visor'); await l2;
  await visorBoot(); await tween(0.3, (k) => { fx.uniforms.uWhite.value = k; });
}
// --- acte 3 : la galerie Ceysson & Bénétière reconstituée. On y suit le parcours réel (W.legs), d'œuvre en œuvre. ---
const trap = (k) => { const a = 0.16, b = 0.2, v = 1 / (1 - a / 2 - b / 2); return k < a ? v * k * k / (2 * a) : k > 1 - b ? 1 - v * (1 - k) * (1 - k) / (2 * b) : v * (k - a / 2); }; // vitesse constante, départ et arrivée doux
const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function walk(leg, look, onK) { // marche le long d'un tronçon : le regard suit le chemin, puis se pose sur « look » à l'arrivée
  const c = W.legs[leg], [s0, len] = W.legLen[leg], p = new V3(), tg = new V3(), y0 = S.yaw, q0 = S.pitch;
  return tween(len / 2.2, (k) => { c.getPointAt(k, p); S.pos.set(p.x, p.y + 1.66 + DSY, p.z); c.getTangentAt(Math.min(1, k + 0.04), tg);
    let yw = Math.atan2(-tg.x, -tg.z), pt = Math.atan2(tg.y, Math.hypot(tg.x, tg.z)) * 0.45;
    if (look) { const a = aim(S.pos, look), b = sm(0.74, 1, k); yw = lerpA(yw, a.yaw, b); pt += (a.pitch - pt) * b; }
    const i = sm(0, 0.14, k); S.yaw = lerpA(y0, yw, i); S.pitch = q0 + (pt - q0) * i; W.pathU.uHead.value = s0 + len * k; if (onK) onK(k); }, trap);
}
async function act3() {
  W.setScene('ds'); scene.fog.color.setHex(0x04070a); scene.fog.density = 0.016; callState('live'); hud.classList.add('ds'); vit.bpm = 92; vit.tmp = 36.8;
  const setLoc = (n) => { if (vit.loc !== UI.loc[n]) { vit.loc = UI.loc[n]; vitals(); } }; setLoc(ST0 > 1 ? 6 : ST0 ? 5 : 4); vitals();
  W.pathU.uPx.value = renderer.getPixelRatio() * innerHeight / 760;
  const p0 = W.legs[ST0].getPointAt(0), t0 = W.legs[ST0].getTangentAt(0.02);
  S.pos.set(p0.x, p0.y + 1.66 + DSY, p0.z + (ST0 ? 0 : 3)); S.yaw = Math.atan2(-t0.x, -t0.z); S.pitch = 0.06; S.roll = 0; S.fov = 62; S.free = 1; fx.uniforms.uFade.value = 1; fx.uniforms.uWhite.value = 1; fx.uniforms.uGlitch.value = 1; $('#visor').classList.remove('on');
  tween(1.8, (k) => { fx.uniforms.uWhite.value = 1 - k; fx.uniforms.uGlitch.value = 1 - k; });
  card('03', UI.card[2]); quest(P3, UI.q.enter);
  await wait(2); await dbg('ds');
  if (!ST0) { const l = say('g11'); await camTo({ pos: new V3(p0.x, 1.66 + DSY, p0.z), pitch: 0.02, fov: 60 }, 7, out); await l; await ask(UI.a.enter); }
  for (let i = ST0; i < 4; i++) {
    const st = W.stations[i], w = WORKS[i], label = UI.art + ' CB-0' + (i + 1) + ' — ' + w.sense; document.querySelectorAll('#qL li').forEach((li) => li.classList.toggle('cur', +li.dataset.i === i));
    quest(P3, i === 2 ? UI.q.up : label); S.walk = 1; let line = null;
    await walk(i, st.stop.look, (k) => { if (k > (i === 2 ? 0.86 : 0.55)) st.k = 1; // l'œuvre se matérialise à l'approche
      if (i === 0 && k > 0.5) setLoc(5); if (i === 2) { if (k > 0.58 && !line) line = say('g11b'); if (k > 0.8) setLoc(6); } });
    S.walk = 0; st.k = 1; if (line) await line; if (i === 2) quest(P3, label); scan(i); await wait(1.2); await dbg('st' + i);
    await say(w.id + 'a'); await ask(w.verb); st.fx.on = true; let back = null; const p = S.pos.clone();
    if (i === 0) tween(8, (k) => { S.sway = Math.sin(k * PI) * 0.05; }, lin);
    if (i === 2) { back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.4); camTo({ pos: p.clone().add(new V3(0, -0.55, 0)), pitch: 0.46, fov: 84 }, 3.6); }
    if (i === 3) { back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.6); const near = st.wallPos.clone().addScaledVector(st.n, 0.5); near.y += 0.02 + DSY; st.near = true; camTo({ pos: near, look: st.stop.look, fov: 50 }, 5); heart = { t: 0.2, gap: 0.62 }; tween(4, (k) => { W.dsTime = 1 - k * 0.8; }); }
    await wait(2.2); await dbg('fx' + i); await say(w.id + 'b'); mark(i); await wait(0.9);
    S.sway = 0; if (i === 3) { heart = null; tween(2, (k) => { W.dsTime = 0.2 + k * 0.8; }); vit.bpm = 92; vitals(); } if (back) await back();
    if (i === 2) st.fx.on = false; /* les troncs se rétractent avant de repartir */ st.near = false;
    $('#scan').classList.remove('on');
  }
  document.querySelectorAll('#qL li').forEach((li) => li.classList.remove('cur'));
  // fin : depuis la rive du niveau 1, un dernier regard sur la nef et sur le chemin parcouru
  quest(P3, UI.q.end); S.walk = 1; tween(5, (k) => { W.pathU.uAll.value = k; W.pathLine.opacity = 0.1 + k * 0.8; });
  const lv = W.stations[3].lv, end = camTo({ pos: new V3(8.35, lv + 1.66 + DSY, -1.9), look: new V3(-7.5, 0.9 + DSY, -17.5), fov: 68 }, 9);
  await say('g12'); await end; S.walk = 0; await dbg('end'); await wait(1); await tween(1.6, (k) => { fx.uniforms.uWhite.value = k; });
}
async function run() {
  hud.classList.add('on'); running = true; clock.getDelta(); frame();
  if (ACT <= 1) await act1(); else { S.pos.set(0, 1.68, -10.6); S.yaw = 0; S.pitch = 0.05; fx.uniforms.uFade.value = 1; }
  if (ACT <= 2) await act2();
  await act3();
  hud.classList.remove('on'); callState('off'); $('#outro').classList.add('on'); theme('#f1f2f4'); if (synth) synth.cancel();
}

/* ============================== ENTRÉES ============================== */
let drag = null; const gaze = new THREE.Vector2(9, 9);
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { S.mx = (e.clientX / innerWidth) * 2 - 1; S.my = (e.clientY / innerHeight) * 2 - 1; gaze.set(S.mx * 0.6, -S.my * 0.6); }
  else if (drag) { S.mx = Math.max(-1, Math.min(1, S.mx - (e.clientX - drag.x) / innerWidth * 2.4)); S.my = Math.max(-1, Math.min(1, S.my - (e.clientY - drag.y) / innerHeight * 2.4)); drag.x = e.clientX; drag.y = e.clientY; gaze.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)); } });
addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { drag = { x: e.clientX, y: e.clientY }; gaze.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)); } });
const endDrag = (e) => { if (e.pointerType !== 'mouse') { drag = null; gaze.set(9, 9); } }; addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { if (skipLine) { e.preventDefault(); skipLine(); } return; }
  if (!running) return;
  if (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'Enter') { if (pending) { e.preventDefault(); pending(); } }
  else if (/^(Digit|Numpad)[1-9]$/.test(e.code) && pick) pick(+e.code.slice(-1) - 1);
});
promptEl.addEventListener('click', () => pending && pending());
$('#prologue').addEventListener('click', () => skipLine && skipLine());
$('#bSkip').addEventListener('click', () => skipLine && skipLine());
$('#bVoice').addEventListener('click', (e) => { voiceOn = !voiceOn; if (!voiceOn && synth) synth.cancel(); if (A.vOut) A.vOut.gain.setTargetAtTime(voiceOn ? 1 : 0.0001, A.ctx.currentTime, 0.1); e.currentTarget.classList.toggle('off', !voiceOn); });
$('#bSound').addEventListener('click', (e) => { A.on = !A.on; if (A.out) A.out.gain.setTargetAtTime(A.on ? 0.5 : 0.0001, A.ctx.currentTime, 0.2); e.currentTarget.classList.toggle('off', !A.on); });
function toDossier() { running = false; if (synth) synth.cancel(); if (A.ctx) { A.out.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.3); A.vOut.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.1); } document.body.classList.add('read'); theme('#f1f2f4'); $('#dossier').scrollIntoView(); }
document.querySelectorAll('[data-dossier]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toDossier(); }));
document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => { location.href = location.pathname; }));
document.addEventListener('visibilitychange', () => { if (!document.hidden && running) clock.getDelta(); });

const startBtn = $('#start'), bootMsg = $('#bootMsg'), theme = (c) => { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c; };
async function boot() {
  try { await Promise.race([document.fonts.load('600 20px Rajdhani').then(() => document.fonts.load('20px "Krona One"')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* polices de secours */ }
  localizeDom(); startBtn.textContent = UI.loading;
  try { const all = await (await fetch('app/lines.json')).json(); LINES = all[LANG] || all.fr || {}; } catch (e) { LINES = {}; }
  let ok = true; try { initGL(); } catch (e) { ok = false; console.error(e); }
  if (!ok) { bootMsg.textContent = UI.noGL; startBtn.disabled = true; toDossier(); return; }
  bootMsg.textContent = reduce ? UI.reduced : UI.ready;
  startBtn.disabled = false; startBtn.textContent = UI.start;
  startBtn.addEventListener('click', async () => { audioInit(); loadVoices(); $('#boot').classList.add('gone'); document.body.classList.add('play'); if (ACT <= 1) await prologue(); run(); }, { once: true });
  if (AUTO) { $('#boot').style.display = 'none'; startBtn.click(); }
}
boot();
