# LTS Beta v0.5.6.10 — fin des relances internes de synchronisation

Cause :
- les fonctions de synchronisation appelaient `save()`;
- chaque sauvegarde technique déclenchait un nouvel événement local;
- la synchronisation se reprogrammait elle-même en boucle.

Corrections :
- suppression des événements de changement local pendant toute synchronisation;
- distinction entre modification Coach et écriture technique;
- la programmation automatique ignore les sauvegardes internes;
- vérification finale avant toute relance;
- même protection appliquée au bouton « Synchroniser maintenant ».

Aucun changement Apps Script n’est nécessaire.
