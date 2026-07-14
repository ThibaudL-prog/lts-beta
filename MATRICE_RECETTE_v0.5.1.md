# Recette impérative v0.5.1

1. Série de force : enregistrer puis vérifier SESSION_EXECUTIONS et SET_RESULTS.
2. Running : vérifier distance en mètres, temps en secondes, vitesse et allure.
3. Escalade : vérifier CLIMBING_ATTEMPTS, statut flash/réussi/non réussi et essais.
4. Exercice de prévention : vérifier SET_RESULTS.
5. Modifier une séance déjà synchronisée : les lignes doivent être mises à jour/remplacées, pas dupliquées.
6. Passer write_enabled à FALSE : la saisie doit rester locale avec badge Erreur sync et aucune ligne métier distante.
7. Réactiver write_enabled puis rouvrir/modifier/enregistrer la séance : badge Synchronisée.
8. Vérifier API_LOG pour execution.upsert, sets.replace, running.upsert et climbing.replace.
