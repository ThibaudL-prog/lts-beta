# LTS Beta v0.5.6.12 — reprise des plans en file corrigée

Cause :
- le chemin de reprise d’un plan en attente utilisait `previousPlanSync`
  et `knownRemoteFingerprint` sans les définir ;
- chaque tentative provoquait une erreur JavaScript ;
- la file restait à 1 et le compteur augmentait sans conflit visible.

Corrections :
- définition correcte du contexte de synchronisation ;
- conservation de l’empreinte distante connue ;
- reconstruction du payload depuis la semaine locale actuelle ;
- suppression de la référence de file après réussite ;
- reprise automatique de l’élément déjà bloqué.

Aucun changement Apps Script n’est nécessaire.
