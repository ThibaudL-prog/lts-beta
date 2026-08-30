# LTS v0.5.9.0-beta1.10 — Sélection des facteurs du cycle

Cette version remplace `v0.5.9.0-beta1.9` sans modifier les données existantes.

## Corrections

- Les boutons `Principal`, `Secondaire` et `Écarter` réagissent visuellement dès le toucher.
- Chaque carte affiche explicitement son état : `Principal`, `Secondaire` ou `Écarté`.
- Un seul facteur peut conserver le rôle principal.
- Plusieurs facteurs secondaires restent possibles.
- Les boutons possèdent une zone tactile de 48 px et un état accessible `aria-pressed`.
- Les facteurs proposés utilisent les derniers tests synchronisés au lieu des valeurs initiales du cycle 1.

Après synchronisation, les valeurs attendues sont notamment :

- force maximale des doigts : `+18 kg` sur 20 mm pendant 5 s ;
- endurance des doigts : `10 répétitions` continues en 7 s / 3 s ;
- force du haut du corps : tractions `+48 kg` et dips `+54 kg` ;
- endurance du haut du corps : `25 tractions` et `39 dips`.

Les niveaux `N…` restent issus de `TEST_METRICS` lorsque la classification correspondante existe dans Google Sheets.

## Google Apps Script

Aucune modification de `Code.gs` n’est nécessaire pour cette version. Conserver le déploiement Apps Script beta1.9 actuellement en service.

## Fichiers PWA à publier

Remplacer à la racine du dépôt :

- `index.html` ;
- `api-client.js` ;
- `manifest.webmanifest` ;
- `service-worker.js`.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.10 - fix cycle factor selection`

## Vérification

1. Attendre le déploiement Cloudflare Pages.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590b110`.
3. Vérifier le titre `LTS v0.5.9.0-beta1.10`.
4. Toucher `Synchroniser maintenant`.
5. Revenir dans `Coach → Cycle → + Nouveau cycle`.
6. Vérifier que la force maximale des doigts apparaît en bleu comme facteur principal.
7. Toucher `Secondaire` sur un autre facteur : la carte et le bouton doivent devenir verts.
8. Toucher `Principal` sur un autre facteur : l’ancien principal doit être automatiquement écarté.

Il ne faut ni recréer le cycle 1, ni supprimer de données locales, ni modifier Google Sheets.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.10`.

