# LTS Beta v0.5.6.2 — prescriptions et check-ins corrigés

Corrections :
- le bouton « Enregistrer les modifications » fonctionne de nouveau ;
- l’ajout d’une prescription ne déclenche plus d’erreur sur une variable inexistante ;
- la modification d’une prescription utilise les bons identifiants dans le journal ;
- correction de « checkins is not defined » ;
- les variables check-ins et mensurations restent accessibles en cas d’échec réseau ;
- la détection automatique utilise `state.records.checkins` et `state.records.measurements` ;
- la file ne tente plus de parcourir `state.checkins` comme un tableau.

Aucun changement Apps Script n’est nécessaire.
