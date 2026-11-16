# un tableau, un sens — SPES

Parcours sensoriel pour la clôture de l'exposition **Résonances** à la galerie **Ceysson & Bénétière** (Saint-Étienne). Projet pédagogique **Design graphique avancé**, Télécom Saint-Étienne B3 (2026).

Ce dépôt contient l'expérience web immersive qui annonce le parcours, et sa version texte accessible.

## Le concept
On abandonne les 5 sens d'Aristote (extéroceptifs, incomplets) pour les **sens internes** des neurosciences. En galerie, l'interdit de toucher/goûter devient le **déclencheur** : privé de contact, le cerveau bascule sur ses sens internes, et le visiteur lit sa propre réaction. Cadre narratif : le vaisseau **SPES** et l'IA **Gladys** font passer 4 « recalibrations » sensorielles à travers 4 œuvres.

| # | Œuvre | Sens interne |
|---|-------|--------------|
| 01 | Plume sur Rhodoïde (L. Cane) | Kinesthésie |
| 02 | Résine sur grillage (L. Cane) | Toucher haptique virtuel |
| 03 | Arpenter ⅔ (A. Pétrel) | Proprioception spatiale |
| 04 | n°60 (P. Favier) | Intéroception / chronoception |

## L'expérience (index.html)
Récit 3D à la première personne, en **français, anglais et espagnol** (voix et sous-titres). Tu es le **sujet R26-0417**, en stase depuis 474 ans à bord de l'arche **SPES-07** ; l'IA Gladys déclenche le **protocole RÉSONANCE**.
0. **Prologue** — trois entrées du journal de bord (2026 → 2500).
1. **Réveil** — vitre givrée du caisson, appel entrant de Gladys, choix de dialogue, sortie dans la baie cryo (dormeurs visibles sous les vitres, bras de maintenance sur rail, drones, robots au sol).
2. **Ce qui reste** — la baie d'observation : la Terre sous la Grande Poussière, les débris, la flotte HOPE, un robot soudeur sur la coque. Puis le poste de liaison N-7 : on s'assoit, le câble cervical se branche, le casque descend.
3. **Danse sensorielle** — la **galerie Ceysson & Bénétière reconstituée** d'après le plan du parcours : narthex, librairie, nef, escalier, niveau 1. On suit le tracé réel d'œuvre en œuvre (lot 42-SE, artefacts CB-01 à 04) ; chacune s'imprime à taille réelle, avec ses cotes, et fait éprouver un sens interne.

Technique : Three.js r160 en modules ES (importmap, aucun build), post-traitement (anticrénelage, occlusion ambiante, bloom, aberration, glitch), qualité adaptative, version texte accessible.
- `app/main.js` : moteur, récit, HUD, son, voix. `app/world.js` : décors et shaders. `app/i18n.js` : langues. `app/lines.json` : répliques de Gladys.
- Voix : `assets/voice/<langue>/<id>.mp3`, générées par `python tools/voix.py` (voix neuronale multilingue, paquet `edge-tts`). À relancer après toute modification de `app/lines.json`. Sans fichier : synthèse du navigateur, puis sous-titres seuls.
- Corps des dormeurs et silhouettes de visiteurs : `python tools/corps.py` (à partir de `tools/sources/Xbot.glb`).
- Paramètres de test : `?act=2|3`, `?st=0..3`, `?auto`, `?quick`, `?lite`, `?hold=<point>`, `?lang=fr|en|es`.

**Pour reprendre le projet : lire [REPRISE.md](REPRISE.md)** (état, architecture, méthode de test, pièges, ce qui reste à faire).

Ressources tierces : tête scannée « LeePerrySmith » (Lee Perry-Smith / Infinite-Realities, CC BY 3.0) ; mannequin X Bot (Mixamo) ; matières métal Poly Haven (CC0) ; texture terrestre NASA.

Versions précédentes conservées : `galerie.html`, `scroll.html`, `voyage.html`, `pont.html`, `classic.html`.

## Direction artistique
Issue du Canva du groupe (pages moodboard, couleurs, polices, effets) : titres en capitales larges (**Krona One**, équivalent web de la police « Wide »), interface en **Rajdhani**, palette bleu grisé `#4c6783`, azur `#7fe3e6`, corail `#ff4f38`, lime `#a8e61d`, safran `#f5c400`, ambre `#fca311`, ocre `#d59639`. Effets : glitch et tracés de circuit, utilisés avec parcimonie. Interface inspirée du HUD de Cyberpunk 2077 (appel, objectif, sous-titres, invite d'action).

## Infos
- **Dates** : 21 & 22 novembre 2026, 11h – 19h
- **Lieu** : Galerie Ceysson & Bénétière, 10 rue des Aciéries, 42000 Saint-Étienne
- **Entrée** : libre · audioguide offert

## Déploiement
Site statique (`index.html`) publié via **GitHub Pages** (branche `main`, racine).

> Les photos des œuvres sont des clichés pris en galerie (œuvres de Louis Cane, Aurélie Pétrel, Philippe Favier) : usage pédagogique. Pour un usage public durable, prévoir un accord galerie/artistes.
