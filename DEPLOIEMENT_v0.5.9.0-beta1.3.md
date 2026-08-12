# LTS v0.5.9.0-beta1.3 — Semaine locale orpheline

Base : v0.5.9.0-beta1.2.

## Cas corrigé
Une semaine supprimée manuellement dans Google Sheets peut rester dans le stockage local de la PWA.

Dans le cas actuel :
- Sheets contient 6 semaines ;
- S7 existe encore localement ;
- S7 bloque une nouvelle duplication S6 → S7 ;
- le diagnostic signale des erreurs `Locale S7 ... aucune prescription`.

## Correction
Une semaine absente de Google Sheets est maintenant marquée :
`Local uniquement`

Dans cette semaine, un bouton apparaît :
`Supprimer cette semaine locale`

### Sécurité
La suppression n'est autorisée que si :
- la semaine n'existe plus dans Google Sheets ;
- elle ne contient aucune exécution / aucun résultat local.

Cette action ne touche jamais Google Sheets.

## Déploiement
Pas besoin de redéployer Apps Script.

GitHub :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Commit :
`LTS v0.5.9.0-beta1.3 - delete orphan local week`

URL :
`https://lts-beta.pages.dev/?v=0590b13`

## Procédure
1. Déployer la beta1.3.
2. Coach → Semaine.
3. S7 doit afficher `Local uniquement`.
4. Ouvrir S7.
5. Appuyer sur `Supprimer cette semaine locale`.
6. Confirmer.
7. Revenir à Coach → Semaine : S7 doit être `Non créée`.
8. `Dupliquer une semaine`.
9. Source : S6.
10. Destination : S7.
11. `Créer comme brouillon`.
12. Vérifier la structure avant publication.
