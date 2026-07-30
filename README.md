# LTS v0.5.8.1 — Schéma stimuli & exécutions, verrouillé

Cette version corrige le modèle avant l’import des réalisations réelles.

## Corrections principales
- `SESSION_EXECUTIONS` rattache chaque réalisé au parent `planned_session_id` et à la prescription `session_block_id`.
- `execution_scope = PRESCRIPTION`.
- `SESSION_TARGETS` est publié et relu avec le plan.
- les cibles peuvent être rattachées à une prescription (`session_block_id`, `target_scope`).
- le plan publie des identifiants valides de `REF_SESSION_TYPES` et `REF_EXERCISES`.
- les résultats de séries utilisent le véritable `exercise_prescription_id`.
- le snapshot récupère les cibles, prescriptions et exécutions par leurs relations.
- un diagnostic `schema.audit` vérifie le Google Sheets sans autoriser les écritures.
- la synchronisation reste verrouillée.

## Important
- cette version exige une mise à jour de `Code.gs` et un nouveau déploiement Apps Script ;
- `api_enabled` et `write_enabled` restent `FALSE` pendant la migration ;
- aucune réalisation réelle ne doit encore être ajoutée ;
- ne pas créer de release Stable.
