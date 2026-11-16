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
const ACT = +Q.get('act') || 1, ST0 = +Q.get('st') || 0, AUTO = Q.has('auto'), QUICK = Q.has('quick');
const LITE = Q.has('lite'); const HOLD = Q.get('hold'); const dbg = (n) => (HOLD === n ? new Promise(() => {}) : Promise.resolve());
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer:coarse)').matches;
const V3 = THREE.Vector3, PI = Math.PI;

const WORKS = [
  { col: COL.amber, css: '#fca311', img: 'assets/works/ouie.jpg', tag: 'KINESTHÉSIE', sense: 'Kinesthésie', by: 'Plume sur Rhodoïde — Louis Cane, 1998', verb: 'Fixer une plume',
    def: "Percevoir un mouvement dans son propre corps, même devant une image immobile.", cns: 'Fixe une seule plume, dix secondes, sans bouger.',
    a: "Plume sur Rhodoïde, Louis Cane, 1998. Des plumes figées sous une vitre. Choisis-en une, et ne la quitte plus des yeux.",
    b: "Tu la sens tomber ? Rien ne bouge, pourtant. C'est ta kinesthésie : ton cerveau simule le mouvement dans ton propre corps." },
  { col: COL.cyan, css: '#7fe3e6', img: 'assets/works/toucher.jpg', tag: 'TOUCHER VIRTUEL', sense: 'Toucher haptique virtuel', by: 'Résine sur grillage — Louis Cane, 2018', verb: 'Toucher du regard',
    def: "L'œil déclenche une sensation tactile, sans aucun contact avec la matière.", cns: 'Approche-toi à trente centimètres. Ne touche pas.',
    a: "Résine sur grillage, Louis Cane, 2018. Du fer noyé dans la résine. Interdit de toucher. Alors touche avec les yeux.",
    b: "Le froid du métal, le lisse de la résine : ton cortex du toucher s'allume sans aucun contact. C'est le toucher haptique virtuel." },
  { col: COL.lime, css: '#a8e61d', img: 'assets/works/odorat.jpg', tag: 'PROPRIOCEPTION', sense: 'Proprioception spatiale', by: 'Arpenter ⅔ — Aurélie Pétrel, 2025', verb: 'Lever les yeux',
    def: "Le sens de ta taille, de ton volume et de ta place dans l'espace, sans regarder ton corps.", cns: 'Place tes pieds sur le repère, à soixante centimètres.',
    a: "Arpenter, deux tiers, Aurélie Pétrel, 2025. Un sous-bois imprimé sur cuivre, presque deux mètres de haut. Lève les yeux.",
    b: "Les troncs te dominent, et tu te sens rétrécir. Ta proprioception recalcule ta taille et ta place dans l'espace." },
  { col: COL.coral, css: '#ff4f38', img: 'assets/works/gout.jpg', tag: 'INTÉROCEPTION', sense: 'Intéroception & chronoception', by: 'n°60 — Philippe Favier, 2025', verb: 'Ralentir',
    def: "Sentir l'intérieur de son corps — le cœur, le souffle — et l'écoulement du temps.", cns: 'Penche-toi à vingt centimètres. Ralentis.',
    a: "Numéro soixante, Philippe Favier, 2025. Des bocaux de confiture, gravés tout petit sur du verre. Approche. Ralentis.",
    b: "Un souvenir d'enfance, et ton cœur change de rythme. C'est l'intéroception : sentir l'intérieur de ton corps. Le temps se dilate." }
];

/* ============================== SON ============================== */
const A = { ctx: null, out: null, on: true };
function audioInit() { if (A.ctx) return; try {
  const c = A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.out = c.createGain(); A.out.gain.value = 0.55; A.out.connect(c.destination);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const dg = c.createGain(); dg.gain.value = 0.0001; lp.connect(dg); dg.connect(A.out);
  [46, 46.4, 69.2].forEach((f) => { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(lp); o.start(); });
  const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; A.noise = nb;
  const n = c.createBufferSource(); n.buffer = nb; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5; const ng = c.createGain(); ng.gain.value = 0.03; n.connect(bp); bp.connect(ng); ng.connect(dg); n.start();
  dg.gain.setTargetAtTime(0.9, c.currentTime, 2);
} catch (e) { A.ctx = null; } }
const env = (g, t, a, peak, r) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); };
const sfx = {
  tone(f, dur = 0.12, vol = 0.12, type = 'sine', when = 0) { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.connect(g); g.connect(A.out); const t = c.currentTime + when; env(g, t, 0.008, vol, dur); o.start(t); o.stop(t + dur + 0.1); },
  blip() { this.tone(880, 0.08, 0.1, 'triangle'); this.tone(1320, 0.1, 0.07, 'triangle', 0.06); },
  noise(dur, freq, q, vol) { if (!A.ctx) return; const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(A.out); const t = c.currentTime; env(g, t, 0.05, vol, dur); f.frequency.exponentialRampToValueAtTime(freq * 0.35, t + dur); s.start(t); s.stop(t + dur + 0.2); },
  hiss() { this.noise(2.4, 5200, 0.7, 0.3); },
  thump() { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(74, c.currentTime); o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.22); o.connect(g); g.connect(A.out); env(g, c.currentTime, 0.01, 0.9, 0.3); o.start(); o.stop(c.currentTime + 0.4); },
  glitch(dur = 2) { if (!A.ctx) return; for (let i = 0; i < dur * 14; i++) this.tone(120 + Math.random() * 3000, 0.03 + Math.random() * 0.05, 0.05, 'square', Math.random() * dur); this.noise(dur, 1800, 0.4, 0.2); },
  ring() { let alive = true; const go = () => { if (!alive) return; this.tone(660, 0.16, 0.12, 'sine'); this.tone(990, 0.16, 0.1, 'sine'); this.tone(660, 0.16, 0.12, 'sine', 0.24); this.tone(990, 0.16, 0.1, 'sine', 0.24); setTimeout(go, 1500); }; go(); return () => { alive = false; }; }
};

/* ============================== VOIX ============================== */
const synth = window.speechSynthesis || null; let voice = null, voiceOn = true, talking = false, mouthKick = 0, skipLine = null;
function pickVoice() { if (!synth) return; const v = synth.getVoices() || []; voice = v.find((x) => /fr[-_]FR/i.test(x.lang) && /denise|eloise|google|amelie|audrey|virginie|julie|hortense/i.test(x.name)) || v.find((x) => /^fr/i.test(x.lang)) || null; }
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
const subEl = $('#sub'), subT = $('#subT');
function say(text) { return new Promise((res) => {
  subT.textContent = text; subEl.classList.add('on'); talking = true; const t0 = performance.now(); let done = false, to;
  const est = QUICK ? 300 : Math.max(1900, text.length * 66);
  const fin = () => { if (done) return; done = true; clearTimeout(to); talking = false; skipLine = null; setTimeout(() => { if (!talking) subEl.classList.remove('on'); res(); }, QUICK ? 40 : 380); };
  const speak = voiceOn && synth && !QUICK;
  to = setTimeout(fin, speak ? est * 1.7 + 2500 : est);
  if (speak) { try { synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; if (voice) u.voice = voice; u.rate = 0.98; u.pitch = 0.92;
    u.onboundary = () => { mouthKick = 1; }; u.onend = () => { const left = est * 0.45 - (performance.now() - t0); if (left > 0) { clearTimeout(to); to = setTimeout(fin, left); } else fin(); };
    u.onerror = () => { clearTimeout(to); to = setTimeout(fin, Math.max(200, est - (performance.now() - t0))); }; synth.speak(u); } catch (e) { /* minuterie de secours */ } }
  skipLine = () => { if (synth) synth.cancel(); fin(); };
}); }

/* ============================== HUD ============================== */
const hud = $('#hud'), promptEl = $('#prompt'), promptT = $('#promptT'), callEl = $('#call'), callS = $('#callS'), callT = $('#callT');
let pending = null, callStart = 0;
function ask(label) { return new Promise((res) => { promptT.textContent = label; promptEl.classList.add('on'); pending = () => { pending = null; promptEl.classList.remove('on'); sfx.blip(); res(); }; if (AUTO && HOLD !== 'ask:' + label) setTimeout(() => pending && pending(), QUICK ? 150 : 900); }); }
function quest(title, obj) { $('#qT').textContent = title; const o = $('#qO'); o.classList.remove('in'); void o.offsetWidth; o.textContent = obj; o.classList.add('in'); }
function card(n, t) { $('#cardN').textContent = n; $('#cardT').textContent = t; const c = $('#card'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
function callState(s) { callEl.dataset.s = s; callEl.classList.toggle('on', s !== 'off'); callS.textContent = s === 'ring' ? 'APPEL ENTRANT' : 'EN LIGNE'; if (s === 'live') callStart = performance.now(); }
function scan(i) { const w = WORKS[i], el = $('#scan'); el.style.setProperty('--sig', w.css); $('#scN').textContent = '0' + (i + 1); $('#scS').textContent = w.sense; $('#scBy').textContent = w.by; $('#scDef').textContent = w.def; $('#scC').textContent = '« ' + w.cns + ' »'; el.classList.add('on'); }
function mark(i) { const li = document.querySelector('#qL li[data-i="' + i + '"]'); if (li) li.classList.add('done'); sfx.tone(523, 0.12, 0.1, 'triangle'); sfx.tone(784, 0.2, 0.1, 'triangle', 0.1); }
const vit = { bpm: 38, tmp: 4, loc: 'CAISSON 0417' };
function vitals() { $('#bpm').textContent = Math.round(vit.bpm); $('#tmp').textContent = vit.tmp.toFixed(1).replace('.', ','); $('#loc').textContent = vit.loc; }

// portrait de Gladys : visage en lignes de contour (relevé holographique), bouche synchronisée à la voix
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

function initGL() {
  const canvas = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const dpr = LITE ? 0.5 : Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5); QL.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020306); scene.fog = new THREE.FogExp2(0x0a1016, 0.034);
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1600);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  W = buildWorld(scene, new THREE.TextureLoader(), WORKS);
  composer = new EffectComposer(renderer); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.92); bloom.enabled = !LITE; composer.addPass(bloom);
  fx = new ShaderPass(FX); composer.addPass(fx); composer.addPass(new OutputPass());
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}
// qualité adaptative : si l'appareil peine, on baisse la résolution puis on coupe le bloom
const QL = { dpr: 1, lvl: 0, n: 0, acc: 0 };
function adapt(raw) { if (LITE || QL.lvl > 1) return; QL.acc += raw; if (++QL.n < 70) return; const avg = QL.acc / QL.n; QL.n = 0; QL.acc = 0;
  if (avg > 0.042) { QL.lvl++; const d = Math.max(0.6, QL.dpr * (QL.lvl === 1 ? 0.72 : 0.55)); renderer.setPixelRatio(d); composer.setPixelRatio(d); if (QL.lvl > 1) bloom.enabled = false; } }
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
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitL = new V3();
let heart = null;
function frame() {
  if (!running) return; requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), tdt = Math.min(raw, 0.6); T += dt; adapt(raw);
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += tdt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
  S.lx += (S.mx - S.lx) * 0.06; S.ly += (S.my - S.ly) * 0.06;
  camera.position.copy(S.pos); camera.position.y += (S.walk ? Math.sin(T * 7.4) * 0.034 * S.walk : 0) + Math.sin(T * 0.9) * 0.006;
  camera.rotation.set(S.pitch - S.ly * 0.24 * S.free, S.yaw - S.lx * 0.42 * S.free, S.roll + Math.sin(T * 0.7) * S.sway + (S.walk ? Math.sin(T * 3.7) * 0.006 : 0), 'YXZ');
  if (Math.abs(camera.fov - S.fov) > 0.01) { camera.fov = S.fov; camera.updateProjectionMatrix(); }
  // station 2 : le grillage suit le regard / le pointeur
  const s1 = W.stations[1]; if (s1.fx.on) { if (touch) ndc.set(Math.sin(T * 0.7) * 0.25 + 0.12, Math.cos(T * 0.9) * 0.2); else ndc.set(S.mx, -S.my);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(s1.fx.hitPlane)[0]; if (hit) { hitL.copy(hit.point); s1.fx.mesh.worldToLocal(hitL); s1.fx.u.uHit.value.lerp(new THREE.Vector2(hitL.x, hitL.y), 0.18); } }
  // station 4 : le pouls
  if (heart) { heart.t -= dt; if (heart.t <= 0) { heart.gap = Math.min(1.35, heart.gap + 0.07); heart.t = heart.gap; sfx.thump(); W.stations[3].fx.pulse = 1; vit.bpm = 60 / heart.gap; vitals(); } }
  bloom.strength = 0.5 + W.stations[3].fx.pulse * 0.7;
  if (W.ds.visible) W.dsLight.position.set(0, 3, S.pos.z + 2);
  mouth += ((talking ? Math.abs(Math.sin(T * 21) * Math.sin(T * 6.7)) * 0.8 + mouthKick * 0.4 : 0) - mouth) * 0.35; mouthKick *= 0.8;
  if (callEl.classList.contains('on')) { drawFace(T); if (callEl.dataset.s === 'live') { const s = ((performance.now() - callStart) / 1000) | 0; callT.textContent = String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); } }
  W.update(T, dt); fx.uniforms.uTime.value = T; composer.render();
}

/* ============================== RÉCIT ============================== */
const DSY = -400;
async function act1() {
  W.setScene('ship'); S.pos.set(-4.32, 0.94, 1.3); S.yaw = -PI / 2; S.pitch = 1.45; S.free = 0.22; S.fov = 64; vit.loc = 'CAISSON 0417'; vitals();
  quest('RÉVEIL', 'Séquence de réveil en cours'); card('01', 'Réveil');
  tween(3, (k) => { fx.uniforms.uFade.value = k; });
  tween(9, (k) => { W.frost.value = k * 0.5; vit.tmp = 4 + k * 22; vit.bpm = 38 + k * 30; vitals(); }, lin);
  await wait(4.2);
  callState('ring'); const stop = sfx.ring(); quest('RÉVEIL', 'Appel entrant — Gladys, IA de bord'); await ask('Répondre'); stop(); callState('live');
  await say("Bonjour. Je suis Gladys, l'intelligence de bord du SPES. Ton cœur vient de repartir : quatre-vingt-douze battements par minute.");
  tween(5, (k) => { W.frost.value = 0.5 + k * 0.5; vit.tmp = 26 + k * 10.8; vit.bpm = 68 + k * 24; vitals(); }, lin);
  await say("Tu as dormi quatre cent soixante-quatorze ans. Ne force rien. Ton corps se souvient, laisse-le faire.");
  quest('RÉVEIL', 'Sortir du caisson'); await ask('Sortir du caisson');
  sfx.hiss(); W.guideMat.color.setHex(COL.safran).multiplyScalar(1.5);
  tween(8, (k) => { W.beacon.intensity = 26 * Math.abs(Math.sin(k * 14)); }, lin);
  await tween(2.6, (k) => { W.lidPivot.rotation.x = -k * 1.9; }, out); quest('RÉVEIL', 'Se redresser');
  await camTo({ pos: new V3(-4.0, 1.3, 1.3), yaw: -PI / 2, pitch: -0.04, fov: 60 }, 3); S.free = 1; await dbg('sit');
  const l1 = say("Regarde autour de toi. Deux mille dormeurs. Tu fais partie des premiers que je réveille.");
  await camTo({ pos: new V3(-1.3, 1.68, 1.3), yaw: -PI / 2 + 0.5, pitch: 0 }, 3.2); await l1; await dbg('stand');
  quest('RÉVEIL', "Rejoindre la baie d'observation"); await ask('Avancer'); vit.loc = 'BAIE CRYOGÉNIQUE';
  S.walk = 1; await camTo({ pos: new V3(0, 1.68, 0.4), look: new V3(0, 2.2, -15) }, 2.4); await dbg('aisle');
  const l2 = say("Avance. Je veux te montrer ce que nous avons laissé derrière nous.");
  await camTo({ pos: new V3(0, 1.68, -10.6), look: new V3(-0.4, 2.3, -15) }, 10.5, lin); S.walk = 0; await l2;
}
async function act2() {
  W.lidPivot.rotation.x = -1.9; W.frost.value = 1; vit.bpm = 92; vit.tmp = 36.8; vit.loc = "BAIE D'OBSERVATION"; vitals(); callState('live');
  card('02', 'Ce qui reste'); quest('CE QUI RESTE', 'Observer la Terre');
  await dbg('window'); await camTo({ pos: new V3(0.2, 1.72, -12.3), look: new V3(-0.9, 1.95, -15), fov: 56 }, 3.4); await dbg('earth');
  await say("Voilà la Terre. Des siècles de poussière, des océans à sec. Elle ne peut plus nous porter.");
  const pan = camTo({ pos: new V3(0.3, 1.72, -12.5), look: new V3(1.4, 2.7, -15) }, 7);
  await say("La flotte HOPE attend en orbite qu'elle guérisse. Deux cent douze vaisseaux. Et le nôtre : le SPES, Station Pour l'Éveil des Sens."); await pan; await dbg('fleet');
  await say("Car avant de redescendre un jour, tu dois réapprendre à percevoir. Pas avec tes cinq sens. Avec ceux qui regardent vers l'intérieur.");
  await say("J'ai gardé pour cela quatre œuvres d'une galerie de Saint-Étienne : Ceysson et Bénétière. Connecte-toi à la liaison. Je t'y emmène en danse sensorielle.");
  quest('CE QUI RESTE', 'Se connecter à la liaison neurale'); S.walk = 1;
  await camTo({ pos: new V3(1.9, 1.68, -11.0), look: new V3(3.3, 1.4, -12.4), fov: 60 }, 3.4); S.walk = 0; await ask('Se connecter');
  W.linkSpin = 7; sfx.glitch(2.6);
  await Promise.all([camTo({ pos: new V3(2.8, 1.55, -11.95), look: new V3(3.3, 1.35, -12.4), fov: 84 }, 2.4), tween(2.4, (k) => { fx.uniforms.uGlitch.value = k; })]);
  await tween(0.3, (k) => { fx.uniforms.uWhite.value = k; });
}
async function act3() {
  W.setScene('ds'); scene.fog.color.setHex(0x04070a); scene.fog.density = 0.042; callState('live'); hud.classList.add('ds'); vit.loc = 'DANSE SENSORIELLE'; vit.bpm = 92; vit.tmp = 36.8; vitals();
  S.pos.set(0, 1.7 + DSY, 6); S.yaw = 0; S.pitch = 0; S.fov = 60; S.free = 1; fx.uniforms.uFade.value = 1; fx.uniforms.uWhite.value = 1; fx.uniforms.uGlitch.value = 1;
  tween(1.8, (k) => { fx.uniforms.uWhite.value = 1 - k; fx.uniforms.uGlitch.value = 1 - k; });
  card('03', 'Danse sensorielle'); quest('DANSE SENSORIELLE', 'Traverser le couloir');
  await wait(2); await dbg('ds'); if (!ST0) await say("Tu es dans la danse sensorielle. Rien ici n'est réel, et pourtant ton corps va répondre. Avance.");
  for (let i = ST0; i < 4; i++) {
    const st = W.stations[i], w = WORKS[i]; document.querySelectorAll('#qL li').forEach((li) => li.classList.toggle('cur', +li.dataset.i === i));
    quest('DANSE SENSORIELLE', 'Station 0' + (i + 1) + ' — ' + w.sense); st.k = 1; S.walk = 1;
    await camTo({ pos: st.stop.pos, look: st.stop.look }, 5.2); S.walk = 0; scan(i); await wait(2.5); await dbg('st' + i);
    await say(w.a); await ask(w.verb); st.fx.on = true; let back = null;
    if (i === 0) { S.sway = 0.02; tween(7, (k) => { S.sway = 0.02 + Math.sin(k * PI) * 0.035; }, lin); }
    if (i === 2) { const p = S.pos.clone(); back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.2); camTo({ pos: p.clone().add(new V3(0, -0.62, 0)), pitch: 0.42, fov: 84 }, 3.6); }
    if (i === 3) { heart = { t: 0.2, gap: 0.62 }; tween(4, (k) => { W.dsTime = 1 - k * 0.8; S.fov = 60 - k * 7; }); }
    await wait(3); await dbg('fx' + i); await say(w.b); mark(i); await wait(1.4);
    if (i === 0) S.sway = 0; if (back) await back(); if (i === 3) { heart = null; tween(2, (k) => { W.dsTime = 0.2 + k * 0.8; S.fov = 53 + k * 7; }); }
    $('#scan').classList.remove('on');
  }
  document.querySelectorAll('#qL li').forEach((li) => li.classList.remove('cur'));
  quest('DANSE SENSORIELLE', 'Rejoindre la sortie'); S.walk = 1;
  const end = camTo({ pos: new V3(0, 1.7 + DSY, -84), look: new V3(0, 1.9 + DSY, -96) }, 9, lin);
  await say("Recalibration terminée. Ces quatre œuvres existent, et tes sens aussi. Viens les éprouver pour de vrai : galerie Ceysson et Bénétière, à Saint-Étienne, les 21 et 22 novembre 2026. Entrée libre.");
  await end; S.walk = 0; await tween(1.6, (k) => { fx.uniforms.uWhite.value = k; });
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
addEventListener('keydown', (e) => { if (!running) return; if (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'Enter') { if (pending) { e.preventDefault(); pending(); } } else if (e.code === 'Space') { e.preventDefault(); if (skipLine) skipLine(); } });
promptEl.addEventListener('click', () => pending && pending());
$('#gl').addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && pending) pending(); });
$('#bSkip').addEventListener('click', () => skipLine && skipLine());
$('#bVoice').addEventListener('click', (e) => { voiceOn = !voiceOn; if (!voiceOn && synth) synth.cancel(); e.currentTarget.classList.toggle('off', !voiceOn); });
$('#bSound').addEventListener('click', (e) => { A.on = !A.on; if (A.out) A.out.gain.setTargetAtTime(A.on ? 0.55 : 0.0001, A.ctx.currentTime, 0.2); e.currentTarget.classList.toggle('off', !A.on); });
function toDossier() { running = false; if (synth) synth.cancel(); if (A.out) A.out.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.3); document.body.classList.add('read'); $('#dossier').scrollIntoView(); }
document.querySelectorAll('[data-dossier]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toDossier(); }));
document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => { location.href = location.pathname; }));
document.addEventListener('visibilitychange', () => { if (!document.hidden && running) clock.getDelta(); });

const startBtn = $('#start'), bootMsg = $('#bootMsg');
async function boot() {
  try { await Promise.race([document.fonts.load('600 20px Rajdhani').then(() => document.fonts.load('20px "Krona One"')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* polices de secours */ }
  let ok = true; try { initGL(); } catch (e) { ok = false; console.error(e); }
  if (!ok) { bootMsg.textContent = "La 3D n'est pas disponible sur cet appareil — version texte ci-dessous."; startBtn.disabled = true; toDossier(); return; }
  bootMsg.textContent = reduce ? 'Animations réduites détectées : la version texte est recommandée.' : 'Systèmes prêts — casque conseillé.';
  startBtn.disabled = false; startBtn.textContent = 'Sortir de stase';
  startBtn.addEventListener('click', () => { audioInit(); if (synth) { try { synth.cancel(); } catch (e) { /* rien */ } } $('#boot').classList.add('gone'); document.body.classList.add('play'); run(); }, { once: true });
  if (AUTO) { $('#boot').style.display = 'none'; startBtn.click(); }
}
boot();
