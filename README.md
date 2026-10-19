# Tessera

Jeu mobile (Android et iOS) minimaliste : on trace des canaux qui transportent des tuiles de mosaïque. Chaque partie
complète des fresques et fait grandir une ville qu'on garde d'une partie à l'autre.

Le design complet (mécaniques, rétention, monétisation, plan de lancement) est dans **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)**.

## Démarrer

```bash
npm install
npm run dev        # jeu dans le navigateur : http://localhost:5173 (ouvrable depuis ton téléphone sur le même Wi-Fi)
npm test           # tests de la simulation, de la progression et de l'équilibrage
npm run build      # build de production dans dist/
```

En mode `dev`, les pubs et les achats sont simulés (une fausse pub s'affiche, l'achat réussit), ce qui permet de
tester tout le parcours.

## Applications natives

Le jeu est en TypeScript + Canvas, empaqueté avec [Capacitor](https://capacitorjs.com). Les projets natifs sont
dans `android/` et `ios/`.

```bash
npm run android    # build + sync + ouvre Android Studio
npm run ios        # build + sync + ouvre Xcode (nécessite un Mac)
```

## Avant de publier

1. `capacitor.config.ts` : remplacer `appId` (`com.tessera.game`) par ton identifiant.
2. **AdMob** : créer l'app et les blocs d'annonces, puis remplacer les IDs de test dans
   `src/monetization/config.ts` (passer `testing: false`), `android/app/src/main/AndroidManifest.xml` et
   `ios/App/App/Info.plist` (`GADApplicationIdentifier`). Configurer le message RGPD (UMP) dans AdMob.
3. **RevenueCat** : créer les produits `tessera_no_ads`, `tessera_patron`, `tessera_tiles_small` et
   `tessera_tiles_large` dans les deux stores, les entitlements `no_ads` et `patron`, puis coller les clés publiques
   dans `src/monetization/config.ts`.
4. Une politique de confidentialité en ligne (obligatoire pour les pubs).
5. Icônes et splash : modifier `assets/` puis `npx @capacitor/assets generate`.

## Structure

```
src/
  game/        simulation déterministe (sim.ts), terrain, contenu, rendu Canvas
  city/        ville isométrique procédurale
  meta/        sauvegarde, missions, série, défi du jour, monuments
  monetization/ AdMob (pubs + consentement), RevenueCat (achats), règles de cadence
  ui/          écrans, HUD, i18n FR/EN, icônes
  core/        RNG, audio génératif, haptique, stockage
tests/         tests vitest + bot d'équilibrage
```
