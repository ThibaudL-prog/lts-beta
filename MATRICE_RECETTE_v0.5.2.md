# Recette impérative v0.5.2

## Publication Coach
1. Modifier une semaine puis la publier.
2. Vérifier le badge `Google Sheets`.
3. Vérifier une ligne dans CYCLES.
4. Vérifier une nouvelle version dans WEEKS.
5. Vérifier un conteneur par ligne dans SESSIONS.
6. Vérifier une prescription par ligne dans SESSION_BLOCKS et EXERCISE_PRESCRIPTIONS.

## Historique
1. Modifier la semaine publiée.
2. Republier.
3. Vérifier une version_no supérieure et un nouvel identifiant `-vN`.
4. Vérifier que l’ancienne version reste présente.
5. Republier sans nouvelle modification/version : la même version doit être remplacée sans doublon.

## Lecture Athlète
1. Ouvrir la PWA dans un navigateur privé ou sur un second appareil.
2. Configurer l’URL Apps Script.
3. Charger l’instantané.
4. Passer côté Athlète.
5. Vérifier la semaine, les créneaux et toutes les prescriptions.
6. Ouvrir une prescription et enregistrer une performance.

## Sécurité
1. Mettre write_enabled à FALSE.
2. Republier une semaine.
3. Vérifier badge `Erreur sync`, historique distant inchangé et erreur API_LOG.
4. Réactiver puis republier.
