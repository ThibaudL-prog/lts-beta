# LTS v0.5.8.0 — Migration production verrouillée

Cette version n’est pas une version d’usage quotidien. Elle prépare le passage
de la base de recette à la base réelle.

## Effets au premier chargement sur chaque appareil
- suppression de l’état local DEMO ;
- suppression des files d’attente, conflits et forçages de recette ;
- remplacement de `ath_demo_001` par `ath_lgrd_001` ;
- conservation de l’URL Apps Script ;
- initialisation d’un socle réel sans semaine ni résultat fictif ;
- verrouillage total des lectures et écritures Google Sheets.

## Important
- `Code.gs` reste inchangé ;
- aucune purge Google Sheets n’est automatique ;
- ne pas créer de tag Stable pour cette version ;
- la synchronisation sera réactivée dans une version ultérieure après import.
