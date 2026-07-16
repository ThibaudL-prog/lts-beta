# LTS Beta v0.5.4.2 — verrou des conflits dans la file

Correction :
- lorsqu’un conflit de semaine est détecté, toute publication en attente pour cette semaine est supprimée de la file ;
- la file de synchronisation effectue désormais le même contrôle de conflit avant `plan.publish` ;
- une opération bloquée pour conflit n’est plus relancée automatiquement ;
- aucune ligne de planification ne doit être écrite avant le choix explicite du Coach.

Aucun changement Apps Script n’est requis.
