# LTS Beta v0.5.6.6 — identifiants stables dans les éditeurs

Corrections :
- l’ajout d’une prescription transporte explicitement l’identifiant de la séance cible ;
- il ne dépend plus de `state.pendingContainerId` après une synchronisation ;
- la modification utilise `sessionId`, et non plus la position de la prescription dans un tableau ;
- les boutons utilisent `type="button"` ;
- les fenêtres disposent d’identifiants explicites ;
- les erreurs d’enregistrement sont désormais affichées au lieu de laisser un bouton apparemment inactif.

Aucun changement Apps Script n’est nécessaire.
