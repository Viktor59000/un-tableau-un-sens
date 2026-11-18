// SPES — le corps du visiteur, vu à la première personne : on baisse les yeux, il est là ; on marche, les bras balancent.
// Modèle : assets/models/corps.glb (tools/humains_blender.py), corps réel découpé en segments rigides articulés —
// corps > torse > bras_haut_g > avant_bras_g, bras_haut_d > avant_bras_d, cuisse_g > jambe_g, cuisse_d > jambe_d.
// Le modèle regarde vers +Z, sans tête : la caméra est posée à la place des yeux.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EYE_Y = 1.574, EYE_Z = 0.122, SCALE = 1.66 / EYE_Y; // position des yeux dans le modèle ; mise à l'échelle sur la hauteur de caméra du récit
// poses : [épaule, coude, hanche, genou, écart des bras, rotation de l'avant-bras] en radians (flexion vers l'avant positive)
const POSES = { // dernière valeur : rotation de l'avant-bras sur son axe (0 = pouce vers l'avant, +1,5 = paume vers le bas, négatif = paume vers soi)
  stand: [0.04, 0.14, 0, 0, 0, 0.15],          // debout, bras le long du corps
  sit: [0.32, 0.6, 1.6, 0.07, 0.02, 1.0],      // assis dans le caisson, jambes allongées, mains à plat sur les cuisses
  hands: [0.55, 1.25, 1.6, 0.07, -0.06, -1.25], // on lève les mains devant soi, paumes vers le visage, pour les regarder
  handsB: [0.5, 1.18, 1.6, 0.07, 0.16, 1.75],  // on les retourne : le dos des mains
  handsF: [0.52, 1.22, 1.6, 0.07, -0.04, -1.25], // on serre les poings, pour voir si elles obéissent
  grip: [-0.1, 0.3, 1.6, 0.07, 0.3, 1.3],   // assis dans le caisson, les mains agrippent les deux bords
  edge: [0.3, 0.34, 1.42, 1.5, 0.36, 1.3],      // assis sur le rebord, jambes pendantes, mains en appui de part et d'autre des hanches
  rail: [0.86, 0.2, 0, 0, 0.2, 1.5],           // debout, les deux mains refermées sur la barre du garde-corps, paumes vers le bas
  seat: [0.02, 1.33, 1.46, 1.5, 0.17, 0],      // assis dans le fauteuil de liaison, avant-bras sur les accoudoirs, mains sur les manches
  lap: [0.3, 0.72, 1.46, 1.5, 0.03, 1.0]       // assis dans le fauteuil, mains à plat sur les cuisses (le temps que les accoudoirs se referment)
};

// fermeture des mains selon la pose : 0 = à plat, 1 = refermées sur une barre (cible de déformation « prise », tools/mains.py)
const GRIP = { stand: 0.24, sit: 0.3, hands: 0.06, handsB: 0.12, handsF: 0.97, grip: 0.3, edge: 0.3, rail: 0.3, seat: 0.88, lap: 0.2 };
// extension du poignet selon la pose (la main se couche à plat sur la cuisse)
const WRIST = { sit: 0.4, lap: 0.4 };

// Matière : sans cela le corps a l'air d'un mannequin. On ajoute, calculés dans la matière à partir de la position sur le modèle (pas de texture) :
// pour la peau, des marbrures, des rougeurs, un grain de pores et de plis fins ; pour la combinaison, une trame de tissu, des froissures,
// et sur l'avant-bras un poignet côtelé souligné d'un filet lumineux. Le relief s'efface avec la distance pour ne pas scintiller.
const NOISE = `varying vec3 vOp;
float dh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 bump(vec3 nrm,float hgt,float k){vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);vec2 d=vec2(dFdx(hgt),dFdy(hgt))*k*smoothstep(2.6,.5,length(vViewPosition));vec3 r1=cross(q1,nrm),r2=cross(nrm,q0);float det=dot(q0,r1);return normalize(abs(det)*nrm-sign(det)*(d.x*r1+d.y*r2));}
`;
// Articulations dans la matière : le modèle est fait de segments rigides (pas de squelette), la main et le pied font corps avec l'avant-bras et la jambe.
// On leur rend un poignet et une cheville en faisant pivoter, dans la matière elle-même, les sommets situés au-delà de l'articulation (uJ, en radians).
function grain(m, kind, joint) {
  m.onBeforeCompile = (sh) => {
    let v = 'varying vec3 vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOp = position;');
    if (joint) { sh.uniforms.uJ = joint.u; const ank = kind === 'jambe', pv = ank ? '-.425,-.045' : joint.px.toFixed(3) + ',-.225', ax = ank ? 'yz' : 'xy', wt = ank ? 'smoothstep(-.395,-.44,position.y)' : 'smoothstep(-.205,-.245,position.y)';
      v = 'uniform float uJ;\n' + v.replace('#include <morphnormal_vertex>', `#include <morphnormal_vertex>\n { float jw=${wt}*uJ, jc=cos(jw), js=sin(jw); objectNormal.${ax}=vec2(objectNormal.${ax}.x*jc-objectNormal.${ax}.y*js, objectNormal.${ax}.x*js+objectNormal.${ax}.y*jc); }`)
        .replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>\n { float jw=${wt}*uJ, jc=cos(jw), js=sin(jw); vec2 jq=transformed.${ax}-vec2(${pv}); transformed.${ax}=vec2(${pv})+vec2(jq.x*jc-jq.y*js, jq.x*js+jq.y*jc); }`); }
    sh.vertexShader = v;
    let f = sh.fragmentShader.replace('void main() {', NOISE + 'void main() {'); /* après les déclarations de la matière (vViewPosition) */
    if (kind === 'peau') f = f
      .replace('#include <color_fragment>', '#include <color_fragment>\n float mot=dn(vOp*38.)*.6+dn(vOp*120.)*.4; diffuseColor.rgb*=.84+.3*mot; diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.16,.84,.78),smoothstep(.5,.9,dn(vOp*17.+3.))*.4);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor*(.78+.45*dn(vOp*210.)),0.,1.);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal=bump(normal,dn(vOp*520.)*.55+dn(vOp*190.)*.9+(1.-abs(sin(vOp.y*300.+dn(vOp*40.)*7.)))*.3,.00042);');
    else f = f
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wv=dn(vOp*900.)*.5+dn(vOp*240.)*.5; float fold=dn(vOp*vec3(34.,12.,34.)); diffuseColor.rgb*=(.8+.34*wv)*(.82+.36*fold);
        float foot=${kind === 'jambe' ? 'smoothstep(-.412,-.422,vOp.y)' : kind === 'bras' ? 'smoothstep(-.208,-.214,vOp.y)' : '0.'}; /* la combinaison s'arrête à la cheville : en dessous, le pied est nu */
        float cuff=${kind === 'bras' ? 'smoothstep(-.184,-.19,vOp.y)*(1.-foot)' : kind === 'jambe' ? 'smoothstep(-.386,-.396,vOp.y)*(1.-foot)' : '0.'}; diffuseColor.rgb*=mix(1.,.36,cuff);
        float mot=dn(vOp*38.)*.6+dn(vOp*120.)*.4; vec3 sk=vec3(.254,.13,.082)*(.84+.3*mot); sk=mix(sk,sk*vec3(1.16,.84,.78),smoothstep(.5,.9,dn(vOp*17.+3.))*.4); diffuseColor.rgb=mix(diffuseColor.rgb,sk,foot);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor=clamp(mix(roughnessFactor*(.8+.35*dn(vOp*300.)),.62*(.78+.45*dn(vOp*210.)),foot),0.,1.);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal=bump(normal,mix(sin(vOp.x*1900.)*sin(vOp.y*1900.)*sin(vOp.z*1900.)*.5+dn(vOp*600.)*.5+fold*5.+cuff*abs(sin(vOp.y*1400.))*1.2,(dn(vOp*520.)*.55+dn(vOp*190.)*.9)*.84,foot),.0005);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${kind === 'bras' ? 'totalEmissiveRadiance+=vec3(.3,.9,1.)*smoothstep(.0032,.0012,abs(vOp.y+.182))*.9;' : kind === 'jambe' ? 'totalEmissiveRadiance+=vec3(.3,.9,1.)*smoothstep(.0032,.0012,abs(vOp.y+.381))*.9;' : ''}`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => 'grain-' + kind + (joint ? '-j' + (joint.px || 0) : ''); return m;
}

export function createBody(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const V3 = THREE.Vector3, suitM = () => new THREE.MeshStandardMaterial({ color: 0x3b434d, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.45 }), skinM = () => new THREE.MeshStandardMaterial({ color: 0x8a6551, roughness: 0.62, envMapIntensity: 0.4 });
  // un poignet (jw) et une cheville (ja) par côté — 0 : gauche, 1 : droite. Le côté gauche du modèle est en +x.
  const jw = [{ value: 0 }, { value: 0 }], ja = [{ value: 0 }, { value: 0 }], SG = [1, -1];
  const mats = { combinaison: grain(suitM(), 'tissu'), bandeau: new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.7 }),
    bras: SG.map((s, i) => grain(suitM(), 'bras', { u: jw[i], px: s * 0.025 })), peau: SG.map((s, i) => grain(skinM(), 'peau', { u: jw[i], px: s * 0.025 })), jambe: SG.map((s, i) => grain(suitM(), 'jambe', { u: ja[i] })) };
  const J = {}, handM = [null, null]; let ready = false;
  new GLTFLoader().load('assets/models/corps.glb', (gl) => {
    gl.scene.traverse((o) => { if (o.isMesh) { const pn = o.parent ? o.parent.name : '', arm = pn.startsWith('avant_bras'), leg = pn.startsWith('jambe'), i = pn.endsWith('_d') ? 1 : 0, mn = o.material.name;
        o.material = arm && mn === 'combinaison' ? mats.bras[i] : arm && mn === 'peau' ? mats.peau[i] : leg && mn === 'combinaison' ? mats.jambe[i] : (leg || arm) && mn === 'bandeau' ? mats.combinaison : mats[mn] && !Array.isArray(mats[mn]) ? mats[mn] : mats.combinaison;
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (arm && mn === 'peau' && o.morphTargetInfluences) handM[i] = o; } if (o.name) J[o.name] = o; });
    gl.scene.scale.setScalar(SCALE); root.add(gl.scene); ready = true;
  });
  // Le corps a un bassin. Le buste relie les hanches à la tête (la caméra) : il s'incline quand on se penche, se couche quand on est allongé, se redresse
  // quand on s'assoit. Assis, les hanches sont posées sur un point d'appui (matelas, rebord, fauteuil) ; debout, elles sont sous la tête, et si la tête
  // descend les genoux plient, pieds au sol.
  // Les mains et les pieds, eux, peuvent être POSÉS : une main ancrée sur un point du décor y va en arc de cercle, y reste au centimètre pendant que le
  // buste bouge (on s'appuie vraiment sur le matelas, la barre, la vitre), et lâche d'elle-même quand le point sort de portée. Des pieds ancrés restent
  // au sol pendant qu'on se lève ou qu'on s'assoit. Se lever, s'asseoir, se pencher sont ce que fait ce corps quand la tête et le bassin bougent.
  const HIP = 0.84, L1 = 0.357, L2 = 0.489, LEG = L1 + L2, TOR = EYE_Y - HIP, TILT0 = Math.atan2(EYE_Z, TOR), SEATED = { sit: 1, hands: 1, handsB: 1, handsF: 1, grip: 1, edge: 1, seat: 1, lap: 1 };
  const SHX = 0.183, SHY = 1.358, LA = 0.285, LF = Math.hypot(0.025, 0.31, 0.1), DELTA = Math.atan2(0.1, 0.31), REACH = (LA + LF) * SCALE; // épaule, bras, avant-bras jusqu'au creux de la paume
  const cur = [...POSES.stand, ...POSES.stand], st = { pose: 'stand', rust: 0, lock: null, seat: null, lean: 0, rate: 9, feet: null }; // cur : gauche puis droite
  const H = SG.map((sg) => ({ sg, a: null, u: 0, grip: GRIP.stand, wr: 0 })); // mains : ancre en cours, avancement du geste (0 = pose libre, 1 = posée)
  const hip = new V3(), last = new V3(1e9, 0, 0); let by = null, byP = 0, lean = 0, th = 0, floor = 0, fresh = true, shock = 0, fk = 0, tph = 0, trn = 0;
  const v1 = new V3(), v2 = new V3(), v3 = new V3(), v4 = new V3(), v5 = new V3(), v6 = new V3(), tW = new V3(), qF = new THREE.Quaternion(), qI = new THREE.Quaternion(), e1 = new THREE.Euler(), m4 = new THREE.Matrix4();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), cl = (x, a, b) => Math.max(a, Math.min(b, x));
  // creux de la paume dans le repère de l'avant-bras, poignet fléchi de a (même rotation que dans la matière)
  const palm = (i, a, out) => out.set(SG[i] * 0.025 + 0.085 * Math.sin(a), -0.225 - 0.085 * Math.cos(a), 0.1);
  // bras : épaule → coude → paume vers un point du monde. pole : où pointe le coude (repère du buste).
  function reach(i, T, pole) { const sg = SG[i], up = J[i ? 'bras_haut_d' : 'bras_haut_g'], t = J.torse.worldToLocal(v1.copy(T)); t.x -= sg * SHX; t.y -= SHY; let d = t.length(); const dm = LA + LF - 0.004; if (d > dm) { t.multiplyScalar(dm / d); d = dm; } if (d < 0.12) { t.multiplyScalar(0.12 / Math.max(d, 1e-4)); d = 0.12; }
    const beta = Math.PI - Math.acos(cl((LA * LA + LF * LF - d * d) / (2 * LA * LF), -1, 1)), al = Math.acos(cl((LA * LA + d * d - LF * LF) / (2 * LA * d), -1, 1)), tn = v2.copy(t).multiplyScalar(1 / d);
    const m = v3.copy(pole).addScaledVector(tn, -pole.dot(tn)); if (m.lengthSq() < 1e-6) m.set(0, 0, -1); m.normalize();
    const u = v4.copy(tn).multiplyScalar(Math.cos(al)).addScaledVector(m, Math.sin(al)), f = v5.copy(t).addScaledVector(u, -LA).normalize(), w = v6.copy(f).addScaledVector(u, -f.dot(u)); if (w.lengthSq() < 1e-8) w.copy(m).multiplyScalar(-1); w.normalize();
    m4.makeBasis(v1.crossVectors(w, u), v2.copy(u).multiplyScalar(-1), w); qI.setFromRotationMatrix(m4); up.quaternion.copy(qI); return Math.max(-0.15, beta - DELTA); }
  return {
    root,
    // pose : nom de la pose des membres. seat : [x, y, z, cap] — point où se trouvent les yeux quand on est assis droit à cet endroit (les hanches s'y ancrent).
    // lock : [x, z, cap] — debout, ancré là pendant que la tête regarde ailleurs. lean : inclinaison du buste debout (radians). rate : vivacité de la transition.
    // feet : [x, y, z] — milieu des deux pieds, posés là (y = hauteur du sol à cet endroit). hands : { l, r } — ancres de main, chacune
    //   { p: [x, y, z] (monde), tw: rotation de l'avant-bras, wr: extension du poignet, grip: fermeture des doigts, pole: [x, y, z] direction du coude, dur: durée du geste } ou null.
    // Toute nouvelle pose remet seat, lock, lean, feet et les mains à zéro si on ne les redonne pas.
    set(o) { if (o.pose) { st.pose = o.pose; st.lock = o.lock || null; st.seat = o.seat || null; st.lean = o.lean || 0; st.rate = o.rate || 9; st.feet = o.feet || null; if (!o.hands) H[0].a = H[1].a = null; }
      else { if (o.lean != null) st.lean = o.lean; if (o.rate != null) st.rate = o.rate; if ('feet' in o) st.feet = o.feet; }
      if (o.hands) { if ('l' in o.hands) H[0].a = o.hands.l; if ('r' in o.hands) H[1].a = o.hands.r; }
      if (o.rust != null) st.rust = o.rust; if (o.floor != null) floor = o.floor; if (o.vis != null) { if (o.vis && !root.visible) fresh = true; root.visible = o.vis; } },
    pulse(k = 1) { shock = Math.max(shock, k); }, // une décharge : les mains se crispent, le corps tremble un instant
    // t : temps ; S : la tête (pos, yaw, pitch, phase et amplitude de la marche)
    update(dt, t, S) {
      if (!ready || !root.visible) return;
      const A = st.seat, L = st.lock, P = POSES[st.pose], seated = !!SEATED[st.pose], jump = fresh || last.distanceTo(S.pos) > 1.2; last.copy(S.pos); fresh = false;
      // cap du corps : il suit le regard avec retard (la tête tourne avant les épaules), prend la direction de la marche, ou reste celui de l'appui
      const want = A ? A[3] : L ? L[2] : (S.ghd != null ? S.ghd : S.yaw); if (by == null || jump) { by = byP = want; }
      by += wrap(want - by) * (1 - Math.exp(-dt * (A || L ? st.rate : 3.4))); if (!A && !L) { const d = wrap(S.yaw - by); if (Math.abs(d) > 1.05) by = S.yaw - Math.sign(d) * 1.05; }
      const yaw = by + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw), w = st.pose === 'stand' ? Math.min(1, S.gamp != null ? S.gamp : (S.walk || 0)) : 0, r = st.rust;
      // on pivote sur place : les pieds ne glissent pas, ils piétinent
      const dby = Math.abs(wrap(by - byP)); byP = by; trn += ((st.pose === 'stand' && !st.feet && w < 0.3 ? Math.min(1, dby / Math.max(dt, 1e-3) / 1.1) : 0) - trn) * (1 - Math.exp(-dt * 7)); tph += dby * 2.6;
      const ph = (S.gph != null ? S.gph : t * 3.7) + tph, s = Math.sin(ph), c = Math.cos(ph), wl = Math.max(w, trn * 0.4);
      if (st.pose === 'stand' && (jump || w > 0.5)) floor = S.pos.y - 1.66; // le sol : là où l'on marche debout
      // bassin : sur son appui, ou sous la tête (reculé quand on penche le buste ou qu'on baisse les yeux vers ses pieds)
      lean += (st.lean - lean) * (1 - Math.exp(-dt * 3)); let hx, hy, hz;
      if (A) { hx = A[0] - fx * EYE_Z * SCALE; hy = A[1] - TOR * SCALE; hz = A[2] - fz * EYE_Z * SCALE; }
      else { const le = lean + (st.pose === 'stand' ? 0.17 * Math.min(1, Math.max(0, -S.pitch)) : 0), zo = (TOR * Math.sin(le) + EYE_Z * Math.cos(le)) * SCALE, yo = (TOR * Math.cos(le) - EYE_Z * Math.sin(le)) * SCALE;
        hx = (L ? L[0] : S.pos.x) - fx * zo; hz = (L ? L[1] : S.pos.z) - fz * zo; hy = S.pos.y - yo; if (st.pose === 'stand') hy = Math.min(hy, (st.feet ? st.feet[1] : floor) + LEG * SCALE); }
      if (jump) hip.set(hx, hy, hz); else { const k = 1 - Math.exp(-dt * (!A && w > 0.3 ? 18 : st.rate)); /* en marchant le bassin suit de près : le buste ne part pas en avant */ hip.x += (hx - hip.x) * k; hip.y += (hy - hip.y) * k; hip.z += (hz - hip.z) * k; }
      // buste : des hanches vers la tête
      const vz = (S.pos.x - hip.x) * fx + (S.pos.z - hip.z) * fz, tt = cl(Math.atan2(vz, S.pos.y - hip.y) - TILT0, -1.9, 1.25); if (jump) th = tt; else th += (tt - th) * (1 - Math.exp(-dt * 16));
      const br = Math.sin(t * 1.55), hl = HIP * SCALE; shock *= Math.exp(-dt * 2.2); // respiration : les épaules montent et descendent à peine
      root.rotation.set(th, yaw, wl * 0.025 * s, 'YXZ'); root.position.set(hip.x - fx * hl * Math.sin(th), hip.y - hl * Math.cos(th) + br * 0.0035, hip.z - fz * hl * Math.sin(th)); root.updateMatrixWorld(true);
      // jambes : assis, celles de la pose (corrigées de l'inclinaison du buste) ; debout, pliées juste ce qu'il faut pour que les pieds restent au sol
      let cf = 0, ck = 0; if (!seated && !st.feet) { const h = Math.max(0.3, (hip.y - floor) / SCALE); if (h < LEG - 0.003) { let lo = 0, hi = 1.55; for (let i = 0; i < 14; i++) { cf = (lo + hi) / 2; const q = L1 * Math.sin(cf) / L2; if (L1 * Math.cos(cf) + L2 * Math.sqrt(Math.max(0, 1 - q * q)) > h) lo = cf; else hi = cf; } ck = cf + Math.asin(Math.min(1, L1 * Math.sin(cf) / L2)); } }
      fk += ((st.feet ? 1 : 0) - fk) * (1 - Math.exp(-dt * 5));
      const ld = Math.min(1, Math.max(0, -S.pitch)), A2 = 0.42 * wl, As = (0.3 + 0.06 * r) * w * (1 - 0.7 * ld), kl = 1 - Math.exp(-dt * (seated ? Math.min(6, st.rate * 2) : 12)); // quand on regarde ses pieds, les bras restent le long du corps
      for (let i = 0; i < 2; i++) { const sg = SG[i], o = i * 6, side = i ? 0.9 : 1.07, tr = (r * 0.035 + shock * 0.05) * Math.sin(t * 21 + i * 2.3) + (st.pose.startsWith('hands') ? 0.03 * Math.sin(t * 17 + i) : 0); // tr : tremblement d'un corps qui se dérouille
        let hf = seated ? Math.max(-0.3, P[2] + th) : cf + th + sg * A2 * s, kn = seated ? P[3] : ck + 0.95 * wl * Math.max(0, sg * c);
        if (fk > 0.002 && st.feet) { const F = st.feet, jx = hip.x + sg * 0.092 * SCALE * lx, jz = hip.z + sg * 0.092 * SCALE * lz, tx = F[0] + sg * 0.1 * SCALE * lx, tz = F[2] + sg * 0.1 * SCALE * lz; // pied ancré : hanche → genou → talon
          const dz = (tx - jx) * fx + (tz - jz) * fz, dy = hip.y - F[1], D = cl(Math.hypot(dz, dy) / SCALE, 0.3, LEG - 0.002), ki = Math.PI - Math.acos(cl((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1)), ai = Math.acos(cl((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
          hf += (Math.atan2(dz, dy) + ai + th - hf) * fk; kn += (ki - kn) * fk; }
        const tgt = [P[0] - sg * As * s + w * r * 0.06 + br * 0.012 + (seated || st.pose === 'rail' ? 0 : th * 0.55 * (1 - ld)), P[1] + w * (0.1 + 0.12 * r) + 0.15 * As * (1 - sg * s) + tr, hf, kn, P[4], P[5]];
        const K = [6.5, 5.5, 0, 0, 6, 4.5]; for (let j = 0; j < 6; j++) cur[o + j] += (tgt[j] - cur[o + j]) * (j === 2 || j === 3 ? (st.feet ? 1 - Math.exp(-dt * 14) : kl) : 1 - Math.exp(-dt * (st.pose.startsWith('hands') ? 3 : K[j]) * side)); // épaule, coude, poignet : chacun son tempo, et les deux côtés pas tout à fait ensemble
        // cheville : le pied reste à plat quand il porte ; il pousse en fin d'appui, se relève à l'attaque du talon ; il pend quand la jambe pend
        const flat = cur[o + 2] - cur[o + 3] - th, aj = !seated || st.feet ? flat + wl * (0.32 * Math.max(0, -sg * s) - 0.16 * Math.max(0, sg * s)) : st.pose === 'seat' || st.pose === 'lap' ? flat : 0.3;
        ja[i].value += (cl(aj, -1.3, 0.8) - ja[i].value) * (1 - Math.exp(-dt * 10)); }
      J.cuisse_g.rotation.set(-cur[2], 0, 0); J.jambe_g.rotation.set(cur[3], 0, 0); J.cuisse_d.rotation.set(-cur[8], 0, 0); J.jambe_d.rotation.set(cur[9], 0, 0);
      // bras : la pose, puis — si la main a un point d'appui — le geste vers ce point
      for (let i = 0; i < 2; i++) { const h = H[i], sg = SG[i], o = i * 6, up = J[i ? 'bras_haut_d' : 'bras_haut_g'], fo = J[i ? 'avant_bras_d' : 'avant_bras_g'], a = h.a, wp = WRIST[st.pose] || 0; let on = a ? 1 : 0;
        qF.setFromEuler(e1.set(-cur[o], 0, sg * cur[o + 4])); up.quaternion.copy(qF); fo.rotation.set(-cur[o + 1], -sg * cur[o + 5], 0);
        if (a) { tW.set(a.p[0], a.p[1], a.p[2]); if (J.torse.localToWorld(v1.set(sg * SHX, SHY, 0)).distanceTo(tW) > REACH * 1.035) on = 0; } // hors de portée : la main lâche
        if (h.u !== on) h.u = cl(h.u + (on ? dt / ((a && a.dur) || 0.6) : -dt / 0.5), 0, 1);
        const e = h.u * h.u * (3 - 2 * h.u), gw = a && a.grip != null ? a.grip : 0.5, gt = GRIP[st.pose] + (gw - GRIP[st.pose]) * e + shock * 0.6, wr = wp + (((a && a.wr) || 0) - wp) * e;
        h.grip += (gt - h.grip) * (1 - Math.exp(-dt * 5)); h.wr += (wr - h.wr) * (1 - Math.exp(-dt * 7)); jw[i].value = sg * h.wr; if (handM[i]) handM[i].morphTargetInfluences[0] = cl(h.grip + r * 0.05 * Math.sin(t * 19), 0, 1);
        if (h.u <= 0 || !a) continue;
        up.updateWorldMatrix(false, true); const pf = fo.localToWorld(palm(i, jw[i].value, v6)), T = pf.lerp(tW, e); T.y += Math.sin(e * Math.PI) * 0.05; const Tx = T.x, Ty = T.y, Tz = T.z; // de là où la pose mettait la main vers l'appui, en arc
        const pole = a.pole ? v3.set(a.pole[0], a.pole[1], a.pole[2]).normalize() : v3.set(sg * 0.55, -0.75, -0.35).normalize(), px = pole.x, py = pole.y, pz = pole.z, tw = cur[o + 5] + ((a.tw != null ? a.tw : 1.4) - cur[o + 5]) * e, kb = Math.min(1, e * 3);
        const put = (el) => { up.quaternion.copy(qF).slerp(qI, kb); fo.rotation.set(-(cur[o + 1] + (el - cur[o + 1]) * kb), -sg * tw, 0); };
        put(reach(i, tW.set(Tx, Ty, Tz), v3.set(px, py, pz)));
        if (e > 0.15) { up.updateWorldMatrix(false, true); fo.localToWorld(palm(i, jw[i].value, v6)); put(reach(i, tW.set(2 * Tx - v6.x, 2 * Ty - v6.y, 2 * Tz - v6.z), v3.set(px, py, pz))); } } // seconde passe : on corrige l'écart dû à la rotation de l'avant-bras et au poignet
    }
  };
}
