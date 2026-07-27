# LTS v0.5.7.4 — Release Candidate

Cette version clôt le lot « Semaine → séance réelle → prescriptions → résultats ».

## Stabilisation
- diagnostic global en lecture seule dans le tableau de bord Coach ;
- contrôle des identifiants, rattachements, jours, créneaux et ordres ;
- détection des doublons entre semaines locales ;
- contrôle des dernières versions récupérées depuis Google Sheets ;
- visibilité sur les plans et résultats encore non synchronisés ;
- sauvegarde JSON accessible depuis le diagnostic ;
- numéro de version correct dans l’export JSON.

## Ordre publié
- les séances sont envoyées vers Google Sheets dans l’ordre lundi → dimanche ;
- pour un même jour : matin → midi → soir ;
- l’ordre des prescriptions est conservé ;
- la reconstruction distante reprend `priority_order` et `block_order`.

`Code.gs` et le contrat des feuilles Google Sheets ne sont pas modifiés.
