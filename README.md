# LTS Beta v0.5.6 — synchronisation automatique en arrière-plan

Ajouts :
- détection automatique des modifications locales ;
- synchronisation différée après 3,5 secondes ;
- aucune synchronisation pendant qu’un éditeur ou une fiche est ouvert ;
- reprise automatique au retour du réseau ;
- reprise lorsque l’application redevient visible ;
- indicateur discret en bas d’écran ;
- protection contre les doubles synchronisations ;
- protection contre les boucles créées par le chargement de l’instantané ;
- le bouton manuel reste disponible comme filet de sécurité.

Règle :
- les modifications locales sont envoyées avant le chargement final de Google Sheets ;
- les conflits ouverts bloquent la synchronisation automatique jusqu’à arbitrage.

Aucun changement Apps Script n’est requis.
