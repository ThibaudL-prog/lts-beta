# Déploiement LTS v0.5.0 — Google Sheets

## 1. Préparer le classeur

Importe `LTS_Core_Google_Sheets_v0.5.0_API.xlsx` dans Google Drive et ouvre-le avec Google Sheets.

## 2. Ajouter Apps Script

Dans le classeur :

1. Extensions → Apps Script.
2. Remplace le contenu de `Code.gs` par le fichier fourni.
3. Dans les paramètres du projet, active l’affichage du manifeste.
4. Remplace `appsscript.json` par le manifeste fourni.
5. Enregistre le projet.

## 3. Déployer l’API

1. Déployer → Nouveau déploiement.
2. Type : Application Web.
3. Exécuter en tant que : toi.
4. Accès : toute personne disposant du lien.
5. Autorise les permissions demandées.
6. Copie l’URL terminant par `/exec`.

## 4. Connecter la PWA

Dans l’espace Coach :

1. Colle l’URL dans le panneau Google Sheets.
2. Laisse `ath_demo_001` pendant les tests.
3. Clique sur « Tester la connexion ».
4. Clique sur « Charger l’instantané ».
5. Utilise « Envoyer check-ins et mensurations » pour tester les premières écritures.

## Limites v0.5.0

- Synchronisation manuelle.
- La planification locale n’est pas encore remplacée par la planification distante.
- Les check-ins et mensurations peuvent être envoyés.
- Les endpoints d’exécution sont prêts, mais leur envoi automatique depuis chaque carte sera ajouté en v0.5.1.
- Pas encore de file d’attente hors ligne ni de résolution de conflits.
