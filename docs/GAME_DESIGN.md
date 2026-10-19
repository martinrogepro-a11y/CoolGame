# TESSERA — Game Design & Business Document

> *Relie les canaux. Révèle la mosaïque.*

## 1. Le pitch (et pourquoi pas un simple clone de Mini Metro)

Ton idée de départ : relier des tapis roulants qui transportent des matériaux, et une ville qu'on regarde grandir.
Je l'ai gardée et poussée sur trois points.

1. **Deux vitesses de jeu.** Une partie courte et tendue (3 à 8 min, façon Mini Metro / Mini Motorways) et une ville
   persistante et calme. Chaque tuile livrée pendant une partie devient une *tessèle* de ta ville. **Aucune partie
   n'est perdue** : même une mauvaise partie fait avancer quelque chose. C'est le moteur principal de rétention.
2. **Un nom et un objet signature.** Une *tessera* est un petit carreau de mosaïque. Les objets transportés sont de
   petits carreaux brillants, la ville est faite de leurs couleurs et le logo en est une grille. L'identité se lit tout
   de suite, même en petit sur une capture d'écran du store.
3. **Une mécanique qui lui est propre : l'aiguillage intelligent.** Quand un tapis se sépare en deux, chaque tuile
   choisit seule la branche qui mène à l'atelier de sa couleur qui en a le plus besoin. On peut donc faire des troncs
   communs multicolores, ce qui donne au jeu une profondeur de « réseau » que les clones n'ont pas. Le joueur garde un
   geste simple : glisser du doigt.

**Références assumées** : Mini Metro (pression qui monte, choix hebdomadaires), Mini Motorways (carte qui s'agrandit),
2048 (une seule règle, apprise en 10 secondes), Townscaper (ville à contempler), Islanders (score qui construit), et
les jeux « cozy » à collection (Neko Atsume) pour la boucle quotidienne.

## 1 quater. Version premium (v0.4)

Voir **[PREMIUM.md](PREMIUM.md)** pour le détail. En bref :

- **40 niveaux à solution unique**, vérifiés par un solveur exact, avec une difficulté graduée par chapitre.
- **Le voyage** : 5 chapitres-albums (Jardin, Port, Marché, Nuit, Cité engloutie) de 10 dessins chacun, chacun
  dans son propre décor vivant façon Townscaper autour du plateau. Compléter un album donne
  des indices et une palette.
- **Coffre d'étoiles** (15 ★) et étiquette « Difficile » sur les niveaux durs.
- **Sensation de jeu** : l'eau coule dans le canal une fois relié, puis la cérémonie de révélation (tuiles, notes,
  reflet de lumière, nom du dessin en serif). Doigt fantôme au premier niveau.
- **Autour du jeu** : partage du défi du jour façon Wordle, notifications locales (avec une pré-permission), demande
  d'avis au bon moment, musique d'ambiance générative, typographie Fraunces.

## 1 ter. Mode principal : puzzles de canaux (v0.3)

Constat : le temps réel façon Mini Metro est profond mais stressant, et c'est un modèle de jeu payant. Les jeux
mobiles gratuits qui rapportent le plus sont **à niveaux** (Candy Crush, Royal Match). Ils montrent une progression
claire, se jouent en 2 minutes, et se monétisent avec des indices et des pubs entre les niveaux. On reprend donc la
règle éprouvée du genre Flow Free et on y ajoute notre identité :

- Chaque fontaine se relie à **son** atelier (même couleur). Les canaux ne se croisent pas, et **toutes les cases**
  doivent être couvertes.
- **Chaque niveau cache un dessin en pixel art** : une fois la grille remplie, les canaux se transforment en mosaïque
  (baleine, renard, phare…). Récompense visuelle, collection et partage.
- Les niveaux sont **générés à partir des images** (`src/puzzle/puzzle.ts`) : les canaux suivent les zones de couleur
  du dessin. Le nombre de paires est calé sur la taille de grille (5×5 → 5 paires … 9×9 → 10 paires). Une image =
  un niveau, et les albums suivants réutilisent les images avec de nouvelles dispositions.
- **Parfait (3 étoiles)** : chaque canal tracé d'un seul geste, sans indice. **Indices** : 3 offerts, puis contre une
  vidéo (plus tard achetables).
- **Défi du jour** : le même puzzle pour tout le monde, choisi parmi les grandes grilles.
- **Missions** orientées puzzle (résoudre N niveaux, N niveaux parfaits). L'ancien mode devient le **Mode Courant**
  (sans fin, temps réel), pour ceux qui veulent de la pression ; il remplit les fresques.
- Pubs : pas d'interstitiel avant le niveau 8, puis au plus 1 niveau sur 3 et 150 s minimum d'écart.

À faire ensuite : un solveur pour garantir une solution unique, une courbe de difficulté mesurée sur de vrais joueurs,
et plus d'images (une image = un niveau).

## 1 bis. Pourquoi des canaux et des fresques (v0.2)

Les tapis roulants de la v0.1 étaient froids, industriels, proches visuellement de Mini Motorways et sans lien avec
la ville. On a gardé le geste (tracer un chemin, celui de Flow Free et Mini Metro) et changé l'habillage et le but :

- **Canaux d'eau** : les tuiles flottent sur des canaux bordés de pierre. Fontaines = sources, ateliers de mosaïstes =
  destinations, **aqueducs** = croisements et passages au-dessus de l'eau (une seule ressource, plus simple).
- **Fresques** : chaque tuile livrée se pose dans une mosaïque en pixel art qui se dévoile partie après partie
  (mécanique de complétion d'image des applis de coloriage). Une fresque finie rapporte 100 tesselles et entre dans la
  galerie. Le contenu est très peu coûteux à produire : une fresque = une grille de texte (`src/meta/frescoes.ts`).

La simulation est identique : dans le code, `belt` désigne un canal et `bridges` les aqueducs.

## 2. Boucle de partie (le « run »)

| Élément | Règle |
|---|---|
| **Carrières** (cercles) | Produisent une tuile de leur couleur toutes les ~2,4 s (3 en réserve max). |
| **Ateliers** (carrés) | Reçoivent des commandes de plus en plus souvent. À partir de 4 commandes en attente, un anneau rouge se remplit. S'il est plein, la partie s'arrête. |
| **Tapis** | Glisser depuis une carrière ou un tapis existant. Chaque case coûte 1 tapis (stock limité). On revient en arrière en glissant à l'envers. La gomme rembourse. |
| **Fusion / embranchement** | On peut rejoindre un tapis existant ou partir d'un tapis (jusqu'à 3 sorties). |
| **Aiguillage intelligent** | À chaque embranchement, la tuile va vers l'atelier de sa couleur le plus en demande (en tenant compte des tuiles déjà en route). |
| **Ponts** | Traverser l'eau coûte 1 pont par case. **Passerelle** : glisser *tout droit* à travers un tapis perpendiculaire le fait passer par-dessus (1 pont). Sans ça, le réseau finit par s'emmurer : c'est le bot d'équilibrage qui l'a montré. |
| **Semaines** (45 s) | +4 tapis automatiques, +1 pont toutes les 2 semaines, puis choix entre 2 bonus (tapis, ponts, turbo, filons, patience). La carte s'agrandit, de nouveaux matériaux arrivent. |
| **Seconde chance** | Une fois par partie, contre une vidéo récompensée : tous les ateliers se calment, +6 tapis. |
| **Score** | Nombre de tesselles livrées. Combo si les livraisons s'enchaînent (affiché, et compté par une mission). |

**Ressenti visé** : calme au début, tendu à partir de la semaine 4 ou 5, et quand on perd, on a envie de relancer tout
de suite.
Côté son, chaque livraison joue une note d'une gamme pentatonique calée sur une grille rythmique : une usine bien
huilée finit par jouer une mélodie. C'est un clin d'œil à la musique générative de Mini Metro, mais tout est synthétisé
dans le code (aucun fichier audio, aucune licence).

## 3. Boucles méta (la rétention)

| Horizon | Raison de revenir |
|---|---|
| **Chaque session** | Battre son record, gagner des tesselles, voir la ville grandir après la partie. |
| **Chaque jour** | **Défi du jour** (même carte et même graine pour tout le monde), **3 missions** du jour, **série** de jours (cadeau à J3, J6, J7… et une palette offerte à 7 jours). |
| **Chaque semaine** | Débloquer un **quartier** (4 cartes à l'identité propre : côte, cimes rocheuses, delta, archipel). |
| **Long terme** | **12 monuments** à collectionner (commun → légendaire), dont les plans se révèlent au cumul de tesselles et qui se construisent avec les tesselles d'une couleur précise. Plus des palettes cosmétiques et une ville qui passe de quelques arbres à 140 maisons. |

**Premier lancement** : moins de 10 secondes avant la première livraison. Une main animée montre le geste, la première
partie est deux fois plus clémente pendant deux semaines de jeu, et les conseils apparaissent au bon moment (fusion,
puis gomme).

**Ville vivante** : diorama isométrique flottant, à l'heure réelle du joueur (jour et nuit, fenêtres allumées la nuit),
avec des petits passants dans les rues. On peut la parcourir au doigt et pincer pour zoomer. C'est l'écran qu'on a envie
de montrer : partage social prévu en v1.1.

### Objectifs chiffrés (KPI) à viser en soft launch

Ordres de grandeur courants pour un bon puzzle casual (à confirmer avec tes propres mesures) :

- **J1 ≥ 40 %**, **J7 ≥ 15 %**, **J30 ≥ 5 %**
- 3 sessions ou plus par jour, 12 minutes ou plus de jeu par jour
- Taux de vision des vidéos récompensées ≥ 30 % des joueurs actifs

Si J1 < 30 %, on retravaille le premier lancement avant de dépenser 1 € en acquisition.

## 4. Direction artistique

- Fond **papier** chaud, aplats, coins arrondis, ombres très courtes : sobre et lisible en plein soleil.
- **5 matériaux** de couleur (argile, ardoise, jade, safran, prune), chacun avec une **forme** associée (cercle, carré,
  triangle, losange, plus) pour l'accessibilité daltonisme (réglage « formes sur les tuiles »).
- Tapis anthracite avec chevrons animés qui montrent le sens. Passerelles avec rambardes et ombre portée.
- 5 palettes : Papier, Nuit, Sakura, Plan bleu, Dune. Elles servent aussi de récompenses et d'achats cosmétiques.
- Retours tactiles discrets (tic léger à la pose, succès en fin de semaine, alerte quand un atelier sature).
- Interface : typographie arrondie du système (SF Rounded sur iOS), grosses zones tactiles (au moins 44 px), marges
  adaptées aux encoches (safe areas).

## 5. Monétisation (hybride, éthique, durable)

**Principe : jamais payer pour gagner une partie.** Le skill reste pur, l'argent sert à aller plus vite dans la méta,
au confort et au cosmétique. C'est ce qui garde les bonnes notes sur les stores.

| Levier | Détail | Réglage actuel |
|---|---|---|
| Vidéo récompensée | Seconde chance, doubler les tesselles d'une partie, doubler le cadeau de série | Toujours au choix du joueur |
| Interstitiel | Entre deux parties uniquement | Jamais avant la 3ᵉ partie, au plus 1 partie sur 2, 150 s minimum d'écart (`src/monetization/config.ts`) |
| **Retirer les pubs** | Achat unique ~3,99 € | Garde les vidéos bonus (au choix) |
| **Pack Mécène** | Achat unique ~9,99 € : sans pub, ×1,5 tesselles à vie, toutes les palettes, monument exclusif (Arche dorée), tous les quartiers | L'offre « baleine douce » |
| Packs de tesselles | 1,99 € / 4,99 € | Accélèrent la ville, pas les parties |

**Prévu ensuite** (v1.3) : un *Season Pass* mensuel (~4,99 €) avec monuments et palettes saisonniers, plus des
événements (quartier temporaire, défi communautaire).

### Combien ça peut rapporter (honnêtement)

Un jeu hybride casual (pub + achats) rapporte en général de l'ordre de **0,03 à 0,10 € par joueur actif et par jour**
(ARPDAU).

- Viser 2 000 € par mois, c'est environ 65 € par jour, donc **700 à 2 000 joueurs actifs par jour**.
- Pour tenir ce niveau de façon organique, il faut des dizaines de milliers d'installations, d'où le plan ci-dessous.

Il faut être lucide : le code ne suffit pas à vivre d'un jeu. La **distribution** (vidéos courtes, page store) pèse
autant que le jeu lui-même. Prévois 3 à 6 mois avant des revenus significatifs. Et ne lâche pas d'autres sources de
revenus tant que les KPI ne sont pas validés.

## 6. Plan de lancement

1. **Semaines 1-2 : bêta privée.** TestFlight (iOS) et test interne Play (Android) avec 20 à 50 personnes. On corrige
   le ressenti, les crashs et la difficulté.
2. **Comptes** : Google Play Console (25 $ une fois), Apple Developer (99 $/an), AdMob, RevenueCat (gratuit jusqu'à un
   certain chiffre d'affaires). Une politique de confidentialité hébergée (obligatoire).
3. **Programme « petite entreprise »** : la commission tombe à 15 % au lieu de 30 % chez Apple et Google (il faut en
   faire la demande).
4. **Soft launch** dans 2 ou 3 pays anglophones à faible coût d'acquisition. On mesure J1/J7 et l'ARPDAU, puis on
   ajuste les constantes `TUNING` et la cadence des pubs.
5. **Contenu** : TikTok, Shorts et Reels de réseaux de tapis « satisfaisants », de timelapses de ville sur 30 jours,
   du défi du jour (« qui fait mieux ? »). Le jeu est conçu pour être filmé. Communautés : r/iosgaming,
   r/AndroidGaming, r/MiniMetro, Discord.
6. **Page store** : 5 captures (geste, réseau complexe, ville de nuit, collection, défi du jour), une vidéo de 20 s, des
   mots-clés « puzzle relaxant, conveyor, city builder, minimalist ».
7. **Lancement mondial** une fois J1 ≥ 35 % atteint. Ensuite, demander la mise en avant éditoriale (Apple et Google
   aiment les jeux sobres, sans pub agressive, accessibles).

## 7. Feuille de route

- **v1.1** : analytics (Firebase ou GameAnalytics : sans mesure, pas de décision), classements Game Center et Play
  Games (défi du jour), partage d'une image de sa ville, notifications locales (série, défi du jour).
- **v1.2** : nouvelle mécanique, le **Four** (deux matériaux qui entrent fusionnent en un composite demandé par des
  ateliers de rang 2). Deux nouveaux quartiers, plus de monuments.
- **v1.3** : Season Pass, événements, traductions ES/DE/PT-BR/JA (le système i18n est prêt).
- **Avant de publier** : vérifier la disponibilité du nom « Tessera » sur les stores et les marques déposées
  (sinon : *Tessera: Mosaic Town*, *Tesselle*…).

## 8. Équilibrage

`tests/bot.ts` est un joueur glouton : il relie chaque atelier à la source la plus proche, utilise les passerelles et
ne réorganise jamais son réseau. `tests/balance.test.ts` le fait jouer 12 parties par quartier. Résultats actuels
(médiane) : 4 à 6 minutes, 175 à 300 tesselles.
Un humain qui fait des troncs communs tient nettement plus longtemps, ce qui est le but.

Tous les réglages sont dans `TUNING` (`src/game/sim.ts`) et `DISTRICTS` (`src/game/content.ts`).
