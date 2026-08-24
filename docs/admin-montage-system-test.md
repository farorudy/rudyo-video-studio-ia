# Test administrateur du parcours de montage

La page `/admin/system-tests` lance un parcours non facturable avec le PostgreSQL, le Blob privé et le worker réellement configurés. Elle ne remplace que Seedance par trois vidéos, une image et une piste WAV synthétiques produites côté serveur.

## Activation

L’application exige simultanément :

```dotenv
E2E_MONTAGE_TEST_ENABLED=true
E2E_TEST_RETENTION_HOURS=24
MONTAGE_WORKER_OFFLINE_SECONDS=90
```

Laisser `E2E_MONTAGE_TEST_ENABLED=false` hors d’une fenêtre de diagnostic. L’administrateur doit être dans `ADMIN_EMAILS`, disposer d’une session admin valide et posséder un compte Rudyo vérifié avec la même adresse électronique.

Le lancement exige aussi une origine identique, un jeton CSRF lié à la session, une clé d’idempotence et respecte une limite de deux lancements par heure et par administrateur.

## Garanties de non-facturation

- Projet et tâches marqués `SYSTEM_TEST` / `NON_BILLABLE` / `TEST_FIXTURE`.
- Aucun appel à `startSceneGeneration`, au client BytePlus ou aux fonctions de réservation de crédits.
- Montant estimé à zéro et absence obligatoire de `creditReservationId`.
- Les fonctions de facturation refusent explicitement les marqueurs système.
- Le worker compare `balanceBefore` et `balanceAfter`, recherche toute réservation liée au projet et vérifie les trois tâches avant de déclarer le test réussi.

## Déroulement

1. Ouvrir `/admin`, se connecter, puis choisir « Tests système ».
2. Vérifier que le worker, FFmpeg, PostgreSQL et Blob sont disponibles.
3. Lancer « Test normal ».
4. Suivre la file réelle jusqu’à `SUCCEEDED`.
5. Contrôler les diagnostics FFprobe et `solde avant = solde après`.
6. Lire puis télécharger le MP4 avec le lien temporaire de quinze minutes.

Les autres scénarios utilisent exclusivement les mêmes fixtures contrôlées : vidéo invalide, musique supprimée, interruption simulée avant rendu, lease expiré, erreur de stockage temporaire, double claim et rejeu idempotent.

## Nettoyage

Le worker recherche périodiquement les exécutions expirées. Il n’accepte que des identifiants UUID et supprime uniquement le préfixe exact `system-tests/{testRunId}/`. Il supprime ensuite le projet dont `source=SYSTEM_TEST` et `billingMode=NON_BILLABLE`, puis conserve le diagnostic minimal dans `SystemTestRun` avec l’état `CLEANED`.

## Validation locale

```bash
npm run test:security
cd worker
npm test
npm run build
```

Un vrai test local PostgreSQL + Blob isolé + conteneur nécessite Docker et un token Blob de test. Le test de production exige en plus la migration appliquée et le worker externe redéployé. Ne pas présenter le parcours comme opérationnel avant la réussite visible de l’enchaînement complet sur la page administrateur.
