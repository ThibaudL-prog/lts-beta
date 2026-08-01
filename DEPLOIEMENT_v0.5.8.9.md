# LTS v0.5.8.9 — restauration du check-in quotidien

## Objet

Cette version corrige l’écart entre les graphiques et la carte **Check quotidien** : lorsqu’un check-in du jour existe déjà dans Google Sheets, l’application recharge maintenant ses valeurs et affiche **✓ Validé**.

Corrections incluses :

- restauration du check-in matin du jour depuis `CHECKINS` ;
- restauration du check-in soir du jour depuis `CHECKINS` ;
- remplissage des champs correspondants dans l’interface ;
- lecture du champ humeur `mood_0_10` ;
- conservation de l’identifiant distant pour éviter un doublon lors d’une modification ultérieure ;
- réinitialisation des cartes au changement de journée ;
- cache PWA porté à `v0.5.8.9`.

Aucune modification de `Code.gs`, du manifeste, des icônes ou du schéma Google Sheets n’est nécessaire.

## Déploiement GitHub / Cloudflare

Remplacer uniquement à la racine du dépôt :

- `index.html`
- `api-client.js`
- `service-worker.js`

Commit conseillé :

`LTS v0.5.8.9 - restore daily check-in state from Sheets`

## Mise à jour sur le téléphone

1. Attendre la fin du déploiement Cloudflare.
2. Ouvrir une fois `https://lts-beta.pages.dev/?v=0589` dans Samsung Internet.
3. Fermer complètement l’application LTS installée.
4. La rouvrir depuis son icône.
5. Dans **Coach → Réglages**, lancer **Tester la connexion**.
6. Revenir dans **Athlète → Quotidien**.

Résultat attendu pour le 1er août 2026 :

- la carte **Matin** affiche `✓ Validé` ;
- les valeurs saisies dans Google Sheets sont visibles dans les champs ;
- la carte **Soir** reste `À remplir` tant qu’aucun check-in du soir n’existe pour cette date.
