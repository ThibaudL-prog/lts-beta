# LTS Beta v0.5.2 — synchronisation de la planification Coach

Ajouts :
- publication du cycle actif et de la semaine dans Google Sheets ;
- version immuable de chaque publication (`weekId-vN`) ;
- synchronisation des conteneurs de séances ;
- synchronisation des prescriptions ;
- badge de publication côté Coach ;
- reconstruction des semaines publiées depuis l’instantané Google Sheets ;
- affichage de la planification distante côté Athlète ;
- historique conservé : une nouvelle publication crée une nouvelle version ;
- une réémission de la même version remplace uniquement cette version.

Déploiement :
1. Remplacer les fichiers du dépôt GitHub.
2. Remplacer `Code.gs` dans Apps Script.
3. Déployer une nouvelle version du déploiement existant.
4. Conserver l’URL `/exec`.
