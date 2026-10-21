# Canalia : le niveau « premium »

Ce document liste ce qui distingue les meilleurs jeux mobiles (Two Dots, Royal Match, Townscaper, I Love Hue,
Wordle, Alto's Odyssey) et ce que Canalia en fait. ✅ = fait dans le code, ⏳ = à faire (ordre de priorité indiqué).

## 1. Le jeu lui-même : qualité des niveaux

Le genre « relier des paires » est saturé. Ce qui fait un bon jeu de ce genre, c'est la qualité des niveaux, pas la
règle. Un niveau ambigu ou à plusieurs solutions donne l'impression d'un jeu bâclé.

- ✅ **Solution unique garantie** : un solveur exact (`src/puzzle/solver.ts`) vérifie chaque niveau ; le générateur
  hors-ligne (`npm run levels`) modifie le tracé jusqu'à n'avoir qu'une solution. Les tests le revérifient.
- ✅ **Difficulté mesurée** : la taille de recherche du solveur sert de note de difficulté, avec un plafond par
  chapitre (doux au Jardin, exigeant la Nuit). Les niveaux durs sont signalés « Difficile », comme Royal Match.
- ✅ **Un dessin caché par niveau** : la récompense visuelle que les clones n'ont pas.
- ✅ **Une mécanique par lieu**, comme Two Dots, chacune née du décor et introduite par un conseil au premier
  niveau du chapitre :
  - Port : **les ponts**. Deux canaux s'y croisent, l'un sur un aqueduc au-dessus de l'autre, tout droit ; les
    deux voies doivent servir ;
  - Marché : **les terrasses de café**. Cases occupées par un parasol, que les canaux contournent ;
  - Nuit : **les lanternes**. Seul le canal de leur couleur peut y passer, et il doit les allumer ;
  - Cité engloutie : **les courants**. Le canal traverse la case dans le sens de la flèche, de la fontaine vers
    la maison.

  Le générateur ne les pose pas en décoration : pour les lanternes et les courants, il fusionne deux canaux (le
  niveau a alors plusieurs solutions) puis ajoute le moins de repères possible pour retrouver une solution
  unique. On a donc besoin d'eux pour raisonner. Le solveur connaît chaque mécanique et revérifie l'unicité.
- ⏳ (3) **Pipeline de contenu** : 40 dessins aujourd'hui. Viser 200 au lancement (20 chapitres). Une image =
  une grille de texte, et le générateur fait le reste.

## 2. La sensation de jeu (le « juice »)

- ✅ Canal **sec** pendant le tracé, puis **l'eau s'engouffre** depuis la fontaine quand il est relié, avec un son
  d'eau et une note de musique qui monte à chaque canal relié.
- ✅ **Cérémonie de fin** : les tuiles se posent depuis le centre, une montée de notes, un reflet de lumière balaie
  la mosaïque, puis le nom du dessin apparaît en serif.
- ✅ Vibrations fines (tic à chaque case, succès à chaque canal), canaux coupés qui se reforment si on recule.
- ✅ Doigt fantôme au premier niveau : on comprend sans lire.
- ⏳ (4) Effets d'écran au tout premier dessin révélé (particules de tesselles), transitions entre écrans animées.

## 3. Direction artistique et son

- ✅ Palette papier chaude et cohérente, 10 teintes de canaux harmonisées, symboles pour les daltoniens.
- ✅ Typographie : **Fraunces** (serif éditoriale, embarquée hors-ligne) pour les titres, le logo et les noms de
  dessins ; arrondi système pour l'interface.
- ✅ **Musique d'ambiance générative** (nappes douces et cloches, façon Alto) et sons synthétisés : aucun fichier
  audio, aucune licence, et la musique ne tourne jamais en boucle à l'identique.
- ✅ 5 palettes (Papier, Nuit, Sakura, Dune, Plan bleu).
- ✅ **Une identité à nous : un village de canaux méditerranéen en mosaïque** (`src/puzzle/scene.ts`). On prend
  aux meilleurs ce qui marche (l'échelle douce de Townscaper, les canaux de Venise, les azulejos de Lisbonne), sans
  copier Monument Valley : pas de tours géantes ni de grand soleil, des maisons basses à hauteur d'homme.
  - des palettes chaudes et variées par lieu, chaque volume ombré par la même lumière, toits de tuiles à pignon,
    volets, jardinières, cheminées ;
  - **le plateau est un morceau du lieu vu du dessus**, comme la carte de Mini Motorways : pelouse au Jardin,
    ponton de bois au-dessus de la mer au Port, carreaux vernissés au Marché, pavés la Nuit, sable dans la Cité
    engloutie. Bordé de tesselles, avec un quai et de l'eau devant. Les cases restent claires et calmes : les
    canaux se lisent toujours en premier ;
  - **les points à relier sont des objets du lieu** : chaque canal part d'une fontaine (ronde) et alimente un
    bâtiment (carré) : un cottage, une cabane de pêcheur sur son ponton, un étal à store rayé, une maison
    éclairée, un coquillage géant. La couleur reste le repère principal, la forme le second ;
  - **chaque lieu se reconnaît au premier coup d'œil** :
    - Jardin : cottages, serre, cyprès, parterres fleuris, fontaine, étang avec nénuphars et canards ;
    - Port : phare rayé et son faisceau, maisons de pêcheurs colorées, caisses et tonneaux, mer et voiliers ;
    - Marché : étals à stores rayés chargés de fruits, cagettes, guirlandes, campanile au loin, gondole chargée ;
    - Nuit : fenêtres allumées, réverbères, guirlandes, lune, étoiles, lucioles, reflets dans le canal ;
    - Cité engloutie : maisons sans toit, colonnes brisées, coraux, algues qui ondulent, poissons et bulles ;
  - de la vie discrète : nuages, oiseaux, jets d'eau, ampoules qui scintillent, bateaux, rides sur l'eau ;
  - de petits bateaux (des poissons sous la mer) naviguent dans les canaux reliés ;
  - le décor du chapitre en cours sert aussi de fond à l'écran d'accueil ;
  - tout est procédural et mis en cache : aucun coût d'illustration.
- ⏳ (5) Un vrai pass d'illustrateur sur les dessins (pixel art plus fin en 10×10 et 12×12) et sur l'icône.

## 4. Les boucles de rétention

| Horizon | Mécanique | État |
|---|---|---|
| La minute | Canal relié = eau + note ; dessin révélé à la fin | ✅ |
| La session | Niveau suivant en un tap, étoiles, coffre d'étoiles (15 ★ = indices, tesselles, parfois une palette) | ✅ |
| Le jour | Défi du jour (même puzzle pour tous) + **partage façon Wordle** (mosaïque en emojis, temps, étoiles), 3 missions, série de jours avec cadeaux | ✅ |
| La semaine | Chapitres-albums à compléter (récompense d'album : indices + palette) | ✅ |
| Le mois | Ville et monuments, palettes, mode Courant, Rappels (les dessins avec de nouveaux tracés) | ✅ |
| Live ops | Événements saisonniers (album d'Halloween, de Noël…), pass de saison cosmétique | ⏳ (6) |
| Social | Classement du défi du jour entre amis (Game Center / Play Games), « vies » partageables | ⏳ (7) |

- ✅ **Notifications locales bien élevées** : demandées après le 5ᵉ niveau via une carte « pré-permission » (jamais
  au lancement), deux rappels max (le puzzle du jour à 9 h, la série en danger à 19 h 30), désactivables.
- ✅ **Demande d'avis sur le store** au bon moment : après une victoire parfaite, à partir du niveau 10, une seule fois.

## 5. Monétisation qui respecte le joueur

- ✅ Pas de pub imposée avant le niveau 8, puis au plus un niveau sur trois et 150 s minimum d'écart. Les vidéos
  restent toujours au choix (indice, doubler).
- ✅ Indices : 3 offerts, puis du coffre, des albums ou d'une vidéo.
- ⏳ (8) Achats d'indices en pack, pass de saison (dessins et palettes exclusifs), abonnement « Mécène » mensuel
  léger (sans pub + indices quotidiens), à tester en soft launch.

## 6. Tout ce qui entoure l'appli

### Avant le lancement
1. **Analytics** (Firebase Analytics ou GameAnalytics, gratuits). Événements à envoyer :
   - `level_start` / `level_complete` / `level_quit`, avec niveau, temps, indices et étoiles ;
   - `hint_used`, `ad_offer` / `ad_watched`, `iap_view` / `iap_purchase` ;
   - `daily_complete`, `share`, `notif_opt_in`, `album_complete`.

   Tableaux de bord : rétention J1/J7/J30, entonnoir des 20 premiers niveaux (où les gens décrochent), revenu par
   utilisateur actif par jour (ARPDAU).
2. **Remote Config / A/B tests** : la cadence des pubs, le nombre d'indices offerts, la taille du coffre et la courbe de
   difficulté doivent pouvoir changer sans mise à jour. Toutes ces valeurs sont déjà regroupées en constantes,
   prêtes à être branchées.
3. **Rapports de crash** (Crashlytics ou Sentry). Objectif : plus de 99,8 % de sessions sans crash.
4. **Budgets techniques** : démarrage à froid en moins de 2 s, 60 images/s sur un Android d'entrée de gamme, appli
   de moins de 40 Mo, jeu 100 % hors-ligne. Aujourd'hui le jeu web pèse environ 200 Ko : très bonne base.
5. **Sauvegarde dans le cloud** (Game Center / Play Games Saved Games, ou un compte léger) pour ne jamais perdre la
   progression en changeant de téléphone.
6. **Accessibilité** : mode daltonien ✅, tailles de texte, réduction des animations, VoiceOver sur les menus.
7. **Traductions** : FR/EN ✅, puis ES, DE, PT-BR, IT, JA (les 6 marchés puzzle principaux).

### La page store (ASO) : c'est elle qui fait installer
- Icône : la mosaïque révélée, lisible en 48 px. Tester 3 variantes (Google Play le permet nativement).
- 5 captures avec une phrase chacune : « Relie les canaux », « Révèle le dessin caché », « 40 albums à
  compléter », « Un défi par jour », « Sans chrono, sans stress ».
- Vidéo de 15 à 20 s : un niveau résolu jusqu'à la mosaïque qui apparaît.
- Mots-clés : puzzle relaxant, relier les points, flow, pixel art, logique, zen, mosaïque.

### Se faire mettre en avant par Apple et Google
Les éditeurs mettent en avant les jeux soignés et respectueux du joueur : sans pub agressive, accessibles, beaux,
avec des mises à jour régulières. Préparer un dossier de presse (logo, captures, GIF, pitch en une phrase), et le
soumettre via le formulaire « App Store Featuring Nominations » d'App Store Connect et l'équipe Indie Corner de
Google Play.

### Communauté et viralité
- Le partage du défi du jour (mosaïque en emojis) est le moteur viral, à la manière de Wordle.
- Un compte TikTok/Reels : timelapses de dessins révélés, défis « qui trouve en moins de 30 s ? ».
- Un Discord : les joueurs proposent des dessins ; le meilleur de la semaine devient un niveau (contenu gratuit et
  communauté engagée).

## 7. Ordre de travail recommandé

1. Analytics + remote config + crash, puis une bêta fermée (TestFlight / test interne) avec 30 à 100 joueurs.
2. Les mécaniques de chapitre (ponts, murets) et 100 dessins de plus.
3. La page store + la vidéo, puis un soft launch dans 2 ou 3 pays.
4. Les live ops (événements saisonniers) une fois la rétention J7 au-dessus de 15 %.
