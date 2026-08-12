# LTS v0.5.9.0-beta1.1 — Hotfix catalogue exercices

Cette version part exactement de `v0.5.9.0-beta1_ready`.

## Problème corrigé
`REF_EXERCISES` est déjà envoyé par l'API dans le snapshot, mais le sélecteur Coach utilisait uniquement `EXERCISE_LIBRARY`, une liste codée en dur dans `index.html`.

Conséquence : un exercice pouvait exister dans Google Sheets sans être proposé dans la PWA.
Exemple confirmé : `FINGER_CURLS / Finger Curls`.

## Correction
- Les prescriptions G20 de prévention fusionnent maintenant :
  - les exercices PWA historiques ;
  - les exercices pertinents de `REF_EXERCISES`.
- Les doublons sont fusionnés par nom.
- L'ID exact `exercise_catalog_id` de Sheets est conservé lors de la publication.
- `Finger Curls` apparaît dans `Prévention doigts`.
- Un bloc `Exercice personnalisé` est disponible dans les cartes basées sur la bibliothèque d'exercices.
- En mode hors ligne, `Finger Curls` reste disponible via le fallback local.

## Déploiement
Aucune nouvelle route Apps Script n'est nécessaire : `reference_exercises` faisait déjà partie du snapshot.

### GitHub
Remplacer :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

### Apps Script
`Code.gs` n'a pas besoin d'être redéployé pour cette correction.
Le fichier fourni porte seulement le numéro de release mis à jour.

Commit conseillé :
`LTS v0.5.9.0-beta1.1 - REF_EXERCISES selector and custom exercise`

URL de contrôle :
`https://lts-beta.pages.dev/?v=0590b11`

## Test
1. Coach → Semaine → créer/modifier une prescription `Prévention doigts`.
2. Vérifier que `Finger Curls` apparaît avec le badge `Sheets`.
3. Sélectionner Finger Curls et renseigner séries/reps/repos.
4. Ajouter une prescription puis la publier.
5. Vérifier dans `EXERCISE_PRESCRIPTIONS` que l'exercice utilise bien son `exercise_catalog_id` de REF_EXERCISES.
6. Tester `Exercice personnalisé` avec un nom temporaire.
7. Vérifier qu'une prescription existante reste inchangée.
