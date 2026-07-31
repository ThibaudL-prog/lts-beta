# Déploiement LTS v0.5.8.3

1. Garder `write_enabled = FALSE`.
2. Remplacer `Code.gs` dans Apps Script, enregistrer puis créer une nouvelle version du déploiement Web.
3. Remplacer `index.html` et `api-client.js` à la racine du dépôt GitHub déployé par Cloudflare Pages.
4. Recharger la PWA avec `?v=0583`.
5. Dans Réglages, tester la connexion pour forcer le rechargement complet du snapshot.
6. Contrôler les créneaux, les tests, la FC allongée et le graphique Fatigue avant d’activer les écritures.
