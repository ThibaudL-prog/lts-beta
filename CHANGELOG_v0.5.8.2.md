# Changelog — LTS v0.5.8.2

## Synchronisation
- Ancien verrou de migration retiré une fois par appareil.
- Connexion enrichie : health, audit et snapshot en une action.
- Chargement automatique au démarrage lorsque l'URL Apps Script est déjà configurée.
- Conservation des modifications locales non synchronisées lors d'un pull.

## Données distantes
- Reconstruction robuste des conteneurs et prescriptions créés directement dans Google Sheets.
- Ajout de `REF_EXERCISES` et autres références au snapshot.
- Import des check-ins et mensurations historiques.
- Protection contre la réécriture en doublon des données importées.

## Espace Athlète
- La vue Aujourd'hui filtre désormais par date exacte.
- La vue Semaine sélectionne la semaine calendaire courante.
- Affichage du commentaire Coach et des règles de progression.
- Saisie des charges réelles pour les exercices détaillés.
- Éditeur escalade : conservation du nom, de la cotation, des essais et du commentaire de chaque bloc.

## Résultats
- Max Hang : une répétition et durée réelle distincte.
- Charge supportée corrigée pour les tractions, dips et suspensions.
- Exercices génériques : charge externe conservée sans inventer la charge corporelle supportée.
- Escalade : `FONT` pour 4a–8c et `INTERNAL` pour les couleurs de salle.
