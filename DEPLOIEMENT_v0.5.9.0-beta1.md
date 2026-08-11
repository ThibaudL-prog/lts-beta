# LTS v0.5.9.0-beta1

Cette version part de l'alpha3 validée.

## Fonction : Dupliquer une semaine côté Coach

Accès :
- `Coach → Semaine → Dupliquer une semaine`
- ou dans une semaine ouverte : `Dupliquer cette semaine`

La nouvelle semaine est toujours créée en `DRAFT`.

### Copié
- séances ;
- prescriptions ;
- ordre ;
- stimuli et paramètres ;
- consignes Coach ;
- paramètres sets / exercices / escalade / running.

### Jamais copié
- exécutions ;
- résultats Athlète ;
- RPE ou douleur réels ;
- check-ins ;
- références de synchronisation distante.

### Nouveaux identifiants
La copie génère immédiatement :
- nouveau `weekId` ;
- nouveaux `containerId` ;
- nouveaux `sessionId`.

À la publication, le mécanisme existant génère donc de nouvelles lignes et de nouveaux identifiants dans :
- `WEEKS`
- `SESSIONS`
- `SESSION_BLOCKS`
- `EXERCISE_PRESCRIPTIONS`
- `SESSION_TARGETS`

### S4 et S8
L'interface avertit lorsque la destination est :
- S4 = DELOAD
- S8 = TESTS

Le contenu peut être copié comme brouillon, mais doit être adapté avant publication.

## Déploiement

### Apps Script
La duplication elle-même n'exige pas de nouvelle route API.
Le `Code.gs` fourni ne change fonctionnellement pas, hormis le numéro de release.

### GitHub
Remplacer :
- `index.html`
- `api-client.js`
- `manifest.webmanifest`
- `service-worker.js`

Commit conseillé :
`LTS v0.5.9.0-beta1 - duplicate coach week`

## Test avec le cycle actuel

1. `Coach → Semaine`.
2. `Dupliquer une semaine`.
3. Source : S6.
4. Destination : S7.
5. Vérifier l'aperçu et la mention `0 résultat copié`.
6. `Créer comme brouillon`.
7. Dans S7, lancer `Vérifier la structure`.
8. Attendu : structure valide et 0 résultat.
9. Modifier une prescription de S7.
10. Vérifier que S6 n'a pas changé.
11. Ne publier S7 qu'après validation du planning.

La v0.5.9.0-alpha3 reste le point de retour arrière jusqu'à validation de cette bêta.
