# LTS v0.5.9.0-alpha1

Première étape de la v0.5.9.0. La v0.5.8.14 reste la version stable de secours.

## Contenu de l'alpha1

### 1. Sommeil
- saisie en heures + minutes ;
- stockage inchangé en heures décimales dans `CHECKINS.sleep_duration_h` ;
- historique existant compatible.

### 2. Durées lisibles
- les durées courtes sont affichées en secondes ;
- au-delà de 60 s : `min + s` ;
- au-delà d'une heure : `h + min` ;
- les Max Hangs et autres exercices chronométrés se saisissent désormais en minutes + secondes côté Athlète ;
- les maintiens d'exercices sont également saisis en minutes + secondes.

### 3. Check hebdomadaire
- le dimanche, une carte Weekly apparaît automatiquement dans `Athlète → Quotidien` ;
- la validation du check du dimanche crée automatiquement une ligne `CHECKINS` avec `checkin_type = WEEKLY` ;
- le statut est restauré depuis Sheets au rechargement ;
- les mensurations continuent d'être enregistrées dans `BODY_MEASUREMENTS`.

## Fichiers à remplacer

### Apps Script
- `Code.gs`
- Enregistrer puis créer une nouvelle version du déploiement Web existant.
- Conserver la même URL `/exec`.

### GitHub
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

## Commit conseillé
`LTS v0.5.9.0-alpha1 - sleep time duration UX and weekly check`

## Test minimal
1. Déployer Apps Script puis GitHub/Cloudflare.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590a1`.
3. Recharger une fois.
4. Fermer complètement Samsung Internet + la PWA, puis rouvrir.
5. Tester :
   - sommeil avec une valeur comme `7 h 37` ;
   - une carte Max Hang : durée saisissable en `0 min / 5 s` ;
   - une carte d'exercice chronométré : maintien en `min / s`.
6. Le test Weekly complet sera fait dimanche :
   - carte automatique dans Quotidien ;
   - validation ;
   - nouvelle ligne `CHECKINS` de type `WEEKLY`.
