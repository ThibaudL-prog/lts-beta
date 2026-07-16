# LTS Beta v0.5.4.1 — correctif de référence de conflit

- récupération de l’empreinte distante après chaque chargement d’instantané ;
- détection effective des modifications concurrentes ;
- blocage si aucune référence distante fiable n’est disponible ;
- `SESSIONS.planned_duration_min` reste la somme des prescriptions du conteneur ;
- la durée individuelle reste dans `SESSION_BLOCKS.duration_target_min`.

Aucun changement Apps Script n’est nécessaire.
