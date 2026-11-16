// SPES — portrait de Gladys dans le cadre d'appel : un visage de femme en 3D, rendu dans son propre petit canevas.
// Le buste vient des « Human Base Meshes » de la Blender Foundation (CC0), préparé par tools/humains_blender.py :
// trois maillages nommés par leur matière — « visage », « yeux », « chevelure » — origine au centre de la tête, en mètres.
// Gladys est une androïde : peau de porcelaine, lèvres à peine teintées, joints lumineux sur les joues et le cou,
// iris qui brillent, mâchoire entraînée par le signal de la voix. Pendant la sonnerie, elle n'est qu'un hologramme corail.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// repères du visage (mètres, depuis le centre de la tête : x vers sa gauche, y vers le haut, z vers l'avant)
const EYE = [0.033, -0.021, 0.062], MOUTH_Y = -0.086;

export function createGladys(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  renderer.setPixelRatio(1); renderer.setSize(canvas.width, canvas.height, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, canvas.width / canvas.height, 0.05, 5);
  cam.position.set(0, -0.02, 0.86); cam.lookAt(0, -0.034, 0);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xdcefff, 2.5); key.position.set(-0.7, 0.8, 1.4); scene.add(key);   // lumière froide, de trois quarts
  const rim = new THREE.DirectionalLight(0xff6a48, 3.4); rim.position.set(1.3, 0.3, -1.1); scene.add(rim);   // contre-jour corail
  scene.add(new THREE.HemisphereLight(0x9cc0de, 0x10141a, 0.4));

  const U = { uTime: { value: 0 }, uMouth: { value: 0 }, uHolo: { value: 1 }, uSeam: { value: new THREE.Color(0.35, 0.95, 1) }, uRing: { value: new THREE.Color(1, 0.33, 0.22) } };
  // tout le buste partage la même fin : il se défait en tranches fines sous les clavicules, et devient hologramme pendant la sonnerie
  const END = `#include <dithering_fragment>
      float ga=smoothstep(-.33,-.2,vObj.y+.012*sin(vObj.x*60.+uTime*1.3)); float gs=step(.45,fract(vObj.y*210.-uTime*.5)); ga*=mix(gs*.75,1.,smoothstep(.45,.95,ga));
      float gy=dot(gl_FragColor.rgb,vec3(.3,.59,.11)); gl_FragColor.rgb=mix(gl_FragColor.rgb,uRing*(gy*1.5+.12)*(.55+.45*gs),uHolo); gl_FragColor.a=ga*mix(1.,.8,uHolo);`;
  const HEAD_V = 'varying vec3 vObj;uniform float uMouth,uHolo,uTime;\nfloat gh(float p){return fract(sin(p*127.1)*43758.5453);}\n', HEAD_F = 'varying vec3 vObj;uniform float uTime,uHolo,uMouth;uniform vec3 uSeam,uRing;\n';
  const JIT = '\n      transformed.x+=uHolo*(gh(floor(position.y*100.)+floor(uTime*9.))-.5)*.012*step(.82,gh(floor(position.y*100.)*1.7+floor(uTime*9.)));';
  const hook = (key, mat, vert, frag, emis) => { mat.transparent = true; mat.customProgramCacheKey = () => 'gladys-' + key; /* sans clé propre, les trois matières partageraient le même programme */ mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = HEAD_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n      vObj=position;' + vert + JIT);
    sh.fragmentShader = HEAD_F + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>' + frag).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + emis).replace('#include <dithering_fragment>', END); }; return mat; };

  const skin = hook('visage', new THREE.MeshPhysicalMaterial({ color: 0xe6ebee, roughness: 0.34, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }),
    `\n      float jw=smoothstep(${(MOUTH_Y + 0.003).toFixed(3)},${(MOUTH_Y - 0.012).toFixed(3)},position.y)*smoothstep(.01,.06,position.z)*smoothstep(-.15,-.125,position.y); transformed.y-=uMouth*.0065*jw; transformed.z-=uMouth*.0015*jw; // mâchoire`,
    `\n      float gFront=smoothstep(.0,.03,vObj.z); float ax=abs(vObj.x);
      float gLip=smoothstep(.027,.017,ax)*smoothstep(-.1,-.094,vObj.y)*smoothstep(-.071,-.078,vObj.y)*step(.08,vObj.z); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.45,.43),gLip*.55); // lèvres à peine teintées
      float gCheek=smoothstep(.0013,.0004,abs(ax-(.047+.13*(vObj.y+.03))))*step(-.108,vObj.y)*step(vObj.y,-.036)*gFront;       // joints des joues
      float gChin=smoothstep(.001,.0003,ax)*step(-.127,vObj.y)*step(vObj.y,-.101)*gFront;                                         // joint du menton
      float gNeck=(smoothstep(.0013,.0004,abs(vObj.y+.17))+smoothstep(.0013,.0004,abs(vObj.y+.198))+smoothstep(.0013,.0004,abs(vObj.y+.226)))*step(vObj.y,-.15); // anneaux du cou
      float gSeam=max(max(gCheek,gChin),gNeck); diffuseColor.rgb*=1.-gSeam*.8;`,
    '\n      totalEmissiveRadiance+=uSeam*gSeam*(.45+1.7*uMouth);');
  const eyes = hook('yeux', new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }), '',
    `\n      vec3 ed=normalize(vObj-vec3(sign(vObj.x)*${EYE[0].toFixed(3)},${EYE[1].toFixed(3)},${EYE[2].toFixed(3)})); float ea=acos(clamp(ed.z,-1.,1.));
      float eIris=smoothstep(.62,.54,ea), ePupil=smoothstep(.27,.21,ea), eRing=eIris*(1.-ePupil); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03,.06,.08),eIris); // iris sombre, anneau lumineux`,
    '\n      totalEmissiveRadiance+=uSeam*eRing*(.9+.5*sin(ea*40.))*(1.3+uMouth);');
  const hair = hook('chevelure', new THREE.MeshPhysicalMaterial({ color: 0x0b1016, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.3, side: THREE.DoubleSide }), '',
    '\n      float hs=.5+.5*sin(atan(vObj.x,vObj.z+.03)*70.+sin(vObj.y*40.)*1.5); diffuseColor.rgb*=.7+.6*hs*hs; // mèches', '');

  const head = new THREE.Group(); scene.add(head); let ready = false;
  new GLTFLoader().load('assets/models/gladys.glb', (gl) => { gl.scene.updateMatrixWorld(true); const mats = { visage: skin, yeux: eyes, chevelure: hair };
    gl.scene.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); head.add(new THREE.Mesh(g, mats[o.material.name] || skin)); } }); ready = true; });

  let holo = 1, nod = 0;
  return {
    render(t, mouth, ringing) { // t : temps en s ; mouth : 0…1 (amplitude de la voix) ; ringing : appel pas encore pris
      if (!ready) return;
      holo += ((ringing ? 1 : 0) - holo) * 0.08; nod += (mouth - nod) * 0.2;
      U.uTime.value = t; U.uMouth.value = mouth; U.uHolo.value = holo;
      head.rotation.set(Math.sin(t * 0.37) * 0.04 + nod * 0.05, Math.sin(t * 0.5) * 0.2 + Math.sin(t * 1.3) * 0.02, Math.sin(t * 0.29) * 0.025);
      renderer.render(scene, cam);
    }
  };
}
