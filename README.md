# LTS Beta v0.5.7.0 — consolidation du modèle Séance → prescriptions

Base : v0.5.6.15 Stable Sync Baseline.

Cette version ne modifie ni Apps Script ni le moteur de synchronisation.

## Ajouts
- schéma local v0.5.7.0 ;
- migration idempotente des anciennes semaines ;
- identifiant stable pour chaque séance réelle ;
- identifiant stable pour chaque prescription ;
- rattachement réparé des prescriptions orphelines ;
- ordre préparé pour les séances et prescriptions ;
- conservation des exécutions Athlète ;
- audit visuel de la structure par semaine ;
- validation structurelle obligatoire avant publication ;
- blocage des séances vides, identifiants dupliqués et prescriptions orphelines.

## Modèle consolidé
Semaine → séance réelle / créneau → plusieurs prescriptions → résultats.

## Déploiement
À tester uniquement sur la branche `dev-v0.5.7-session-structure`.
Ne pas modifier `main` et ne pas redéployer Apps Script.
