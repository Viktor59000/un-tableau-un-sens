// SPES — le corps du visiteur, vu à la première personne : on baisse les yeux, il est là ; on marche, les bras balancent.
// Modèle : assets/models/corps.glb (tools/humains_blender.py), corps réel découpé en segments rigides articulés —
// corps > torse > bras_haut_g > avant_bras_g, bras_haut_d > avant_bras_d, cuisse_g > jambe_g, cuisse_d > jambe_d.
// Le modèle regarde vers +Z, sans tête : la caméra est posée à la place des yeux.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EYE_Y = 1.574, EYE_Z = 0.122, SCALE = 1.66 / EYE_Y; // position des yeux dans le modèle ; mise à l'échelle sur la hauteur de caméra du récit
// poses : [épaule, coude, hanche, genou, écart des bras] en radians (flexion vers l'avant positive)
const POSES = {
  stand: [0.04, 0.14, 0, 0, 0],          // debout, bras le long du corps
  sit: [0.32, 0.6, 1.5, 0.06, 0.02],     // assis dans le caisson, jambes allongées, mains sur les cuisses
  hands: [0.55, 1.25, 1.5, 0.06, -0.06], // on lève les mains devant soi pour les regarder
  seat: [0.02, 1.33, 1.46, 1.5, 0.17]    // assis dans le fauteuil de liaison, avant-bras posés sur les accoudoirs, mains sur les pupitres
};

export function createBody(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const mats = { combinaison: new THREE.MeshStandardMaterial({ color: 0x353c45, roughness: 0.78, metalness: 0.06, envMapIntensity: 0.45 }), peau: new THREE.MeshStandardMaterial({ color: 0x7a5a48, roughness: 0.7, envMapIntensity: 0.35 }),
    bandeau: new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.7 }) };
  const J = {}; let ready = false;
  new GLTFLoader().load('assets/models/corps.glb', (gl) => {
    gl.scene.traverse((o) => { if (o.isMesh) { o.material = mats[o.material.name] || mats.combinaison; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } if (o.name) J[o.name] = o; });
    gl.scene.scale.setScalar(SCALE); root.add(gl.scene); ready = true;
  });
  const cur = [...POSES.stand, ...POSES.stand], st = { pose: 'stand', rust: 0 }; // cur : gauche puis droite
  return {
    root,
    set(o) { if (o.pose) st.pose = o.pose; if (o.rust != null) st.rust = o.rust; if (o.vis != null) root.visible = o.vis; },
    // t : temps ; S : état de la caméra du récit (pos, yaw, walk)
    update(dt, t, S) {
      if (!ready || !root.visible) return;
      const yaw = S.yaw + Math.PI, P = POSES[st.pose], w = st.pose === 'stand' ? Math.min(1, S.walk || 0) : 0, r = st.rust, ph = t * 3.7, s = Math.sin(ph), c = Math.cos(ph);
      root.rotation.set(0, yaw, w * 0.025 * s); const ez = (EYE_Z + (st.pose === 'stand' ? 0.2 * Math.min(1, Math.max(0, -S.pitch)) : 0)) * SCALE; // debout, quand on baisse les yeux, la nuque se penche : le torse recule et laisse voir les pieds
      root.position.set(S.pos.x - Math.sin(yaw) * ez, S.pos.y - EYE_Y * SCALE, S.pos.z - Math.cos(yaw) * ez); // les yeux du modèle sur la caméra
      const A = 0.42 * w, As = (0.3 + 0.22 * r) * w, k = 1 - Math.exp(-dt * (st.pose === 'hands' ? 3 : 6));
      for (let i = 0; i < 2; i++) { const sg = i ? -1 : 1, tr = r * 0.035 * Math.sin(t * 21 + i * 2.3) + (st.pose === 'hands' ? 0.03 * Math.sin(t * 17 + i) : 0), o = i * 5; // tr : tremblement d'un corps qui se dérouille
        const tgt = [P[0] - sg * As * s + w * r * 0.25, P[1] + w * (0.3 + 0.95 * r) + 0.15 * As * (1 - sg * s) + tr, P[2] + sg * A * s, P[3] + 0.95 * w * Math.max(0, sg * c), P[4]];
        for (let j = 0; j < 5; j++) cur[o + j] += (tgt[j] - cur[o + j]) * k; }
      const a = (n, x, z = 0) => { const p = J[n]; if (p) p.rotation.set(x, 0, z); };
      a('bras_haut_g', -cur[0], cur[4]); a('avant_bras_g', -cur[1]); a('cuisse_g', -cur[2]); a('jambe_g', cur[3]);
      a('bras_haut_d', -cur[5], -cur[9]); a('avant_bras_d', -cur[6]); a('cuisse_d', -cur[7]); a('jambe_d', cur[8]);
    }
  };
}
