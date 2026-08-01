# LTS v0.5.8.12 — profil Athlète par thèmes et Top 5 Kilter par angle

## Changements
- Profil Athlète présenté comme le Suivi Coach avec les durées : 7 jours, 30 jours, Cycle, Tout.
- Trois thèmes Athlète : Tests & records, Lifestyle & santé, Mensurations.
- Aucun onglet Quotidien dans le Profil Athlète.
- Top 5 Kilterboard séparés en 20°, 30° et 40° dans Coach et Athlète.
- Les blocs Kilterboard sans angle ne sont pas inclus dans ces trois classements.

## Fichiers à remplacer
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`

Aucune modification de `Code.gs`, `api-client.js` ou Google Sheets.

## Commit conseillé
`LTS v0.5.8.12 - athlete profile tabs and Kilter flash tops by angle`

## Vérification
1. Ouvrir `https://lts-beta.pages.dev/?v=05812` dans Samsung Internet.
2. Recharger une fois, fermer complètement Samsung Internet et la PWA, puis rouvrir LTS.
3. Athlète → Profil : vérifier les 4 durées et les 3 thèmes.
4. Coach → Suivi → Tests & records : vérifier Salle, Kilter 20°, Kilter 30°, Kilter 40°.
5. Athlète → Profil → Tests & records : vérifier les mêmes quatre palmarès.
