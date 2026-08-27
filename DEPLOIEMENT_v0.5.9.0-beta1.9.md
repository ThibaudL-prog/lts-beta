# LTS v0.5.9.0-beta1.9 — Historique des tests et TEST_METRICS

Cette version remplace `v0.5.9.0-beta1.8`.

## Anomalies corrigées

### Doublon dans les graphiques de suivi

Un test synchronisé était conservé deux fois dans l'historique de la PWA :

- une fois comme saisie locale `Test Athlète` ;
- une fois comme retour distant `Tests Google Sheets`.

La feuille `TEST_RESULTS` ne contenait pourtant qu'une seule ligne. La fusion de l'historique se fait désormais par date et par métrique. Le même test n'affiche donc plus deux points identiques.

Les doublons déjà visibles disparaissent au premier rechargement de l'instantané Google Sheets. Aucune ligne de `TEST_RESULTS` ne doit être supprimée.

### Alimentation de TEST_METRICS

L'API écrivait uniquement dans `TEST_RESULTS`. Elle génère maintenant également la ligne correspondante dans `TEST_METRICS` avec :

- la métrique classante ;
- la valeur et l'unité ;
- les ratios de charge lorsque le poids de corps est disponible ;
- la charge totale supportée ;
- les valeurs dérivées des tests McGill ou running lorsqu'elles existent ;
- le niveau, le seuil et la version de règle lorsqu'un seuil compatible est présent ;
- le statut `CLASSIFIED`, `NOT_CLASSIFIED` ou `INVALID`.

La classification s'appuie sur les feuilles de référence du classeur, détectées par leurs en-têtes. Google Sheets reste ainsi la source de vérité pour les seuils.

Pour `FINGER_END_20_7_3`, la métrique reste `repetitions_valid` en `rep`, conformément au protocole continu corrigé dans la beta1.8.

### Rattrapage automatique

Au premier chargement après mise à jour, la PWA demande une reconstruction idempotente de `TEST_METRICS` à partir des lignes existantes de `TEST_RESULTS`.

Cela doit notamment créer les métriques correspondant aux tests déjà enregistrés le 24 août 2026, sans dupliquer leurs lignes `TEST_RESULTS`.

## Fichiers à publier

### Google Apps Script — à faire en premier

- remplacer le contenu de `Code.gs` ;
- enregistrer ;
- créer une nouvelle version du déploiement Web App ;
- conserver l'URL terminant par `/exec`.

### PWA

- `index.html` ;
- `api-client.js` ;
- `manifest.webmanifest` ;
- `service-worker.js`.

## Ordre de déploiement

1. Mettre à jour et redéployer `Code.gs`.
2. Publier les quatre fichiers PWA.
3. Ouvrir `https://lts-beta.pages.dev/?v=0590b19`.
4. Dans le centre de synchronisation, toucher `Synchroniser maintenant` une fois.
5. Revenir dans `Suivi`.

## Vérifications attendues

1. Dans `TEST_RESULTS`, conserver une seule ligne pour chacun des tests du jour.
2. Dans `TEST_METRICS`, vérifier l'apparition d'une ligne liée à chaque `test_result_id`.
3. Dans les graphiques `1RM traction` et `1RM dips`, vérifier qu'il ne reste que l'ancien résultat et le nouveau résultat, sans point identique supplémentaire.
4. Une nouvelle pression sur `Synchroniser maintenant` ne doit créer aucun doublon : les deux tables utilisent des identifiants stables et sont mises à jour par upsert.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.9`.

URL de contrôle :

`https://lts-beta.pages.dev/?v=0590b19`

Message de commit conseillé :

`LTS v0.5.9.0-beta1.9 - fix test history and metrics`
