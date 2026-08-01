# Déploiement LTS v0.5.8.10

Cette version apporte deux corrections ciblées :

1. le graphique **Fatigue** utilise exclusivement les check-ins du soir ;
2. les icônes PWA sont publiées sous de nouveaux noms et complétées par des favicons explicites afin que Samsung Internet et le lanceur Android utilisent l’icône LTS fournie.

## Fichiers à déployer sur GitHub / Cloudflare Pages

Remplacer :

- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Ajouter ou remplacer :

- `favicon.ico`
- le dossier `icons/`, notamment les fichiers `lts-*-v05810.png`

Aucune modification de `Code.gs` ni du Google Sheets n’est requise.

## Commit conseillé

`LTS v0.5.8.10 - evening fatigue graph and PWA icon refresh`

## Vérification fonctionnelle

1. Ouvrir `https://lts-beta.pages.dev/?v=05810` dans Samsung Internet.
2. Vérifier que le graphique Fatigue n’affiche pas la valeur du matin du jour courant tant que le check-in du soir n’existe pas.
3. Ouvrir directement `https://lts-beta.pages.dev/icons/lts-icon-192-v05810.png` et vérifier que l’icône LTS bleue apparaît.

## Actualisation de l’icône Android

1. Supprimer uniquement l’ancien raccourci LTS de l’écran d’accueil.
2. Fermer complètement Samsung Internet et l’application LTS.
3. Rouvrir `https://lts-beta.pages.dev/?v=05810` dans Samsung Internet.
4. Recharger la page une fois.
5. Ajouter de nouveau la page à l’écran d’accueil.

Ne pas effacer les données du site : cela supprimerait la configuration API locale et les éventuelles données non synchronisées.
