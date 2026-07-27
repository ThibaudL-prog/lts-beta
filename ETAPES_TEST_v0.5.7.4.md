# Recette finale — LTS v0.5.7.4 RC

## Déploiement
1. Utiliser uniquement `dev-v0.5.7-session-structure`.
2. Remplacer `index.html`, `api-client.js` et `README.md`.
3. Ajouter ce fichier et `MATRICE_RECETTE_v0.5.7.4.md`.
4. Ne pas modifier `Code.gs`.
5. Vérifier `LTS v0.5.7.4` sur l’URL de prévisualisation.

## Diagnostic
1. Ouvrir le tableau de bord Coach.
2. Repérer `Stabilisation v0.5.7`.
3. Ouvrir le diagnostic.
4. Attendu :
   - 0 erreur structurelle ;
   - toutes les semaines locales valides ;
   - dernières versions Google Sheets valides ;
   - plans et résultats non synchronisés à 0 après synchronisation.
5. Exporter une sauvegarde JSON et vérifier que le fichier est créé.

## Publication chronologique
1. Conserver une séance du samedi créée après une séance du dimanche.
2. Publier la semaine.
3. Synchroniser le second appareil.
4. Vérifier Coach et Athlète :
   - samedi avant dimanche ;
   - prescriptions dans le bon ordre ;
   - durées et résultats inchangés.

## Non-régression
1. Modifier puis publier depuis le PC.
2. Synchroniser le téléphone.
3. Modifier un résultat Athlète sur le téléphone.
4. Synchroniser le PC.
5. Vérifier :
   - résultat conservé ;
   - progression identique ;
   - En attente 0 ;
   - Conflits 0 ;
   - Non synchronisés 0.
6. Ne pas fusionner dans `main` avant validation complète.
