// SPES — portrait de Gladys dans le cadre d'appel : un visage de femme en 3D, rendu dans son propre petit canevas.
// Le buste vient des « Human Base Meshes » de la Blender Foundation (CC0), préparé par tools/humains_blender.py : maillages « visage » et
// « yeux », origine au centre de la tête, en mètres. La chevelure est un fichier à part, fait de mèches (tools/cheveux_blender.py).
// Gladys est une androïde, mais c'est d'abord un visage : sourcils, paupières lourdes et cils, lèvres, naissance des cheveux et mèches
// fines sont peints dans la matière (le maillage n'en a pas) ; son regard reste posé sur nous quand sa tête bouge, elle cligne des yeux,
// hoche la tête en parlant. De la machine il reste une peau de porcelaine, des joints lumineux à la mâchoire et au cou, des iris qui
// brillent et quelques fibres de lumière dans les cheveux. Pendant la sonnerie, elle n'est qu'un hologramme corail.
// Banc d'essai (le portrait en grand, hors du récit) : tools/gladys-essai.html.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// repères du visage (mètres, depuis le centre de la tête : x vers sa gauche, y vers le haut, z vers l'avant)
const EYE = [0.033, -0.021, 0.062], MOUTH_Y = -0.086;
const f3 = (v) => v.toFixed(4);

export function createGladys(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  renderer.setPixelRatio(1); renderer.setSize(canvas.width, canvas.height, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, canvas.width / canvas.height, 0.05, 5);
  cam.position.set(0, -0.022, 0.8); cam.lookAt(0, -0.036, 0);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  // éclairage de portrait : une lumière froide de trois quarts, haute, qui creuse l'orbite et la joue ; un contre-jour corail ; presque pas de remplissage
  const key = new THREE.DirectionalLight(0xdcefff, 3.1); key.position.set(-0.9, 1.1, 1.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6a48, 2.6); rim.position.set(1.3, 0.3, -1.1); scene.add(rim);
  const under = new THREE.DirectionalLight(0x58d8e0, 0.55); under.position.set(0.3, -1, 0.7); scene.add(under); // la lueur des écrans, par en dessous
  scene.add(new THREE.HemisphereLight(0x9cc0de, 0x10141a, 0.22));

  const U = { uTime: { value: 0 }, uMouth: { value: 0 }, uHolo: { value: 1 }, uSeam: { value: new THREE.Color(0.35, 0.95, 1) }, uRing: { value: new THREE.Color(1, 0.33, 0.22) },
    uGaze: { value: new THREE.Vector2() }, uLid: { value: 0.23 }, uBrow: { value: 0 } };
  // tout le buste partage la même fin : il se défait en tranches fines sous les clavicules, et devient hologramme pendant la sonnerie
  const END = `#include <dithering_fragment>
      float ga=smoothstep(-.33,-.2,vObj.y+.012*sin(vObj.x*60.+uTime*1.3)); float gs=step(.45,fract(vObj.y*210.-uTime*.5)); ga*=mix(gs*.75,1.,smoothstep(.45,.95,ga));
      float gy=dot(gl_FragColor.rgb,vec3(.3,.59,.11)); gl_FragColor.rgb=mix(gl_FragColor.rgb,uRing*(gy*1.5+.12)*(.55+.45*gs),uHolo); gl_FragColor.a*=ga*mix(1.,.8,uHolo);`;
  const HEAD_V = 'varying vec3 vObj;uniform float uMouth,uHolo,uTime;\nfloat gh(float p){return fract(sin(p*127.1)*43758.5453);}\n';
  // fonctions communes aux trois matières : bruit à une dimension, et loi du bord du cuir chevelu (la même que dans tools/cheveux_blender.py)
  const HEAD_F = `varying vec3 vObj;uniform mat3 normalMatrix;uniform float uTime,uHolo,uMouth,uLid,uBrow;uniform vec3 uSeam,uRing;uniform vec2 uGaze;
    float gh(float p){return fract(sin(p*127.1)*43758.5453);} float gn(float p){float i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(gh(i),gh(i+1.),f);}
    float hairMax(float fr){return radians(54.+50.*(1.-smoothstep(.1,.62,fr)));}
    const vec3 HAIR=vec3(.016,.022,.032);\n`;
  const JIT = '\n      transformed.x+=uHolo*(gh(floor(position.y*100.)+floor(uTime*9.))-.5)*.012*step(.82,gh(floor(position.y*100.)*1.7+floor(uTime*9.)));';
  const hook = (key, mat, vert, frag, emis, nrm, decl) => { mat.transparent = true; mat.customProgramCacheKey = () => 'gladys2-' + key; /* sans clé propre, les trois matières partageraient le même programme */ mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = HEAD_V + (decl ? decl[0] : '') + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n      vObj=position;' + vert + JIT);
    sh.fragmentShader = HEAD_F + (decl ? decl[1] : '') + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>' + frag).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + (nrm || '')).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + emis).replace('#include <dithering_fragment>', END); }; return mat; };

  const skin = hook('visage', new THREE.MeshPhysicalMaterial({ color: 0xe9e2dc, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.28, envMapIntensity: 0.38 }),
    `\n      float jw=smoothstep(${(MOUTH_Y + 0.003).toFixed(3)},${(MOUTH_Y - 0.012).toFixed(3)},position.y)*smoothstep(.01,.06,position.z)*smoothstep(-.15,-.125,position.y); transformed.y-=uMouth*.0065*jw; transformed.z-=uMouth*.0015*jw; // mâchoire`,
    `\n      float ax=abs(vObj.x); float gFront=smoothstep(.0,.03,vObj.z);
      // cuir chevelu : sombre sous les mèches, avec un bord en racines fines (on ne doit jamais voir de peau claire entre deux mèches)
      vec3 hd=normalize(vObj); float ha=acos(clamp(hd.y,-1.,1.)); float hfr=hd.z/max(length(hd.xz),1e-4); float hph=atan(hd.x,hd.z);
      float hEdge=hairMax(hfr)+radians(4.)+radians(1.5)*(gn(hph*46.)+.6*gn(hph*150.)-.8);
      float gHair=smoothstep(hEdge,hEdge-radians(3.2),ha)*(.55+.45*gn(hph*260.));gHair=max(gHair,smoothstep(hEdge-radians(3.),hEdge-radians(5.),ha)); float gStr=.75+.5*gn(hph*210.+ha*6.);
      // sourcils : un arc fin, plus épais à la tête qu'à la queue, fait de poils ; ils montent un peu quand elle insiste
      float bt=clamp((ax-.011)/.045,0.,1.); float by=-.0052+.0058*sin(bt*2.05)-.0058*bt*bt+uBrow*.0022*(1.-bt*.5);
      float gBrow=smoothstep(mix(.0043,.0013,bt),mix(.002,.0004,bt),abs(vObj.y-by))*smoothstep(.009,.014,ax)*smoothstep(.058,.05,ax)*gFront*(.72+.28*gn(ax*900.+vObj.y*500.));
      // paupière : un fard fumé au-dessus de l'œil, un trait de cils le long du bord, étiré vers la tempe
      vec2 ep=vec2(ax-${f3(EYE[0])},vObj.y-(${f3(EYE[1])}));
      float gShadow=exp(-(ep.x*ep.x/.00034+(ep.y-.0078)*(ep.y-.0078)/.00003))*gFront;
      float ly=.0046-ep.x*ep.x*17.+.0016*smoothstep(.004,.016,ep.x); float gLash=smoothstep(.0019,.0006,abs(ep.y-ly))*smoothstep(-.0145,-.011,ep.x)*smoothstep(.02,.0155,ep.x)*gFront;
      float gUnder=smoothstep(.0009,.0003,abs(ep.y+.0058-ep.x*ep.x*9.))*smoothstep(-.004,.002,ep.x)*smoothstep(.0165,.012,ep.x)*gFront*.45;
      // lèvres : teinte soutenue, plus sombre à la commissure et entre les deux lèvres
      float lw=1.-ax*ax/.00062; float lTop=(${f3(MOUTH_Y)})+.0098*lw-.0022*exp(-ax*ax/.00002), lBot=(${f3(MOUTH_Y)})-.0108*(1.-ax*ax/.00052); float gLip=smoothstep(lBot-.0012,lBot+.0008,vObj.y)*smoothstep(lTop+.0012,lTop-.0008,vObj.y)*smoothstep(.0255,.0225,ax)*step(.07,vObj.z);
      float gLine=smoothstep(.0018,.0004,abs(vObj.y-(${f3(MOUTH_Y)})+ax*ax*2.))*smoothstep(.027,.02,ax)*step(.07,vObj.z);
      // pommettes : un rose très léger, et l'ombre sous l'os de la joue
      float gBlush=exp(-((ax-.047)*(ax-.047)/.0005+(vObj.y+.052)*(vObj.y+.052)/.00022))*gFront;
      // joints de l'androïde : le menton et les anneaux du cou seulement — un trait sur la joue se lisait comme une larme
      float gChin=smoothstep(.001,.0003,ax)*step(-.127,vObj.y)*step(vObj.y,-.106)*gFront;
      float gNeck=(smoothstep(.0013,.0004,abs(vObj.y+.17))+smoothstep(.0013,.0004,abs(vObj.y+.198))+smoothstep(.0013,.0004,abs(vObj.y+.226)))*step(vObj.y,-.15);
      float gSeam=max(gChin,gNeck);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.5,.47),gBlush*.2);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.3,.25,.28),gShadow*.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.2,.23),gLip*.82); diffuseColor.rgb*=1.-gLine*.55;
      diffuseColor.rgb=mix(diffuseColor.rgb,HAIR*1.3,max(gBrow*.95,max(gLash,gUnder)));
      diffuseColor.rgb*=mix(.6,1.,smoothstep(-.21,-.12,vObj.y)); // le cou et les épaules s'effacent : le regard va au visage
      diffuseColor.rgb=mix(diffuseColor.rgb,HAIR*gStr,gHair);
      diffuseColor.rgb*=1.-gSeam*.8;`,
    '\n      totalEmissiveRadiance+=uSeam*gSeam*(.4+1.7*uMouth);');
  const eyes = hook('yeux', new THREE.MeshPhysicalMaterial({ color: 0xc9d3da, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 }), '',
    `\n      vec3 ec=vec3(sign(vObj.x)*${f3(EYE[0])},${f3(EYE[1])},${f3(EYE[2])}); vec3 ed=normalize(vObj-ec); vec3 gd=normalize(vec3(uGaze.x,uGaze.y,1.)); float ea=acos(clamp(dot(ed,gd),-1.,1.));
      float eIris=smoothstep(.57,.51,ea), ePupil=smoothstep(.23,.18,ea), eRing=eIris*(1.-ePupil); float eAng=atan(ed.y-gd.y,ed.x-gd.x);
      float eFib=.55+.45*sin(eAng*26.+sin(ea*30.)*1.2); float eLimb=smoothstep(.4,.55,ea)*eIris;               // fibres de l'iris, cerne sombre au bord
      diffuseColor.rgb=mix(diffuseColor.rgb*(.62+.38*smoothstep(.57,1.2,ea)),vec3(.015,.04,.055),eIris);
      // la paupière : peinte sur le globe, elle descend pour le clignement (uLid : 0 ouverte, 1 fermée) ; son bord porte les cils
      float lidY=${f3(EYE[1])}+.0042-.0104*uLid-(vObj.x-ec.x)*(vObj.x-ec.x)*14.; float eLid=smoothstep(lidY-.0006,lidY+.0003,vObj.y); float eLash=smoothstep(.0022,.0004,abs(vObj.y-lidY+.0006));
      eRing*=1.-eLid; diffuseColor.rgb*=mix(.4,1.,smoothstep(0.,.0045,lidY-vObj.y)); /* l'ombre de la paupière sur le globe */ diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.5,.44,.45),eLid); diffuseColor.rgb=mix(diffuseColor.rgb,HAIR,eLash*.9);`,
    '\n      totalEmissiveRadiance+=(uSeam*(.1+.5*eFib)*(1.-eLimb*.8)+vec3(.8,1.,1.)*smoothstep(.27,.235,ea)*smoothstep(.18,.235,ea)*.45)*eRing*(1.+.9*uMouth);');
  // La chevelure : des rubans (tools/cheveux_blender.py). vH = (travers de la mèche, racine → pointe, hasard de la mèche, couche : 0 fond, 1 mèche).
  // La matière dessine les cheveux un à un dans chaque ruban, effile les bords et les pointes, et « peigne » la normale pour que chaque
  // cheveu renvoie la lumière à sa façon. Quelques mèches portent une fibre de lumière, qui bat avec la voix.
  const hair = hook('chevelure', new THREE.MeshPhysicalMaterial({ color: 0x0b0f15, roughness: 0.55, metalness: 0.05, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.6, side: THREE.DoubleSide, alphaTest: 0.5 }),
    '\n      vH=vec4(uv,uv1);',
    `\n      float hAc=vH.x, hAl=vH.y, hR=vH.z, hLay=vH.w; float hN=mix(4.,8.,gh(hR*91.))*mix(2.2,1.,hLay); float hId=floor(hAc*hN), hF=fract(hAc*hN); float hs=gh(hId*7.3+hR*53.);
      diffuseColor.rgb*=(.3+.62*hs*hs)*(.7+.6*gh(hR*17.))*mix(.6,1.1,smoothstep(0.,.35,hAl))*(.55+.45*smoothstep(0.,.5,min(hF,1.-hF)*2.));
      float hEd=min(hAc,1.-hAc)*2.; float hTip=hAl+(hs-.5)*mix(.34,.26,hLay)+(gh(hR*5.)-.5)*.05;
      diffuseColor.a*=(1.-smoothstep(.86,.95,hTip))*mix(1.,smoothstep(.02,.3,hEd+(hs-.5)*.35),hLay);
      float hFib=step(.968,gh(hR*3.1))*hLay*smoothstep(.2,.05,abs(hAc-.5));`,
    '\n      totalEmissiveRadiance+=uSeam*hFib*(.2+.8*smoothstep(.55,1.,sin(hAl*22.-uTime*1.8+hR*40.)))*(.45+1.7*uMouth);',
    '\n      { vec3 hx=dFdx(vViewPosition), hy=dFdy(vViewPosition); vec3 hT=hx*dFdx(vH.x)+hy*dFdy(vH.x); float hl=length(hT); if(hl>1e-9) normal=normalize(normal+hT/hl*((hF-.5)*.9+(hAc-.5)*.7)); } // chaque cheveu bombe sa mèche',
    ['varying vec4 vH;\n', 'varying vec4 vH;\n']);
  hair.transparent = false; hair.alphaToCoverage = true; /* découpe nette et bords lissés par l'anticrénelage : pas de tri de transparence à faire */

  const head = new THREE.Group(); scene.add(head); let ready = false;
  const bake = (gl, pick) => { gl.scene.updateMatrixWorld(true); gl.scene.traverse((o) => { const m = o.isMesh && pick(o.material.name); if (m) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); head.add(new THREE.Mesh(g, m)); } }); };
  new GLTFLoader().load('assets/models/gladys.glb', (gl) => { bake(gl, (n) => ({ visage: skin, yeux: eyes })[n]); ready = true; }); /* l'ancienne coque « chevelure » du fichier n'est plus affichée */
  new GLTFLoader().load('assets/models/gladys-cheveux.glb', (gl) => bake(gl, () => hair));

  // Le vivant : regard, clignements, hochements. Tout est tiré d'horloges propres au portrait (déterministe, sans état caché dans le récit).
  const rnd = (n) => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
  let holo = 1, nod = 0, talk = 0, tPrev = 0, blinkAt = 2.4, blinkN = 0, lid = 0.2, glN = 0, glAt = 5, glT = -9, glDir = 1, yaw = 0, pit = 0, sx = 0, sy = 0, sacAt = 0, sacN = 0;
  return {
    render(t, mouth, ringing, o) { // t : temps en s ; mouth : 0…1 (amplitude de la voix) ; ringing : appel pas encore pris ; o : essais (tools/gladys-essai.html)
      if (!ready) return;
      const dt = Math.min(0.1, Math.max(0, t - tPrev)); tPrev = t;
      holo += ((ringing ? 1 : 0) - holo) * 0.08; nod += (mouth - nod) * 0.2; talk += ((mouth > 0.08 ? 1 : 0) - talk) * Math.min(1, dt * 4);
      // clignement : toutes les 2,5 à 6 s, parfois double ; la paupière tombe vite et remonte un peu moins vite
      if (t > blinkAt + 0.2) { blinkN++; blinkAt = t + (rnd(blinkN) < 0.18 ? 0.34 : 2.5 + rnd(blinkN + 0.5) * 3.5); }
      const bk = t - blinkAt, blink = bk > 0 && bk < 0.2 ? (bk < 0.07 ? bk / 0.07 : 1 - (bk - 0.07) / 0.13) : 0;
      lid += ((0.2 + 0.07 * (1 - talk)) - lid) * Math.min(1, dt * 5); /* au repos les paupières sont un peu plus lourdes */
      // de temps en temps elle regarde ailleurs (ses instruments), la tête suit avec un temps de retard, puis elle revient à nous
      if (t > glAt) { glN++; glT = t; glDir = rnd(glN + 7) < 0.5 ? -1 : 1; glAt = t + 7 + rnd(glN) * 8; }
      const g = t - glT, away = g < 2.2 ? Math.min(1, g / 0.18) * (1 - Math.max(0, Math.min(1, (g - 1.5) / 0.3))) : 0;
      // petites saccades de l'œil : il ne reste jamais parfaitement fixe
      if (t > sacAt) { sacN++; sacAt = t + 0.5 + rnd(sacN) * 1.6; sx = (rnd(sacN + 3) - 0.5) * 0.05; sy = (rnd(sacN + 5) - 0.5) * 0.03; }
      const ty = (o && o.yaw != null ? o.yaw : Math.sin(t * 0.31) * 0.07 + Math.sin(t * 0.83) * 0.025 + away * glDir * 0.26), tp = Math.sin(t * 0.37) * 0.025 + nod * 0.06 + away * 0.05;
      yaw += (ty - yaw) * Math.min(1, dt * 3.2); pit += (tp - pit) * Math.min(1, dt * 5);
      head.rotation.set(pit, yaw, Math.sin(t * 0.29) * 0.02 - yaw * 0.12);
      // le regard : il compense la rotation de la tête pour rester sur nous, sauf quand elle regarde ailleurs (les yeux partent avant la tête)
      U.uGaze.value.set(-Math.tan(yaw) * 0.9 + away * glDir * 0.34 + sx, Math.tan(pit) * 0.8 - away * 0.1 + sy);
      U.uLid.value = Math.max(lid, blink); U.uBrow.value = nod * 1.4 + away * 0.3;
      U.uTime.value = t; U.uMouth.value = mouth; U.uHolo.value = holo;
      renderer.render(scene, cam);
    }
  };
}
