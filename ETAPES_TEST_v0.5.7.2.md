# Recette ciblée — LTS v0.5.7.2

## Déploiement
1. Utiliser uniquement `dev-v0.5.7-session-structure`.
2. Remplacer `index.html`, `api-client.js` et `README.md`.
3. Ajouter ce fichier de recette.
4. Vérifier `LTS v0.5.7.2` sur l’URL de prévisualisation.

## Test local Coach
1. Ouvrir la séance test contenant deux prescriptions.
2. Utiliser ↑ puis ↓ sur une prescription.
3. Vérifier que l’ordre change et persiste après réouverture.
4. Créer une seconde séance sur le même jour.
5. Déplacer une prescription vers cette seconde séance.
6. Vérifier :
   - nouvelle séance de destination ;
   - jour et créneau cohérents ;
   - durée totale recalculée dans les deux séances.
7. Dupliquer une prescription.
8. Vérifier :
   - identifiant différent dans l’audit ;
   - aucun résultat copié ;
   - durée ajoutée au total.
9. Retirer la copie.
10. Tester `Séance ↑` et `Séance ↓` sur deux séances du même créneau.
11. Enregistrer la semaine sans publier, fermer et rouvrir.

## Publication et multi-appareils
1. Vérifier `Structure valide`.
2. Publier.
3. Vérifier les trois compteurs à 0.
4. Synchroniser le second appareil.
5. Vérifier ordre, déplacements, durées et regroupements.
6. Vérifier que la production v0.5.6.15 reste intacte.

Ne pas fusionner dans `main`.
