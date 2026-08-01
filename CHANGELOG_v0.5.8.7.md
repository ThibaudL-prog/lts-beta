# LTS v0.5.8.7

## Corrections
- Le kilométrage vélo quotidien est saisi dans un champ numérique précis, avec décimales jusqu’au centième de kilomètre.
- La distance vélo apparaît dans les graphiques Coach « Lifestyle & santé » et Athlète « Mon évolution ».
- Les check-ins du soir enregistrent maintenant RPE, fatigue, courbatures, douleur et distance vélo dans les colonnes dédiées de `CHECKINS`.
- Le serveur Apps Script mappe explicitement `bike` vers `cycling_distance_km` sans arrondi.

## Schéma
Aucune colonne n’est ajoutée. La version utilise la colonne existante `cycling_distance_km` de `CHECKINS`.
