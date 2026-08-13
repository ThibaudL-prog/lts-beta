# LTS v0.5.9.0-beta1.5 — Éditeur Coach ergonomique et catalogues Sheets

Cette version remplace la bêta `v0.5.9.0-beta1.4` pour la partie PWA.

## Fichiers à publier

- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

`Code.gs` et le schéma Google Sheets restent inchangés : aucun redéploiement Apps Script n’est nécessaire pour ce lot.

## Corrections livrées

### Construction d’une semaine

- Les contrôles, le résumé et « À placer cette semaine » sont repliés par défaut.
- Le planning propose sept boutons de jours et n’affiche qu’un jour à la fois.
- Le jour actif est conservé pendant les ajouts et modifications.
- L’ajout d’une séance pré-sélectionne le jour actuellement ouvert.
- Les actions secondaires des séances et prescriptions sont regroupées sous « Plus ».
- La feuille de route de la prochaine semaine est également repliée.
- Les propositions manquantes des semaines 4 (deload) et 8 (tests) sont opérationnelles.

### Prescriptions Coach

- Escalade technique : choix exclusif entre durée imposée et nombre de blocs imposé.
- Escalade technique : choix des situations actives issues de `REF_EXERCISES` (`q_technique`, `q_hand_coord`, `q_foot_coord`, `q_full_coord`).
- Souplesse : ajout des séances préétablies Jessica Prévalet 20 min et Full Body 37 min 52 s.
- Toute nouvelle semaine reçoit automatiquement la routine matinale Jessica Prévalet de 20 min sur les sept jours.
- Jambes : ajout des séances force G23 et puissance G24, limitées à 30 min dans les modèles.
- Gainage : le catalogue G10 expose les exercices `q_core` / famille `core` du Sheets, dont le circuit de gainage.
- L’éditeur d’une prescription existante permet aussi de changer la sélection d’exercices, les séries, répétitions, charges, unités, durées et repos.

## Contrôles rapides après publication

1. Ouvrir l’espace Coach, puis `Semaines`.
2. Créer ou ouvrir une semaine et vérifier qu’un seul jour est visible.
3. Ouvrir « Contrôles et résumé » puis « À placer cette semaine ».
4. Dans une séance, ajouter `Escalade` → `Escalade technique facile`.
5. Vérifier les deux modes `Durée imposée` et `Nombre de blocs imposé`, puis la liste d’exercices marqués `Sheets`.
6. Vérifier `Souplesse` → `Souplesse matinale — Jessica Prévalet`.
7. Vérifier `Jambes — force`, `Jambes — puissance` et `Gainage`.
8. Publier une semaine de test et contrôler sa présence côté Athlète.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.5`. Après déploiement, ouvrir une fois :

`https://lts-beta.pages.dev/?v=0590b15`

Si un ancien écran reste affiché, fermer tous les onglets LTS puis rouvrir cette URL.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.5 - coach week editor and Sheets catalogs`
