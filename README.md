# LTS Beta v0.5.1 — synchronisation des performances

Cette version synchronise automatiquement les saisies Athlète après leur sauvegarde locale.

Types couverts :
- séries de force, doigts et endurance ;
- exercices, prévention, mobilité, souplesse et gainage ;
- séances génériques ;
- running ;
- escalade et Kilterboard.

Sécurité :
- la saisie est toujours conservée localement avant l’appel distant ;
- statut visible : Local, Envoi…, Synchronisée ou Erreur sync ;
- identifiants déterministes pour éviter les doublons ;
- `write_enabled` reste appliqué par Apps Script ;
- le bouton général d’envoi des check-ins et mensurations est conservé.

Déploiement :
- remplacer les fichiers GitHub par cette version ;
- remplacer `Code.gs` dans Apps Script puis créer une nouvelle version du déploiement existant ;
- conserver la même URL `/exec`.
