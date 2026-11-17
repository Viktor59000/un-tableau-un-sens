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
  sit: [0.32, 0.6, 1.5, 0.06, 0.02, 1.0],      // assis dans le caisson, jambes allongées, mains à plat sur les cuisses
  hands: [0.55, 1.25, 1.5, 0.06, -0.06, -1.25], // on lève les mains devant soi, paumes vers le visage, pour les regarder
  grip: [-0.22, 0.42, 1.5, 0.06, 0.46, 1.3],   // assis dans le caisson, les mains agrippent les deux bords
  edge: [0.3, 0.34, 1.42, 1.5, 0.36, 1.3],      // assis sur le rebord, jambes pendantes, mains en appui de part et d'autre des hanches
  rail: [0.86, 0.2, 0, 0, 0.2, 1.5],           // debout, les deux mains refermées sur la barre du garde-corps, paumes vers le bas
  seat: [0.02, 1.33, 1.46, 1.5, 0.17, 0]       // assis dans le fauteuil de liaison, avant-bras sur les accoudoirs, mains sur les manches
};

// fermeture des mains selon la pose : 0 = à plat, 1 = refermées sur une barre (cible de déformation « prise », tools/mains.py)
const GRIP = { stand: 0.24, sit: 0.3, hands: 0.06, grip: 0.92, edge: 0.8, rail: 1, seat: 0.88 };

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
        float foot=${kind === 'jambe' ? 'smoothstep(-.412,-.422,vOp.y)' : '0.'}; /* la combinaison s'arrête à la cheville : en dessous, le pied est nu */
        float cuff=${kind === 'bras' ? 'smoothstep(-.186,-.198,vOp.y)' : kind === 'jambe' ? 'smoothstep(-.386,-.396,vOp.y)*(1.-foot)' : '0.'}; diffuseColor.rgb*=mix(1.,.36,cuff);
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
    gl.scene.traverse((o) => { if (o.isMesh) { const pn = o.parent ? o.parent.name : '', arm = pn.startsWith('avant_bras'), leg = pn.startsWith('jambe'), mn = o.material.name; o.material = mn === 'combinaison' && arm ? mats.bras : mn === 'combinaison' && leg ? mats.jambe : mats[mn] || mats.combinaison; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (arm && mn === 'peau' && o.morphTargetInfluences) hands.push(o); } if (o.name) J[o.name] = o; });
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
      const br = Math.sin(t * 1.55); // respiration : les épaules montent et descendent à peine
      root.position.set(S.pos.x - Math.sin(yaw) * ez, S.pos.y - EYE_Y * SCALE + br * 0.0035, S.pos.z - Math.cos(yaw) * ez); // les yeux du modèle sur la caméra
      grip += (GRIP[st.pose] - grip) * (1 - Math.exp(-dt * 4.5)); for (const h of hands) h.morphTargetInfluences[0] = Math.min(1, Math.max(0, grip + r * 0.05 * Math.sin(t * 19)));
      const A = 0.42 * w, As = (0.3 + 0.22 * r) * w, k = 1 - Math.exp(-dt * (st.pose === 'hands' ? 3 : 6));
      for (let i = 0; i < 2; i++) { const sg = i ? -1 : 1, tr = r * 0.035 * Math.sin(t * 21 + i * 2.3) + (st.pose === 'hands' ? 0.03 * Math.sin(t * 17 + i) : 0), o = i * 6; // tr : tremblement d'un corps qui se dérouille
        const tgt = [P[0] - sg * As * s + w * r * 0.25 + br * 0.012, P[1] + w * (0.3 + 0.95 * r) + 0.15 * As * (1 - sg * s) + tr, P[2] + sg * A * s, P[3] + 0.95 * w * Math.max(0, sg * c), P[4], P[5]];
        for (let j = 0; j < 6; j++) cur[o + j] += (tgt[j] - cur[o + j]) * k; }
      const a = (n, x, z = 0, y = 0) => { const p = J[n]; if (p) p.rotation.set(x, y, z); };
      a('bras_haut_g', -cur[0], cur[4]); a('avant_bras_g', -cur[1], 0, -cur[5]); a('cuisse_g', -cur[2]); a('jambe_g', cur[3]);
      a('bras_haut_d', -cur[6], -cur[10]); a('avant_bras_d', -cur[7], 0, cur[11]); a('cuisse_d', -cur[8]); a('jambe_d', cur[9]);
    }
  };
}
