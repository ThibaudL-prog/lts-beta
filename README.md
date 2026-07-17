# LTS Beta v0.5.6.15 — récupération multi-appareils corrigée

Cause :
- un téléphone pouvait conserver sa copie locale d’une semaine publiée ;
- un ancien statut de synchronisation ou une protection locale empêchait le remplacement ;
- la version publiée depuis le PC était bien dans Google Sheets mais n’apparaissait pas sur le téléphone.

Corrections :
- « Synchroniser maintenant » force la récupération distante lorsqu’aucune modification locale non publiée n’existe ;
- les anciens statuts `error` ou `pending` ne sont plus assimilés à une modification métier ;
- une vraie semaine en brouillon reste protégée ;
- les exécutions Athlète locales sont conservées par `sessionId` ;
- les marqueurs de publication de l’ancien appareil sont retirés lors de l’adoption de la version distante.

Aucun changement Apps Script n’est nécessaire.
