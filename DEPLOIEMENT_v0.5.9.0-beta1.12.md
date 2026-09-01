# LTS v0.5.9.0-beta1.12 — Continuité complète au changement de cycle

Cette version cumulative remplace directement `v0.5.9.0-beta1.10`. Il n'est pas nécessaire d'installer `beta1.11` auparavant. Elle ne supprime ni le cycle 2, ni sa semaine 1, ni les données déjà présentes dans Google Sheets.

## Corrections cumulatives

- Les check-ins sont associés au jour civil du téléphone ; le check-in du matin est restauré et celui du soir reste saisissable.
- Les dix mensurations et fréquences cardiaques prévues restent obligatoires chaque dimanche.
- Les séances publiées restent visibles et saisissables pendant le passage d'un cycle à l'autre.
- Une semaine sans dates locales récupère automatiquement les dates calculées depuis le début du cycle ; `Athlète → Aujourd'hui` n'est donc plus vide.
- Les derniers résultats et niveaux viennent de `TEST_RESULTS` et `TEST_METRICS`, et non des valeurs initiales du cycle 1.
- Les records flash en salle et sur Kilterboard 20°, 30° et 40° utilisent aussi les semaines archivées.
- Les performances quotidiennes des cycles archivés restent dans l'historique.
- Une lecture Google Sheets incomplète ne remplace plus un planning local complet.
- La sélection des facteurs de cycle de beta1.10 est conservée.

## 1. Google Apps Script

1. Remplacer le contenu de `Code.gs`.
2. Enregistrer.
3. Modifier le déploiement Web App existant et choisir **Nouvelle version**.
4. Conserver la même URL `/exec` et les mêmes paramètres d'accès.

Description conseillée :

`LTS v0.5.9.0-beta1.12`

## 2. Fichiers PWA

Remplacer à la racine du dépôt :

- `index.html` ;
- `api-client.js` ;
- `manifest.webmanifest` ;
- `service-worker.js`.

Message de commit conseillé :

`LTS v0.5.9.0-beta1.12 - cycle transition dashboard today and flash history`

## 3. Vérification

1. Attendre le déploiement Cloudflare Pages.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590b112`.
3. Vérifier le titre `LTS v0.5.9.0-beta1.12`.
4. Toucher une fois **Synchroniser maintenant**.
5. Vérifier dans **Coach → Accueil** que les derniers tests affichent les valeurs de fin du cycle 1.
6. Vérifier dans **Athlète → Aujourd'hui** que les séances publiées du jour apparaissent.
7. Vérifier dans **Athlète → Profil → Tests & records** que les records flash antérieurs sont revenus.
8. Vérifier l'état `À jour`, avec `En attente : 0`, `Conflits : 0` et `Non synchronisés : 0`.

Il ne faut pas recréer le cycle 2 ou la semaine 1, ressaisir les tests, vider les données du site ni désinstaller la PWA.

## Cache PWA

Le cache passe à `lts-pwa-v0.5.9.0-beta1.12`.
