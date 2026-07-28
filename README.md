# LTS v0.5.7.5 — RC2, persistance des résultats Athlète

Correctif critique :
- l’espace Athlète écrit désormais dans la semaine locale canonique ;
- une synchronisation Coach ne peut plus remplacer un résultat local non sécurisé ;
- les performances locales sont envoyées avant la première lecture distante lors d’une synchronisation manuelle ;
- les synchronisations concurrentes d’une même prescription sont dédupliquées ;
- les exécutions, séries, résultats de course et tentatives d’escalade sont reconstruits depuis Google Sheets ;
- les anciennes exécutions éventuellement stockées dans `remoteWeeks` sont migrées vers `weeks` ;
- un overlay local protège les résultats pendant le remplacement des plans par le snapshot distant.

`Code.gs` et le schéma Google Sheets restent inchangés.
