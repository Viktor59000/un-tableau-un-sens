// SPES — moteur, mise en scène narrative, HUD, voix, son.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, COL } from './world.js';
import { createGladys } from './gladys.js';
import { createBody } from './corps.js';
import { LANG, T as UI, WTX, LOG, TX, SPEECH, DEC, QUO, localizeDom } from './i18n.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
// paramètres de test : ?act=2|3 ?st=0..3 ?auto ?quick ?lite ?hold=<point> ?lang=fr|en|es ?msaa=0 ?timer (voir REPRISE.md)
const ACT = +Q.get('act') || 1, ST0 = +Q.get('st') || 0, AUTO = Q.has('auto'), QUICK = Q.has('quick'), LITE = Q.has('lite'), HOLD = Q.get('hold');
const NOAO = Q.has('noao'), NOSH = Q.has('nosh');
const nextFrame = Q.has('timer') ? (f) => setTimeout(f, 16) : (f) => requestAnimationFrame(f); // ?timer : la boucle tourne même dans un onglet masqué (tests automatisés)
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
  dg.gain.setTargetAtTime(0.9, c.currentTime, 2); A.drone = dg;
  // bruits tenus, pilotés à chaque image : grain du toucher (œuvre 2), souffle de la chute (œuvre 1)
  const held = (f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const g2 = c.createGain(); g2.gain.value = 0.0001; s.connect(fl); fl.connect(g2); g2.connect(A.out); s.start(); return { f: fl, g: g2 }; };
  A.grain = held(2600, 2.5); A.air = held(500, 0.8);
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
  rumble(dur) { this.noise(dur, 62, 0.6, 0.85, 0.6); this.noise(dur, 180, 1.2, 0.22, 0.5); this.tone(41, dur, 0.2, 'sawtooth'); this.tone(27.5, dur, 0.3, 'sine'); }, // une masse passe tout près : la coque en vibre
  dawn() { for (const [f, w] of [[110, 0], [165, 0.6], [220, 1.4], [330, 2.6]]) this.tone(f, 9 - w, 0.045, 'sine', w); this.noise(9, 900, 0.5, 0.05, 4); }, // lever de soleil : un accord qui monte
  servo(dur) { this.noise(dur, 700, 6, 0.22, 1.6); this.tone(92, dur, 0.06, 'sawtooth'); },
  clack() { this.tone(160, 0.07, 0.5, 'square'); this.tone(2400, 0.04, 0.12, 'square', 0.02); this.noise(0.14, 3200, 1, 0.35); },
  thump() { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(74, c.currentTime); o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.22); o.connect(g); g.connect(A.out); env(g, c.currentTime, 0.01, 0.9, 0.3); o.start(); o.stop(c.currentTime + 0.4); },
  glitch(dur = 2) { if (!A.ctx) return; for (let i = 0; i < dur * 14; i++) this.tone(120 + Math.random() * 3000, 0.03 + Math.random() * 0.05, 0.05, 'square', Math.random() * dur); this.noise(dur, 1800, 0.4, 0.2); },
  type() { this.tone(1500 + Math.random() * 500, 0.02, 0.025, 'square'); },
  grain(v, f) { if (!A.ctx) return; const t = A.ctx.currentTime; A.grain.g.gain.setTargetAtTime(Math.max(0.0001, v * 0.16), t, 0.05); A.grain.f.frequency.setTargetAtTime(3400 - f * 2700, t, 0.08); A.grain.f.Q.setTargetAtTime(3.5 - f * 2.8, t, 0.08); },
  air(v, f = 500) { if (!A.ctx) return; const t = A.ctx.currentTime; A.air.g.gain.setTargetAtTime(Math.max(0.0001, v * 0.2), t, 0.25); A.air.f.frequency.setTargetAtTime(f, t, 0.2); },
  step() { this.noise(0.09, 190 + Math.random() * 60, 1.1, 0.12, 0.6); this.tone(72 + Math.random() * 14, 0.05, 0.1, 'sine'); },
  bubble() { if (!A.ctx) return; const c = A.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime, f = 260 + Math.random() * 280; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.09); o.connect(g); g.connect(A.out); env(g, t, 0.01, 0.05, 0.1); o.start(t); o.stop(t + 0.25); },
  room(on) { if (!A.ctx) return; A.drone.gain.setTargetAtTime(on ? 0.16 : 0.9, A.ctx.currentTime, 1.5); }, // dans la galerie, le bourdon du vaisseau s'efface
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
// analyse d'une œuvre, à la manière du scanner de Cyberpunk 2077 : des équerres se referment sur elle, une trame la balaie, puis la fiche s'écrit ligne à ligne
const lockEl = $('#lock'), lockT = $('#lockT'), lockV = new V3(); let lockSt = null, lockK = 0;
function lockFrame() { if (!lockSt) return; const w = WORKS[lockSt.i]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { lockSt.g.localToWorld(lockV.set(sx * w.w / 2, sy * w.h / 2, 0.03)).project(camera); const x = (lockV.x + 1) / 2 * innerWidth, y = (1 - lockV.y) / 2 * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = lockK, m = 14, a = innerWidth * 0.08, b = innerHeight * 0.1; x0 = a + (x0 - m - a) * k; y0 = b + (y0 - m - b) * k; x1 = innerWidth - a + (x1 + m - innerWidth + a) * k; y1 = innerHeight - b + (y1 + m - innerHeight + b) * k; // des bords de l'écran jusqu'au cadre de l'œuvre
  lockEl.style.transform = 'translate(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px)'; lockEl.style.width = (x1 - x0).toFixed(1) + 'px'; lockEl.style.height = (y1 - y0).toFixed(1) + 'px'; }
const typeIn = (sel, txt) => { const el = $(sel); el.textContent = ''; return tween(Math.max(0.12, txt.length * 0.011), (k) => { const n = Math.round(k * txt.length); if (el.textContent.length !== n) { el.textContent = txt.slice(0, n); if (n % 3 === 0) sfx.type(); } }, lin); };
async function scanArt(i) {
  const w = WORKS[i], el = $('#scan'); el.style.setProperty('--sig', w.css); lockEl.style.setProperty('--sig', w.css); $('#scN').textContent = 'CB-0' + (i + 1) + ' · ' + UI.lot; for (const q of ['#scS', '#scBy', '#scTech', '#scDef', '#scC']) $(q).textContent = '';
  lockSt = W.stations[i]; lockK = 0; lockT.textContent = ''; lockEl.className = 'on'; sfx.blip(); await tween(0.7, (k) => { lockK = k; }, out);
  lockEl.classList.add('scan'); await tween(1.7, (k) => { lockT.textContent = UI.scanning + ' ' + String(Math.round(k * 100)).padStart(3, '0') + ' %'; if (Math.random() < 0.3) sfx.type(); }, lin);
  lockEl.classList.remove('scan'); lockT.textContent = UI.identified; sfx.tone(784, 0.1, 0.09, 'triangle'); sfx.tone(1175, 0.16, 0.08, 'triangle', 0.09); el.classList.add('on');
  await typeIn('#scS', w.sense); await typeIn('#scBy', w.title + ' — ' + w.artist); await typeIn('#scTech', w.tech); await typeIn('#scDef', w.def); await typeIn('#scC', QUO[0] + w.cns + QUO[1]);
  await wait(0.5); lockEl.className = ''; lockSt = null;
}
function mark(i) { W.stations[i].done = true; const li = document.querySelector('#qL li[data-i="' + i + '"]'); if (li) li.classList.add('done'); sfx.tone(523, 0.12, 0.1, 'triangle'); sfx.tone(784, 0.2, 0.1, 'triangle', 0.1); }
const vit = { bpm: 8, tmp: 4, loc: '' }, bpmEl = $('#bpm'), tmpEl = $('#tmp'), ecgC = $('#ecg'), eg = ecgC.getContext('2d'); let ecgP = 0, vitN = 0;
function vitals() { $('#loc').textContent = vit.loc; vitN = 0; }
// constantes vivantes : le pouls et la température oscillent autour de leur valeur, le tracé bat au rythme du pouls
const ecgY = (p) => { p -= Math.floor(p); const g = (c, w, a) => a * Math.exp(-(((p - c) / w) ** 2)); return g(0.18, 0.035, 0.14) - g(0.285, 0.012, 0.22) + g(0.31, 0.014, 1) - g(0.34, 0.014, 0.3) + g(0.56, 0.06, 0.26); }; // ondes P, QRS, T
function vitalsLive(dt) {
  ecgP += dt * vit.bpm / 60; if (--vitN < 0) { vitN = 24; bpmEl.textContent = Math.max(0, Math.round(vit.bpm + Math.sin(T * 1.7) * 1.4 + Math.sin(T * 0.43) * 1.1)); tmpEl.textContent = (vit.tmp + Math.sin(T * 0.31) * 0.06 + Math.sin(T * 1.13) * 0.04).toFixed(1).replace('.', DEC); }
  if (frameN % 2) return; const w = ecgC.width, h = ecgC.height; eg.clearRect(0, 0, w, h); eg.lineWidth = 2.5; eg.lineJoin = 'round'; eg.strokeStyle = '#ff4f38'; eg.shadowColor = '#ff4f38'; eg.shadowBlur = 8; eg.beginPath();
  for (let x = 0; x <= w; x += 2) { const y = h * 0.68 - ecgY(ecgP - (w - x) / w * 2.4) * h * 0.58; if (x) eg.lineTo(x, y); else eg.moveTo(x, y); } eg.stroke(); eg.shadowBlur = 0; eg.fillStyle = '#f1f2f4'; eg.fillRect(w - 5, h * 0.68 - ecgY(ecgP) * h * 0.58 - 2.5, 5, 5); }

/* mini-carte : plan du pont ou de la galerie, centré sur toi, cap vers le haut ; le losange safran est l'objectif */
const mapC = $('#mapC'), mg = mapC.getContext('2d'), clockEl = $('#clock'); let GOAL = null, clockS = -1;
function drawMap() {
  const w = mapC.width, u = w / 172, c = w / 2, cy = w * 0.58, ds = W.ds.visible, P = ds ? W.planDs : W.planShip, sc = (ds ? 5.6 : 9.5) * u, yaw = camera.rotation.y;
  const k = ds ? W.ds.scale.x : 1, px = ds ? (S.pos.x - W.ds.position.x) / k : S.pos.x, pz = ds ? (S.pos.z - W.ds.position.z) / k : S.pos.z; // dans la galerie agrandie (œuvre 3), on reste à l'échelle du plan
  mg.clearRect(0, 0, w, w); mg.save(); mg.translate(c, cy); mg.rotate(yaw); mg.scale(sc, sc); mg.translate(-px, -pz); mg.lineCap = 'round';
  mg.fillStyle = 'rgba(127,227,230,.16)'; mg.strokeStyle = 'rgba(127,227,230,.5)'; mg.lineWidth = 1 * u / sc; for (const [x, z, bw, bd] of P.boxes) { mg.fillRect(x - bw / 2, z - bd / 2, bw, bd); mg.strokeRect(x - bw / 2, z - bd / 2, bw, bd); }
  mg.beginPath(); for (const [x1, z1, x2, z2] of P.soft) { mg.moveTo(x1, z1); mg.lineTo(x2, z2); } mg.stroke();
  mg.strokeStyle = 'rgba(160,238,240,.95)'; mg.lineWidth = 1.8 * u / sc; mg.beginPath(); for (const [x1, z1, x2, z2] of P.walls) { mg.moveTo(x1, z1); mg.lineTo(x2, z2); } mg.stroke();
  if (P.path && P.path.length) { mg.strokeStyle = 'rgba(255,79,56,.9)'; mg.lineWidth = 1.3 * u / sc; mg.setLineDash([0.35, 0.5]); mg.beginPath(); mg.moveTo(P.path[0], P.path[1]); for (let i = 2; i < P.path.length; i += 2) mg.lineTo(P.path[i], P.path[i + 1]); mg.stroke(); mg.setLineDash([]);
    W.stations.forEach((st, i) => { const x = st.stop.pos.x, z = st.stop.pos.z, r = 0.75; mg.beginPath(); mg.moveTo(x, z - r); mg.lineTo(x + r, z); mg.lineTo(x, z + r); mg.lineTo(x - r, z); mg.closePath(); mg.strokeStyle = WORKS[i].css; mg.lineWidth = 1.5 * u / sc; mg.stroke(); if (st.done) { mg.fillStyle = WORKS[i].css; mg.fill(); } }); }
  mg.restore();
  if (GOAL) { let vx = (GOAL[0] - px) * sc, vz = (GOAL[1] - pz) * sc, x = vx * Math.cos(yaw) - vz * Math.sin(yaw), y = vx * Math.sin(yaw) + vz * Math.cos(yaw); const d = Math.hypot(x, y), R = c - 16 * u; if (d > R) { x *= R / d; y *= R / d; } // hors champ : l'objectif reste accroché au bord
    const r = (5 + Math.sin(T * 4)) * u; x += c; y = Math.max(14 * u, Math.min(w - 14 * u, y + cy)); mg.beginPath(); mg.moveTo(x, y - r); mg.lineTo(x + r, y); mg.lineTo(x, y + r); mg.lineTo(x - r, y); mg.closePath(); mg.fillStyle = '#f5c400'; mg.fill(); }
  mg.fillStyle = '#ff4f38'; mg.beginPath(); mg.moveTo(c, cy - 8 * u); mg.lineTo(c + 5.5 * u, cy + 6 * u); mg.lineTo(c, cy + 3 * u); mg.lineTo(c - 5.5 * u, cy + 6 * u); mg.closePath(); mg.fill(); // toi
  mg.strokeStyle = 'rgba(127,227,230,.22)'; mg.lineWidth = u; mg.beginPath(); mg.arc(c, cy, 46 * u, 0, PI * 2); mg.stroke();
  const sec = (T | 0); if (sec !== clockS) { clockS = sec; const s = 24120 + sec; clockEl.textContent = 'J+173 141 · ' + String((s / 3600) | 0).padStart(2, '0') + ':' + String(((s / 60) | 0) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
}

// portrait de Gladys : un visage 3D rendu dans son propre canevas (app/gladys.js) ; à défaut — pas de second contexte 3D, ou ?lite — un relevé en lignes de contour.
// Dans les deux cas la bouche suit le signal de la voix.
const fcv = $('#face'); let fc = null, G3 = null, mouth = 0;
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
  const ring = callEl.dataset.s === 'ring'; if (G3) { if (frameN % 2 === 0) G3.render(t, mouth, ring); return; } if (!fc) return;
  const w = fcv.width, h = fcv.height, kx = w / 184; fc.clearRect(0, 0, w, h);
  const yaw = Math.sin(t * 0.55) * 0.24, tilt = 0.44, cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), stl = Math.sin(tilt);
  fc.lineWidth = 1.6 * kx;
  for (let j = 0; j < 48; j++) {
    const v = -1.08 + j * (2.24 / 47); let pen = false; fc.beginPath();
    const jit = ring ? (Math.random() - 0.5) * 6 * (Math.random() < 0.15 ? 1 : 0) : 0;
    for (let i = 0; i <= 60; i++) { const u = -1 + i / 30, z = headZ(u, v, mouth); if (z <= 0) { pen = false; continue; }
      const px = w / 2 + (u * cy + z * sy * 0.7) * 96 * kx + jit, py = h * 0.5 + (v * ct - z * stl * 0.55) * 104 * kx; if (pen) fc.lineTo(px, py); else { fc.moveTo(px, py); pen = true; } }
    fc.strokeStyle = ring ? 'rgba(255,79,56,' + (0.25 + 0.3 * Math.abs(Math.sin(t * 6 + j))) + ')' : 'rgba(127,227,230,' + (j % 3 ? 0.42 : 0.85) + ')'; fc.stroke();
  }
  if (!ring && (t % 4.3) > 0.13) { fc.fillStyle = 'rgba(241,242,244,.95)'; for (const ex of [-0.3, 0.3]) { const z = headZ(ex, -0.12, 0); fc.fillRect(w / 2 + (ex * cy + z * sy * 0.7) * 96 * kx - 7 * kx, h * 0.5 + (-0.12 * ct - z * stl * 0.55) * 104 * kx - kx, 14 * kx, 3 * kx); } }
}

/* ============================== MOTEUR ============================== */
let renderer, composer, bloom, gtao, fx, scene, camera, W, running = false, T = 0, frameN = 0;
const clock = new THREE.Clock();
const S = { pos: new V3(), yaw: 0, pitch: 0, roll: 0, fov: 60, mx: 0, my: 0, lx: 0, ly: 0, free: 1, walk: 0, sway: 0 };
const FX = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAb: { value: 0.0018 }, uFade: { value: 0 }, uWhite: { value: 0 }, uCold: { value: 0 }, uWarm: { value: 0 }, uTunnel: { value: 0 }, uPulse: { value: 0 }, uSurge: { value: 0 }, uExpo: { value: 1.1 }, uSharp: { value: 0 }, uTexel: { value: new THREE.Vector2(0.001, 0.001) }, tBloom: { value: null }, uBloom: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform sampler2D tBloom;uniform float uTime,uGlitch,uAb,uFade,uWhite,uCold,uWarm,uTunnel,uPulse,uSurge,uExpo,uSharp,uBloom;uniform vec2 uTexel;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    /* mise en tons ACES et passage en sRGB : mêmes formules que la passe de sortie de three.js, fusionnées ici pour économiser une passe plein écran */
    vec3 rrt(vec3 v){vec3 a=v*(v+0.0245786)-0.000090537;vec3 b=v*(0.983729*v+0.4329510)+0.238081;return a/b;}
    vec3 aces(vec3 c){const mat3 mi=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));const mat3 mo=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));return clamp(mo*rrt(mi*(c*uExpo/0.6)),0.,1.);}
    vec3 srgb(vec3 v){return mix(pow(v,vec3(0.41666))*1.055-vec3(0.055),v*12.92,vec3(lessThanEqual(v,vec3(0.0031308))));}
    void main(){ vec2 uv=.5+(vUv-.5)*(1.-uPulse*.014); float g=uGlitch;
      if(g>.001){ float band=floor(uv.y*mix(14.,56.,h(vec2(floor(uTime*13.),1.)))); float r=h(vec2(band,floor(uTime*21.)));
        uv.x+=(r-.5)*.3*g*step(.6,r); uv.y+=(h(vec2(floor(uTime*9.),band))-.5)*.03*g; }
      vec2 d=uv-.5; float ab=uAb*(.4+dot(d,d)*3.)+g*.03;
      vec3 c=vec3(texture2D(tDiffuse,uv+d*ab).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-d*ab).b);
      if(uSharp>.001){ vec3 nb=texture2D(tDiffuse,uv+vec2(uTexel.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(uTexel.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,uTexel.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,uTexel.y)).rgb; c=max(c+(c-nb*.25)*uSharp,0.); } /* définition interne réduite : on redonne du piqué */
      c+=texture2D(tBloom,uv).rgb*uBloom;
      if(g>.15){ float b=h(floor(uv*vec2(26.,15.))+floor(uTime*17.)); if(b>1.-g*.16) c=c.gbr*1.7+vec3(.02,.0,.03); }
      float r2=dot(d,d); c*=1.-r2*.95;
      c*=mix(1.,smoothstep(.36,.02,r2)*.9+.1,uTunnel); c=mix(c,c*vec3(1.14,.97,.8),uTunnel*.55);                                  /* tunnel : le monde s'éteint autour du regard */
      float fz=smoothstep(.1,.44,r2+(h(floor(uv*vec2(230.,130.)))-.5)*.1); c=mix(c,c*vec3(.7,.9,1.18)+vec3(.03,.07,.12)*fz,uCold*(.3+.7*fz)); /* froid du fer : givre sur les bords */
      c=mix(c,c*vec3(1.12,1.,.86),uWarm*.5); c+=vec3(.55,.04,.02)*uPulse*r2*1.3;                                                  /* tiédeur de la résine ; battement du cœur */
      float sa=atan(d.y,d.x); float sr=pow(abs(sin(sa*17.+h(vec2(floor(sa*7.),floor(uTime*22.)))*6.28)),22.); c+=(vec3(.3,.9,1.)*sr*smoothstep(.05,.5,r2)*2.4+vec3(.16,.5,.6)*r2*1.6)*uSurge; /* branchement : décharge venue des bords */
      c+=(h(uv*vec2(1731.,977.)+uTime*61.)-.5)*.022;
      c=mix(c*uFade,vec3(2.2),uWhite); gl_FragColor=vec4(srgb(aces(c)),1.); }` };
// Fluidité : on vise 60 images/s. Comme dans les jeux, c'est d'abord la définition interne du rendu 3D qui s'ajuste (par pas de 5 %,
// compensée par une accentuation dans la passe finale ; l'interface, elle, reste nette), et seulement en dernier recours les effets.
// Les images d'un onglet en arrière-plan ne comptent pas ; ?noadapt fige tout, ?timer aussi (la boucle de test ne suit pas l'écran).
const QL = { dpr: 1, scale: 1, min: 0.7, lvl: touch ? 1 : 0, n: 0, acc: 0, warm: 2, ok: 0, up: false, block: 0 }, MSAA = LITE || touch ? 0 : (Q.has('msaa') ? +Q.get('msaa') : 4); // anticrénelage : indispensable aux filets fins de la galerie
function setScale(k) { QL.scale = k; const d = QL.dpr * k; renderer.setPixelRatio(d); composer.setPixelRatio(d); msSize(); fx.uniforms.uSharp.value = Math.min(0.8, (1 - k) * 2.4); fx.uniforms.uTexel.value.set(1 / (innerWidth * d), 1 / (innerHeight * d)); if (W.pathU) W.pathU.uPx.value = d * innerHeight / 760; if (W.dustU) W.dustU.uPx.value = d * innerHeight / 734; }
function adapt(raw) { if (LITE || Q.has('noadapt') || Q.has('timer') || raw > 0.4 || document.hidden) return; QL.acc += raw; if (++QL.n < 30) return; const avg = QL.acc / QL.n * 1000; QL.n = 0; QL.acc = 0;
  if (QL.warm-- > 0) return; // les premières mesures (compilation des shaders) sont ignorées
  if (avg > 18.4) { QL.ok = 0; if (QL.up) QL.block = T + 40; QL.up = false; // sous ~54 images/s : on allège (et si c'était un essai de remontée, on n'en retente pas avant 40 s)
    if (QL.scale > QL.min + 0.001) setScale(Math.max(QL.min, QL.scale - (avg > 24 ? 0.1 : 0.05)));
    else if (QL.lvl < 5) { QL.lvl++; // ordre des sacrifices une fois la définition au plancher : occlusion ambiante, plancher plus bas, ombres, anticrénelage, bloom
      if (QL.lvl === 2) QL.min = 0.55; if (QL.lvl === 3) for (const l of W.shadowLights) l.castShadow = false;
      if (QL.lvl === 4 && msRT) { msRT.dispose(); msRT = null; } if (QL.lvl === 5) bloom.enabled = false; } }
  else if (avg < 17.4) { if (QL.scale < 1 && T > QL.block && ++QL.ok >= 6) { QL.ok = 0; QL.up = true; setScale(Math.min(1, QL.scale + 0.05)); } else if (QL.up && QL.ok >= 2) QL.up = false; } // trois secondes à 60 images/s : on tente de remonter d'un cran
  else QL.ok = 0; }
// La scène est rendue dans une cible multi-échantillonnée, résolue UNE fois, puis recopiée dans la chaîne de post-traitement :
// donner des échantillons aux tampons du composer coûtait une résolution par passe (≈ +17 ms par image sur carte intégrée).
let msRT = null, msQuad = null; const msSize = () => { if (msRT) { const r = QL.dpr * QL.scale; msRT.setSize(Math.floor(innerWidth * r), Math.floor(innerHeight * r)); } };
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
  const dpr = LITE ? 0.5 : Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.25); QL.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = !LITE && !NOSH; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.localClippingEnabled = true;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020306); scene.fog = new THREE.FogExp2(0x0a1016, 0.034);
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1600);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  W = buildWorld(scene, new THREE.TextureLoader(), WORKS, TX, { lite: LITE, touch, reel: Q.has('reel') });
  { let wt = 0; THREE.DefaultLoadingManager.onLoad = () => { clearTimeout(wt); wt = setTimeout(() => { if (W.warm && !W.ds.visible) W.warm(renderer, camera); menu(); }, 300); }; } /* modèles chargés : on prépare les programmes des états d'éclairage */ BODY = createBody(scene); window.__spes = { renderer, QL, scene, W, S, BODY };
  composer = new EffectComposer(renderer); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); const rp = new RenderPass(scene, camera); composer.addPass(rp);
  if (MSAA) { msRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MSAA, depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType) }); msSize(); const base = rp.render.bind(rp), quad = msQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null } }, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=vec4(clamp(texture2D(tDiffuse,vUv).rgb,0.,24.),1.);}' })); // la recopie borne aussi les pics de reflet avant le bloom
    rp.render = (r, wb, rb, d, mk) => { if (!msRT) return base(r, wb, rb, d, mk); base(r, wb, msRT, d, mk); if (gtao.enabled) return; quad.material.uniforms.tDiffuse.value = msRT.texture; r.setRenderTarget(rb); quad.render(r); }; }
  // occlusion ambiante (demi-résolution) : ancre les objets au sol ; les objets transparents/lumineux n'y participent pas
  gtao = new GTAOPass(scene, camera, 256, 256); const gs = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => gs(Math.ceil(w * 0.5), Math.ceil(h * 0.5));
  gtao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.4, thickness: 1.3, scale: 1.25, samples: 8 }); gtao.blendIntensity = 0.95;
  gtao.overrideVisibility = function () { const c = this._visibilityCache; this.scene.traverse((o) => { c.set(o, o.visible); if (o.userData.twin || o.isPoints || o.isLine || o.isSprite || (o.isMesh && o.material && !o.material.userData.ao && (o.material.transparent || o.material.isMeshBasicMaterial || o.material.isShaderMaterial))) o.visible = false; }); };
  if (msRT) { gtao._renderGBuffer = false; gtao.depthTexture = msRT.depthTexture; for (const m of [gtao.gtaoMaterial, gtao.pdMaterial]) { m.defines.NORMAL_VECTOR_TYPE = 0; m.defines.DEPTH_SWIZZLING = 'x'; m.uniforms.tDepth.value = msRT.depthTexture; m.needsUpdate = true; } } /* normales reconstruites depuis la profondeur : une passe de géométrie en moins */
  // Avec la cible multi-échantillonnée, la passe est réécrite : elle relit directement la scène résolue (et la borne), et répartit son calcul
  // sur deux images — l'occlusion une image, son débruitage la suivante. Le voile d'ombre a donc une à deux images de retard, ce qui ne se voit pas.
  { const full = gtao.render.bind(gtao); let n = 0; gtao.render = function (r, wb, rb) { if (!msRT) return full(r, wb, rb); const g = this.gtaoMaterial.uniforms, cam = this.camera, both = n < 2;
      if (both || n % 2 === 0) { g.cameraNear.value = cam.near; g.cameraFar.value = cam.far; g.cameraProjectionMatrix.value.copy(cam.projectionMatrix); g.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse); g.cameraWorldMatrix.value.copy(cam.matrixWorld); this.renderPass(r, this.gtaoMaterial, this.gtaoRenderTarget, 0xffffff, 1.0); }
      if (both || n % 2 === 1) { this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse); this.renderPass(r, this.pdMaterial, this.pdRenderTarget, 0xffffff, 1.0); } n++;
      msQuad.material.uniforms.tDiffuse.value = msRT.texture; r.setRenderTarget(wb); msQuad.render(r);
      this.blendMaterial.uniforms.intensity.value = this.blendIntensity; this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture; this.renderPass(r, this.blendMaterial, wb); }; }
  gtao.enabled = !LITE; composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.92); bloom.enabled = !LITE; bloom.blendMaterial.visible = false; composer.addPass(bloom); /* son résultat est ajouté par la passe finale (tBloom) : une passe plein écran en moins */
  fx = new ShaderPass(FX); fx.uniforms.tBloom.value = bloom.renderTargetsHorizontal[0].texture; composer.addPass(fx); Object.assign(window.__spes, { composer, bloom, gtao, camera, setScale }); setScale(1);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); setScale(QL.scale); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}
const tweens = [];
const io = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2), lin = (k) => k, out = (k) => 1 - Math.pow(1 - k, 3);
function tween(dur, fn, ease = io) { if (QUICK) dur *= 0.12; const tw = { t: 0, dur: Math.max(0.001, dur), fn, ease }, p = new Promise((res) => { tw.res = res; tweens.push(tw); }); p.stop = () => { const i = tweens.indexOf(tw); if (i >= 0) { tweens.splice(i, 1); tw.res(); } }; return p; } // .stop() interrompt une animation tenue
const wait = (s) => tween(s, () => {}, lin);
function aim(from, to) { const d = new V3().subVectors(to, from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; }
function camTo(o, dur = 2, ease = io) {
  const p0 = S.pos.clone(), p1 = o.pos || p0.clone(); let y1 = S.yaw, q1 = S.pitch; if (o.look) { const a = aim(p1, o.look); y1 = a.yaw; q1 = a.pitch; }
  if (o.yaw != null) y1 = o.yaw; if (o.pitch != null) q1 = o.pitch;
  const y0 = S.yaw, dy = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)), q0 = S.pitch, f0 = S.fov, f1 = o.fov || f0;
  return tween(dur, (k) => { S.pos.lerpVectors(p0, p1, k); S.yaw = y0 + dy * k; S.pitch = q0 + (q1 - q0) * k; S.fov = f0 + (f1 - f0) * k; }, ease);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitL = new V3(), hit2 = new THREE.Vector2();
let heart = null, bloomBase = 0.5, stepT = 0, BODY = null; // BODY : le corps du visiteur (app/corps.js)
function frame() {
  if (!running) return; nextFrame(frame); if (window.__spes.pause) { clock.getDelta(); return; } /* __spes.pause = true : fige la boucle, pour chronométrer composer.render() à la main */
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1), tdt = Math.min(raw, 0.6); T += dt; adapt(raw);
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += tdt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
  if (MENU) { S.yaw = MENU.yaw + Math.sin(T * 0.13) * MENU.amp; S.pitch = MENU.pitch + Math.sin(T * 0.09) * 0.012; } /* accueil et fin : la caméra dérive à peine */
  if (touch && !drag) { S.mx *= 0.97; S.my *= 0.97; } S.lx += (S.mx - S.lx) * 0.06; S.ly += (S.my - S.ly) * 0.06;
  camera.position.copy(S.pos); camera.position.y += (S.walk ? Math.sin(T * 7.4) * 0.034 * S.walk : 0) + Math.sin(T * 0.9) * 0.006;
  camera.rotation.set(S.pitch - S.ly * 0.24 * S.free, S.yaw - S.lx * 0.42 * S.free, S.roll + Math.sin(T * 0.7) * S.sway + (S.walk ? Math.sin(T * 3.7) * 0.006 : 0), 'YXZ');
  const asp = camera.aspect, vf = asp >= 1.15 ? S.fov : Math.min(104, 2 * Math.atan(Math.tan(S.fov * 0.95 * PI / 360) / Math.max(0.4, asp * 0.98)) * 180 / PI);
  if (Math.abs(camera.fov - vf) > 0.01) { camera.fov = vf; camera.updateProjectionMatrix(); }
  // station 2 : la matière se soulève là où porte le regard
  touchFx(dt);
  // station 4 : le pouls
  if (heart) { heart.t -= dt; if (heart.t <= 0) { heart.gap = Math.min(1.35, heart.gap + 0.07); heart.t = heart.gap; sfx.thump(); W.stations[3].fx.pulse = 1; vit.bpm = 60 / heart.gap; vitals(); } }
  bloom.strength = bloomBase + W.stations[3].fx.pulse * 0.5; fx.uniforms.uPulse.value = W.stations[3].fx.pulse;
  if (S.walk > 0.5 && W.ds.visible) { stepT -= dt; if (stepT <= 0) { stepT = 0.56; sfx.step(); } } // tes pas sur la résine du sol
  // bouche du portrait : amplitude réelle de la voix quand elle joue, sinon mouvement générique
  let m = 0; if (talking) { if (A.vAna) { A.vAna.getByteTimeDomainData(A.vBuf); let s = 0; for (let i = 0; i < 512; i += 4) { const x = (A.vBuf[i] - 128) / 128; s += x * x; } m = Math.min(1, Math.sqrt(s / 128) * 5.5); }
    if (m < 0.02 && (!A.ctx || QUICK || !voiceOn)) m = Math.abs(Math.sin(T * 21) * Math.sin(T * 6.7)) * 0.8; }
  mouth += (m - mouth) * 0.4;
  if (frameN % 2 === 1) drawMap(); vitalsLive(dt); lockFrame();
  if (callEl.classList.contains('on')) { drawFace(T); callEl.style.setProperty('--amp', mouth.toFixed(2)); if (callEl.dataset.s === 'live') { const s = ((performance.now() - callStart) / 1000) | 0; callT.textContent = String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); } }
  frameN++; if (W.bay.visible) { const kz = Math.max(-10.5, Math.min(12, S.pos.z - 0.6)); W.keyLight.position.z = kz; W.keyLight.target.position.z = kz; if (frameN % 3 === 0) W.keyLight.shadow.needsUpdate = true; } // le projecteur principal suit le visiteur ; son ombre est recalculée une image sur trois
  gtao.enabled = !LITE && !NOAO && QL.lvl < 1 && (MSAA === 0 || !!msRT); if (gtao.enabled) { gtao.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix); gtao.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); gtao.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse); }
  BODY.update(dt, T, S); W.update(T, dt, camera.position); fx.uniforms.uTime.value = T; fx.uniforms.uExpo.value = renderer.toneMappingExposure; fx.uniforms.uBloom.value = bloom.enabled ? 1 : 0; composer.render();
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
  await tween(2.6, (k) => { W.lidPivot.rotation.x = -k * 1.9; }, out); quest(P1, UI.q.sit); BODY.set({ pose: 'sit', vis: true, rust: 1 });
  await camTo({ pos: new V3(-4.0, 1.58, 1.3), yaw: -PI / 2, pitch: -0.04, fov: 60 }, 3); S.free = 1; await dbg('sit');
  // ce corps n'a pas bougé depuis 474 ans : on baisse les yeux, on lève ses mains qui tremblent, on les regarde
  quest(P1, UI.q.hands); const l1 = say('g04'); BODY.set({ pose: 'hands' }); await camTo({ pitch: -0.62, fov: 56 }, 1.8); await dbg('hands'); await wait(2.4); BODY.set({ pose: 'sit' }); await camTo({ pitch: -0.1, fov: 60 }, 1.3);
  // sortir du caisson : les mains agrippent les bords, on pivote, les jambes passent par-dessus le rebord, les pieds touchent le sol, on se redresse
  quest(P1, UI.q.exit); BODY.set({ pose: 'grip' }); W.vent(); await camTo({ yaw: -PI / 2 - 0.3, pitch: -0.95, fov: 66 }, 1.4); await wait(0.4);
  sfx.servo(0.9); BODY.set({ pose: 'edge' }); await camTo({ pos: new V3(-3.95, 1.5, 1.72), yaw: -PI, pitch: -1.08, fov: 70 }, 2.3); await dbg('edge'); await wait(0.7);
  quest(P1, UI.q.look); BODY.set({ pose: 'stand' }); tween(3, (k) => { S.sway = Math.sin(k * PI) * 0.03; }, lin); // on tient debout, mais ça tangue
  await camTo({ pos: new V3(-3.9, 1.66, 2.28), pitch: -1.3 }, 1.5, out); sfx.thump(); await dbg('debout'); await wait(0.5); await camTo({ pitch: -0.05, fov: 60 }, 1.3);
  await camTo({ pos: new V3(-2.9, 1.66, 2.3), look: new V3(-4.2, 0.95, 3.9) }, 2.6); await camTo({ pos: new V3(-3.72, 1.58, 2.86), look: new V3(-4.36, 0.86, 3.9), fov: 50 }, 3.4); await dbg('voisin'); await wait(2.2);
  await camTo({ pos: new V3(-1.3, 1.68, 1.9), yaw: -PI / 2 + 0.4, pitch: 0.04, fov: 60 }, 3); await l1; await dbg('stand');
  quest(P1, UI.q.obs); GOAL = [0, -11.6]; await ask(UI.a.walk); vit.loc = UI.loc[1]; vitals();
  S.walk = 1; await camTo({ pos: new V3(0, 1.68, 0.6), yaw: -0.5, pitch: -1.0, fov: 64 }, 3.4); await dbg('aisle'); // premiers pas : on regarde ses pieds avancer
  tween(9, (k) => BODY.set({ rust: 1 - k })); // le corps se dérouille en marchant
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
  BODY.set({ pose: 'stand', vis: true, rust: 0 }); W.lidPivot.rotation.x = -1.9; W.frost.value = 1.4; W.wakeHold = false; vit.bpm = 92; vit.tmp = 36.8; vit.loc = UI.loc[2]; vitals(); callState('live');
  card('02', UI.card[1]); quest(P2, UI.q.earth); GOAL = null;
  // on s'avance jusqu'au garde-corps, on y pose les mains ; en relevant les yeux, on croise son propre reflet dans le verre, puis la Terre
  await dbg('window'); S.walk = 1; await camTo({ pos: new V3(0.12, 1.72, -13.2), yaw: 0.03, pitch: -0.3, fov: 60 }, 2.6); S.walk = 0; BODY.set({ pose: 'rail' });
  await camTo({ pitch: -0.62 }, 0.9); sfx.thump(); await dbg('rail'); await wait(0.7);
  await camTo({ look: new V3(0.12, 1.69, -15.3), fov: 54 }, 1.8); await dbg('reflet'); await wait(1.6);
  await camTo({ look: new V3(-0.55, 2.05, -15), fov: 56 }, 2.4); await dbg('earth');
  // le soleil se lève derrière la Terre : un fil de lumière au limbe, puis il perce, la baie s'éclaire, la flotte sort de l'ombre
  sfx.dawn(); tween(8, (k) => W.setSun(0.1 * k), out).then(() => tween(17, (k) => W.setSun(0.1 + 0.9 * k)));
  await say('g06'); await dbg('sun');
  // une arche nous dépasse, tout près, au-dessus de la baie : la coque en tremble, puis elle rejoint la flotte
  sfx.rumble(10); tween(17, (k) => { W.flyby(k); const e = Math.exp(-(((k - 0.3) / 0.17) ** 2)); S.roll = Math.sin(k * 610) * 0.005 * e; }, lin);
  const pan = camTo({ pos: new V3(0.2, 1.72, -13.2), look: new V3(-0.25, 3.25, -15) }, 7); await say('g07'); await pan; await dbg('fleet');
  quest(P2, UI.q.askG); const c = await choose(UI.ch2); await say(c ? 'g08b' : 'g08a');
  await say('g09');
  quest(P2, UI.q.link); GOAL = [W.seat.chair.x, W.seat.chair.z]; const l = say('g10'); BODY.set({ pose: 'stand' }); S.walk = 1; sfx.servo(1.6); tween(2.6, (k) => W.seatWake(k)); // le poste s'éveille à l'approche
  await camTo({ pos: W.seat.front.clone().setY(1.68), look: W.seat.chair, fov: 60 }, 3.8); S.walk = 0; await l; await dbg('link');
  await ask(UI.a.seat); GOAL = null; vit.loc = UI.loc[3]; vitals();
  await camTo({ pos: W.seat.front.clone().setY(1.68), yaw: W.seat.yaw, pitch: -0.08 }, 1.7); // demi-tour : dos au fauteuil
  BODY.set({ pose: 'seat' }); sfx.servo(1.4); await camTo({ pos: W.seat.eye, yaw: W.seat.yaw, pitch: -0.98, fov: 66 }, 2.3, out); sfx.thump(); // on se laisse tomber dans l'assise, les yeux sur ses genoux et ses mains
  await wait(0.4); sfx.servo(1); await tween(1.0, (k) => W.setArms(k)); sfx.thump(); // les accoudoirs se referment sous les avant-bras
  await wait(0.25); sfx.clack(); await tween(0.45, (k) => W.setClamp(k), out); await dbg('clamp'); await wait(0.9); // puis les bracelets, sur les poignets
  await camTo({ pitch: 0.08, fov: 60 }, 1.5); S.free = 0.45; await dbg('seat');
  // lien neural : la fiche du câble cervical se présente devant toi, ouvre ses griffes, puis va se verrouiller derrière la nuque
  quest(P2, UI.q.cable); const l2 = say('g10b'); sfx.servo(2.4);
  await tween(2.6, (k) => W.setCable(k * 0.52)); await dbg('plug'); await wait(0.9); await tween(0.6, (k) => W.setCable(0.52 + k * 0.48), out);
  sfx.clack(); sfx.glitch(1.2); W.cableOn(1); tween(2.4, (k) => W.seatWake(1 + 2.2 * (1 - k)), out); vit.bpm = 118; vitals(); sense(UI.sense.l[0], UI.sense.l[1], UI.sense.l[2], '#7fe3e6');
  tween(1.7, (k) => { const e = (1 - k) * (1 - k); S.roll = Math.sin(k * PI * 4) * 0.04 * (1 - k); fx.uniforms.uGlitch.value = 0.6 * (1 - k); fx.uniforms.uSurge.value = e; S.fov = 60 + 7 * e; }, lin); // décharge : l'image saute, des filaments de lumière fusent des bords
  await dbg('cable'); await wait(1.9); sense(null); tween(3, (k) => { vit.bpm = 118 - 14 * k; });
  quest(P2, UI.q.visor); W.linkSpin = 7; sfx.servo(2.8); const v = $('#visor');
  await tween(2.2, (k) => W.setVisor(k * 0.8)); await dbg('visor0'); await tween(1.0, (k) => { W.setVisor(0.8 + k * 0.2); if (k > 0.3) v.classList.add('on'); }); await dbg('visor'); await l2; // le casque se rabat depuis le dessus de la tête
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
// mesure affichée pendant qu'un sens s'éveille : elle met un chiffre sur ce que le corps éprouve
const senseEl = $('#sense'); let senseK = '';
function sense(t, v, s, col) { if (t == null) { senseEl.classList.remove('on'); senseK = ''; return; } const k = t + '|' + v + '|' + s; if (k !== senseK) { senseK = k; $('#senseT').textContent = t; $('#senseV').textContent = v; $('#senseS').textContent = s || ''; } if (col) senseEl.style.setProperty('--sig', col); senseEl.classList.add('on'); }
function senseAt(x, y) { if (x == null) { senseEl.classList.remove('tag'); senseEl.style.left = senseEl.style.top = ''; return; } senseEl.classList.add('tag'); senseEl.style.left = Math.max(8, Math.min(innerWidth - 250, x + 28)) + 'px'; senseEl.style.top = Math.max(8, Math.min(innerHeight - 210, y + 24)) + 'px'; }
// œuvre 2 : la matière répond au regard — relief sous l'œil, froid du fer ou tiédeur de la résine, grain sonore
let feel = 0.5, lastMat = -1, matT = 0; const lastHit = new THREE.Vector2();
function touchFx(dt) {
  const s1 = W.stations[1], u = fx.uniforms, a = s1.fx.amp.value; u.uCold.value = (1 - feel) * a * 0.9; u.uWarm.value = feel * a;
  if (!s1.fx.on) { if (lastMat >= 0) { lastMat = -1; sfx.grain(0, 0.5); } return; }
  if (gaze.x > 2) ndc.set(Math.sin(T * 0.6) * 0.34, Math.cos(T * 0.8) * 0.26); else ndc.copy(gaze);
  ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(s1.fx.hitPlane)[0]; if (!hit) return;
  hitL.copy(hit.point); s1.fx.mesh.worldToLocal(hitL); lastHit.copy(s1.fx.hit); if (s1.fx.hit.x > 5) s1.fx.hit.set(hitL.x, hitL.y); s1.fx.hit.lerp(hit2.set(hitL.x, hitL.y), 0.16);
  const resin = s1.fx.satAt(s1.fx.hit.x, s1.fx.hit.y) > 0.17 ? 1 : 0, sp = lastHit.distanceTo(s1.fx.hit) / Math.max(dt, 0.004); feel += ((lastMat > 0 ? 1 : 0) - feel) * 0.1;
  if (resin === lastMat) matT = 0; else if ((matT += dt) > 0.25 || lastMat < 0) { lastMat = resin; matT = 0; if (touch && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(resin ? 8 : 16); sfx.tone(resin ? 420 : 1900, 0.05, 0.03, 'sine'); } // la matière ne bascule qu'après un quart de seconde : pas de clignotement à la frontière
  sfx.grain(Math.min(1, sp * 1.4) * a, feel);
  const SN = UI.sense.h; senseAt((ndc.x + 1) / 2 * innerWidth, (1 - ndc.y) / 2 * innerHeight); sense(lastMat ? SN[2] : SN[0], lastMat ? SN[3] : SN[1], SN[4] + ' · ' + SN[5] + ' ' + Math.round(52 + 40 * a + 4 * Math.sin(T * 3)) + ' %', lastMat ? '#ff9a6b' : '#8fd7ff');
}
async function act3() {
  BODY.set({ pose: 'stand', vis: true, rust: 0 }); W.setScene('ds'); const LK = W.dsLook; scene.background.copy(LK.bg); scene.fog.color.copy(LK.fog); scene.fog.density = LK.density; bloomBase = LK.bloomBase; if (Q.has('reel')) hud.classList.add('reel'); bloom.threshold = LK.bloom; bloom.radius = 0.4; renderer.toneMappingExposure = LK.exposure; sfx.room(true);
  callState('live'); hud.classList.add('ds'); vit.bpm = 92; vit.tmp = 36.8;
  const setLoc = (n) => { if (vit.loc !== UI.loc[n]) { vit.loc = UI.loc[n]; vitals(); } }; setLoc(ST0 > 1 ? 6 : ST0 ? 5 : 4); vitals();
  W.pathU.uPx.value = QL.dpr * QL.scale * innerHeight / 760;
  const p0 = W.legs[ST0].getPointAt(0), t0 = W.legs[ST0].getTangentAt(0.02);
  S.pos.set(p0.x, p0.y + 1.66 + DSY, p0.z + (ST0 ? 0 : 3)); S.yaw = Math.atan2(-t0.x, -t0.z); S.pitch = 0.06; S.roll = 0; S.fov = 62; S.free = 1; fx.uniforms.uFade.value = 1; fx.uniforms.uWhite.value = 1; fx.uniforms.uGlitch.value = 1; $('#visor').classList.remove('on');
  tween(1.8, (k) => { fx.uniforms.uWhite.value = 1 - k; fx.uniforms.uGlitch.value = 1 - k; });
  card('03', UI.card[2]); quest(P3, UI.q.enter);
  await wait(2); await dbg('ds');
  if (!ST0) { const l = say('g11'); await camTo({ pos: new V3(p0.x, 1.66 + DSY, p0.z), pitch: 0.02, fov: 60 }, 7, out); await l; await ask(UI.a.enter); }
  const SN = UI.sense, num = (v, n = 2) => v.toFixed(n).replace('.', DEC), u = fx.uniforms;
  for (let i = ST0; i < 4; i++) {
    const st = W.stations[i], w = WORKS[i], label = UI.art + ' CB-0' + (i + 1) + ' — ' + w.sense; document.querySelectorAll('#qL li').forEach((li) => li.classList.toggle('cur', +li.dataset.i === i));
    quest(P3, i === 2 ? UI.q.up : label); GOAL = [st.stop.pos.x, st.stop.pos.z]; S.walk = 1; let line = null;
    await walk(i, st.stop.look, (k) => { if (k > (i === 2 ? 0.86 : 0.55)) st.k = 1; // l'œuvre s'imprime à l'approche
      if (i === 0 && k > 0.5) setLoc(5); if (i === 2) { if (k > 0.58 && !line) line = say('g11b'); if (k > 0.8) setLoc(6); } });
    S.walk = 0; st.k = 1; if (line) await line; if (i === 2) quest(P3, label); await scanArt(i); await dbg('st' + i);
    await say(w.id + 'a'); await ask(w.verb); const p = S.pos.clone(); st.fx.on = true; st.near = true; let live = null, back = () => camTo({ pos: p, look: st.stop.look, fov: 60 }, 2.6);
    if (i === 0) { // kinesthésie : le regard s'accroche à une plume qui tombe, et le corps tombe avec elle (roulis, glissement, affaissement)
      live = tween(900, () => { const f = st.fx, a = aim(S.pos, f.hero), k = Math.min(1, f.t / 2.2) * 0.07; S.yaw = lerpA(S.yaw, a.yaw, k); S.pitch += (a.pitch - S.pitch) * k; S.roll += (-f.sway * 0.3 - S.roll) * 0.06; S.pos.z = p.z + f.sway * 0.5; S.pos.y = p.y - f.drop * 0.2; S.fov += (44 - S.fov) * 0.012;
        sfx.air(0.3 + Math.abs(f.sway) * 2, 380 + Math.abs(f.sway) * 900); sense(SN.k[0], SN.k[2] + ' ' + num(f.drop) + ' m', SN.k[1], w.css); }, lin); }
    if (i === 1) { const near = st.wallPos.clone().addScaledVector(st.n, 0.66); near.y += DSY - 0.04; camTo({ pos: near, look: st.stop.look, fov: 54 }, 4.4); } // toucher : à trente centimètres, la suite se joue dans touchFx()
    if (i === 2) { // proprioception : la galerie grandit autour de toi, les troncs sortent du cuivre, la brume rose de la photographie envahit la salle
      const fy = DSY + st.lv; camTo({ pos: p, pitch: 0.52, fov: 82 }, 4.5); sfx.servo(4);
      tween(5, (k) => { const s = 1 + 1.45 * k; W.setScale(s, p.x, fy, p.z); scene.fog.color.lerpColors(LK.fog, LK.forest, k); scene.fog.density = LK.density + k * 0.085; W.dsDim(k); sense(SN.p[0], SN.p[1] + ' ' + num(1.72 / s) + ' m', Math.round(100 / s) + ' %', w.css); });
      back = async () => { await Promise.all([camTo({ pos: p, look: st.stop.look, fov: 60 }, 3), tween(3, (k) => { const s = 2.45 - 1.45 * k; W.setScale(s, p.x, fy, p.z); scene.fog.color.lerpColors(LK.forest, LK.fog, k); scene.fog.density = LK.density + (1 - k) * 0.085; W.dsDim(1 - k); })]); W.setScale(1); W.dsDim(0); }; }
    if (i === 3) { // intéroception : on se penche, le monde s'éteint autour du cadre, le temps ralentit, on entend son cœur
      const near = st.wallPos.clone().addScaledVector(st.n, 0.46); near.y += DSY + 0.02; camTo({ pos: near, look: st.stop.look, fov: 50 }, 5); heart = { t: 0.2, gap: 0.62 };
      tween(5, (k) => { W.dsTime = 1 - k * 0.82; u.uTunnel.value = k; });
      live = tween(900, () => { sense(SN.i[0], SN.i[1] + ' ' + Math.round(vit.bpm) + ' bpm', SN.i[2] + ' ' + num(1 / Math.max(0.18, W.dsTime), 1) + ' s', w.css); if (Math.random() < 0.02) sfx.bubble(); }, lin); }
    await wait(2.6); await dbg('fx' + i); await say(w.id + 'b'); mark(i); await wait(1.2);
    st.fx.on = false; if (live) live.stop(); sense(null); senseAt(null); // la sensation se retire
    if (i === 0) { sfx.air(0); tween(1.6, (k) => { S.roll *= 1 - k; }); }
    if (i === 3) { heart = null; tween(2, (k) => { W.dsTime = 0.18 + k * 0.82; u.uTunnel.value = 1 - k; }); vit.bpm = 92; vitals(); }
    await back(); S.roll = 0; st.near = false; $('#scan').classList.remove('on');
  }
  document.querySelectorAll('#qL li').forEach((li) => li.classList.remove('cur'));
  // fin : depuis la rive du niveau 1, un dernier regard sur la nef et sur le chemin parcouru
  quest(P3, UI.q.end); GOAL = [8.35, -1.9]; S.walk = 1; tween(5, (k) => { W.pathU.uAll.value = k; W.pathLine.opacity = 0.1 + k * 0.8; });
  const lv = W.stations[3].lv, end = camTo({ pos: new V3(8.35, lv + 1.66 + DSY, -1.9), look: new V3(-7.5, 0.9 + DSY, -17.5), fov: 68 }, 9);
  await say('g12'); await end; S.walk = 0; await dbg('end'); await wait(1); await tween(1.6, (k) => { fx.uniforms.uWhite.value = k; });
}
async function run() {
  hud.classList.add('on'); clock.getDelta(); if (!running) { running = true; frame(); }
  if (ACT <= 1) await act1(); else { S.pos.set(0, 1.68, -10.6); S.yaw = 0; S.pitch = 0.05; fx.uniforms.uFade.value = 1; }
  if (ACT <= 2) await act2();
  await act3();
  hud.classList.remove('on'); callState('off'); BODY.set({ vis: false }); $('#outro').classList.add('on'); theme('#06080c'); if (synth) synth.cancel();
  MENU = { yaw: S.yaw, pitch: S.pitch, amp: 0.04 }; S.free = 0.5; { const m = MENU, y0 = S.yaw, wide = innerWidth > 900 ? 0.36 : 0; tween(2.6, (k) => { fx.uniforms.uWhite.value = 1 - k; }); tween(5, (k) => { m.yaw = y0 + wide * k; }); } /* l'éclair retombe : la nef reste là, derrière le terminal de fin */
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
  else if (e.code === 'KeyV') $('#bVoice').click(); else if (e.code === 'KeyM') $('#bSound').click();
});
promptEl.addEventListener('click', () => pending && pending());
$('#prologue').addEventListener('click', () => skipLine && skipLine());
$('#bSkip').addEventListener('click', () => skipLine && skipLine());
$('#bVoice').addEventListener('click', (e) => { voiceOn = !voiceOn; if (!voiceOn && synth) synth.cancel(); if (A.vOut) A.vOut.gain.setTargetAtTime(voiceOn ? 1 : 0.0001, A.ctx.currentTime, 0.1); e.currentTarget.classList.toggle('off', !voiceOn); });
$('#bSound').addEventListener('click', (e) => { A.on = !A.on; if (A.out) A.out.gain.setTargetAtTime(A.on ? 0.5 : 0.0001, A.ctx.currentTime, 0.2); e.currentTarget.classList.toggle('off', !A.on); });
function toDossier() { running = false; if (synth) synth.cancel(); if (A.ctx) { A.out.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.3); A.vOut.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.1); } document.body.classList.add('read'); theme('#06080c'); $('#dossier').scrollIntoView(); }
document.querySelectorAll('[data-dossier]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toDossier(); }));
document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => { location.href = location.pathname; }));
document.addEventListener('visibilitychange', () => { if (!document.hidden && running) clock.getDelta(); });

// Accueil : derrière le terminal, la baie des caissons tourne déjà — le même monde que l'immersion, pas une page à part. La boucle de rendu démarre
// donc dès que les modèles sont là (sauf mouvement réduit, mode allégé et tests), avec une caméra qui dérive ; elle se met en veille pendant le journal.
let MENU = null, started = false;
function menu() { if (MENU || started || running || LITE || reduce || AUTO || !W || document.body.classList.contains('read')) return; W.setScene('ship');
  S.pos.set(-0.35, 1.5, 5.6); S.yaw = 0.1; S.pitch = 0.03; S.fov = 58; S.free = 0.5; MENU = { yaw: S.yaw, pitch: S.pitch, amp: 0.05 };
  running = true; clock.getDelta(); frame(); const m = MENU; tween(3.2, (k) => { if (MENU === m && !started) fx.uniforms.uFade.value = k * 0.9; }); }
{ const tc = document.querySelectorAll('.t-clk'), p2 = (v) => String(v).padStart(2, '0'), tick = () => { const s = 24120 + ((performance.now() / 1000) | 0), v = 'J+173 141 · ' + p2((s / 3600) | 0) + ':' + p2(((s / 60) | 0) % 60) + ':' + p2(s % 60); tc.forEach((e) => { e.textContent = v; }); }; tick(); setInterval(tick, 1000); }
const startBtn = $('#start'), bootMsg = $('#bootMsg'), theme = (c) => { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c; };
async function boot() {
  try { await Promise.race([document.fonts.load('600 20px Rajdhani').then(() => document.fonts.load('20px "Krona One"')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* polices de secours */ }
  localizeDom(); startBtn.textContent = UI.loading;
  try { const all = await (await fetch('app/lines.json')).json(); LINES = all[LANG] || all.fr || {}; } catch (e) { LINES = {}; }
  let ok = true; try { initGL(); } catch (e) { ok = false; console.error(e); }
  if (!ok) { bootMsg.textContent = UI.noGL; startBtn.disabled = true; toDossier(); return; }
  if (!LITE) G3 = createGladys(fcv); if (!G3) fc = fcv.getContext('2d');
  bootMsg.textContent = reduce ? UI.reduced : UI.ready;
  startBtn.disabled = false; startBtn.textContent = UI.start;
  startBtn.addEventListener('click', async () => { started = true; audioInit(); loadVoices(); $('#boot').classList.add('gone'); document.body.classList.add('play');
    if (MENU) { const f0 = fx.uniforms.uFade.value; await tween(1.1, (k) => { fx.uniforms.uFade.value = f0 * (1 - k); }); MENU = null; window.__spes.pause = true; }
    if (ACT <= 1) await prologue(); window.__spes.pause = false; run(); }, { once: true });
  if (AUTO) { $('#boot').style.display = 'none'; startBtn.click(); }
}
boot();
