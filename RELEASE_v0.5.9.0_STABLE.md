# LTS v0.5.9.0 — STABLE

Version stable issue des versions alpha1, alpha2, alpha3 et beta1 validées en usage réel.

## Contenu
- Sommeil en heures + minutes.
- Durées lisibles.
- Check hebdomadaire automatique le dimanche.
- Dernière séance comparable Tractions / Dips.
- Graphiques interactifs Coach et Athlète.
- Vélo : distance + durée + vitesse moyenne.
- Duplication d'une semaine côté Coach en brouillon, sans copier résultats/exécutions/check-ins.

## Déploiement
Apps Script : `Code.gs` uniquement pour aligner le numéro de release.
GitHub :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Commit conseillé :
`LTS v0.5.9.0 stable`

URL de contrôle :
`https://lts-beta.pages.dev/?v=0590`

Après déploiement, vérifier :
1. version v0.5.9.0 ;
2. sauvegarde d'un check-in ;
3. graphique interactif ;
4. accès à `Dupliquer une semaine` ;
5. files d'attente / conflits à 0.
