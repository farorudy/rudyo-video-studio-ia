# Worker de montage Rudyo

Service Node.js autonome pour Railway Hobby. Next.js crée les tâches persistantes de façon atomique, puis réveille Railway avec un `POST /jobs` signé. Le worker conserve aussi le claim PostgreSQL `FOR UPDATE SKIP LOCKED`, afin qu’une tâche survive à un redémarrage ou à la mise en veille Serverless.

## Contrat et sécurité

- Entrées et sortie dans Vercel Blob privé, désignées uniquement par des clés internes.
- Aucun token Blob, mot de passe PostgreSQL ou secret dans `inputManifest`.
- Conteneur non-root, répertoire temporaire borné et nettoyé après chaque tentative.
- FFmpeg lancé sans shell, avec limites de taille, durée et timeout.
- Lease renouvelé par heartbeat. Un job dont le worker meurt redevient réclamable après expiration.
- Upload idempotent et succès transactionnel avec `FinalExport`.
- Échec définitif et remboursement traités dans une transaction PostgreSQL idempotente.

## Développement et tests

```bash
cd worker
npm ci --include=dev
npm test
npm run build
```

Le test média fabrique deux vidéos et une piste audio synthétiques, exécute le montage, puis contrôle avec FFprobe : MP4, H.264, AAC, `yuv420p`, dimensions et durée. Il ne contacte pas BytePlus. Les tests contrôlent aussi le claim concurrent, le lease, le backoff et les chemins de traversée.

## Construction du conteneur

```bash
docker build -t rudyo-montage-worker ./worker
docker run --rm --env-file worker/.env -p 8080:8080 rudyo-montage-worker
```

L’image Debian installe FFmpeg/FFprobe et s’exécute avec l’utilisateur `node`. Le healthcheck public `GET /health` ne renvoie jamais de secret. `POST /jobs` est protégé par HMAC, horodatage, nonce anti-rejeu, idempotence et limitation de fréquence.

## Variables obligatoires

Copier `.env.example` vers le gestionnaire de secrets de la plateforme, jamais dans Git :

- `DATABASE_URL` : même PostgreSQL que l’application, avec TLS.
- `BLOB_READ_WRITE_TOKEN` et `CLOUD_STORAGE_PREFIX` : même Blob privé que l’application.
- `WORKER_SHARED_SECRET` : au moins 32 caractères aléatoires, partagé avec `MONTAGE_WORKER_SECRET` côté Vercel.
- `MONTAGE_WORKER_ID` : identité d’instance facultative.
- `WORKER_MOCK_MODE=true` : obligatoire jusqu’à l’approbation explicite d’un appel Seedance payant.
- `APP_BASE_URL=https://rudyoai.com`.
- `MONTAGE_CONCURRENCY` et `MONTAGE_MAX_ATTEMPTS` : commencer à `1` et `3`.
- `MONTAGE_LEASE_SECONDS` / `MONTAGE_HEARTBEAT_SECONDS` : garder le heartbeat nettement inférieur au lease.
- Limites `MONTAGE_MAX_INPUT_BYTES`, `MONTAGE_MAX_OUTPUT_BYTES`, `MONTAGE_MAX_DURATION_SECONDS`, `MONTAGE_MAX_SCENES` et `MONTAGE_TEMP_DIR`.

`FFMPEG_PATH` et `FFPROBE_PATH` sont facultatifs et valent `ffmpeg` et `ffprobe`.

## Déploiement Railway autorisé

1. Exécuter `npx prisma migrate deploy` depuis une release contrôlée de l’application.
2. Créer un service Docker depuis la racine avec `RAILWAY_DOCKERFILE_PATH=Dockerfile.worker`; aucun volume permanent n’est requis.
3. Injecter les secrets ci-dessus. Ne pas les préfixer par `NEXT_PUBLIC_`.
4. Utiliser Railway Hobby, région Singapore (`asia-southeast1-eqsg3a`), une instance, Serverless, au maximum 2 vCPU et 2 Gio de RAM.
5. Exposer uniquement `GET /health` et `POST /jobs`. Le POST exige HMAC SHA-256, horodatage, nonce anti-rejeu et clé d’idempotence.
6. Vérifier `/health`, puis créer un export Rudyo et suivre `montage_claimed` / `montage_failed`.
7. Pour scaler, augmenter les réplicas; le claim PostgreSQL empêche un double traitement.

Rollback : arrêter les nouveaux workers, redéployer l’image précédente, puis laisser expirer les leases. Les jobs non terminés seront repris. Ne supprimer table ou enum qu’après avoir vidé la file et déployé une application qui ne les utilise plus.

## Observabilité

Créer des alertes sur : `/health` en 503, jobs `QUEUED/RETRYING` trop anciens, leases expirés répétés, taux de `FAILED/REFUNDED`, temps de rendu et espace temporaire. Les messages persistés et logs restent génériques afin de ne pas divulguer de chemins privés ou secrets.

Le worker publie également `WorkerHeartbeat` avec sa version, son état, la tâche courante, la disponibilité FFmpeg/PostgreSQL/Blob et l’espace temporaire. Il nettoie toutes les dix minutes les exécutions système expirées sous le préfixe UUID strict `system-tests/{testRunId}/`.
