# LTS v0.5.8.11 — Top 5 des blocs flashés

## Évolution

Cette version ajoute deux palmarès dans :

- **Coach → Suivi → Tests & records**
- **Athlète → Profil**

Les palmarès affichés sont :

- **Top 5 flash — Salle**
- **Top 5 flash — Kilterboard**

Chaque ligne indique la cotation, le bloc, la séance, la date et, pour le Kilterboard, l’angle.

Le classement est calculé uniquement à partir des blocs marqués **Flash = Oui** dans les séances réellement enregistrées.

### Règles de classement

- Kilterboard : cotations Fontainebleau.
- Salle : le système de cotation le plus renseigné est utilisé automatiquement (Fontainebleau ou couleurs).
- Les cotations incompatibles ou non reconnues ne sont pas mélangées.
- À cotation égale, la performance la plus récente passe devant.
- Le Top 5 porte sur l’historique complet et ne dépend pas du filtre 7/30 jours.

## Fichiers à déployer

Remplacer à la racine du dépôt :

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`

`api-client.js` est fourni dans l’archive complète mais ne contient pas de modification fonctionnelle dans cette version.

Aucune modification de `Code.gs` ou de Google Sheets n’est nécessaire.

## Commit conseillé

`LTS v0.5.8.11 - add top 5 flashed climbing records`

## Vérification

1. Attendre le déploiement Cloudflare.
2. Ouvrir une fois :
   `https://lts-beta.pages.dev/?v=05811`
3. Fermer puis rouvrir la PWA installée.
4. Contrôler :
   - Coach → Suivi → Tests & records
   - Athlète → Profil
5. Comparer les entrées affichées avec les lignes `FLASH` de `CLIMBING_ATTEMPTS`.

## Remarque

Un bloc sans cotation exploitable reste enregistré normalement, mais n’entre pas dans le classement.
