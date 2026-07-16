# LTS Beta v0.5.6.5 — enregistrements non bloquants

Correction principale :
- `save()` écrit d’abord les données locales puis rend immédiatement la main à l’interface ;
- la notification de synchronisation est déclenchée ensuite, de manière asynchrone ;
- une erreur de synchronisation ne peut plus empêcher la fermeture d’une fenêtre ;
- le gestionnaire de synchronisation automatique est protégé par un `try/catch` ;
- lors d’une publication, la fenêtre se ferme avant le démarrage de l’envoi Google Sheets.

Cela concerne notamment :
- Enregistrer une prescription ;
- Enregistrer les modifications ;
- Enregistrer une semaine ;
- Publier une semaine ;
- les autres formulaires utilisant la fonction commune `save()`.

Aucun changement Apps Script n’est nécessaire.
