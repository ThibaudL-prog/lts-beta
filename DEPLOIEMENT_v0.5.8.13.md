# LTS v0.5.8.13 — correction du bouton Profil Athlète

## Problème corrigé

Dans la v0.5.8.12, le clic sur **Profil** rendait correctement l'écran Profil, puis appelait immédiatement `renderDaily()`.
L'application revenait donc aussitôt sur l'écran Quotidien, ce qui donnait l'impression que le bouton Profil ne fonctionnait plus.

La v0.5.8.13 supprime cet appel parasite.

## Fichiers à remplacer dans GitHub

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`

Aucune modification de `Code.gs`, `api-client.js` ou Google Sheets.

## Commit conseillé

`LTS v0.5.8.13 - fix athlete profile navigation`

## Vérification

1. Attendre le déploiement Cloudflare.
2. Ouvrir `https://lts-beta.pages.dev/?v=05813`.
3. Recharger une fois.
4. Fermer complètement la PWA.
5. La rouvrir depuis son icône.
6. Passer côté Athlète et appuyer sur **Profil**.
7. Vérifier que l'écran reste sur Profil et que les boutons de durée et de thème fonctionnent.
