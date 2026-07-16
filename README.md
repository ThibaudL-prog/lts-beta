# LTS Beta v0.5.5.2 — nettoyage des éléments de file obsolètes

Correction :
- les opérations déjà synchronisées sont retirées automatiquement de la file ;
- les publications dont la semaine est déjà `synced` sont supprimées ;
- les exécutions déjà synchronisées sont supprimées ;
- les entrées sans entité locale correspondante sont supprimées ;
- nettoyage avant l’affichage, avant la synchronisation et après la synchronisation.

Aucun changement Apps Script n’est nécessaire.
