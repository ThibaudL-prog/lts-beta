# LTS Beta v0.5.6.1 — arrêt des boucles de synchronisation

Correction :
- maximum de 2 tentatives automatiques rapprochées ;
- délais progressifs de 15 s puis 45 s ;
- arrêt automatique après deux échecs ;
- message stable « Synchronisation en attente » ;
- reprise seulement après :
  - une nouvelle modification locale ;
  - un retour du réseau ;
  - un clic sur « Synchroniser maintenant » ;
- le retour au premier plan ne réveille plus une synchronisation suspendue ;
- une synchronisation réussie remet les compteurs d’échec à zéro.

Aucun changement Apps Script n’est nécessaire.
