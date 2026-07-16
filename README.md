# LTS Beta v0.5.6.14 — réconciliation du statut de synchronisation

Correction :
- après le chargement final de Google Sheets, les semaines publiées sont rapprochées de leur version distante ;
- si la version distante est identique ou plus récente et qu’aucun conflit n’est ouvert, la semaine passe à `synced` ;
- le compteur « Non synchronisés » retombe à 0 ;
- le statut global ne peut plus afficher « À jour » si un élément reste réellement non synchronisé ;
- les anciens statuts `error` ou `pending` sont nettoyés après une synchronisation confirmée.

Aucun changement Apps Script n’est nécessaire.
