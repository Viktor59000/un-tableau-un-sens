# Reprise du projet — « un tableau, un sens » · SPES

Document de passation. Il dit où en est le projet, comment il est construit, ce qui reste à faire tout de suite et plus tard, et les pièges déjà rencontrés. État décrit : **16 novembre 2026**.

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
| `app/world.js` | Tous les décors et shaders : baie cryogénique, robots, hublots, espace, poste de liaison, galerie. `buildWorld()` renvoie l'objet `W` que le récit pilote. |
| `app/i18n.js` | Langues fr/en/es : interface, textes des œuvres, textes affichés dans le décor 3D, traduction de la version texte. |
| `app/lines.json` | Répliques de Gladys, par langue : `{ t: sous-titre, say?: graphie pour la synthèse, d: durée en s }`. |
| `tools/voix.py` | Régénère les voix (`assets/voice/<langue>/<id>.mp3`) et les durées. |
| `tools/corps.py` | Fabrique `assets/models/sleeper.bin` (corps des dormeurs) et `echo.bin` (silhouettes de visiteurs) à partir de `tools/sources/Xbot.glb`. |
| `galerie.html`, `scroll.html`, `voyage.html`, `pont.html`, `classic.html` | Anciennes versions, gardées pour mémoire. Ne pas s'en inspirer : le commanditaire les a rejetées. |

Outils du récit dans `main.js` : `tween(durée, fn, ease)`, `wait(s)`, `camTo({pos, look|yaw|pitch, fov}, durée)`, `walk(tronçon, regard, rappel)`, `say(id)`, `ask(libellé)` (invite [F] ou bouton tactile), `choose([a, b])`, `quest()`, `card()`, `scan(i)`, `mark(i)`. L'état de la caméra est l'objet `S`.

Chaîne de rendu : scène rendue dans une cible MSAA ×4 résolue une seule fois, recopiée (et bornée) dans le composer → occlusion ambiante GTAO (demi-résolution, vaisseau seulement) → bloom → passe maison (aberration, vignette, grain, glitch, fondus) → sortie. Un seul projecteur à ombres, qui suit le visiteur. `adapt()` vise ~50 images/s et sacrifie dans l'ordre : occlusion, résolution (deux crans), ombres, anticrénelage, bloom.

## 4. Le récit, tel qu'il est

0. **Prologue** — trois entrées du journal de bord (2026 → 2500).
1. **Réveil** — dans le caisson, vitre givrée ; appel entrant de Gladys ; choix de dialogue ; sortie ; regard sur le dormeur voisin ; marche jusqu'à la baie d'observation.
2. **Ce qui reste** — la Terre sous la Grande Poussière, la flotte HOPE ; choix de dialogue ; poste de liaison N-7 : fauteuil, câble cervical, casque, écran de synchronisation.
3. **Danse sensorielle** — on arrive devant la galerie, on entre par le narthex (accueil, librairie, vue sur Le Bistrot), on suit le tracé au sol : œuvre 1 sur une cimaise de la nef, œuvre 2 sur le mur ouest, escalier, œuvres 3 et 4 au niveau 1. Chaque œuvre s'imprime à taille réelle, puis déclenche son effet. Fin sur la rive du niveau 1, face à la nef, puis écran de fin avec les infos pratiques.

Lexique de bord à conserver : arche SPES-07, programme HOPE, cohorte R-26, sujet R26-0417, protocole RÉSONANCE, Veilleurs (robots), indice de Voile 9,7, Grande Poussière, lot 42-SE, artefacts CB-01 à CB-04, liaison N-7, port cervical C2, DS-04 « Résonances », pont 12 / baie cryo C.

## 5. La galerie reconstituée

Le plan vient de la page « Parcours » du Canva du groupe (design `DAHWHwMMPdI`), converti à raison de 1 px du plan ≈ 0,1 m. Repère : entrée en z = 0, le fond de la nef vers −z. Tout est dans `world.js`, section « DANSE SENSORIELLE » :

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
- Référence d'interface : le HUD de Cyberpunk 2077 (appel entrant, objectif, sous-titres, invite [F], choix 1/2), en version épurée.
- La galerie est en **filets fins** sur fond sombre : arêtes, verrière, reflets dans le sol, silhouettes en nuage de points. Seules les œuvres sont en couleur.

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

Rejeté : œuvres en photos brutes posées dans la scène, Gladys en hologramme humanoïde fait de primitives (remplacée par un portrait d'appel en lignes de contour), couloir abstrait à portiques et anneaux pour la danse sensorielle.

## 8. Voix et langues

- Une seule voix pour les trois langues : `fr-FR-VivienneMultilingualNeural` (voix neuronale Microsoft Edge, via le paquet `edge-tts`), débit +6 %, hauteur −4 Hz. Le navigateur la joue à travers un filtre « liaison radio » ; son amplitude anime la bouche du portrait.
- Modifier une réplique : éditer `app/lines.json` (dans les trois langues), puis `python tools/voix.py <langue> <id>` (connexion requise). Sans argument, tout est régénéré. Le champ `say` sert à forcer une prononciation (« SPES » → « Spèce », nombres en lettres).
- Repli automatique : synthèse du navigateur, puis sous-titres minutés par le champ `d`.
- Langue choisie par `?lang=`, puis choix mémorisé, puis langue du navigateur. Le sélecteur FR/EN/ES recharge la page (le décor 3D porte aussi du texte).
- Ajouter une langue : un bloc dans `STR` (`app/i18n.js`), un bloc dans `app/lines.json`, un bouton `data-lang` dans `index.html`, puis `tools/voix.py`.

## 9. Tester

Paramètres d'adresse (cumulables) : `?auto` (valide seul les invites), `?quick` (durées ×0,12, sans voix), `?lite` (demi-résolution, sans bloom, ombres ni occlusion), `?act=2|3`, `?st=0..3`, `?hold=<point>` pour figer un plan (`sit`, `voisin`, `stand`, `aisle`, `window`, `earth`, `fleet`, `link`, `seat`, `plug`, `cable`, `visor0`, `visor`, `ds`, `st0..3`, `fx0..3`, `end`, ou `ask:<libellé>`), `?touch`, `?lang=`, `?msaa=0`, `?noao`, `?nosh`, `?noadapt`, `?c=1` (deuxième choix de dialogue). `window.__spes` expose `renderer, scene, W, S, composer, bloom, gtao, camera, QL`.

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
- Fermer les onglets de test : ils continuent de faire tourner la 3D.

## 10. À faire

### Maintenant (avant le 21 novembre)

1. **Écouter la voix** dans les trois langues sur un vrai appareil : elle n'a été contrôlée qu'à la présence des fichiers et à leur durée. Points à surveiller : « SPES », « R26-0417 », « 42-SE », les dates.
2. **Essayer sur de vrais téléphones** (Safari iOS et Chrome Android) : fluidité, bouton d'action dans la zone du pouce, encoches, démarrage du son au premier appui. Le contrôle mobile n'a été fait qu'en émulation.
3. **Faire relire l'anglais et l'espagnol** par quelqu'un dont c'est la langue (interface, sous-titres, version texte).
4. **Confronter la galerie reconstituée au lieu** : place réelle des quatre œuvres, sens de l'escalier, hauteur du niveau 1. Corriger `ART[]`, `W.legs` et les murs dans `world.js` si l'accrochage diffère du plan du groupe.
5. **Droits** : les photos des œuvres sont des clichés pris en galerie, à usage pédagogique. Demander l'accord de la galerie avant toute diffusion durable.

### Plus tard

- Donner de la matière au lieu : texture de béton ciré, photos réelles du narthex et de la nef projetées en filigrane.
- Varier les dormeurs : poses, mains, cheveux ; un deuxième scan de visage.
- Visiteurs de la galerie animés (le modèle source contient une marche).
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

## 12. Ressources tierces et licences

| Ressource | Source | Licence |
|---|---|---|
| Tête scannée `assets/models/head` | Lee Perry-Smith / Infinite-Realities, via les exemples three.js | CC BY 3.0 — **crédit obligatoire** (présent en pied de page) |
| Corps `tools/sources/Xbot.glb` → `sleeper.bin`, `echo.bin` | mannequin X Bot, Mixamo (Adobe), via les exemples three.js | conditions d'utilisation Mixamo |
| Matières `assets/tex/pbr` | Poly Haven | CC0 |
| Terre `assets/space` | NASA | domaine public |
| Voix | voix neuronale Microsoft Edge (`edge-tts`) | usage à vérifier avant toute exploitation commerciale |
| Photos des œuvres `assets/works` | clichés pris en galerie (Louis Cane, Aurélie Pétrel, Philippe Favier) | usage pédagogique, accord à demander |
| Three.js r160 | jsDelivr | MIT |
| Polices Krona One, Rajdhani | Google Fonts | OFL |
