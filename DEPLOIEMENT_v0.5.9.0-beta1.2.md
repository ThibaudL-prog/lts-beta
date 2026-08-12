# LTS v0.5.9.0-beta1.2 — Hotfix mobilité

Cette version part de `v0.5.9.0-beta1.1`.

## Problème corrigé
La prescription `Mobilité complète — 5 articulations` utilisait encore une configuration générique :
elle n'ouvrait pas le sélecteur d'exercices et ne pouvait donc pas exploiter le catalogue `REF_EXERCISES`.

## Correction
- La prescription Mobilité utilise maintenant le même sélecteur de catalogue que la prévention.
- Les exercices sont fusionnés entre :
  - la bibliothèque locale historique G11 ;
  - `REF_EXERCISES`.
- Pour G11, sont proposés tous les exercices dont :
  - `exercise_family = mobility`
  - OU `primary_quality_id = q_mobility`.
- Les doublons sont fusionnés par nom.
- L'`exercise_catalog_id` Sheets est conservé.
- `Exercice personnalisé` est également disponible pour la mobilité.

## Déploiement
Aucune nouvelle route Apps Script n'est nécessaire.

### GitHub
Remplacer :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

### Apps Script
Pas besoin de redéployer `Code.gs` pour ce correctif.

Commit conseillé :
`LTS v0.5.9.0-beta1.2 - mobility REF_EXERCISES selector`

URL de contrôle :
`https://lts-beta.pages.dev/?v=0590b12`

## Test
1. Coach → Semaine → ajouter une prescription `Mobilité complète — 5 articulations`.
2. Vérifier qu'un sélecteur d'exercices apparaît.
3. Vérifier la présence d'exercices issus de REF_EXERCISES, par exemple :
   - 90/90 Stretch
   - Pigeon Stretch
   - Pancake Stretch
   - Frog Stretch
   - Open Book
   - Cat-Cow
   - Shoulder Dislocation
   - Wrist Pronation / Supination
   selon le contenu actuel de REF_EXERCISES.
4. Vérifier le badge `Sheets`.
5. Sélectionner plusieurs exercices et créer la prescription.
6. Vérifier que `Exercice personnalisé` est disponible.
