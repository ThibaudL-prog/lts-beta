# LTS v0.5.9.0-beta1.14 — Ouverture des séances du cycle actif

Cette correction remplace `v0.5.9.0-beta1.13` sans supprimer ni modifier les données locales ou Google Sheets.

## Correction

- Les boutons Athlète ne recherchent plus une séance uniquement par son numéro de semaine.
- L'application utilise d'abord l'identifiant unique de la prescription, puis celui de la séance.
- Une ancienne semaine 1 archivée ne peut plus intercepter l'ouverture de la semaine 1 du cycle 2.
- Le bouton **Voir l'échauffement et commencer**, les cartes de prescription et **Revoir la séance** ouvrent le bon contenu.
- Le formulaire Running est de nouveau accessible.
- La déduplication du planning de beta1.13 et toutes les corrections de beta1.12 sont conservées.

## Déploiement

`Code.gs` ne change pas : ne pas redéployer Google Apps Script.

Remplacer à la racine du dépôt PWA :

- `index.html` ;
- `api-client.js` ;
- `manifest.webmanifest` ;
- `service-worker.js`.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.14 - open athlete sessions by unique prescription id`

## Vérification

1. Attendre le déploiement Cloudflare Pages.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590b114`.
3. Vérifier le titre `LTS v0.5.9.0-beta1.14`.
4. Ouvrir **Athlète → Aujourd'hui → Séance run EF**.
5. Toucher **Voir l'échauffement et commencer**, puis **Débuter · R1 — Endurance fondamentale**.
6. Vérifier que le formulaire Running affiche notamment la durée et la distance réalisées.
7. Après la saisie, toucher une fois **Synchroniser maintenant** et vérifier `À jour`, `En attente : 0`, `Conflits : 0` et `Non synchronisés : 0`.

Ne recréer aucune séance, ne supprimer aucune ligne Google Sheets, ne pas vider les données du site et ne pas désinstaller la PWA.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.14`.
