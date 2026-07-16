# LTS Beta v0.5.4.4 — conservation de la référence distante

Cause corrigée :
- `planSync` était remplacé par l’état `pending` avant le contrôle de conflit ;
- cette opération supprimait `remoteFingerprint` ;
- la PWA déclenchait alors un faux conflit « Référence distante absente ».

Correction :
- la référence distante est capturée avant le changement de statut ;
- elle est conservée pendant `pending`, `error` et `conflict` ;
- seuls les vrais changements distants déclenchent désormais un conflit.

Aucun changement Apps Script n’est requis.
