# LTS Beta v0.5.6.9 — protection après publication

Cause :
- après `plan.publish`, la synchronisation automatique rechargeait immédiatement un snapshot ;
- Google Sheets pouvait encore renvoyer momentanément le contenu précédent pour la même version ;
- la copie Coach fraîchement publiée était alors remplacée à l’écran.

Corrections :
- une publication confirmée est protégée pendant 2 minutes ;
- un snapshot de même version ne remplace pas cette copie fraîche ;
- une version distante plus ancienne ne peut jamais écraser une version locale plus récente ;
- une version distante réellement supérieure reste prioritaire ;
- « Utiliser distant » force toujours le remplacement demandé par le Coach.

Aucun changement Apps Script n’est nécessaire.
