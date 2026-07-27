# Déploiement et test — LTS v0.5.7.0

## Important
- Travailler uniquement sur la branche `dev-v0.5.7-session-structure`.
- Ne pas modifier `main`.
- Ne pas modifier ni redéployer Apps Script.
- Utiliser uniquement l’URL Cloudflare de prévisualisation.

## Déploiement
1. Ouvrir le dépôt GitHub.
2. Vérifier que la branche sélectionnée est `dev-v0.5.7-session-structure`.
3. Remplacer `index.html`.
4. Remplacer `api-client.js` même s’il est identique au socle stable, afin que le paquet reste complet.
5. Ajouter `README.md` et `MATRICE_RECETTE_v0.5.7.0.md`.
6. Valider le commit.
7. Attendre le déploiement Cloudflare de la branche.
8. Ouvrir l’URL de prévisualisation.
9. Vérifier que l’onglet affiche `LTS v0.5.7.0`.

## Test initial
1. Synchroniser la prévisualisation.
2. Ouvrir une semaine existante.
3. Repérer la carte `Modèle Séance → prescriptions`.
4. Vérifier qu’elle affiche `Valide`.
5. Appuyer sur `Vérifier la structure`.
6. Contrôler :
   - une carte par séance réelle ;
   - les prescriptions rattachées à la bonne séance ;
   - les résultats existants signalés comme conservés.
7. Fermer l’audit sans publier.

## Test fonctionnel
1. Créer une nouvelle séance.
2. Lui ajouter deux prescriptions.
3. Modifier l’une des deux prescriptions.
4. Vérifier que la durée totale de la séance correspond à la somme des prescriptions.
5. Publier la semaine.
6. Synchroniser.
7. Vérifier Google Sheets :
   - une ligne dans `SESSIONS` pour la séance ;
   - deux lignes distinctes dans `SESSION_BLOCKS` ;
   - deux prescriptions distinctes dans `EXERCISE_PRESCRIPTIONS`.
8. Synchroniser l’autre appareil.
9. Vérifier que la séance et ses deux prescriptions apparaissent.
10. Vérifier :
   - En attente : 0
   - Conflits : 0
   - Non synchronisés : 0

## Arrêt immédiat du test
Ne pas fusionner dans `main` si :
- la carte structure affiche `À corriger` ;
- une prescription change de séance ;
- un résultat Athlète disparaît ;
- la synchronisation ne termine pas à zéro ;
- la production v0.5.6.15 est affectée.
