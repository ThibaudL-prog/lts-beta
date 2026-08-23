# LTS v0.5.9.0-beta1.8 — Correction du test Density 20 mm 7/3

Cette version remplace `v0.5.9.0-beta1.7`.

## Fichiers à publier

### PWA

- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

### Google Apps Script

- `Code.gs`

`Code.gs` change dans cette version. Après avoir remplacé son contenu, créer une nouvelle version du déploiement Web App puis conserver l’URL `/exec` dans la configuration de la PWA.

Le classeur ne nécessite aucune nouvelle feuille ni colonne : le test corrigé utilise la colonne existante `repetitions_valid` de `TEST_RESULTS`.

## Correction prioritaire — Density 20 mm 7/3

Le test et l’exercice d’entraînement sont maintenant explicitement séparés :

- exercice d’entraînement : séries/tours structurés, par exemple `4 × 6`, avec récupération entre les séries ;
- test officiel `FINGER_END_20_7_3` : répétitions continues de `7 s` de suspension et `3 s` de repos, sans aucune pause supplémentaire ni regroupement en tours.

La PWA :

- affiche `Répétitions de 7 s entièrement validées` ;
- impose un nombre entier ;
- affiche l’historique en `reps` ;
- écrit le résultat dans `TEST_RESULTS.repetitions_valid` ;
- continue de lire provisoirement `completed_tours` pour récupérer l’ancien résultat mal étiqueté ;
- migre automatiquement les brouillons S8 déjà créés sans supprimer les autres modifications du Coach.

Le résultat historique de `7` correspond donc à `7 répétitions continues`, et non à `7 tours de 6 répétitions`.

### Alignement recommandé du Google Sheets

Dans la ligne de définition correspondant à `FINGER_END_20_7_3` :

- `raw_metric_code` : `repetitions_valid` ;
- `classifying_metric_code` : `repetitions_valid` ;
- `default_unit` : `rep` ;
- description : `Répétitions continues 7 s / 3 s sans pause supplémentaire`.

Dans les seuils associés à ce test, remplacer uniquement :

- `metric_code = completed_tours` par `metric_code = repetitions_valid` ;
- `unit_code = tour` par `unit_code = rep`.

Les bornes numériques ne sont pas modifiées.

Dans l’ancien résultat réel égal à `7` :

- renseigner `repetitions_valid = 7` ;
- vider `completed_tours` ;
- conserver `raw_value = 7` ;
- remplacer `raw_unit` par `rep`.

## Corrections livrées

### Espace Athlète — semaine jour par jour

- L’onglet `Semaine` utilise les mêmes sept boutons `Lun` à `Dim` que l’éditeur Coach.
- Un seul jour est ouvert à la fois.
- Le jour courant est sélectionné automatiquement lorsqu’il appartient à la semaine publiée.
- Chaque bouton indique le nombre de séances et la progression du jour.
- Les cartes de séance, échauffements, prescriptions et saisies Athlète restent inchangés à l’intérieur du jour actif.

### Création et conservation des cycles

- L’onglet `Cycle` est maintenant accessible dans la navigation Coach mobile.
- Le Coach peut créer un nouveau cycle même lorsqu’un cycle existe déjà.
- Le choix du facteur principal reste complet même si les anciens tests ne couvrent pas encore la puissance haute, l’escalade ou le gainage.
- Le cycle précédent et ses semaines sont archivés localement avant l’ouverture du nouveau cycle.
- Chaque cycle reçoit un identifiant stable distinct.
- Le brouillon est écrit dans `CYCLES`; sa validation utilise `cycle.activate` et marque l’ancien cycle actif comme terminé.
- Les semaines distantes sont filtrées par `cycle_id` afin que les semaines de deux cycles portant le même numéro ne soient plus mélangées.
- Les contrôles de conflit d’une semaine utilisent également son `cycle_id`.
- Un nouveau brouillon local en attente ou en erreur de synchronisation n’est pas remplacé par l’ancien cycle lors d’une lecture distante.

### Générateur de semaine 8

La proposition de semaine 8 affiche des cases à cocher, présélectionnées selon les contenus réellement planifiés dans les semaines 1 à 7 :

- Max Hang 20 mm — 5 s ;
- Density 20 mm — 7 s / 3 s continu, résultat exprimé en répétitions ;
- 1RM tractions et dips ;
- max reps tractions et dips ;
- Power Slap et pompe pliométrique uniquement si la puissance du haut du corps appartenait au cycle ;
- Kilterboard max flash 30° et 40° ;
- batterie McGill : planche latérale, fléchisseurs et Sorensen.

Exclusions appliquées :

- aucun test running dans la semaine 8 ;
- aucun test de force ou de puissance des jambes ;
- aucun test de calisthénie.

Les dernières prescriptions `Jambes — force` et `Jambes — puissance` peuvent être recopiées comme séances ordinaires de suivi. Elles ne créent aucun résultat de test ni facteur limitant.

La semaine générée reste un brouillon : le Coach peut déplacer, modifier ou supprimer chaque carte avant publication.

### Saisie et synchronisation des tests

- Chaque carte de test possède ses champs propres, son protocole, son échauffement et le résultat précédent lorsqu’il existe.
- L’Athlète peut enregistrer un test valide, invalide ou non réalisé, ainsi que le RPE, la douleur et un commentaire.
- Les mesures valides alimentent l’historique local.
- Les résultats sont synchronisés dans `TEST_RESULTS` via la nouvelle action `tests.upsert`.
- Les séances Kilter flash continuent d’utiliser les cartes escalade et `CLIMBING_ATTEMPTS`, ce qui conserve le relevé bloc par bloc et les records flash par angle.
- La PWA n’interprète pas automatiquement le résultat : la décision finale reste celle du Coach.

## Contrôles rapides après publication

1. Ouvrir l’espace Coach sur mobile et vérifier les quatre onglets `Accueil`, `Cycle`, `Semaine`, `Suivi`.
2. Dans `Cycle`, ouvrir `Nouveau cycle`, remplir l’arbitrage puis créer un brouillon.
3. Valider le cycle et vérifier qu’il apparaît dans la feuille `CYCLES` avec le statut `active`.
4. Créer les semaines jusqu’à S8, puis ouvrir la proposition de tests.
5. Vérifier que la puissance haute n’est proposée automatiquement que si elle a été planifiée dans le cycle.
6. Vérifier qu’aucun test jambes ou running n’est généré.
7. Publier S8, passer dans l’espace Athlète et vérifier la navigation par jour.
8. Ouvrir le test Density, vérifier que le champ demande des répétitions entières, saisir une valeur de contrôle puis vérifier `TEST_RESULTS.repetitions_valid`.
9. Ouvrir une séance Kilter flash et vérifier le relevé des blocs à l’angle prévu.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.8`.

Après déploiement, ouvrir une fois :

`https://lts-beta.pages.dev/?v=0590b18`

Si une ancienne interface reste visible, fermer tous les onglets LTS puis rouvrir cette URL.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.8 - fix continuous finger density test`
