# LTS v0.5.8.14 — correction des flashs Kilterboard par angle

## Cause identifiée

Les lignes historiques de `CLIMBING_ATTEMPTS` contiennent bien l'angle réel dans `wall_angle_deg`.
Lors du chargement depuis Google Sheets, `api-client.js` reconstruisait les blocs mais supprimait cette information.

Le Top 5 cherchait ensuite uniquement `session.climbing.angle`. Les flashs historiques à 40° étaient donc exclus même si `wall_angle_deg = 40` était correctement présent dans Sheets.

## Correction

- conservation de `wall_angle_deg` sur chaque bloc chargé ;
- conservation d'un angle au niveau de l'exécution ;
- classement par l'angle réel de chaque tentative ;
- reconnaissance d'une séance Kilter à partir de son angle ou de son identifiant externe ;
- aucun changement des données Sheets.

## Fichiers à remplacer

- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Aucune modification de `Code.gs` ou de Google Sheets.

## Commit conseillé

`LTS v0.5.8.14 - restore Kilter flash angles from Sheets`

## Vérification

1. Attendre le déploiement Cloudflare.
2. Ouvrir `https://lts-beta.pages.dev/?v=05814`.
3. Recharger une fois.
4. Fermer complètement Samsung Internet et la PWA.
5. Rouvrir LTS depuis son icône.
6. Lancer `Coach → Réglages → Tester la connexion`.
7. Vérifier `Coach → Suivi → Tests & records` puis `Athlète → Profil → Tests & records`.
8. Le Top 5 Kilterboard 40° doit reprendre les lignes `FLASH` dont `wall_angle_deg = 40`.
