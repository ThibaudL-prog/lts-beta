# LTS Beta v0.5.6.13 — stabilisation de la synchronisation des plans

Décision de stabilisation :
- suppression automatique des anciennes entrées `plan` bloquées ;
- arrêt des tentatives automatiques pour les plans ;
- aucune création de file en cas d’échec de publication d’une semaine ;
- publication d’un plan uniquement via :
  - « Publier » ;
  - « Synchroniser maintenant » ;
- erreur affichée directement et conservée dans le statut de la semaine ;
- la file hors ligne reste disponible pour les données Athlète.

Cette version privilégie la fiabilité et la lisibilité à l’automatisation.

Aucun changement Apps Script n’est nécessaire.
