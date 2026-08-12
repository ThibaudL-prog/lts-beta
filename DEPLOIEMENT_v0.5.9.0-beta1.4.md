# LTS v0.5.9.0-beta1.4 — Charge dans les exercices de mobilité / prévention

Base : v0.5.9.0-beta1.3.

## Correction
Les exercices issus de `REF_EXERCISES` peuvent maintenant recevoir une charge prescrite côté Coach.

Exemple :
- Single Leg Romanian Deadlift
- 3 séries
- 8 reps
- charge : 20
- unité : kg

## Fonctionnement
Dans tous les sélecteurs basés sur la bibliothèque d'exercices (mobilité, prévention, etc.) :
- Séries
- Reps
- Charge
- Unité
- Durée
- Repos

sont désormais modifiables.

Pour les exercices `REF_EXERCISES` avec :
`load_mode = external_load`
la PWA reprend automatiquement `default_unit` lorsque disponible.

Si une charge est renseignée sans unité, `kg` est utilisé par défaut.

## Google Sheets
Lors de la publication :
- `EXERCISE_PRESCRIPTIONS.load_target_value` reçoit la charge de l'exercice ;
- `EXERCISE_PRESCRIPTIONS.load_target_unit` reçoit son unité.

L'Athlète voyait déjà la charge prévue et pouvait saisir la charge réellement utilisée ; cette partie reste compatible.

## Déploiement
Pas besoin de redéployer Apps Script.

GitHub :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Commit :
`LTS v0.5.9.0-beta1.4 - exercise load prescription`

URL :
`https://lts-beta.pages.dev/?v=0590b14`

## Test
1. Coach → Semaine → Mobilité.
2. Choisir `Single Leg Romanian Deadlift`.
3. Saisir par exemple :
   - séries : 3
   - reps : 8
   - charge : 20
   - unité : kg
4. Créer / modifier la prescription.
5. Vérifier côté Athlète que `Charge prévue : 20 kg` apparaît.
6. Après publication, vérifier dans `EXERCISE_PRESCRIPTIONS` :
   - `load_target_value = 20`
   - `load_target_unit = kg`
7. Lors de l'exécution Athlète, saisir la charge réellement utilisée et vérifier qu'elle arrive dans `SET_RESULTS.load_added_kg`.
