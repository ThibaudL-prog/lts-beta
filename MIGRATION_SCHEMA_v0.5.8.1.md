# Migration Google Sheets — v0.5.8.1

## 1. Colonnes à ajouter

### SESSION_TARGETS
Ajouter à droite :
- `session_block_id`
- `target_scope`

### SESSION_EXECUTIONS
Ajouter à droite :
- `session_block_id`
- `execution_scope`

### REF_INTERFERENCE_RULES
Ajouter à droite :
- `source_stimulus_code`
- `target_stimulus_code`
- `same_day_allowed`

## 2. Nouvelle feuille
Créer `REF_LOAD_SCALES` avec les colonnes et données du fichier
`LTS_MIGRATION_SCHEMA_v0.5.8.1.xlsx`.

## 3. Référentiels
Utiliser les onglets du fichier de migration :
- `REF_QUALITIES_ADD`
- `REF_SESSION_TYPES`
- `REF_EXERCISES_ADD`
- `REF_STIMULI_REPLACE`
- `REF_RECOVERY_REPLACE`
- `REF_INTERFERENCE_REPLACE`
- `SYS_LISTS_ADD`

## 4. Corrections de la semaine 1
- `SESSIONS!D2:D7` devient `st_multi`.
- remplacer `SESSION_BLOCKS!C2:C13` avec l’onglet `WEEK1_FIXES`.
- vider les anciennes lignes de `SESSION_TARGETS`, puis coller `WEEK1_TARGETS`.

## 5. Configuration
Dans `API_CONFIG` :
- `schema_version = 0.5.8.1`
- `api_enabled = FALSE`
- `write_enabled = FALSE`
- `default_athlete_id = ath_lgrd_001`

## 6. Apps Script
Remplacer `Code.gs`, enregistrer, puis créer un nouveau déploiement de l’application Web.
Conserver l’accès identique à la version précédente.

## 7. Application
Déployer la branche `dev-v0.5.8.1-schema-stimuli`.
La synchronisation reste verrouillée.
Le bouton `Vérifier le schéma Google Sheets` utilise l’action de lecture seule `schema.audit`.
