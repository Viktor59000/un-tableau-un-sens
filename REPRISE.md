# Reprise du projet — « un tableau, un sens » · SPES

Document de passation. Il dit où en est le projet, comment il est construit, ce qui reste à faire tout de suite et plus tard, et les pièges déjà rencontrés. État décrit : **17 novembre 2026**.

## 1. En deux minutes

- **Quoi** : une expérience web 3D à la première personne qui donne envie d'aller voir le parcours sensoriel « un tableau, un sens », clôture de l'exposition *Résonances* à la galerie **Ceysson & Bénétière** (10 rue des Aciéries, Saint-Étienne), les **21 et 22 novembre 2026**, 11h–19h, entrée libre. Cible : 18-25 ans.
- **Idée** : on oublie les cinq sens ; quatre œuvres font éprouver quatre *sens internes* (kinesthésie, toucher haptique virtuel, proprioception, intéroception/chronoception).
- **Fiction** : an 2500, arche SPES-07. L'IA Gladys réveille le sujet R26-0417 (le visiteur) et rouvre ses sens avec quatre œuvres numérisées en 2026. Le troisième acte se passe dans une « danse sensorielle » : **la galerie reconstituée, que l'on parcourt comme on la parcourra en vrai**.
- **Cadre** : projet de Design graphique avancé, Télécom Saint-Étienne B3. Dépôt `Viktor59000/un-tableau-un-sens`, publié par GitHub Pages : https://viktor59000.github.io/un-tableau-un-sens/
- **Technique** : site statique, **aucun build**. `index.html` + modules ES, Three.js r160 chargé par importmap depuis jsDelivr.

## 2. Lancer, tester, publier

```bash
python -m http.server 8755 --bind 127.0.0.1
```

Puis ouvrir http://127.0.0.1:8755/ (les modules ES ne se chargent pas en `file://`). Publier = pousser sur `main` (Pages sert la racine, délai d'une à deux minutes).

Ne **jamais** committer `.mcp.json` (jeton d'accès Figma, déjà dans `.gitignore`).

## 3. Carte du code

| Fichier | Rôle |
|---|---|
| `index.html` | Balisage, toute la CSS, écran de démarrage, HUD, écran de fin, **version texte accessible** (`#dossier`). Le français est écrit ici ; les éléments traduisibles portent `data-k`. |
| `app/main.js` | Moteur (rendu, post-traitement, qualité adaptative), son, voix, HUD, entrées, et **le récit** (`prologue`, `act1`, `act2`, `act3`, écrits en `async/await`). |
| `app/world.js` | Décors et shaders du vaisseau : baie cryogénique, robots, hublots, espace, poste de liaison. `buildWorld()` renvoie l'objet `W` que le récit pilote, et appelle `buildGallery()`. **Espace** : toutes les coques (arches, navettes, pont avant) viennent de modèles Blender et partagent une seule matière (`hullMat`), qui dessine tôles, hublots et feux ; tout l'éclairage lit le vecteur `SUN`, que `W.setSun(k)` déplace (lever de soleil). `W.flyby(k)` fait passer l'arche géante. **Baie cryogénique** : `baie.glb` posé en pièces répétées tous les 2,6 m (`RIB0`, `NB`), `caisson.glb` pour les 23 caissons ; les matières sont attribuées par nom (`bayMats`) et les textures projetées par `boxUV` (les modèles n'ont pas de coordonnées de texture). **Poste de liaison** : `fauteuil.glb`, animé par `W.seatWake`, `W.setArms`, `W.setClamp`, `W.setCable`, `W.setVisor`. |
| `app/galerie.js` | **La danse sensorielle** : la galerie reconstituée, **rendue en hologramme** (volumes réels en verre sombre, arêtes lumineuses, sol miroir ; `?reel` montre la variante en cube blanc), son mobilier, ses visiteurs, et les quatre œuvres avec leur effet. Code aéré, une section par œuvre. |
| `app/corps.js` | **Le corps du visiteur**, vu à la première personne : segments articulés (bras, avant-bras, cuisses, jambes), poses (assis dans le caisson, mains levées, debout, assis au fauteuil) et marche. `BODY.set({ pose, vis, rust })` depuis le récit. |
| `app/gladys.js` | Le **portrait 3D de Gladys** dans le cadre d'appel : un **visage de femme** (buste `gladys.glb`) traité en androïde — porcelaine, carré sombre, iris lumineux, joints sur les joues et le cou —, rendu dans son propre petit canevas WebGL. À défaut (`?lite`, second contexte refusé), `main.js` retombe sur l'ancien relevé en lignes de contour. |
| `app/plumes.js` | Position, angle, taille et couleur des 114 plumes de l'œuvre 1. **Généré** par `tools/plumes.py` : ne pas modifier à la main. |
| `app/i18n.js` | Langues fr/en/es : interface, textes des œuvres, textes affichés dans le décor 3D, traduction de la version texte. |
| `app/lines.json` | Répliques de Gladys, par langue : `{ t: sous-titre, say?: graphie pour la synthèse, d: durée en s }`. |
| `tools/voix.py` | Régénère les voix (`assets/voice/<langue>/<id>.mp3`) et les durées. |
| `tools/humains_blender.py` | Dans **Blender** : à partir des « Human Base Meshes » de la Blender Foundation (CC0), écrit `gladys.glb` (buste, yeux, chevelure), `dormeuse.glb` / `dormeur.glb` (corps allongés, bonnet, bandeau, port cervical, câble) et `corps.glb` (le visiteur, en segments articulés). Option `-- apercu` pour des images de contrôle. La source (50 Mo) n'est pas versionnée : voir l'en-tête du script. |
| `tools/blender_kit.py` | Boîte à outils commune aux trois scripts ci-dessous : volumes simples rangés par matière (`Parts`), chanfreins, export glTF, image de contrôle. |
| `tools/arche_blender.py` | Dans **Blender** : modélise une arche du programme HOPE (coque à plaques, anneau d'habitat séparé pour le faire tourner, treillis, réservoirs, voilures, tuyères) → `arche.glb` et sa version allégée `arche-lod.glb` (flotte lointaine). |
| `tools/pont_blender.py` | Dans **Blender** : le pont avant de SPES-07 vu sous le hublot (tablier, galerie à hublots, mâts, parabole, plateforme et navette posée, perche d'instruments) → `pont.glb` ; et la navette de liaison → `navette.glb`. |
| `tools/baie_blender.py` | Dans **Blender** : la baie cryogénique → `baie.glb` en quatre pièces (`travee` : 2,6 m de baie avec son alcôve technique ; `couple` : la structure ; `avant` : les 2 m devant les hublots ; `fond` : cloison et porte étanche) et le caisson de stase → `caisson.glb` (`caisson`, et `capot`, l'armature de la verrière, origine sur sa charnière). Le verre, le givre, les corps et les témoins restent dessinés par `world.js`. |
| `tools/fauteuil_blender.py` | Dans **Blender** : le poste de liaison N-7 → `fauteuil.glb`, en quatre objets : `fauteuil` (fixe), `accoudoir_g`, `accoudoir_d` (origine sur leur charnière), `casque` (origine sur son axe). Les cotes suivent la posture du corps : les relire avant de toucher à la pose `seat` de `corps.js`. |
| `tools/robots_blender.py` | Dans **Blender** : les Veilleurs → `robots.glb`. Chaque pièce mobile est un objet dont l'origine est sur son articulation : bras sur rail (`chariot`, `bras1`, `bras2`, `outil`), drone (`drone`, `helice`), robot au sol (`rover`, `roue`, `mat`). `world.js` prépare les pivots (`slot()`), y accroche les pièces au chargement et n'anime que les pivots. |
| `tools/hublots_blender.py` | Dans **Blender** : le mur des hublots → `hublots.glb` : `cloison` (tôle percée par opération booléenne) et `hublots` (cadre boulonné du grand hublot, couronne et vérins du volet-iris, hublots latéraux, soubassements, conduites, pupitre incliné à écrans et clavier, garde-corps). Les ouvertures reprennent `WC`/`HOLES` de `world.js` ; z = 0 est la face intérieure, le décor pose le tout en `Z0`. |
| `tools/equipements_blender.py` | Dans **Blender** : `equipements.glb` — `rail` (2,6 m de rail des bras, répété le long de la baie), `portique` (l'arche à émetteurs derrière le fauteuil de liaison), `soudeur` (le robot agrippé à la collerette du grand hublot, vu à travers le verre). |
| `tools/plumes.py` | Relève les plumes sur la photo `assets/works/ouie.jpg` et écrit `app/plumes.js`. À relancer si la photo change. |
| `tools/visiteur_blender.py` | Dans **Blender** (`blender -b --python tools/visiteur_blender.py`) : allège le mannequin, ne garde que la marche et l'attente, écrit `assets/models/visiteur.glb` (488 Ko). |
| `assets/brand/partage.jpg` | Image d'aperçu pour les partages (1200 × 630), fabriquée à partir d'une capture de l'entrée de la galerie. |
| `galerie.html`, `scroll.html`, `voyage.html`, `pont.html`, `classic.html` | Anciennes versions, gardées pour mémoire. Ne pas s'en inspirer : le commanditaire les a rejetées. |

Outils du récit dans `main.js` : `tween(durée, fn, ease)`, `wait(s)`, `camTo({pos, look|yaw|pitch, fov}, durée)`, `walk(tronçon, regard, rappel)`, `say(id)`, `ask(libellé)` (invite [F] ou bouton tactile), `choose([a, b])`, `quest()`, `card()`, `scan(i)`, `mark(i)`. L'état de la caméra est l'objet `S`.

Chaîne de rendu : scène rendue dans une cible MSAA ×4 résolue une seule fois, recopiée (et bornée) dans le composer → occlusion ambiante GTAO (demi-résolution, vaisseau seulement) → bloom → passe maison (aberration, vignette, grain, glitch, fondus) → sortie. Un seul projecteur à ombres, qui suit le visiteur. `adapt()` vise ~50 images/s et sacrifie dans l'ordre : occlusion, résolution (deux crans), ombres, anticrénelage, bloom.

## 4. Le récit, tel qu'il est

0. **Prologue** — trois entrées du journal de bord (2026 → 2500).
1. **Réveil** — dans le caisson, vitre givrée ; appel entrant de Gladys ; choix de dialogue ; sortie ; regard sur le dormeur voisin ; marche jusqu'à la baie d'observation.
2. **Ce qui reste** — à l'arrivée au hublot, tout est dans l'ombre de la Terre : un globe noir piqué de foyers, des feux et des hublots dans la nuit. Pendant `g06`, **le soleil se lève derrière le limbe** (halo, faisceau dans la baie, lumière chaude à l'avant) ; pendant `g07`, il monte sur la droite, la flotte et le pont avant sortent de l'ombre, et **une arche géante nous dépasse** au-dessus de la baie (grondement, léger tremblement) avant de rejoindre les autres. Dans le champ : quatre arches proches, une soixantaine au loin, **une épave brisée en deux** sur la droite, deux navettes, la poussière de glace. Puis choix de dialogue ; poste de liaison N-7 : le fauteuil s'allume à l'approche, on se retourne, on s'assoit (on voit ses genoux et ses mains sur les pupitres), **les accoudoirs se referment, puis des bracelets sur les avant-bras**, la fiche du **câble cervical** se présente, ouvre ses griffes et se verrouille derrière la nuque (décharge lumineuse), puis **le casque se rabat depuis le dessus de la tête**, puis l'écran de synchronisation. *(L'essai d'un branchement à l'avant-bras a été abandonné le 16/11 : le commanditaire préfère l'implant cervical.)*
3. **Danse sensorielle** — on arrive devant la galerie, on entre par le narthex (accueil, librairie, vue sur Le Bistrot), on suit le tracé au sol : œuvre 1 sur une cimaise de la nef, œuvre 2 sur le mur ouest, escalier, œuvres 3 et 4 au niveau 1. Chaque œuvre s'imprime à taille réelle, puis déclenche son effet. Fin sur la rive du niveau 1, face à la nef, puis écran de fin avec les infos pratiques.

Lexique de bord à conserver : arche SPES-07, programme HOPE, cohorte R-26, sujet R26-0417, protocole RÉSONANCE, Veilleurs (robots), indice de Voile 9,7, Grande Poussière, lot 42-SE, artefacts CB-01 à CB-04, liaison N-7, port cervical C2, DS-04 « Résonances », pont 12 / baie cryo C.

## 5. La galerie reconstituée

**Depuis le 16/11 au soir, la galerie n'est plus en filets sur fond sombre : elle est reconstruite en matières réelles**, d'après les vues de l'exposition *Résonances* publiées par la galerie (ceyssonbenetiere.com, pages « Saint-Étienne » et « Louis Cane »). Ce qu'on y a relevé : cube blanc très lumineux, **sol gris brillant qui reflète les œuvres**, plafond blanc à **cadres de LED** et rails carrés de projecteurs, grande **façade vitrée à montants noirs**, cimaises épaisses, socles blancs, salle haute plus basse à sol mat (vues de l'exposition Favier). Ces photos ont servi de référence visuelle uniquement : aucune n'est dans le dépôt.

Comment c'est fait (`app/galerie.js`) :

- **Volumes fusionnés par matière** (`span()`, `box()`, `cyl()` puis `flush()`) : une poignée d'appels de rendu pour toute l'architecture.
- **Reflets du sol** : chaque objet a un *jumeau* (`twin()`), dessiné sous le sol par une matière qui retourne seulement la projection (`mirrorMat()`). Le sol du rez-de-chaussée est à demi transparent, plus réfléchissant en vue rasante. Coupé en `?lite`.
- **Lumière** : un hémisphère (ambiance du cube blanc), un soleil à ombre portée qui entre par la façade (taches au sol du narthex), un projecteur par œuvre, la lampe chaude du Bistrot. `W.dsDim(k)` assombrit et rosit la salle (œuvre 3).
- **Œuvres « hors lot »** : les murs portent des emplacements cotés et hachurés (« HORS LOT · non numérisé »). Seules les quatre œuvres du lot 42-SE existent — c'est la fiction, et cela évite de reproduire d'autres œuvres.
- **Visiteurs** : silhouettes translucides animées (marche, arrêt devant un mur, attente), y compris à l'accueil et au Bistrot. Deux fois moins nombreux sur téléphone.
- **Les quatre œuvres sont des objets** : feuille de Rhodoïde et 114 plumes redessinées une à une à leur vraie place ; panneau de résine brillant avec grillage et relief recalculés à partir de la photo ; plaque de cuivre brossé ; cadre de chêne sous verre. Chacune s'imprime de haut en bas à l'approche (barre lumineuse), puis apparaissent cotes, cartel et repère au sol.

Le ressenti de chaque œuvre, volontairement amplifié (séquences dans `act3()` de `main.js`) :

1. **Kinesthésie** — les plumes se détachent et tombent ; la caméra suit celle qu'on fixe, penche et s'affaisse avec elle. Mesure affichée : chute perçue / déplacement réel 0,00 m. Elles remontent toutes à la fin : rien n'avait bougé.
2. **Toucher haptique virtuel** — on s'approche à ~60 cm ; la matière se soulève et brille sous le regard ; une étiquette suit l'œil (FER froid et rugueux / RÉSINE lisse et tiède), l'image se givre ou se réchauffe, un grain sonore suit le mouvement, le téléphone vibre au changement de matière (Android).
3. **Proprioception** — toute la galerie grandit autour du visiteur (`W.setScale`), les troncs sortent du sol, la brume rose de la photographie envahit la salle. Mesure : taille perçue 1,72 m → 0,70 m.
4. **Intéroception / chronoception** — on se penche sur le cadre, le monde s'éteint autour (tunnel), le temps ralentit (`W.dsTime`), la vapeur du dessin monte, le cœur bat. Mesure : pouls et « 1 s perçue = n s ». Les bocaux en fil de fer ont été retirés.

Le plan vient de la page « Parcours » du Canva du groupe (design `DAHWHwMMPdI`), converti à raison de 1 px du plan ≈ 0,1 m. Repère : entrée en z = 0, le fond de la nef vers −z. Le commanditaire signale que **ce plan diffère du lieu réel** ; la place des œuvres, elle, est validée. Cotes dans `galerie.js` :

- enveloppe x −15,2 … 15,3 · z 0 … −32,3 ; renfoncement ouest (Le Bistrot) x −18,6 … −15,2 · z −11,5 … −18,9 ; porte x −9 … −5,2 ;
- cimaises : `x=-0,8 z -10,9…-16,7` (porte l'œuvre 1, face ouest), `z=-20 x -11,2…-2`, `z=-20 x 1,7…10`, `x=-0,8 z -22,5…-29,5`, `z=-9,7 x 1,7…6,2` ;
- niveau 1 (mezzanine) x 7,2 … 15,3 · z 0 … −13, escalier x 2,6 … 7,2 · z −1,4 … −3 ;
- œuvres : `ART[]` (position, normale, niveau) ; trajet : `W.legs` (quatre courbes).

Sources sur le lieu, fournies par le commanditaire : ancien bâtiment industriel réhabilité, 1 000 à 1 500 m² dont ~800 m² de plateau, **~6 m sous plafond**, narthex avec accueil et librairie, vue sur le restaurant Le Bistrot de la galerie, grande nef aux murs blancs et sol en béton ciré (ceyssonbenetiere.com/fr/locations/12/saint-etienne, ideat.fr, saint-etienne-hors-cadre.fr).

**Estimations, pas des relevés** : hauteur du niveau 1 (+3,20 m), hauteur des cimaises (4,20 m), mobilier (banque d'accueil, rayonnages, tables), position exacte des œuvres sur les murs.

## 6. Direction artistique

Celle du Canva du groupe (pages moodboard, couleurs, polices, effets), pas celle des premières versions du site.

- Titres : **Krona One** (équivalent web de la « Wide » du Canva). Interface : **Rajdhani**. Ne plus utiliser Orbitron, Space Mono ni l'ancien logo réticule.
- Palette : bleu grisé `#4c6783`, azur `#7fe3e6`, pâle `#b9d6f2`, corail `#ff4f38`, lime `#a8e61d`, safran `#f5c400`, ambre `#fca311`, ocre `#d59639`.
- Référence d'interface : le HUD de Cyberpunk 2077. Deux volets inclinés vers le regard (perspective CSS, à plat sur téléphone). À gauche l'**appel** : nom au-dessus du portrait 3D de Gladys, cadre à pan coupé corail (sonnerie) puis azur (en ligne), durée et onde de la voix. À droite la **mini-carte** (plan du pont ou de la galerie centré sur le visiteur, cap vers le haut, losange safran = objectif, tracé du parcours en corail ; masquée sur téléphone), puis la **quête** : nom en corail, objectif en safran précédé d'un pictogramme. En bas à gauche les constantes en cartouches. Dans la galerie, claire, les blocs prennent un fond sombre.
- La galerie est un **cube blanc réaliste** (voir § 5). Les détails fins sont portés par le lieu lui-même : montants de façade, cadres de LED, livres, cartels, cotes, emplacements hachurés, fil d'Ariane au sol. Seules les œuvres, les livres et le Bistrot sont en couleur. L'interface garde un dégradé sombre en haut et en bas pour rester lisible sur le blanc.

## 7. Ce que le commanditaire a demandé (et refusé)

Dans l'ordre où c'est arrivé. C'est la grille de lecture pour toute modification.

1. Pas un site à menus : une **histoire 3D guidée et narrée**, avec de la vie dans le décor.
2. « Propre, épuré, pro », proche de Cyberpunk 2077 — pas « cyberpunk 2010 », pas « primaire », pas « IA slop ».
3. Sortie du caisson, appel de l'IA façon téléphone, hublots sur la Terre abîmée et les vaisseaux, branchement (câble **et** casque, avec l'animation) avant la danse sensorielle.
4. Des textes qui font entrer dans le délire (codes, jargon de bord), jamais de générique.
5. Les œuvres reproduites fidèlement, à taille réelle.
6. **Mobile-first**.
7. Ombres, matières, humains crédibles.
8. Dernier lot (traité le 16/11) : voix en plusieurs langues ; corps des dormeurs, faisceaux des drones et espace « trop en bloc » ; danse sensorielle dans le lieu réel, en suivant le vrai parcours ; « moins de gros pâtés, plus d'effets et de détails fins ».

9. Lot du 16/11 au soir : « on peut beaucoup plus travailler le rendu 3D » — réalisme, matière partout, détails, ambiance de **film de science-fiction** ; interface et lien neural **comme dans Cyberpunk 2077** (appel avec portrait, câble branché **à l'avant-bras**, ou port visible dans le cou des autres humains) ; Gladys à embellir ; danse sensorielle : plus de détails fins, moins de gros ; **faire vraiment ressentir** l'effet psychologique de chaque œuvre, quitte à l'amplifier ; plumes, résine, arbres à refaire, bocaux incompris ; lieu à reconstituer d'après photos ; plus de vie. **Traité ce soir-là : toute la danse sensorielle, l'interface, le portrait de Gladys.**
10. Retours suivants, le même soir : Gladys doit être **une femme** ; pouls, température et boutons mieux intégrés (et vivants) ; les corps « font mannequin » ; retour à l'**implant cervical** ; la danse sensorielle est une **reproduction holographique**, pas un lieu blanc ; l'accueil et la boutique sont **une pièce à part**, la boutique **dans un renfoncement** ; le Bistrot est **à côté de l'escalier** ; le renfoncement ouest est **un couloir d'œuvres** ; il y a des **tables et des chaises à l'étage** ; analyse des œuvres **façon scanner de Cyberpunk** ; **voir son corps** (pieds, bras qui balancent, « se dérouiller ») ; logos de la galerie et de l'école ; utiliser les skills Blender (`kevinbadi/blender-skills`, installés dans `.claude/skills/`, hors dépôt). **Tout cela est traité**, sauf ce qui suit.
11. Demandé ensuite : revoir le siège de liaison et son animation ; les **vaisseaux** (« mal faits ») et les détails dans l'espace ; plus de **drame** ; des environnements qui font « wow » ; tout modéliser dans Blender. **Traité le 16/11 dans la nuit** : l'espace et le fauteuil (voir § 4, acte 2), puis **la baie cryogénique et ses caissons**, remodelés dans Blender (couples de structure, alcôves à réservoirs givrés et pupitres, pans coupés et conduites, plafond à gaines, porte étanche ; caissons à socle ventilé, matelas, armature de verrière, bloc de tête, pupitre de pied). La baie a été allongée de 1,2 m (`Z1 = 18,2`) pour que le dernier rang de caissons ne traverse plus la cloison.

Rejeté : œuvres en photos brutes posées dans la scène, Gladys en hologramme humanoïde fait de primitives (remplacée par un portrait d'appel en lignes de contour), couloir abstrait à portiques et anneaux pour la danse sensorielle.

## 8. Voix et langues

- Une seule voix pour les trois langues : `fr-FR-VivienneMultilingualNeural` (voix neuronale Microsoft Edge, via le paquet `edge-tts`), débit +6 %, hauteur −4 Hz. Le navigateur la joue à travers un filtre « liaison radio » ; son amplitude anime la bouche du portrait.
- Modifier une réplique : éditer `app/lines.json` (dans les trois langues), puis `python tools/voix.py <langue> <id>` (connexion requise). Sans argument, tout est régénéré. Le champ `say` sert à forcer une prononciation (« SPES » → « Spèce », nombres en lettres).
- Repli automatique : synthèse du navigateur, puis sous-titres minutés par le champ `d`.
- Langue choisie par `?lang=`, puis choix mémorisé, puis langue du navigateur. Le sélecteur FR/EN/ES recharge la page (le décor 3D porte aussi du texte).
- Ajouter une langue : un bloc dans `STR` (`app/i18n.js`), un bloc dans `app/lines.json`, un bouton `data-lang` dans `index.html`, puis `tools/voix.py`.

## 9. Tester

Paramètres d'adresse (cumulables) : `?auto` (valide seul les invites), `?quick` (durées ×0,12, sans voix), `?lite` (demi-résolution, sans bloom, ombres ni occlusion), `?act=2|3`, `?st=0..3`, `?hold=<point>` pour figer un plan (`sit`, `voisin`, `stand`, `aisle`, `window`, `earth`, `sun`, `fleet`, `hands`, `link`, `clamp`, `seat`, `plug`, `cable`, `visor0`, `visor`, `ds`, `st0..3`, `fx0..3`, `end`, ou `ask:<libellé>`), `?touch`, `?lang=`, `?msaa=0`, `?noao`, `?nosh`, `?noadapt`, `?c=1` (deuxième choix de dialogue), `?timer` (la boucle tourne sur une minuterie : indispensable dans un onglet ou un volet masqué, où l'animation est sinon gelée). `window.__spes` expose `renderer, scene, W, S, composer, bloom, gtao, camera, QL`.

Méthode qui a fonctionné :

- contrôle fonctionnel : `?auto&quick&lite` dans un navigateur automatisé, attendre l'écran de fin, lire la console ;
- jugement du rendu : un vrai Chrome, **onglet au premier plan** (un onglet en arrière-plan tourne à une image par seconde et fausse tout) ;
- coût d'une image : chronométrer `composer.render()` suivi d'un `gl.readPixels`. Repères sur carte intégrée Intel Iris Xe, 1482×734 au ratio 1,25 : ~24 ms devant une œuvre de la galerie, ~30 ms dans la baie avec occlusion.

Pièges déjà payés :

- **Un commentaire `//` au milieu d'une ligne longue commente la suite de la ligne.** Le code est écrit en lignes denses : mettre les commentaires en fin de ligne ou en `/* */`. C'est arrivé deux fois.
- **`pow()` d'une base négative dans un shader** (une coordonnée interpolée qui déborde de 0) donne une valeur invalide que le bloom étale en grands rectangles noirs. Toujours borner (`clamp`) avant `pow`.
- Matière très lisse (rugosité < 0,1) sous un projecteur = pics de reflet que le bloom transforme en carrés blancs. La vitre des hublots est pour cela une simple teinte.
- Tester aussi **sans** `?lite` : un bug du chemin « qualité normale » y est invisible.
- Donner des échantillons MSAA aux tampons du composer coûte une résolution par passe ; d'où la cible MSAA unique.
- Les objets transparents ne s'occultent pas entre eux : dans la galerie, les reflets sont en `renderOrder -2`, le sol en `-1`, et les cimaises derrière les œuvres sont des plans opaques.
- Les textures sont décodées en **linéaire** dans les shaders : un seuil mesuré sur l'image (sRGB) doit être converti (≈ valeur^2,2). Un gris à 0,71 vaut 0,47.
- Si la fenêtre du navigateur est masquée par une autre, elle tombe à ~3 images/s et les animations du décor paraissent figées. Pour juger un plan figé quand même, avancer le décor à la main dans la console : `for (let i = 0; i < 180; i++) __spes.W.update(200 + i * 0.05, 0.05, __spes.camera.position); __spes.composer.render();`
- Fermer les onglets de test : ils continuent de faire tourner la 3D.
- **Galerie claire et bloom** : le seuil du bloom est relevé dans la galerie (`W.dsLook`), sinon les murs blancs bavent. Toute matière blanche éclairée au-delà du seuil se met à luire.
- **Le soleil doit couvrir tout le bâtiment de son ombre** : hors du champ de l'ombre, un objet est considéré comme éclairé, et le soleil « traverse » les murs.
- **Jumeaux (reflets)** : appeler `twin()` une fois la matière de l'original entièrement configurée (`onBeforeCompile` compris), sinon le jumeau n'hérite pas de l'effet. Les jumeaux et le sol transparent sont traités à part par la passe d'occlusion ambiante (`gtao.overrideVisibility` dans `main.js`).
- **Aperçus Blender** : le repère du décor (y vers le haut) devient (x, −z, y) dans Blender. Une caméra d'aperçu placée en y positif regarde l'envers du décor.
- **Mesurer avec `?timer`** : la boucle tourne en continu, donc un `composer.render()` chronométré à la main est en concurrence avec elle et paraît environ deux fois plus cher.
- **Transparence d'un personnage** : sans passe de profondeur préalable, on voit ses membres à travers lui. D'où les deux maillages par visiteur (`ghostDepth` puis `ghost`).

## 10. À faire

### Maintenant (avant le 21 novembre)

0. **Plan de ce qu'il reste à refaire en 3D** (arrêté le 16/11 dans la nuit, à reprendre dans cet ordre) :
   1. **Regarder l'acte 2 à vitesse réelle** et régler dans `act2()` de `main.js` : durée du lever de soleil (8 s puis 17 s), passage de l'arche géante (17 s), tremblement, sons `sfx.dawn` et `sfx.rumble`, rabat du casque. Rien de tout cela n'a été vu autrement qu'en image fixe.
   2. ~~Robots de la baie~~ — **fait le 17/11** (`tools/robots_blender.py`) : bras articulé à vérin sur chariot, drone à quatre rotors carénés (les hélices tournent), robot au sol à six roues, brosse et tourelle de relevé. Vus en image fixe ; le mouvement n'a pas été jugé à vitesse réelle.
   3. ~~Mur des hublots~~ — **fait le 17/11** (`tools/hublots_blender.py`), ainsi que les rails du plafond, le portique de liaison et le robot soudeur (`tools/equipements_blender.py`). Les **anneaux tournants** derrière le fauteuil ont été retirés à la demande du commanditaire : six filets de lumière partent des émetteurs du portique vers la tête quand `W.linkSpin` monte.
   4. **Mains du visiteur** : elles restent ouvertes ; les refermer sur les manches du fauteuil (doigts à articuler dans `tools/humains_blender.py`, pose `seat` de `corps.js`).
   5. **Épave** dans le champ du hublot : ajout non demandé, la voix n'en parle pas. À garder ou à retirer (bloc `wreck` de `world.js`).
   6. **Poids** : **mesuré le 17/11 sur carte intégrée (Intel Iris Xe, 1482 × 734 au ratio 1,25) : la baie coûte de l'ordre de 45 à 55 ms par image en qualité maximale**, soit ~20 images/s — la qualité adaptative descend donc de plusieurs crans sur ce type de machine (mesure prise dans une fenêtre masquée, donc pessimiste, mais l'ordre de grandeur est là). Premier allègement fait : caissons regroupés en instances (1 093 → 792 objets dessinés), architecture et dormeurs sortis de la passe d'ombre, travées écartées du rendu hors champ. **Reste à faire** : regrouper les dormeurs (23 × ~7 objets, 245 000 triangles), réduire les travées détaillées en mode tactile, versions allégées du pont et du caisson. Toujours à mesurer sur téléphone. La baie a gagné environ 200 000 triangles, l'espace environ 100 000 ; `pont.glb` pèse 1,4 Mo. Pistes : moins de travées détaillées en mode tactile, version allégée du pont et du caisson.
   7. **Logo de Télécom Saint-Étienne** : le fichier n'est pas dans le dépôt (l'écran de fin affiche le nom en toutes lettres à côté du logo de la galerie).
   8. **Constats de l'audit du 16/11** : `<title>` et description traduits, anciennes pages sorties de l'indexation (`noindex`) — **faits le 17/11**. Restent : contrastes, éléments focalisables invisibles (invite, écran de fin et version texte atteignables au clavier quand ils sont masqués : poser `inert`), poids du chargement (~7 Mo de modèles).
0 bis. **Blender** : les scripts de `tools/` tournent en Blender sans fenêtre (`blender -b --python tools/<script>.py`, option `-- apercu` pour des images de contrôle dans `tools/sources/`). Vérifiés le 17/11 avec **Blender 5.3** (installé par `winget install BlenderFoundation.Blender`, exécutable dans `C:\Program Files\Blender Foundation\Blender 5.3\`). Les skills Blender (`kevinbadi/blender-skills`) pilotent, eux, un Blender ouvert par le module `blender-mcp` (port 9876) : non installés sur ce poste, non nécessaires aux scripts.
1. **Écouter la voix** dans les trois langues sur un vrai appareil : elle n'a été contrôlée qu'à la présence des fichiers et à leur durée. Points à surveiller : « SPES », « R26-0417 », « 42-SE », les dates.
2. **Essayer sur de vrais téléphones** (Safari iOS et Chrome Android) : fluidité, bouton d'action dans la zone du pouce, encoches, démarrage du son au premier appui, retour visuel à l'appui (`:active`), absence de flash gris au toucher, couleur de la barre du navigateur (sombre pendant l'expérience, claire sur l'écran de fin). Le contrôle mobile n'a été fait qu'en émulation, qui ne reproduit aucun de ces points.
3. **Faire relire l'anglais et l'espagnol** par quelqu'un dont c'est la langue (interface, sous-titres, version texte).
4. **Confronter la galerie reconstituée au lieu** : place réelle des quatre œuvres, sens de l'escalier, hauteur du niveau 1. Corriger `ART[]`, `W.legs` et les murs dans `world.js` si l'accrochage diffère du plan du groupe.
5. **Droits** : les photos des œuvres sont des clichés pris en galerie, à usage pédagogique. Demander l'accord de la galerie avant toute diffusion durable.
6. **Vérifier l'aperçu de partage** (image `assets/brand/partage.jpg`, balises `og:`) en collant le lien dans une messagerie : les réseaux gardent l'ancien aperçu en cache quelque temps.

### Plus tard

- Varier les dormeurs : poses, mains, cheveux ; un deuxième scan de visage.
- Affiner la galerie avec un relevé sur place : plan réel, hauteur sous plafond, escalier, vraie façade (l'extérieur est inventé).
- Répliques : Gladys dit encore « des bocaux de confiture » pour l'œuvre 4 ; la photo montre plutôt des récipients de verre. À trancher avec le groupe avant de régénérer la voix.
- Fusionner la passe de sortie dans la passe maison (une passe plein écran en moins).
- Charger les textures lourdes (tête scannée) après le premier rendu ; indicateur de chargement réel.
- Pages par langue pour le référencement (`hreflang`).
- Déplacement libre dans la galerie après la fin du récit.
- Mesure d'audience respectueuse (aucune aujourd'hui).

## 11. Non vérifié

- Qualité perçue de la voix à l'oreille, dans les trois langues.
- Comportement sur un vrai téléphone et sur Safari.
- Exactitude du plan de la galerie par rapport au lieu.
- Tenue sur une machine plus faible qu'une carte intégrée récente (la qualité adaptative est censée s'en charger).
- **Interface, Gladys, corps, dormeurs (16/11 au soir)** : contrôlés en image fixe et de bout en bout en mode test. Pas vus sur un vrai téléphone : le portrait ouvre un **second contexte WebGL** (repli automatique prévu, non éprouvé) et les nouveaux modèles alourdissent la scène (23 dormeurs d'environ 12 000 faces, un corps de 18 000). **La marche, le balancement des bras et les poses n'ont été jugés que sur images fixes** : rythme et raccords à vérifier à vitesse réelle. Les épaules du corps gardent un raccord visible sous leur coque.
- **Robots, mur des hublots, rails, portique, soudeur (17/11)** : contrôlés en image fixe et de bout en bout en mode test (`?auto&quick&timer`, français). Mouvements (hélices, roues, tourelle, bras) et filets de lumière du portique non vus à vitesse réelle ; pas de contrôle sur téléphone.
- **Baie cryogénique (16/11 dans la nuit)** : contrôlée en image fixe (réveil, assis dans le caisson, voisin, allée dans les deux sens, hublot) et de bout en bout en mode test (français sur bureau, espagnol en mode tactile). Poids non mesuré : environ 200 000 triangles de plus dans la baie, à surveiller sur téléphone et carte intégrée (la qualité adaptative ne réduit pas la géométrie).
- **Espace et fauteuil (16/11 dans la nuit)** : contrôlés en image fixe à chaque étape (ombre, lever de soleil, flotte éclairée, passage de l'arche, approche du fauteuil, assise, casque) et de bout en bout en mode test, en français sur bureau et en anglais en mode tactile. **Jamais vus à vitesse réelle** : la durée du lever de soleil (8 s puis 17 s), le passage de l'arche (17 s), le tremblement, les deux nouveaux sons (`sfx.dawn`, `sfx.rumble`) et le rabat du casque sont à juger en vrai, et à régler dans `act2()` de `main.js`. Poids non mesuré sur téléphone : la scène gagne environ 100 000 triangles hors de la baie.
- **Nouvelle galerie (16/11 au soir)** : contrôlée image par image et de bout en bout en mode test (`?auto&quick&timer`, fr et en, bureau et format téléphone), sur une carte graphique puissante uniquement (~6 ms par image en 1280 × 720). **Pas vue en temps réel à vitesse normale**, pas mesurée sur carte intégrée ni sur téléphone : le rythme des quatre effets, la fluidité avec les reflets et les visiteurs, la vibration et les nouveaux sons (pas, souffle, grain, bulles) restent à juger.

## 12. Ressources tierces et licences

| Ressource | Source | Licence |
|---|---|---|
| Visiteurs de la galerie `tools/sources/Xbot.glb` → `visiteur.glb` | mannequin X Bot, Mixamo (Adobe), via les exemples three.js | conditions d'utilisation Mixamo |
| Gladys, dormeurs, corps du visiteur : `gladys.glb`, `dormeuse.glb`, `dormeur.glb`, `corps.glb` | Human Base Meshes, Blender Foundation (download.blender.org) | CC0 |
| Arches, navette, pont avant, fauteuil, baie, caisson, robots, mur des hublots, équipements : `arche.glb`, `arche-lod.glb`, `navette.glb`, `pont.glb`, `fauteuil.glb`, `baie.glb`, `caisson.glb`, `robots.glb`, `hublots.glb`, `equipements.glb` | modélisés pour le projet par les scripts `tools/*_blender.py` | aucune ressource tierce |
| Logo `assets/Ceysson.svg` | galerie Ceysson & Bénétière | marque de la galerie, usage lié au projet |
| Vues de la galerie (référence visuelle, non embarquées) | ceyssonbenetiere.com — photos Cyrille Cauvet | aucune image reprise ; le lieu est remodélisé |
| Matières `assets/tex/pbr` | Poly Haven | CC0 |
| Terre `assets/space` | NASA | domaine public |
| Voix | voix neuronale Microsoft Edge (`edge-tts`) | usage à vérifier avant toute exploitation commerciale |
| Photos des œuvres `assets/works` | clichés pris en galerie (Louis Cane, Aurélie Pétrel, Philippe Favier) | usage pédagogique, accord à demander |
| Three.js r160 | jsDelivr | MIT |
| Polices Krona One, Rajdhani | Google Fonts | OFL |
