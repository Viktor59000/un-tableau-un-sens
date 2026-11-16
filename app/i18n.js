// SPES — langues (fr · en · es) : interface, œuvres, textes du décor 3D.
// Les répliques de Gladys (voix + sous-titres) sont dans app/lines.json ; le français de la page est écrit dans index.html.
const STR = {
  fr: {
    speech: 'fr-FR', dec: ',', quo: ['« ', ' »'],
    ui: { loading: 'Chargement…', start: 'Lancer le dégel', ready: 'Systèmes prêts — casque audio conseillé.', reduced: 'Animations réduites détectées : la version texte est recommandée.',
      noGL: "La 3D n'est pas disponible sur cet appareil — version texte ci-dessous.", ring: 'APPEL ENTRANT', live: 'EN LIGNE', proto: 'PROTOCOLE RÉSONANCE', lot: 'LOT 42-SE', art: 'Artefact',
      card: ['Réveil', 'Ce qui reste', 'Danse sensorielle'],
      loc: ['PONT 12 · CAISSON R26-0417', 'PONT 12 · BAIE CRYO C', "PONT 12 · BAIE D'OBSERVATION", 'PONT 12 · LIAISON N-7', 'DS-04 · GALERIE — NARTHEX', 'DS-04 · GALERIE — NEF, NIV. 0', 'DS-04 · GALERIE — NIV. 1'],
      q: { thaw: 'Séquence de dégel en cours', call: 'Appel entrant — Gladys, unité de veille', askG: 'Interroger Gladys', exit: 'Sortir du caisson', sit: 'Se redresser', look: 'Observer la baie', obs: "Rejoindre la baie d'observation",
        earth: 'Observer la Terre', link: 'Rejoindre le poste de liaison N-7', cable: 'Branchement du câble cervical', visor: 'Casque de liaison — synchronisation', enter: 'Entrer dans la galerie', up: 'Monter au niveau 1', end: 'Regarder la nef une dernière fois' },
      a: { answer: 'Répondre', exit: 'Sortir du caisson', walk: 'Avancer', seat: "S'installer", enter: 'Entrer' },
      ch1: ['Où suis-je ?', 'Combien de temps ai-je dormi ?'], ch2: ['Pourquoi des œuvres ?', 'Pourquoi me réveiller, moi ?'],
      visor: ['PORT CERVICAL C2 · VERROUILLÉ', 'CORTEX VISUEL · PRIS EN CHARGE', 'CORTEX SOMATOSENSORIEL · PRIS EN CHARGE', 'CHARGEMENT DS-04 « RÉSONANCES » · LOT 42-SE'] },
    works: [
      { sense: 'Kinesthésie', canal: 'Canal K', verb: 'Fixer une plume', tech: 'plumes sur Rhodoïde · 97,5 × 97,5 cm', dw: '97,5 cm', dh: '97,5 cm',
        def: 'Percevoir un mouvement dans son propre corps, même devant une image immobile.', cns: 'Fixe une seule plume, dix secondes, sans bouger.' },
      { sense: 'Toucher haptique virtuel', canal: 'Canal H', verb: 'Toucher du regard', tech: 'résine sur grillage de fer · 141 × 141 cm', dw: '141 cm', dh: '141 cm',
        def: "L'œil déclenche une sensation tactile, sans aucun contact avec la matière.", cns: 'Approche-toi à trente centimètres. Ne touche pas.' },
      { sense: 'Proprioception spatiale', canal: 'Canal P', verb: 'Lever les yeux', tech: 'impression sur cuivre · 192 × 100 cm', dw: '100 cm', dh: '192 cm',
        def: "Le sens de ta taille, de ton volume et de ta place dans l'espace, sans regarder ton corps.", cns: 'Place tes pieds sur le repère, à soixante centimètres.' },
      { sense: 'Intéroception & chronoception', canal: 'Canal I', verb: "S'approcher", tech: 'pointe de gramophone sur verre peint · 35 × 44 cm', dw: '44 cm', dh: '35 cm',
        def: "Sentir l'intérieur de son corps — le cœur, le souffle — et l'écoulement du temps.", cns: 'Penche-toi à vingt centimètres. Ralentis.' }],
    log: [['ARCHIVE 42-SE // 22.11.2026', "Saint-Étienne. La galerie Ceysson & Bénétière ferme l'exposition Résonances. Quatre de ses œuvres sont numérisées pour le programme HOPE."],
      ['JOURNAL DE BORD // 14.12.2026', "La cohorte R-26 embarque sur l'arche SPES-07 : deux mille volontaires de 18 à 25 ans. Mise en stase, niveau 4."],
      ['JOURNAL DE BORD // J+173 141', "An 2500. Indice de Voile terrestre : 9,7. Protocole RÉSONANCE déclenché. Premier sujet : R26-0417. C'est toi."]],
    tx: { bay: ['PONT 12 — BAIE CRYO C', 'cohorte R-26   ·   2 000 sujets en stase niv. 4', 'réveillés : 0001   ·   cycle J+173 141'],
      log: ['JOURNAL DE BORD — SPES-07', '2026 · embarquement de la cohorte R-26', '2140 · indice de Voile > 9 : la Grande Poussière', '2318 · dernier signal terrestre capté', '2500 · protocole RÉSONANCE — sujet R26-0417'],
      obs: '▲ OBSERVATION', stase: 'STASE NIV.4', earth: ['ORBITE BASSE — TERRE', 'indice de Voile : 9,7 / 10', 'surface habitable : 3 %'], fleet: ['FLOTTE HOPE', '212 arches en attente', 'SPES-07 · arche sensorielle'],
      link: ['LIAISON N-7', 'danse sensorielle · lot 42-SE'], entree: 'ENTRÉE', narthex: 'NARTHEX · ACCUEIL', librairie: 'LIBRAIRIE', bistrot: 'LE BISTROT', nef: 'NEF · NIV. 0', niv1: 'NIV. 1' }
  },
  en: {
    speech: 'en-GB', dec: '.', quo: ['“', '”'],
    ui: { loading: 'Loading…', start: 'Begin thawing', ready: 'Systems ready — headphones recommended.', reduced: 'Reduced motion detected: the text version is recommended.',
      noGL: '3D is not available on this device — text version below.', ring: 'INCOMING CALL', live: 'CONNECTED', proto: 'PROTOCOL RESONANCE', lot: 'BATCH 42-SE', art: 'Artefact',
      card: ['Awakening', 'What remains', 'Sense dance'],
      loc: ['DECK 12 · POD R26-0417', 'DECK 12 · CRYO BAY C', 'DECK 12 · OBSERVATION BAY', 'DECK 12 · LINK N-7', 'DS-04 · GALLERY — NARTHEX', 'DS-04 · GALLERY — NAVE, LEVEL 0', 'DS-04 · GALLERY — LEVEL 1'],
      q: { thaw: 'Thaw sequence in progress', call: 'Incoming call — Gladys, watch unit', askG: 'Question Gladys', exit: 'Leave the pod', sit: 'Sit up', look: 'Look around the bay', obs: 'Reach the observation bay',
        earth: 'Look at Earth', link: 'Reach link station N-7', cable: 'Connecting the cervical cable', visor: 'Link headset — synchronising', enter: 'Enter the gallery', up: 'Go up to level 1', end: 'One last look at the nave' },
      a: { answer: 'Answer', exit: 'Leave the pod', walk: 'Walk on', seat: 'Sit down', enter: 'Enter' },
      ch1: ['Where am I?', 'How long have I been asleep?'], ch2: ['Why works of art?', 'Why wake me?'],
      visor: ['CERVICAL PORT C2 · LOCKED', 'VISUAL CORTEX · TAKEN OVER', 'SOMATOSENSORY CORTEX · TAKEN OVER', 'LOADING DS-04 “RÉSONANCES” · BATCH 42-SE'] },
    works: [
      { sense: 'Kinesthesia', canal: 'Channel K', verb: 'Fix on a feather', tech: 'feathers on Rhodoid · 97.5 × 97.5 cm', dw: '97.5 cm', dh: '97.5 cm',
        def: 'Perceiving movement in your own body, even in front of a still image.', cns: 'Fix on a single feather for ten seconds, without moving.',
        doc: 'Perceiving movement in your own body in front of a still image: your brain simulates the feathers falling.' },
      { sense: 'Virtual haptic touch', canal: 'Channel H', verb: 'Touch with your eyes', tech: 'resin on iron wire mesh · 141 × 141 cm', dw: '141 cm', dh: '141 cm',
        def: 'The eye triggers a tactile sensation, with no contact with the material at all.', cns: 'Come within thirty centimetres. Do not touch.',
        doc: 'The eye triggers a tactile sensation without contact: the cortex rebuilds the cold of the iron and the smoothness of the resin.' },
      { sense: 'Spatial proprioception', canal: 'Channel P', verb: 'Look up', tech: 'print on copper · 192 × 100 cm', dw: '100 cm', dh: '192 cm',
        def: 'The sense of your size, your volume and your place in space, without looking at your body.', cns: 'Place your feet on the marker, sixty centimetres away.',
        doc: 'The sense of your size and your place in space: the trunks tower over you, and your brain recalculates your scale.' },
      { sense: 'Interoception & chronoception', canal: 'Channel I', verb: 'Move closer', tech: 'gramophone needle on painted glass · 35 × 44 cm', dw: '44 cm', dh: '35 cm',
        def: 'Sensing the inside of your body — heart, breath — and the flow of time.', cns: 'Lean in to twenty centimetres. Slow down.',
        doc: 'Sensing the inside of your body and the flow of time: a childhood memory changes the rhythm of your heart.' }],
    log: [['ARCHIVE 42-SE // 22.11.2026', 'Saint-Étienne. The Ceysson & Bénétière gallery closes the exhibition Résonances. Four of its works are digitised for the HOPE programme.'],
      ["SHIP'S LOG // 14.12.2026", 'Cohort R-26 boards the ark SPES-07: two thousand volunteers aged 18 to 25. Stasis engaged, level 4.'],
      ["SHIP'S LOG // D+173,141", "Year 2500. Earth's Veil index: 9.7. Protocol RESONANCE triggered. First subject: R26-0417. That is you."]],
    tx: { bay: ['DECK 12 — CRYO BAY C', 'cohort R-26   ·   2,000 subjects in stasis lvl 4', 'awake: 0001   ·   cycle D+173,141'],
      log: ["SHIP'S LOG — SPES-07", '2026 · cohort R-26 boards', '2140 · Veil index > 9: the Great Dust', '2318 · last signal received from Earth', '2500 · Protocol RESONANCE — subject R26-0417'],
      obs: '▲ OBSERVATION', stase: 'STASIS LVL 4', earth: ['LOW ORBIT — EARTH', 'Veil index: 9.7 / 10', 'habitable surface: 3 %'], fleet: ['HOPE FLEET', '212 arks standing by', 'SPES-07 · sensory ark'],
      link: ['LINK N-7', 'sense dance · batch 42-SE'], entree: 'ENTRANCE', narthex: 'NARTHEX · RECEPTION', librairie: 'BOOKSHOP', bistrot: 'LE BISTROT', nef: 'NAVE · LEVEL 0', niv1: 'LEVEL 1' },
    dom: { skip: 'Skip to the text version', bKick: 'SPES-07 · deck 12 · pod R26-0417',
      lede: 'You are subject R26-0417. You have been asleep for 474 years aboard an ark in orbit. A voice is calling you: Protocol RESONANCE begins.',
      txt: 'Text version', keysT: 'Tap the buttons to act · drag to look around', keys: '<kbd>F</kbd> act · <kbd>1</kbd><kbd>2</kbd> answer · <kbd>Space</kbd> skip a line · mouse to look',
      proSkip: 'Space or click to skip', vKick: 'Link N-7 · neural synchronisation', callI: 'Watch unit · SPES-07',
      q0: 'Channel K · Kinesthesia', q1: 'Channel H · Virtual touch', q2: 'Channel P · Proprioception', q3: 'Channel I · Interoception', art: 'Artefact', pulse: 'Pulse', temp: 'Temp.',
      bSkip: 'Skip', bVoice: 'Voice', bSound: 'Sound', oKick: 'Protocol RESONANCE · 4/4 channels reopened', oH: 'Come and feel it for real',
      oP: 'The four works you have just walked through exist. They are waiting for you at the closing weekend of the exhibition Résonances.',
      fDates: 'Dates', fDatesV: '21 &amp; 22 November 2026<br>11 am – 7 pm', fPlace: 'Venue', fAccess: 'Admission', fAccessV: 'Free entry<br>Free audio guide',
      route: 'Get directions', readD: 'Read the logbook', replay: 'Relive the awakening',
      dKick: "Ship's log · text version", dP: 'A sensory trail for the closing weekend of the exhibition Résonances at the Ceysson &amp; Bénétière gallery. Four works, four senses nobody taught you at school.',
      s1n: '01 — The idea', s1h: 'Five senses is a myth',
      s1p: "Aristotle's five senses only describe your interface with the outside world. Neuroscience counts more than twenty, and the most powerful ones look inward. The trail uses them to bring down the barrier around contemporary art.",
      c1h: 'What you know', c1p: 'Seeing, hearing, touching, smelling, tasting: sensors turned outward. Useful, but incomplete.',
      c2h: 'What the gallery forbids', c2p: 'No touching, no tasting, no noise. Your outer senses are held back: that is the trigger.',
      c3h: 'What wakes up', c3p: 'Deprived of contact, your brain switches to the position of your body, the rhythm of your heart, your perception of time.',
      s2n: '02 — The works', s2h: 'Four recalibrations', s3n: '03 — Visiting', s3h: 'Practical information',
      iDatesV: '21 &amp; 22 November 2026<span>Saturday and Sunday, 11 am – 7 pm</span>', iAccessV: 'Free entry<span>No booking, free audio guide</span>',
      iDur: 'Duration', iDurV: '45 minutes<span>Four stations, at your own pace</span>', launch: 'Launch the 3D experience',
      foot1: '© 2026 — Advanced graphic design, Télécom Saint-Étienne B3 × Ceysson &amp; Bénétière gallery',
      foot2: 'Scanned head: Lee Perry-Smith / Infinite-Realities (CC BY 3.0) · Body: X Bot mannequin, Mixamo · Materials: Poly Haven (CC0) · Earth: NASA (public domain) · Voice: speech synthesis' }
  },
  es: {
    speech: 'es-ES', dec: ',', quo: ['« ', ' »'],
    ui: { loading: 'Cargando…', start: 'Iniciar el deshielo', ready: 'Sistemas listos — se recomiendan auriculares.', reduced: 'Animaciones reducidas detectadas: se recomienda la versión de texto.',
      noGL: 'El 3D no está disponible en este dispositivo — versión de texto más abajo.', ring: 'LLAMADA ENTRANTE', live: 'EN LÍNEA', proto: 'PROTOCOLO RESONANCIA', lot: 'LOTE 42-SE', art: 'Artefacto',
      card: ['Despertar', 'Lo que queda', 'Danza sensorial'],
      loc: ['CUBIERTA 12 · CÁPSULA R26-0417', 'CUBIERTA 12 · BAHÍA CRIO C', 'CUBIERTA 12 · BAHÍA DE OBSERVACIÓN', 'CUBIERTA 12 · ENLACE N-7', 'DS-04 · GALERÍA — NÁRTEX', 'DS-04 · GALERÍA — NAVE, NIVEL 0', 'DS-04 · GALERÍA — NIVEL 1'],
      q: { thaw: 'Secuencia de deshielo en curso', call: 'Llamada entrante — Gladys, unidad de vigilia', askG: 'Preguntar a Gladys', exit: 'Salir de la cápsula', sit: 'Incorporarse', look: 'Observar la bahía', obs: 'Llegar a la bahía de observación',
        earth: 'Observar la Tierra', link: 'Llegar al puesto de enlace N-7', cable: 'Conexión del cable cervical', visor: 'Casco de enlace — sincronización', enter: 'Entrar en la galería', up: 'Subir al nivel 1', end: 'Mirar la nave por última vez' },
      a: { answer: 'Responder', exit: 'Salir de la cápsula', walk: 'Avanzar', seat: 'Sentarse', enter: 'Entrar' },
      ch1: ['¿Dónde estoy?', '¿Cuánto tiempo he dormido?'], ch2: ['¿Por qué obras de arte?', '¿Por qué despertarme a mí?'],
      visor: ['PUERTO CERVICAL C2 · BLOQUEADO', 'CÓRTEX VISUAL · BAJO CONTROL', 'CÓRTEX SOMATOSENSORIAL · BAJO CONTROL', 'CARGANDO DS-04 «RÉSONANCES» · LOTE 42-SE'] },
    works: [
      { sense: 'Cinestesia', canal: 'Canal K', verb: 'Fijar una pluma', tech: 'plumas sobre Rhodoïd · 97,5 × 97,5 cm', dw: '97,5 cm', dh: '97,5 cm',
        def: 'Percibir un movimiento en tu propio cuerpo, incluso ante una imagen inmóvil.', cns: 'Fija una sola pluma, diez segundos, sin moverte.',
        doc: 'Percibir un movimiento en tu propio cuerpo ante una imagen inmóvil: tu cerebro simula la caída de las plumas.' },
      { sense: 'Tacto háptico virtual', canal: 'Canal H', verb: 'Tocar con la mirada', tech: 'resina sobre malla de hierro · 141 × 141 cm', dw: '141 cm', dh: '141 cm',
        def: 'El ojo desencadena una sensación táctil, sin ningún contacto con la materia.', cns: 'Acércate a treinta centímetros. No toques.',
        doc: 'El ojo desencadena una sensación táctil sin contacto: la corteza reconstruye el frío del hierro y la suavidad de la resina.' },
      { sense: 'Propiocepción espacial', canal: 'Canal P', verb: 'Levantar la vista', tech: 'impresión sobre cobre · 192 × 100 cm', dw: '100 cm', dh: '192 cm',
        def: 'El sentido de tu tamaño, de tu volumen y de tu lugar en el espacio, sin mirar tu cuerpo.', cns: 'Coloca los pies en la marca, a sesenta centímetros.',
        doc: 'El sentido de tu tamaño y de tu lugar en el espacio: los troncos te dominan y tu cerebro recalcula tu escala.' },
      { sense: 'Interocepción y cronocepción', canal: 'Canal I', verb: 'Acercarse', tech: 'punta de gramófono sobre vidrio pintado · 35 × 44 cm', dw: '44 cm', dh: '35 cm',
        def: 'Sentir el interior de tu cuerpo —el corazón, la respiración— y el paso del tiempo.', cns: 'Inclínate a veinte centímetros. Ve más despacio.',
        doc: 'Sentir el interior de tu cuerpo y el paso del tiempo: un recuerdo de infancia cambia el ritmo de tu corazón.' }],
    log: [['ARCHIVO 42-SE // 22.11.2026', 'Saint-Étienne. La galería Ceysson & Bénétière clausura la exposición Résonances. Cuatro de sus obras se digitalizan para el programa HOPE.'],
      ['DIARIO DE A BORDO // 14.12.2026', 'La cohorte R-26 embarca en el arca SPES-07: dos mil voluntarios de 18 a 25 años. Puesta en estasis, nivel 4.'],
      ['DIARIO DE A BORDO // D+173 141', 'Año 2500. Índice de Velo terrestre: 9,7. Protocolo RESONANCIA activado. Primer sujeto: R26-0417. Eres tú.']],
    tx: { bay: ['CUBIERTA 12 — BAHÍA CRIO C', 'cohorte R-26   ·   2 000 sujetos en estasis niv. 4', 'despiertos: 0001   ·   ciclo D+173 141'],
      log: ['DIARIO DE A BORDO — SPES-07', '2026 · embarque de la cohorte R-26', '2140 · índice de Velo > 9: el Gran Polvo', '2318 · última señal recibida de la Tierra', '2500 · protocolo RESONANCIA — sujeto R26-0417'],
      obs: '▲ OBSERVACIÓN', stase: 'ESTASIS NIV.4', earth: ['ÓRBITA BAJA — TIERRA', 'índice de Velo: 9,7 / 10', 'superficie habitable: 3 %'], fleet: ['FLOTA HOPE', '212 arcas en espera', 'SPES-07 · arca sensorial'],
      link: ['ENLACE N-7', 'danza sensorial · lote 42-SE'], entree: 'ENTRADA', narthex: 'NÁRTEX · RECEPCIÓN', librairie: 'LIBRERÍA', bistrot: 'LE BISTROT', nef: 'NAVE · NIVEL 0', niv1: 'NIVEL 1' },
    dom: { skip: 'Ir a la versión de texto', bKick: 'SPES-07 · cubierta 12 · cápsula R26-0417',
      lede: 'Eres el sujeto R26-0417. Llevas 474 años dormido a bordo de un arca en órbita. Una voz te llama: comienza el protocolo RESONANCIA.',
      txt: 'Versión de texto', keysT: 'Toca los botones para actuar · desliza el dedo para mirar', keys: '<kbd>F</kbd> actuar · <kbd>1</kbd><kbd>2</kbd> responder · <kbd>Espacio</kbd> saltar una réplica · ratón para mirar',
      proSkip: 'Espacio o clic para saltar', vKick: 'Enlace N-7 · sincronización neuronal', callI: 'Unidad de vigilia · SPES-07',
      q0: 'Canal K · Cinestesia', q1: 'Canal H · Tacto virtual', q2: 'Canal P · Propiocepción', q3: 'Canal I · Interocepción', art: 'Artefacto', pulse: 'Pulso', temp: 'Temp.',
      bSkip: 'Saltar', bVoice: 'Voz', bSound: 'Sonido', oKick: 'Protocolo RESONANCIA · 4/4 canales reabiertos', oH: 'Ven a sentirlo de verdad',
      oP: 'Las cuatro obras que acabas de recorrer existen. Te esperan en la clausura de la exposición Résonances.',
      fDates: 'Fechas', fDatesV: '21 y 22 de noviembre de 2026<br>11 h – 19 h', fPlace: 'Lugar', fAccess: 'Acceso', fAccessV: 'Entrada libre<br>Audioguía gratuita',
      route: 'Cómo llegar', readD: 'Leer el dossier', replay: 'Revivir el despertar',
      dKick: 'Diario de a bordo · versión de texto', dP: 'Un recorrido sensorial para la clausura de la exposición Résonances en la galería Ceysson &amp; Bénétière. Cuatro obras, cuatro sentidos que nadie te enseñó en el colegio.',
      s1n: '01 — El principio', s1h: 'Los cinco sentidos son un mito',
      s1p: 'Los cinco sentidos de Aristóteles solo describen tu interfaz con el exterior. La neurociencia cuenta más de veinte, y los más potentes miran hacia dentro. El recorrido se sirve de ellos para derribar la barrera del arte contemporáneo.',
      c1h: 'Lo que conoces', c1p: 'Ver, oír, tocar, oler, saborear: sensores orientados hacia fuera. Útiles, pero incompletos.',
      c2h: 'Lo que la galería prohíbe', c2p: 'No tocar, no probar, no hacer ruido. Tus sentidos externos quedan frenados: ese es el detonante.',
      c3h: 'Lo que despierta', c3p: 'Privado de contacto, tu cerebro pasa a la posición del cuerpo, el ritmo del corazón, la percepción del tiempo.',
      s2n: '02 — Las obras', s2h: 'Cuatro recalibraciones', s3n: '03 — Venir', s3h: 'Información práctica',
      iDatesV: '21 y 22 de noviembre de 2026<span>Sábado y domingo, de 11 h a 19 h</span>', iAccessV: 'Entrada libre<span>Sin reserva, audioguía gratuita</span>',
      iDur: 'Duración', iDurV: '45 minutos<span>Cuatro estaciones, a tu ritmo</span>', launch: 'Lanzar la experiencia 3D',
      foot1: '© 2026 — Diseño gráfico avanzado, Télécom Saint-Étienne B3 × galería Ceysson &amp; Bénétière',
      foot2: 'Cabeza escaneada: Lee Perry-Smith / Infinite-Realities (CC BY 3.0) · Cuerpo: maniquí X Bot, Mixamo · Materiales: Poly Haven (CC0) · Tierra: NASA (dominio público) · Voz: síntesis de voz' }
  }
};

const stored = () => { try { return localStorage.getItem('spes-lang'); } catch (e) { return null; } };
function detect() { // ordre : ?lang= dans l'adresse, choix mémorisé, langue du navigateur, français
  for (const c of [new URLSearchParams(location.search).get('lang'), stored(), ...(navigator.languages || [navigator.language])]) { const k = (c || '').slice(0, 2).toLowerCase(); if (STR[k]) return k; }
  return 'fr';
}
export const LANG = detect();
const L = STR[LANG];
export const T = L.ui, WTX = L.works, LOG = L.log, TX = L.tx, SPEECH = L.speech, DEC = L.dec, QUO = L.quo;
export function setLang(l) { if (l === LANG || !STR[l]) return; try { localStorage.setItem('spes-lang', l); } catch (e) { /* stockage indisponible */ } const u = new URL(location.href); u.searchParams.set('lang', l); location.href = u.href; }
export function localizeDom() { // le sélecteur de langue recharge la page : le décor 3D porte lui aussi des textes
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-lang]').forEach((b) => { const on = b.dataset.lang === LANG; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.addEventListener('click', () => setLang(b.dataset.lang)); });
  if (!L.dom) return;
  document.querySelectorAll('[data-k]').forEach((el) => { const v = L.dom[el.dataset.k]; if (v != null) el.innerHTML = v; });
  document.querySelectorAll('[data-w]').forEach((el) => { const i = +el.dataset.w, w = WTX[i]; el.querySelector('b').textContent = '0' + (i + 1) + ' · ' + w.sense; el.querySelector('.d').textContent = w.doc; el.querySelector('.c').textContent = QUO[0] + w.cns + QUO[1]; });
}
