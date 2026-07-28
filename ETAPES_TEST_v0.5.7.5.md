# Recette ciblée — v0.5.7.5 RC2

## Déploiement
1. Utiliser uniquement `dev-v0.5.7-session-structure`.
2. Remplacer `index.html`, `api-client.js` et `README.md`.
3. Ajouter ce fichier.
4. Ne pas modifier `Code.gs`.
5. Vérifier `LTS v0.5.7.5`.

## Reproduction du défaut corrigé
1. Sur téléphone, ouvrir une prescription côté Athlète.
2. Ajouter le commentaire `TEST PERSISTANCE 0575`.
3. Enregistrer.
4. Passer immédiatement côté Coach.
5. Cliquer sur `Synchroniser maintenant`, sans attendre la synchronisation automatique.
6. Revenir côté Athlète.
7. Attendu : le commentaire est toujours présent.

## Relecture distante
1. Fermer complètement la PWA.
2. La rouvrir et synchroniser.
3. Attendu : le commentaire est toujours présent.
4. Sur le second appareil, synchroniser.
5. Attendu : le même commentaire est récupéré depuis Google Sheets.

## Contrôles
- progression de séance inchangée ;
- ordre Coach/Athlète inchangé ;
- attente 0 ;
- conflits 0 ;
- non synchronisés 0.
