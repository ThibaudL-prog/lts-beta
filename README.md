# LTS Beta v0.5.6.8 — migration et nettoyage du stockage local

Cause :
- chaque version utilisait une nouvelle clé `lts-v…`;
- chaque clé contenait une copie complète de l’application;
- le navigateur mobile a atteint son quota local;
- `localStorage.setItem()` échouait avant la fermeture des éditeurs.

Corrections :
- clé permanente : `lts-current`;
- migration automatique depuis la dernière clé `lts-v…`;
- suppression ciblée des anciennes copies d’état;
- conservation de :
  - l’URL Apps Script;
  - la file de synchronisation;
  - les conflits;
  - les choix de synchronisation;
- nouvelle tentative automatique en cas de quota dépassé;
- les prochaines versions conserveront la même clé permanente.

Aucun changement Apps Script n’est nécessaire.
