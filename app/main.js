// SPES — moteur, mise en scène narrative, HUD, voix, son.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, COL } from './world.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
// paramètres de test : ?act=2|3 ?st=0..3 ?auto ?quick ?lite ?hold=<point>
const ACT = +Q.get('act') || 1, ST0 = +Q.get('st') || 0, AUTO = Q.has('auto'), QUICK = Q.has('quick'), LITE = Q.has('lite'), HOLD = Q.get('hold');
const dbg = (n) => (HOLD === n ? new Promise(() => {}) : Promise.resolve());
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer:coarse)').matches;
const V3 = THREE.Vector3, PI = Math.PI;

// Les quatre artefacts du lot 42-SE, reconstitués à taille réelle (dimensions en mètres)
const WORKS = [
  { key: 's1', col: COL.amber, css: '#fca311', img: 'assets/works/ouie.jpg', sense: 'Kinesthésie', canal: 'Canal K', verb: 'Fixer une plume',
    title: 'Plume sur Rhodoïde', artist: 'Louis Cane, 1998', tech: 'plumes sur Rhodoïd · 97,5 × 97,5 cm', dw: '97,5 cm', dh: '97,5 cm', w: 0.975, h: 0.975, ar: 653 / 558, mode: 0, cell: 0.04, cy: 1.5, dist: 1.9,
    def: "Percevoir un mouvement dans son propre corps, même devant une image immobile.", cns: 'Fixe une seule plume, dix secondes, sans bouger.' },
  { key: 's2', col: COL.cyan, css: '#7fe3e6', img: 'assets/works/toucher.jpg', sense: 'Toucher haptique virtuel', canal: 'Canal H', verb: 'Toucher du regard',
    title: 'Résine sur grillage', artist: 'Louis Cane, 2018', tech: 'résine sur grillage de fer · 141 × 141 cm', dw: '141 cm', dh: '141 cm', w: 1.41, h: 1.41, ar: 587 / 552, mode: 0, relief: 1, key: [0.03, 0.2], base: 0.3, cell: 0.045, cy: 1.55, dist: 2.5,
    def: "L'œil déclenche une sensation tactile, sans aucun contact avec la matière.", cns: 'Approche-toi à trente centimètres. Ne touche pas.' },
  { key: 's3', col: COL.lime, css: '#a8e61d', img: 'assets/works/odorat.jpg', sense: 'Proprioception spatiale', canal: 'Canal P', verb: 'Lever les yeux',
    title: 'Arpenter ⅔', artist: 'Aurélie Pétrel, 2025', tech: 'impression sur cuivre · 192 × 100 cm', dw: '100 cm', dh: '192 cm', w: 1.0, h: 1.92, ar: 300 / 764, mode: 1, cell: 0.042, cy: 1.3, dist: 2.9,
    def: "Le sens de ta taille, de ton volume et de ta place dans l'espace, sans regarder ton corps.", cns: 'Place tes pieds sur le repère, à soixante centimètres.' },
  { key: 's4', col: COL.coral, css: '#ff4f38', img: 'assets/works/gout.jpg', sense: 'Intéroception & chronoception', canal: 'Canal I', verb: "S'approcher",
    title: 'n°60', artist: 'Philippe Favier, 2025', tech: 'pointe de gramophone sur verre peint · 35 × 44 cm', dw: '44 cm', dh: '35 cm', w: 0.44, h: 0.35, ar: 682 / 460, mode: 2, cell: 0.02, cy: 1.5, dist: 1.15,
    def: "Sentir l'intérieur de son corps — le cœur, le souffle — et l'écoulement du temps.", cns: 'Penche-toi à vingt centimètres. Ralentis.' }
];
const LOG = [ // prologue : entrées du journal de bord
  ['ARCHIVE 42-SE // 22.11.2026', "Saint-Étienne. La galerie Ceysson & Bénétière ferme l'exposition Résonances. Quatre de ses œuvres sont numérisées pour le programme HOPE."],
  ['JOURNAL DE BORD // 14.12.2026', "La cohorte R-26 embarque sur l'arche SPES-07 : deux mille volontaires de 18 à 25 ans. Mise en stase, niveau 4."],
  ['JOURNAL DE BORD // J+173 141', "An 2500. Indice de Voile terrestre : 9,7. Protocole RÉSONANCE déclenché. Premier sujet : R26-0417. C'est toi."]
];

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
// Répliques pré-enregistrées (assets/voice) ; à défaut, synthèse du navigateur ; à défaut, sous-titres minutés.
let LINES = {}; const VB = {}, VFAIL = {};
const synth = window.speechSynthesis || null; let voice = null, voiceOn = true, talking = false, skipLine = null;
function pickVoice() { if (!synth) return; const v = synth.getVoices() || []; voice = v.find((x) => /fr[-_]FR/i.test(x.lang) && /denise|eloise|hortense|julie|google|amelie|audrey/i.test(x.name)) || v.find((x) => /^fr/i.test(x.lang)) || null; }
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
function loadVoices() { if (!A.ctx) return; for (const id of Object.keys(LINES)) fetch('assets/voice/' + id + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => A.ctx.decodeAudioData(b)).then((buf) => { VB[id] = buf; }).catch(() => { VFAIL[id] = 1; }); }
const subEl = $('#sub'), subT = $('#subT');
async function say(id) {
  const L = LINES[id] || { t: id }, text = L.t; subT.textContent = text; subEl.classList.add('on'); talking = true;
  if (!QUICK && voiceOn && A.ctx && !VB[id] && !VFAIL[id]) for (let i = 0; i < 20 && !VB[id] && !VFAIL[id]; i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((res) => {
    const t0 = performance.now(), est = QUICK ? 300 : (L.d ? L.d * 1000 + 250 : Math.max(1900, text.length * 66)); let done = false, to, src = null;
    const fin = () => { if (done) return; done = true; clearTimeout(to); if (src) { src.onended = null; try { src.stop(); } catch (e) { /* déjà arrêtée */ } } talking = false; skipLine = null; setTimeout(() => { if (!talking) subEl.classList.remove('on'); res(); }, QUICK ? 40 : 420); };
    if (!QUICK && voiceOn && A.ctx && VB[id]) { if (A.ctx.state === 'suspended') A.ctx.resume(); src = A.ctx.createBufferSource(); src.buffer = VB[id]; src.connect(A.vIn); src.onended = fin; src.start(); to = setTimeout(fin, est + 1500); }
    else if (!QUICK && voiceOn && synth) { to = setTimeout(fin, est * 1.6 + 2500); try { if (synth.speaking || synth.pending) synth.cancel(); const u = new SpeechSynthesisUtterance(L.say || text); u.lang = 'fr-FR'; if (voice) u.voice = voice; u.rate = 1.02; u.pitch = 0.92; window.__utt = u;
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
function callState(s) { callEl.dataset.s = s; callEl.classList.toggle('on', s !== 'off'); callS.textContent = s === 'ring' ? 'APPEL ENTRANT' : 'EN LIGNE'; if (s === 'live') callStart = performance.now(); }
function scan(i) { const w = WORKS[i], el = $('#scan'); el.style.setProperty('--sig', w.css); $('#scN').textContent = 'CB-0' + (i + 1) + ' · LOT 42-SE'; $('#scS').textContent = w.sense; $('#scBy').textContent = w.title + ' — ' + w.artist; $('#scDef').textContent = w.def; $('#scC').textContent = '« ' + w.cns + ' »'; el.classList.add('on'); }
function mark(i) { const li = document.querySelector('#qL li[data-i="' + i + '"]'); if (li) li.classList.add('done'); sfx.tone(523, 0.12, 0.1, 'triangle'); sfx.tone(784, 0.2, 0.1, 'triangle', 0.1); }
const vit = { bpm: 8, tmp: 4, loc: '' };
function vitals() { $('#bpm').textContent = Math.round(vit.bpm); $('#tmp').textContent = vit.tmp.toFixed(1).replace('.', ','); $('#loc').textContent = vit.loc; }

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
let renderer, composer, bloom, fx, scene, camera, W, running = false, T = 0;
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
// qualité adaptative : si l'appareil peine, on baisse la résolution puis on coupe le bloom
const QL = { dpr: 1, lvl: 0, n: 0, acc: 0 };
function adapt(raw) { if (LITE || QL.lvl > 1) return; QL.acc += raw; if (++QL.n < 70) return; const avg = QL.acc / QL.n; QL.n = 0; QL.acc = 0;
  if (avg > 0.042) { QL.lvl++; const d = Math.max(0.6, QL.dpr * (QL.lvl === 1 ? 0.72 : 0.55)); renderer.setPixelRatio(d); composer.setPixelRatio(d); if (QL.lvl > 1) bloom.enabled = false; } }
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
  const dpr = LITE ? 0.5 : Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5); QL.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020306); scene.fog = new THREE.FogExp2(0x0a1016, 0.034);
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1600);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  W = buildWorld(scene, new THREE.TextureLoader(), WORKS);
  composer = new EffectComposer(renderer); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.92); bloom.enabled = !LITE; composer.addPass(bloom);
  fx = new ShaderPass(FX); composer.addPass(fx); composer.addPass(new OutputPass());
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
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
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), tdt = Math.min(raw, 0.6); T += dt; adapt(raw);
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += tdt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
  S.lx += (S.mx - S.lx) * 0.06; S.ly += (S.my - S.ly) * 0.06;
  camera.position.copy(S.pos); camera.position.y += (S.walk ? Math.sin(T * 7.4) * 0.034 * S.walk : 0) + Math.sin(T * 0.9) * 0.006;
  camera.rotation.set(S.pitch - S.ly * 0.24 * S.free, S.yaw - S.lx * 0.42 * S.free, S.roll + Math.sin(T * 0.7) * S.sway + (S.walk ? Math.sin(T * 3.7) * 0.006 : 0), 'YXZ');
  if (Math.abs(camera.fov - S.fov) > 0.01) { camera.fov = S.fov; camera.updateProjectionMatrix(); }
  // station 2 : la matière se soulève là où porte le regard
  const s1 = W.stations[1]; if (s1.fx.on) { if (touch) ndc.set(Math.sin(T * 0.7) * 0.2, Math.cos(T * 0.9) * 0.16); else ndc.set(S.mx * 0.6, -S.my * 0.6);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(s1.fx.hitPlane)[0]; if (hit) { hitL.copy(hit.point); s1.fx.mesh.worldToLocal(hitL); s1.u.uHit.value.lerp(hit2.set(hitL.x, hitL.y), 0.18); } }
  // station 4 : le pouls
  if (heart) { heart.t -= dt; if (heart.t <= 0) { heart.gap = Math.min(1.35, heart.gap + 0.07); heart.t = heart.gap; sfx.thump(); W.stations[3].fx.pulse = 1; vit.bpm = 60 / heart.gap; vitals(); } }
  bloom.strength = 0.5 + W.stations[3].fx.pulse * 0.7;
  if (W.ds.visible) W.dsLight.position.set(0, 3, S.pos.z + 2);
  // bouche du portrait : amplitude réelle de la voix quand elle joue, sinon mouvement générique
  let m = 0; if (talking) { if (A.vAna) { A.vAna.getByteTimeDomainData(A.vBuf); let s = 0; for (let i = 0; i < 512; i += 4) { const x = (A.vBuf[i] - 128) / 128; s += x * x; } m = Math.min(1, Math.sqrt(s / 128) * 5.5); }
    if (m < 0.02 && (!A.ctx || QUICK || !voiceOn)) m = Math.abs(Math.sin(T * 21) * Math.sin(T * 6.7)) * 0.8; }
  mouth += (m - mouth) * 0.4;
  if (callEl.classList.contains('on')) { drawFace(T); if (callEl.dataset.s === 'live') { const s = ((performance.now() - callStart) / 1000) | 0; callT.textContent = String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); } }
  W.update(T, dt, camera.position); fx.uniforms.uTime.value = T; composer.render();
}

/* ============================== RÉCIT ============================== */
const DSY = -400, P1 = 'PROTOCOLE RÉSONANCE · 1/3', P2 = 'PROTOCOLE RÉSONANCE · 2/3', P3 = 'PROTOCOLE RÉSONANCE · 3/3';
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
  W.setScene('ship'); S.pos.set(-4.32, 0.94, 1.3); S.yaw = -PI / 2; S.pitch = 1.45; S.free = 0.22; S.fov = 64; vit.loc = 'PONT 12 · CAISSON R26-0417'; vitals();
  quest(P1, 'Séquence de dégel en cours'); card('01', 'Réveil');
  tween(3, (k) => { fx.uniforms.uFade.value = k; });
  tween(9, (k) => { W.frost.value = k * 0.5; vit.tmp = 4 + k * 22; vit.bpm = 8 + k * 60; vitals(); }, lin);
  await wait(4.2);
  callState('ring'); const stop = sfx.ring(); quest(P1, 'Appel entrant — Gladys, unité de veille'); await ask('Répondre'); stop(); callState('live');
  await say('g01');
  tween(5, (k) => { W.frost.value = 0.5 + k * 0.5; vit.tmp = 26 + k * 10.8; vit.bpm = 68 + k * 24; vitals(); }, lin);
  quest(P1, 'Interroger Gladys'); const c = await choose(['Où suis-je ?', "Combien de temps ai-je dormi ?"]); await say(c ? 'g02b' : 'g02a');
  await say('g03');
  quest(P1, 'Sortir du caisson'); await ask('Sortir du caisson');
  sfx.hiss(); W.guideMat.color.setHex(COL.safran).multiplyScalar(1.5);
  tween(8, (k) => { W.beacon.intensity = 26 * Math.abs(Math.sin(k * 14)); }, lin);
  await tween(2.6, (k) => { W.lidPivot.rotation.x = -k * 1.9; }, out); quest(P1, 'Se redresser');
  await camTo({ pos: new V3(-4.0, 1.3, 1.3), yaw: -PI / 2, pitch: -0.04, fov: 60 }, 3); S.free = 1; await dbg('sit');
  const l1 = say('g04');
  await camTo({ pos: new V3(-1.3, 1.68, 1.3), yaw: -PI / 2 + 0.55, pitch: 0.02 }, 3.4); await camTo({ yaw: -PI / 2 - 0.75, pitch: 0.16 }, 4.2); await camTo({ yaw: -PI / 2 + 0.2, pitch: 0 }, 2.6); await l1; await dbg('stand');
  quest(P1, "Rejoindre la baie d'observation"); await ask('Avancer'); vit.loc = 'PONT 12 · BAIE CRYO C'; vitals();
  S.walk = 1; await camTo({ pos: new V3(0, 1.68, 0.4), look: new V3(0, 2.2, -15) }, 2.4); await dbg('aisle');
  const l2 = say('g05');
  await camTo({ pos: new V3(0, 1.68, -10.6), look: new V3(-0.4, 2.3, -15) }, 10.5, lin); S.walk = 0; await l2;
}
async function visorBoot() {
  const v = $('#visor'), rows = ['PORT CERVICAL C2 · VERROUILLÉ', 'CORTEX VISUEL · PRIS EN CHARGE', 'CORTEX SOMATOSENSORIEL · PRIS EN CHARGE', 'CHARGEMENT DS-04 « RÉSONANCES » · LOT 42-SE'], ul = $('#vRows'); ul.innerHTML = '';
  sfx.glitch(3.2);
  await tween(3.4, (k) => { $('#vPct').textContent = String(Math.round(k * 100)).padStart(3, '0'); $('#vBar').style.transform = 'scaleX(' + k + ')'; const n = Math.min(rows.length, Math.floor(k * (rows.length + 0.6)));
    while (ul.children.length < n) { const li = document.createElement('li'); li.textContent = rows[ul.children.length]; ul.appendChild(li); sfx.blip(); } fx.uniforms.uGlitch.value = k * k; v.style.setProperty('--g', k); }, lin);
}
async function act2() {
  W.lidPivot.rotation.x = -1.9; W.frost.value = 1; vit.bpm = 92; vit.tmp = 36.8; vit.loc = "PONT 12 · BAIE D'OBSERVATION"; vitals(); callState('live');
  card('02', 'Ce qui reste'); quest(P2, 'Observer la Terre');
  await dbg('window'); await camTo({ pos: new V3(0.2, 1.72, -12.3), look: new V3(-0.9, 1.95, -15), fov: 56 }, 3.4); await dbg('earth');
  await say('g06');
  const pan = camTo({ pos: new V3(0.3, 1.72, -12.5), look: new V3(1.4, 2.7, -15) }, 7); await say('g07'); await pan; await dbg('fleet');
  quest(P2, 'Interroger Gladys'); const c = await choose(['Pourquoi des œuvres ?', 'Pourquoi me réveiller, moi ?']); await say(c ? 'g08b' : 'g08a');
  await say('g09');
  quest(P2, "Rejoindre le poste de liaison N-7"); const l = say('g10'); S.walk = 1;
  await camTo({ pos: W.seat.front.clone().setY(1.68), look: W.seat.chair, fov: 60 }, 3.8); S.walk = 0; await l; await dbg('link');
  await ask("S'installer"); vit.loc = 'PONT 12 · LIAISON N-7'; vitals();
  await camTo({ pos: W.seat.eye, yaw: W.seat.yaw, pitch: 0.1 }, 3.4); S.free = 0.45; await dbg('seat');
  quest(P2, 'Branchement du câble cervical'); const l2 = say('g10b'); sfx.servo(2.4);
  await tween(2.6, (k) => W.setCable(k * 0.52)); await wait(0.9); await tween(0.6, (k) => W.setCable(0.52 + k * 0.48), out);
  sfx.clack(); tween(0.7, (k) => { S.roll = Math.sin(k * PI * 3) * 0.035 * (1 - k); fx.uniforms.uGlitch.value = 0.55 * (1 - k); }, lin); vit.bpm = 104; vitals(); await dbg('cable'); await wait(1.1);
  quest(P2, 'Casque de liaison — synchronisation'); W.linkSpin = 7; sfx.servo(2.8); const v = $('#visor');
  await tween(3, (k) => { W.setVisor(k); if (k > 0.78) v.classList.add('on'); }); await dbg('visor'); await l2;
  await visorBoot(); await tween(0.3, (k) => { fx.uniforms.uWhite.value = k; });
}
async function act3() {
  W.setScene('ds'); scene.fog.color.setHex(0x04070a); scene.fog.density = 0.042; callState('live'); hud.classList.add('ds'); vit.loc = 'DS-04 · « RÉSONANCES »'; vit.bpm = 92; vit.tmp = 36.8; vitals();
  S.pos.set(0, 1.66 + DSY, 6); S.yaw = 0; S.pitch = 0; S.roll = 0; S.fov = 60; S.free = 1; fx.uniforms.uFade.value = 1; fx.uniforms.uWhite.value = 1; fx.uniforms.uGlitch.value = 1; $('#visor').classList.remove('on');
  tween(1.8, (k) => { fx.uniforms.uWhite.value = 1 - k; fx.uniforms.uGlitch.value = 1 - k; });
  card('03', 'Danse sensorielle'); quest(P3, 'Traverser la danse sensorielle');
  await wait(2); await dbg('ds'); if (!ST0) await say('g11');
  for (let i = ST0; i < 4; i++) {
    const st = W.stations[i], w = WORKS[i]; document.querySelectorAll('#qL li').forEach((li) => li.classList.toggle('cur', +li.dataset.i === i));
    quest(P3, 'Artefact CB-0' + (i + 1) + ' — ' + w.sense); st.k = 1; S.walk = 1;
    await camTo({ pos: st.stop.pos, look: st.stop.look }, 5.4); S.walk = 0; scan(i); await wait(2.6); await dbg('st' + i);
    await say(w.key + 'a'); await ask(w.verb); st.fx.on = true; let back = null; const p = S.pos.clone();
    if (i === 0) tween(8, (k) => { S.sway = Math.sin(k * PI) * 0.05; }, lin);
    if (i === 2) { back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.4); camTo({ pos: p.clone().add(new V3(0, -0.55, 0)), pitch: 0.4, fov: 82 }, 3.6); }
    if (i === 3) { back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.6); camTo({ pos: new V3(st.ax, 0, st.z).addScaledVector(st.n, 0.5).setY(w.cy + 0.02 + DSY), look: st.stop.look, fov: 50 }, 5); heart = { t: 0.2, gap: 0.62 }; tween(4, (k) => { W.dsTime = 1 - k * 0.8; }); }
    await wait(3.2); await dbg('fx' + i); await say(w.key + 'b'); mark(i); await wait(1.4);
    S.sway = 0; if (i === 3) { heart = null; tween(2, (k) => { W.dsTime = 0.2 + k * 0.8; }); vit.bpm = 92; vitals(); } if (back) await back();
    $('#scan').classList.remove('on');
  }
  document.querySelectorAll('#qL li').forEach((li) => li.classList.remove('cur'));
  quest(P3, 'Rejoindre la sortie'); S.walk = 1;
  const end = camTo({ pos: new V3(0, 1.66 + DSY, -84), look: new V3(0, 1.9 + DSY, -96) }, 12, lin);
  await say('g12'); await end; S.walk = 0; await tween(1.6, (k) => { fx.uniforms.uWhite.value = k; });
}
async function run() {
  hud.classList.add('on'); running = true; clock.getDelta(); frame();
  if (ACT <= 1) await act1(); else { S.pos.set(0, 1.68, -10.6); S.yaw = 0; S.pitch = 0.05; fx.uniforms.uFade.value = 1; }
  if (ACT <= 2) await act2();
  await act3();
  hud.classList.remove('on'); callState('off'); $('#outro').classList.add('on'); if (synth) synth.cancel();
}

/* ============================== ENTRÉES ============================== */
addEventListener('pointermove', (e) => { S.mx = (e.clientX / innerWidth) * 2 - 1; S.my = (e.clientY / innerHeight) * 2 - 1; });
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { if (skipLine) { e.preventDefault(); skipLine(); } return; }
  if (!running) return;
  if (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'Enter') { if (pending) { e.preventDefault(); pending(); } }
  else if (/^(Digit|Numpad)[1-9]$/.test(e.code) && pick) pick(+e.code.slice(-1) - 1);
});
promptEl.addEventListener('click', () => pending && pending());
$('#gl').addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && pending) pending(); });
$('#prologue').addEventListener('click', () => skipLine && skipLine());
$('#bSkip').addEventListener('click', () => skipLine && skipLine());
$('#bVoice').addEventListener('click', (e) => { voiceOn = !voiceOn; if (!voiceOn && synth) synth.cancel(); if (A.vOut) A.vOut.gain.setTargetAtTime(voiceOn ? 1 : 0.0001, A.ctx.currentTime, 0.1); e.currentTarget.classList.toggle('off', !voiceOn); });
$('#bSound').addEventListener('click', (e) => { A.on = !A.on; if (A.out) A.out.gain.setTargetAtTime(A.on ? 0.5 : 0.0001, A.ctx.currentTime, 0.2); e.currentTarget.classList.toggle('off', !A.on); });
function toDossier() { running = false; if (synth) synth.cancel(); if (A.ctx) { A.out.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.3); A.vOut.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.1); } document.body.classList.add('read'); $('#dossier').scrollIntoView(); }
document.querySelectorAll('[data-dossier]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toDossier(); }));
document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => { location.href = location.pathname; }));
document.addEventListener('visibilitychange', () => { if (!document.hidden && running) clock.getDelta(); });

const startBtn = $('#start'), bootMsg = $('#bootMsg');
async function boot() {
  try { await Promise.race([document.fonts.load('600 20px Rajdhani').then(() => document.fonts.load('20px "Krona One"')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* polices de secours */ }
  try { LINES = await (await fetch('app/lines.json')).json(); } catch (e) { LINES = {}; }
  let ok = true; try { initGL(); } catch (e) { ok = false; console.error(e); }
  if (!ok) { bootMsg.textContent = "La 3D n'est pas disponible sur cet appareil — version texte ci-dessous."; startBtn.disabled = true; toDossier(); return; }
  bootMsg.textContent = reduce ? 'Animations réduites détectées : la version texte est recommandée.' : 'Systèmes prêts — casque audio conseillé.';
  startBtn.disabled = false; startBtn.textContent = 'Lancer le dégel';
  startBtn.addEventListener('click', async () => { audioInit(); loadVoices(); $('#boot').classList.add('gone'); document.body.classList.add('play'); if (ACT <= 1) await prologue(); run(); }, { once: true });
  if (AUTO) { $('#boot').style.display = 'none'; startBtn.click(); }
}
boot();
