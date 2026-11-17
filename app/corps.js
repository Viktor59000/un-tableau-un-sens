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
  sit: [0.32, 0.6, 1.54, 0.05, 0.02, 1.0],      // assis dans le caisson, jambes allongées, mains à plat sur les cuisses
  hands: [0.55, 1.25, 1.54, 0.05, -0.06, -1.25], // on lève les mains devant soi, paumes vers le visage, pour les regarder
  grip: [-0.22, 0.42, 1.54, 0.05, 0.46, 1.3],   // assis dans le caisson, les mains agrippent les deux bords
  edge: [0.3, 0.34, 1.42, 1.5, 0.36, 1.3],      // assis sur le rebord, jambes pendantes, mains en appui de part et d'autre des hanches
  rail: [0.86, 0.2, 0, 0, 0.2, 1.5],           // debout, les deux mains refermées sur la barre du garde-corps, paumes vers le bas
  seat: [0.02, 1.33, 1.46, 1.5, 0.17, 0],      // assis dans le fauteuil de liaison, avant-bras sur les accoudoirs, mains sur les manches
  lap: [0.3, 0.72, 1.46, 1.5, 0.03, 1.0]       // assis dans le fauteuil, mains à plat sur les cuisses (le temps que les accoudoirs se referment)
};

// fermeture des mains selon la pose : 0 = à plat, 1 = refermées sur une barre (cible de déformation « prise », tools/mains.py)
const GRIP = { stand: 0.24, sit: 0.3, hands: 0.06, grip: 0.92, edge: 0.8, rail: 1, seat: 0.88, lap: 0.2 };

// Matière : sans cela le corps a l'air d'un mannequin. On ajoute, calculés dans la matière à partir de la position sur le modèle (pas de texture) :
// pour la peau, des marbrures, des rougeurs, un grain de pores et de plis fins ; pour la combinaison, une trame de tissu, des froissures,
// et sur l'avant-bras un poignet côtelé souligné d'un filet lumineux. Le relief s'efface avec la distance pour ne pas scintiller.
const NOISE = `varying vec3 vOp;
float dh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 bump(vec3 nrm,float hgt,float k){vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);vec2 d=vec2(dFdx(hgt),dFdy(hgt))*k*smoothstep(2.6,.5,length(vViewPosition));vec3 r1=cross(q1,nrm),r2=cross(nrm,q0);float det=dot(q0,r1);return normalize(abs(det)*nrm-sign(det)*(d.x*r1+d.y*r2));}
`;
function grain(m, kind) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOp = position;');
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
  m.customProgramCacheKey = () => 'grain-' + kind; return m;
}

export function createBody(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const suit = (kind) => grain(new THREE.MeshStandardMaterial({ color: 0x3b434d, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.45 }), kind);
  const mats = { combinaison: suit('tissu'), bras: suit('bras'), jambe: suit('jambe'), peau: grain(new THREE.MeshStandardMaterial({ color: 0x8a6551, roughness: 0.62, envMapIntensity: 0.4 }), 'peau'),
    bandeau: new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.7 }) };
  const J = {}, hands = []; let ready = false, grip = GRIP.stand;
  new GLTFLoader().load('assets/models/corps.glb', (gl) => {
    gl.scene.traverse((o) => { if (o.isMesh) { const pn = o.parent ? o.parent.name : '', arm = pn.startsWith('avant_bras'), leg = pn.startsWith('jambe'), mn = o.material.name; o.material = mn === 'combinaison' && arm ? mats.bras : mn === 'combinaison' && leg ? mats.jambe : mn === 'bandeau' && leg ? mats.combinaison : mats[mn] || mats.combinaison; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (arm && mn === 'peau' && o.morphTargetInfluences) hands.push(o); } if (o.name) J[o.name] = o; });
    gl.scene.scale.setScalar(SCALE); root.add(gl.scene); ready = true;
  });
  // Le corps a un bassin. Le buste relie les hanches à la tête (la caméra) : il s'incline quand on se penche, se couche quand on est allongé, se redresse
  // quand on s'assoit. Assis, les hanches sont posées sur un point d'appui (matelas, rebord, fauteuil) ; debout, elles sont sous la tête, et si la tête
  // descend les genoux plient, pieds au sol. Se lever, s'asseoir, se pencher ne sont donc plus des changements de pose mais ce que fait ce corps
  // quand la tête bouge.
  const HIP = 0.84, L1 = 0.357, L2 = 0.489, LEG = L1 + L2, TOR = EYE_Y - HIP, TILT0 = Math.atan2(EYE_Z, TOR), SEATED = { sit: 1, hands: 1, grip: 1, edge: 1, seat: 1, lap: 1 };
  const cur = [...POSES.stand, ...POSES.stand], st = { pose: 'stand', rust: 0, lock: null, seat: null, lean: 0, rate: 9 }; // cur : gauche puis droite
  const hip = new THREE.Vector3(), last = new THREE.Vector3(1e9, 0, 0); let by = null, lean = 0, th = 0, floor = 0, fresh = true;
  return {
    root,
    // pose : nom de la pose des membres. seat : [x, y, z, cap] — point où se trouvent les yeux quand on est assis droit à cet endroit (les hanches s'y ancrent).
    // lock : [x, z, cap] — debout, ancré là (mains sur la barre) pendant que la tête regarde ailleurs. lean : inclinaison du buste debout (radians).
    // rate : vivacité de la transition vers ce nouvel appui (1,5 = lente, 9 = vive). Toute nouvelle pose remet seat, lock et lean à zéro si on ne les redonne pas.
    set(o) { if (o.pose) { st.pose = o.pose; st.lock = o.lock || null; st.seat = o.seat || null; st.lean = o.lean || 0; st.rate = o.rate || 9; } else { if (o.lean != null) st.lean = o.lean; if (o.rate != null) st.rate = o.rate; }
      if (o.rust != null) st.rust = o.rust; if (o.floor != null) floor = o.floor; if (o.vis != null) { if (o.vis && !root.visible) fresh = true; root.visible = o.vis; } },
    // t : temps ; S : état de la caméra du récit (pos, yaw, pitch, phase et amplitude de la marche)
    update(dt, t, S) {
      if (!ready || !root.visible) return;
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), A = st.seat, L = st.lock, P = POSES[st.pose], seated = !!SEATED[st.pose], jump = fresh || last.distanceTo(S.pos) > 1.2; last.copy(S.pos); fresh = false;
      // cap du corps : il suit le regard avec retard (la tête tourne avant les épaules), prend la direction de la marche, ou reste celui de l'appui
      const want = A ? A[3] : L ? L[2] : (S.ghd != null ? S.ghd : S.yaw); if (by == null || jump) by = want;
      by += wrap(want - by) * (1 - Math.exp(-dt * (A || L ? st.rate : 3.4))); if (!A && !L) { const d = wrap(S.yaw - by); if (Math.abs(d) > 1.05) by = S.yaw - Math.sign(d) * 1.05; }
      const yaw = by + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw), w = st.pose === 'stand' ? Math.min(1, S.gamp != null ? S.gamp : (S.walk || 0)) : 0, r = st.rust, ph = S.gph != null ? S.gph : t * 3.7, s = Math.sin(ph), c = Math.cos(ph);
      if (st.pose === 'stand' && (jump || w > 0.5)) floor = S.pos.y - 1.66; // le sol : là où l'on marche debout
      // bassin : sur son appui, ou sous la tête (reculé quand on penche le buste ou qu'on baisse les yeux vers ses pieds)
      lean += (st.lean - lean) * (1 - Math.exp(-dt * 3)); let hx, hy, hz;
      if (A) { hx = A[0] - fx * EYE_Z * SCALE; hy = A[1] - TOR * SCALE; hz = A[2] - fz * EYE_Z * SCALE; }
      else { const le = lean + (st.pose === 'stand' ? 0.17 * Math.min(1, Math.max(0, -S.pitch)) : 0), zo = (TOR * Math.sin(le) + EYE_Z * Math.cos(le)) * SCALE, yo = (TOR * Math.cos(le) - EYE_Z * Math.sin(le)) * SCALE;
        hx = (L ? L[0] : S.pos.x) - fx * zo; hz = (L ? L[1] : S.pos.z) - fz * zo; hy = S.pos.y - yo; if (st.pose === 'stand') hy = Math.min(hy, floor + LEG * SCALE); }
      if (jump) hip.set(hx, hy, hz); else { const k = 1 - Math.exp(-dt * st.rate); hip.x += (hx - hip.x) * k; hip.y += (hy - hip.y) * k; hip.z += (hz - hip.z) * k; }
      // buste : des hanches vers la tête
      const vz = (S.pos.x - hip.x) * fx + (S.pos.z - hip.z) * fz, tt = Math.max(-1.9, Math.min(1.25, Math.atan2(vz, S.pos.y - hip.y) - TILT0)); if (jump) th = tt; else th += (tt - th) * (1 - Math.exp(-dt * 16));
      const br = Math.sin(t * 1.55), hl = HIP * SCALE; // respiration : les épaules montent et descendent à peine
      root.rotation.set(th, yaw, w * 0.025 * s, 'YXZ'); root.position.set(hip.x - fx * hl * Math.sin(th), hip.y - hl * Math.cos(th) + br * 0.0035, hip.z - fz * hl * Math.sin(th));
      grip += (GRIP[st.pose] - grip) * (1 - Math.exp(-dt * 4.5)); for (const h of hands) h.morphTargetInfluences[0] = Math.min(1, Math.max(0, grip + r * 0.05 * Math.sin(t * 19)));
      // jambes : assis, celles de la pose (corrigées de l'inclinaison du buste) ; debout, pliées juste ce qu'il faut pour que les pieds restent au sol
      let cf = 0, ck = 0; if (!seated) { const h = Math.max(0.3, (hip.y - floor) / SCALE); if (h < LEG - 0.003) { let lo = 0, hi = 1.55; for (let i = 0; i < 14; i++) { cf = (lo + hi) / 2; const q = L1 * Math.sin(cf) / L2; if (L1 * Math.cos(cf) + L2 * Math.sqrt(Math.max(0, 1 - q * q)) > h) lo = cf; else hi = cf; } ck = cf + Math.asin(Math.min(1, L1 * Math.sin(cf) / L2)); } }
      const ld = Math.min(1, Math.max(0, -S.pitch)), A2 = 0.42 * w, As = (0.3 + 0.06 * r) * w * (1 - 0.7 * ld), /* quand on regarde ses pieds, les bras restent le long du corps : ce sont les jambes qu'on voit */ k = 1 - Math.exp(-dt * (st.pose === 'hands' ? 3 : 6)), kl = 1 - Math.exp(-dt * (seated ? Math.min(6, st.rate * 2) : 12));
      for (let i = 0; i < 2; i++) { const sg = i ? -1 : 1, tr = r * 0.035 * Math.sin(t * 21 + i * 2.3) + (st.pose === 'hands' ? 0.03 * Math.sin(t * 17 + i) : 0), o = i * 6; // tr : tremblement d'un corps qui se dérouille
        const tgt = [P[0] - sg * As * s + w * r * 0.06 + br * 0.012 + (seated || st.pose === 'rail' ? 0 : th * 0.55 * (1 - ld)), P[1] + w * (0.1 + 0.12 * r) + 0.15 * As * (1 - sg * s) + tr, /* bras : balancement d'épaule, coude à peine plié — les mains restent sous la taille, même raides */
          seated ? Math.max(-0.3, P[2] + th) : cf + th + sg * A2 * s, seated ? P[3] : ck + 0.95 * w * Math.max(0, sg * c), P[4], P[5]];
        for (let j = 0; j < 6; j++) cur[o + j] += (tgt[j] - cur[o + j]) * (j === 2 || j === 3 ? kl : k); }
      const a = (n, x, z = 0, y = 0) => { const p = J[n]; if (p) p.rotation.set(x, y, z); };
      a('bras_haut_g', -cur[0], cur[4]); a('avant_bras_g', -cur[1], 0, -cur[5]); a('cuisse_g', -cur[2]); a('jambe_g', cur[3]);
      a('bras_haut_d', -cur[6], -cur[10]); a('avant_bras_d', -cur[7], 0, cur[11]); a('cuisse_d', -cur[8]); a('jambe_d', cur[9]);
    }
  };
}
