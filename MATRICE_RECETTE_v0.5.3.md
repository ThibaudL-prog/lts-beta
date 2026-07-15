# Recette v0.5.3

1. Couper le réseau.
2. Enregistrer une séance Athlète.
3. Vérifier : donnée locale conservée, badge erreur/en attente, compteur +1.
4. Réactiver le réseau.
5. Vérifier la reprise automatique et le compteur à 0.
6. Vérifier l’écriture distante sans doublon.
7. Refaire avec une publication Coach.
8. Tester le bouton « Relancer maintenant ».
9. Mettre write_enabled à FALSE : l’élément reste en file avec l’erreur explicite.
10. Réactiver write_enabled puis relancer : l’élément disparaît de la file.
11. Ajouter plusieurs modifications à la même séance hors ligne : une seule entrée de file doit rester.
12. Fermer puis rouvrir la PWA : la file doit persister.
