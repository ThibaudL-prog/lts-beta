# LTS v0.5.9.0-beta1.13 — Déduplication du planning Athlète

Cette correction remplace `v0.5.9.0-beta1.12` sans supprimer ni modifier les données locales ou Google Sheets.

## Correction

- La copie locale d'une semaine et sa copie synchronisée Google Sheets sont maintenant fusionnées par **cycle + numéro de semaine**.
- Une différence de dates enregistrées ou d'identifiants techniques ne crée plus deux cartes identiques.
- Un second contrôle déduplique les séances du jour à partir de leurs prescriptions.
- Les vues **Athlète → Aujourd'hui** et **Athlète → Semaine** n'affichent plus deux fois la même séance.
- Toutes les corrections cumulatives de beta1.12 sont conservées.

Il s'agissait d'un doublon d'affichage. Aucune suppression de ligne dans Google Sheets n'est nécessaire.

## Déploiement

`Code.gs` ne change pas : ne pas redéployer Google Apps Script.

Remplacer à la racine du dépôt PWA :

- `index.html` ;
- `api-client.js` ;
- `manifest.webmanifest` ;
- `service-worker.js`.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.13 - deduplicate local and synced athlete planning`

## Vérification

1. Attendre le déploiement Cloudflare Pages.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590b113`.
3. Vérifier le titre `LTS v0.5.9.0-beta1.13`.
4. Toucher une fois **Synchroniser maintenant**.
5. Ouvrir **Athlète → Aujourd'hui** puis **Athlète → Semaine** : chaque séance doit apparaître une seule fois.
6. Vérifier l'état `À jour`, avec `En attente : 0`, `Conflits : 0` et `Non synchronisés : 0`.

Ne supprimer aucune séance ou ligne Google Sheets, ne pas vider les données du site et ne pas désinstaller la PWA.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.13`.
