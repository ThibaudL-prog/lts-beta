# LTS v0.5.9.0-beta1.6 — Prescriptions escalade et échauffements

Cette version remplace la bêta `v0.5.9.0-beta1.5` pour la partie PWA.

## Fichiers à publier

- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

`Code.gs` et le schéma Google Sheets restent inchangés : les nouvelles propriétés sont conservées dans les objets JSON déjà synchronisés, tandis que les valeurs canoniques continuent d’alimenter les colonnes existantes de `PLAN_EXERCISE_PRESCRIPTIONS` et `CLIMBING_ATTEMPTS`.

## Corrections livrées

### Prescriptions escalade, exercice par exercice

- Toutes les cartes escalade utilisent les exercices actifs de `REF_EXERCISES` : libre, bloc maximal, technique, Kilterboard, coordination, vitesse et précision.
- Pour chaque exercice, le Coach choisit exclusivement :
  - un temps total en minutes ; ou
  - une quantité imposée, exprimée en blocs ou en essais.
- Une récupération facultative en secondes peut être définie entre les blocs ou les essais.
- Un commentaire Coach propre à chaque exercice est visible par l’Athlète.
- Le Coach décide explicitement si l’Athlète peut effectuer un relevé bloc par bloc.
- Si le relevé est désactivé, la prescription reste lisible et la séance peut être validée sans créer de bloc réalisé.
- Si le relevé est activé, l’Athlète ajoute uniquement les blocs réellement grimpés ; la PWA ne génère plus une longue liste vide à faire défiler.
- Les relevés synchronisés portent l’identifiant et le nom de l’exercice afin de restaurer leur regroupement après rechargement du Sheets.
- Les anciennes séances escalade restent compatibles et conservent leur capacité de saisie historique.

### Commentaires Coach

- Chaque prescription LTS possède désormais un commentaire Coach global.
- Chaque exercice choisi dans `REF_EXERCISES` possède aussi son commentaire propre.
- Les commentaires sont affichés dans les vues Athlète pour les séances structurées, running, gainage, mobilité, souplesse, prévention, jambes, calisthénie et escalade.

### Échauffement de chaque séance

- L’échauffement est attaché à la séance réelle qui regroupe les prescriptions, et non répété dans chaque prescription.
- Le Coach peut conserver le choix automatique ou sélectionner une typologie prédéfinie.
- Douze protocoles sont fournis : général, escalade, force des doigts, haut du corps, jambes force, jambes puissance, running endurance, running qualitatif, gainage/mobilité, souplesse, prévention et calisthénie.
- Le mode automatique choisit le protocole à partir de la première prescription de la séance.
- Le Coach peut ajouter une précision facultative au protocole.
- L’Athlète voit un résumé sur sa carte puis le protocole complet avant d’ouvrir la prescription.
- L’échauffement est strictement en lecture seule : aucune case, mesure ou validation n’est demandée à l’Athlète.
- Le protocole complet est synchronisé dans `PLANNED_SESSIONS.coach_instructions` pour être restauré sur les autres appareils.

## Compatibilité Google Sheets

- Temps d’un exercice escalade : `duration_target_s`.
- Quantité imposée : `reps_target_min` et `reps_target_max`.
- Pause : `rest_seconds`.
- Configuration complète de l’exercice : `coach_notes` JSON.
- Configuration complète de la prescription : `SESSION_BLOCKS.notes` JSON.
- Échauffement de séance : `PLANNED_SESSIONS.coach_instructions` JSON.
- Regroupement des blocs réalisés par exercice : métadonnées JSON dans `CLIMBING_ATTEMPTS.notes`.

## Contrôles rapides après publication

1. Dans l’espace Coach, créer une séance d’escalade technique.
2. Choisir un exercice, sélectionner `Temps total`, saisir `20 min`, puis `30 s` de pause.
3. Choisir un second exercice, sélectionner `Quantité`, saisir `30 essais`, puis ajouter un commentaire Coach.
4. Régler le relevé Athlète sur `Non` pour le premier exercice et `Oui` pour le second.
5. Modifier la séance et choisir `Échauffement escalade progressif`.
6. Publier la semaine puis ouvrir l’espace Athlète.
7. Vérifier que l’échauffement apparaît en lecture seule avant la prescription.
8. Vérifier que seul l’exercice autorisé propose `Ajouter un bloc réalisé`.
9. Synchroniser, recharger le planning depuis Google Sheets et vérifier la conservation des objectifs, commentaires, pauses, droits de saisie et échauffement.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.6`. Après déploiement, ouvrir une fois :

`https://lts-beta.pages.dev/?v=0590b16`

Si un ancien écran reste affiché, fermer tous les onglets LTS puis rouvrir cette URL.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.6 - climbing prescriptions and read-only warmups`
