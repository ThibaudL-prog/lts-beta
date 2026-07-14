# LTS Beta v0.5.0.1 — correctif de démarrage

Cause corrigée :
- le tableau de bord Coach appelait `renderApiPanel()` avant le chargement de `api-client.js` ;
- l’application tombait donc systématiquement sur l’écran « LTS n’a pas pu démarrer ».

Correctifs :
- chargement de `api-client.js` avant le script principal ;
- panneau de secours si le module API est absent ;
- conservation de toutes les fonctions de la v0.5.0.
