# LTS v0.5.8.2 — remise en service de la PWA

## Objet de cette version

Cette version clôt la migration v0.5.8.1 et remet en service la synchronisation réelle.

Corrections principales :

- suppression contrôlée du verrou local hérité de v0.5.8.0/v0.5.8.1 ;
- test de connexion = `health` + `schema.audit` + chargement automatique de `snapshot` ;
- reconstruction des semaines, séances, prescriptions et résultats depuis Google Sheets ;
- prise en charge des lignes historiques ajoutées manuellement dans le schéma v0.5.8.1 ;
- affichage des règles de progression dans « Commentaire du Coach » ;
- affichage de la vraie séance du jour à partir de la date, et non du seul jour de semaine ;
- saisie des charges pour les exercices détaillés ;
- cotations d'escalade `INTERNAL` pour les couleurs et `FONT` pour les cotations françaises ;
- préservation des données locales non synchronisées pendant un rechargement distant ;
- import des check-ins et mensurations historiques sans les réécrire en doublon.

## État initial à conserver

Dans `API_CONFIG` :

```text
api_enabled       TRUE
write_enabled     FALSE
demo_data_enabled FALSE
```

Dans `SYS_SETTINGS` :

```text
active_athlete_id ath_lgrd_001
demo_mode         FALSE
```

## 1. Mettre à jour Apps Script

1. Ouvrir le Google Sheets LTS.
2. Ouvrir `Extensions → Apps Script`.
3. Remplacer entièrement `Code.gs` par le fichier `Code.gs` de cette version.
4. Vérifier que `appsscript.json` correspond au fichier fourni.
5. Enregistrer.
6. Ouvrir `Déployer → Gérer les déploiements`.
7. Modifier le déploiement Web actif.
8. Choisir `Nouvelle version`, puis déployer.
9. Conserver la même URL `/exec`.

Cette mise à jour ajoute notamment les catalogues de référence au snapshot et renforce l'audit avant ouverture de la synchronisation.

## 2. Déployer la PWA

Dans le dépôt GitHub relié à Cloudflare :

1. Remplacer `index.html`.
2. Remplacer `api-client.js`.
3. Commit recommandé :

```text
LTS v0.5.8.2 - unlock sync and load real planning
```

4. Pousser sur la branche déployée par Cloudflare.
5. Attendre la fin du déploiement Cloudflare Pages.

Les autres fichiers du dépôt restent inchangés.

## 3. Forcer le chargement de la nouvelle version sur le téléphone

1. Fermer complètement l'onglet ou la PWA.
2. Rouvrir `lts-beta.pages.dev`.
3. En cas d'ancien affichage, recharger la page ou ouvrir une fois :

```text
https://lts-beta.pages.dev/?v=0582
```

La v0.5.8.2 retire automatiquement l'ancien verrou sur cet appareil sans effacer les données locales.

## 4. Test en lecture seule

Laisser `write_enabled = FALSE`.

Dans l'espace Coach :

1. Appuyer sur `Tester la connexion`.
2. Le bouton exécute désormais les contrôles et charge automatiquement le planning.
3. Vérifier :
   - schéma valide ;
   - au moins une semaine Google Sheets ;
   - des séances et prescriptions chargées ;
   - absence de bannière « Migration verrouillée ».
4. Passer dans l'espace Athlète.
5. Ouvrir `Aujourd'hui`.
6. Pour le 31/07/2026, vérifier l'affichage de :
   - la routine matinale ;
   - la séance du soir avec Max Hang, tractions, dips et prévention.
7. Ouvrir les prescriptions et vérifier les commentaires du Coach.

Ne saisir aucune performance tant que ces contrôles ne sont pas validés.

## 5. Ouvrir les écritures

Après validation de la lecture :

1. Dans `API_CONFIG`, passer uniquement :

```text
write_enabled TRUE
```

2. Actualiser la PWA.
3. Appuyer de nouveau sur `Tester la connexion`.
4. La configuration locale mémorise alors que les écritures distantes sont disponibles.

## 6. Première écriture réelle

Ordre recommandé :

1. Saisir et valider la routine matinale du 31/07.
2. Vérifier immédiatement dans Google Sheets :
   - une nouvelle ligne dans `SESSION_EXECUTIONS` ;
   - les résultats détaillés dans `SET_RESULTS`.
3. Saisir ensuite la séance du soir prescription par prescription.
4. Vérifier `API_LOG` : chaque requête doit être `OK`.

En cas d'erreur, la PWA conserve les données localement dans la file de synchronisation.

## Retour arrière immédiat

En cas d'anomalie :

1. remettre `write_enabled = FALSE` ;
2. ne pas supprimer les données locales ;
3. conserver les lignes déjà écrites dans Google Sheets ;
4. redéployer la version précédente de la PWA si nécessaire.
