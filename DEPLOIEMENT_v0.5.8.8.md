# LTS v0.5.8.8 — Installation PWA en mode application

## Objet

Cette version ajoute l'installation Android en mode `standalone` : lancement depuis une icône dédiée, sans barre d'adresse ni commandes Chrome.

## Fichiers à déployer sur GitHub / Cloudflare Pages

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- le dossier `icons/`

`api-client.js` et `Code.gs` ne comportent aucune modification fonctionnelle pour cette version. Ils sont inclus dans l'archive complète uniquement pour conserver un paquet autonome.

## Apps Script

Aucun redéploiement Apps Script n'est nécessaire.

## Déploiement

1. Copier les fichiers ci-dessus à la racine du dépôt GitHub.
2. Conserver le dossier `icons` et ses quatre images.
3. Commit conseillé : `LTS v0.5.8.8 - installable standalone PWA`.
4. Attendre la fin du déploiement Cloudflare Pages.
5. Ouvrir `https://lts-beta.pages.dev/?v=0588` dans Chrome.
6. Vérifier que l'application charge les données normalement.

## Installation Android

1. Supprimer l'ancien raccourci LTS de l'écran d'accueil.
2. Ouvrir l'URL stable `https://lts-beta.pages.dev/` dans Chrome.
3. Menu `⋮` puis `Installer l'application`.
4. Lancer LTS depuis la nouvelle icône.

En mode installé, la barre Chrome disparaît. La barre système Android (heure, batterie, notifications) reste visible, ce qui est le comportement attendu du mode `standalone`.

## Mise à jour

Le service worker utilise une stratégie réseau prioritaire pour `index.html`, `api-client.js` et le manifeste. Les nouvelles versions restent donc récupérées en ligne tout en conservant un démarrage hors connexion de l'interface.
