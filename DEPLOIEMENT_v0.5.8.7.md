# Déploiement LTS v0.5.8.7

## 1. Conserver les écritures fermées
Dans `API_CONFIG`, garder `write_enabled = FALSE` pendant le déploiement et le contrôle.

## 2. Mettre à jour Apps Script
1. Remplacer entièrement `Code.gs` par celui de cette archive.
2. Enregistrer.
3. `Déployer` → `Gérer les déploiements` → modifier le déploiement Web existant.
4. Choisir `Nouvelle version`, puis déployer.
5. Conserver la même URL `/exec`.

## 3. Mettre à jour la PWA
À la racine du dépôt GitHub, remplacer :
- `index.html`
- `api-client.js`

Commit conseillé :
`LTS v0.5.8.7 - exact bike entry and cycling charts`

## 4. Contrôles en lecture seule
1. Ouvrir `https://lts-beta.pages.dev/?v=0587`.
2. Coach → Réglages → Tester la connexion.
3. Coach → Suivi → Lifestyle & santé : vérifier le graphique `Vélo quotidien` et l’historique importé.
4. Athlète → Profil : vérifier la section `Activité quotidienne`.
5. Athlète → Quotidien → Soir : vérifier le champ numérique `Vélo quotidien`, avec saisie décimale.

## 5. Ouverture des écritures
N’activer `write_enabled = TRUE` qu’après validation de ces contrôles.
