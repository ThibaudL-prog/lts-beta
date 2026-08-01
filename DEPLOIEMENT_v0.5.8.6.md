# Déploiement LTS v0.5.8.6

1. Conserver `write_enabled = FALSE`.
2. Remplacer `index.html` et `api-client.js` à la racine du dépôt GitHub relié à Cloudflare Pages.
3. Commit : `LTS v0.5.8.6 - refine G21 recovery alerts`.
4. Attendre le déploiement Cloudflare.
5. Ouvrir `https://lts-beta.pages.dev/?v=0586`.
6. Coach → Réglages → Tester la connexion.
7. Ouvrir la semaine 5. Les compteurs doivent rester 5 / 2 / 2 / 2 / 3 / 1. Les fausses alertes liées à la souplesse ou au run facile avant l’escalade doivent disparaître.

Aucune modification de `Code.gs` ou du Google Sheets n’est nécessaire.
