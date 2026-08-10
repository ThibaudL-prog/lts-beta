# LTS v0.5.9.0-alpha3

Cette version part de l'alpha2 validée.

## Nouveauté : vélo distance + durée + vitesse moyenne

### Athlète → Quotidien → Soir
La saisie vélo comprend désormais :
- distance exacte en km ;
- durée en heures + minutes ;
- vitesse moyenne calculée automatiquement.

La vitesse n'est PAS stockée : elle est recalculée à partir de la distance et de la durée.

### Google Sheets
Une nouvelle colonne est utilisée dans `CHECKINS` :
`cycling_duration_min`

Aucune modification manuelle de Sheets n'est nécessaire :
`Code.gs` ajoute automatiquement cette colonne lors du premier enregistrement de check-in contenant la nouvelle durée.

La distance continue d'utiliser :
`cycling_distance_km`

### Suivi Coach / Athlète
Dans `Lifestyle & santé`, une carte `Vélo quotidien` permet de basculer entre :
- Distance ;
- Durée ;
- Vitesse.

Les graphiques restent compatibles avec :
- 7 jours ;
- 30 jours ;
- Cycle ;
- Tout.

La vitesse quotidienne est calculée comme :
distance / (durée / 60)

## Fichiers à déployer

### Apps Script
Remplacer `Code.gs`, enregistrer puis créer une nouvelle version du déploiement Web existant.
Conserver la même URL `/exec`.

### GitHub
Remplacer :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

## Commit conseillé
`LTS v0.5.9.0-alpha3 - cycling duration and average speed`

## Test contrôlé
1. Déployer Apps Script.
2. Déployer GitHub / Cloudflare.
3. Ouvrir :
   `https://lts-beta.pages.dev/?v=0590a3`
4. Fermer puis rouvrir la PWA.
5. Athlète → Quotidien → Soir :
   - Distance : 18.40 km
   - Durée : 0 h 52 min
   - La vitesse doit afficher environ 21.2 km/h.
6. Valider le soir.
7. Dans `CHECKINS`, vérifier :
   - `cycling_distance_km = 18.4`
   - `cycling_duration_min = 52`
8. Fermer / rouvrir la PWA :
   - 18.4 km et 52 min doivent être restaurés.
9. Coach → Suivi → Lifestyle & santé :
   - tester Distance / Durée / Vitesse.
10. Athlète → Profil → Lifestyle & santé :
   - refaire les trois tests.

## Important
La v0.5.9.0-alpha2 reste le point de retour arrière jusqu'à validation de cette alpha3.
