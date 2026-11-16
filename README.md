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
2. **Ce qui reste** — la baie d'observation : la Terre dans l'ombre, puis **le soleil qui se lève derrière elle** et révèle la Grande Poussière, le pont avant de l'arche, la flotte HOPE, une épave, **une arche géante qui nous dépasse**. Puis le poste de liaison N-7 : le fauteuil s'ouvre, on s'assoit, les accoudoirs et les bracelets se referment sur les avant-bras, le câble cervical se verrouille derrière la nuque, le casque se rabat. On voit son propre corps : ses mains qui tremblent au réveil, ses pieds aux premiers pas.
3. **Danse sensorielle** — la **galerie Ceysson & Bénétière reconstituée, projetée en hologramme** (volumes de verre sombre aux arêtes lumineuses, sol miroir, cadres de LED, façade vitrée, accueil-librairie et son mobilier, Bistrot près de l'escalier, tables à l'étage, visiteurs) d'après le plan du parcours et les vues de l'exposition. On suit le tracé réel d'œuvre en œuvre (lot 42-SE, artefacts CB-01 à 04) ; chacune s'imprime à taille réelle, avec ses cotes, et fait **éprouver** un sens interne : on tombe avec les plumes, la résine répond au regard, la salle grandit et l'on rétrécit, le temps ralentit et l'on entend son cœur.

Technique : Three.js r160 en modules ES (importmap, aucun build), post-traitement (anticrénelage, occlusion ambiante, bloom, aberration, glitch), qualité adaptative, version texte accessible.
- `app/main.js` : moteur, récit, HUD, son, voix. `app/world.js` : décors du vaisseau. `app/galerie.js` : la galerie et les quatre œuvres. `app/gladys.js` : le portrait 3D de Gladys. `app/i18n.js` : langues. `app/lines.json` : répliques de Gladys.
- Voix : `assets/voice/<langue>/<id>.mp3`, générées par `python tools/voix.py` (voix neuronale multilingue, paquet `edge-tts`). À relancer après toute modification de `app/lines.json`. Sans fichier : synthèse du navigateur, puis sous-titres seuls.
- Arches, pont avant, navette, fauteuil de liaison, baie cryogénique et caissons : `blender -b --python tools/arche_blender.py`, `tools/pont_blender.py`, `tools/fauteuil_blender.py`, `tools/baie_blender.py`.
- Gladys, dormeurs et corps du visiteur : `blender -b --python tools/humains_blender.py`. Visiteurs animés : `blender -b --python tools/visiteur_blender.py`. Plumes de l'œuvre 1 : `python tools/plumes.py`.
- Paramètres de test : `?act=2|3`, `?st=0..3`, `?auto`, `?quick`, `?lite`, `?hold=<point>`, `?lang=fr|en|es`, `?timer`.

**Pour reprendre le projet : lire [REPRISE.md](REPRISE.md)** (état, architecture, méthode de test, pièges, ce qui reste à faire).

Ressources tierces : Human Base Meshes (Blender Foundation, CC0) ; mannequin X Bot (Mixamo) ; matières métal Poly Haven (CC0) ; texture terrestre NASA.

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
