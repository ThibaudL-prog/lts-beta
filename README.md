# LTS Beta v0.5.6.7 — normalisation du numéro de semaine

Cause corrigée :
- après synchronisation, `week.number` peut être une chaîne (`"1"`) ;
- les boutons transmettent un nombre (`1`) ;
- la comparaison stricte empêchait de retrouver la semaine ;
- l’exécution s’arrêtait avant la fermeture de l’éditeur.

Corrections :
- toutes les recherches du flux d’ajout utilisent `Number(x.number) === Number(n)` ;
- les identifiants de séance utilisent une comparaison par chaîne stable ;
- messages explicites si la semaine, la séance ou la prescription est introuvable ;
- protection `try/catch` autour de l’ajout.

Aucun changement Apps Script n’est nécessaire.
