# Étapes — v0.5.8.0 Migration verrouillée

## Déploiement
1. Créer la branche `dev-v0.5.8-production-migration` depuis `main`.
2. Déployer le contenu du ZIP sur cette branche.
3. Vérifier la prévisualisation et la syntaxe.
4. Fusionner dans `main` uniquement pour exécuter le nettoyage sur le domaine de production.
5. Ne pas créer de release Stable.
6. Ne pas modifier ni redéployer `Code.gs`.

## Contrôle téléphone
1. Ouvrir le domaine principal de production.
2. Vérifier `LTS v0.5.8.0`.
3. Vérifier l’absence de la semaine DEMO.
4. Vérifier l’affichage `Migration production en cours`.
5. Vérifier que le bouton indique `Migration verrouillée`.
6. Fermer complètement la PWA.

## Contrôle PC
Reproduire exactement les six contrôles précédents.

## Seulement après validation sur les deux appareils
La purge des lignes Google Sheets peut commencer.
