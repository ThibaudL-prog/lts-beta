# LTS v0.5.9.0-alpha2

Cette version part de l'alpha1 validée.

## Nouveautés

### 1. Tractions / Dips : dernière séance comparable
Dans les cartes Athlète des protocoles :
- Tractions lestées
- Dips lestés
- Tractions strictes à RIR 2
- Dips stricts à RIR 2

L'application recherche la dernière séance ANTÉRIEURE du même protocole et affiche :
- la date ;
- toutes les séries réalisées ;
- charge ;
- répétitions ;
- RIR ;
- un rappel "Dernière fois" dans chaque série actuelle.

Une séance lestée n'est pas comparée à une séance PDC, et inversement.

### 2. Courbes interactives
Dans :
- Coach → Suivi
- Athlète → Profil

Chaque point peut être touché sur mobile ou sélectionné au clavier.
La carte affiche ensuite :
- la date exacte ;
- la performance correspondante.

Le sommeil est présenté en h/min et les métriques en secondes sont formatées en min/s lorsque nécessaire.

## Fichiers à remplacer dans GitHub
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`

`Code.gs` et `api-client.js` ne changent pas par rapport à l'alpha1.

## Commit conseillé
`LTS v0.5.9.0-alpha2 - previous upper body session and interactive charts`

## Test
1. Déployer les 3 fichiers GitHub.
2. Ouvrir `https://lts-beta.pages.dev/?v=0590a2`.
3. Recharger une fois.
4. Fermer Samsung Internet + PWA, puis rouvrir.
5. Ouvrir une carte Tractions et une carte Dips :
   - vérifier "Dernière séance comparable" ;
   - vérifier les valeurs de chaque série.
6. Coach → Suivi :
   - toucher plusieurs points de graphiques.
7. Athlète → Profil :
   - refaire le même test ;
   - vérifier que date et valeur apparaissent.
