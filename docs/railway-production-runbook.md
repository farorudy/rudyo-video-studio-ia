# Worker Railway de production

Configuration autorisée pour le service de création Rudyo :

- plan Railway Hobby ;
- région Southeast Asia — Singapore (`asia-southeast1-eqsg3a`) ;
- une seule instance ;
- Serverless activé ;
- maximum 2 vCPU et 2 Go de RAM ;
- alerte de consommation à 10 USD ;
- limite stricte à 15 USD ;
- aucun volume persistant ;
- `WORKER_MOCK_MODE=true` tant qu’un appel Seedance payant n’a pas été approuvé.

Le build part de la racine avec `Dockerfile.worker`. Les secrets restent dans Railway et Vercel, jamais dans Git ni dans les logs.

Variables Railway : `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `WORKER_SHARED_SECRET`, `APP_BASE_URL`, `WORKER_MOCK_MODE`, `NODE_ENV`, `CLOUD_STORAGE_PREFIX`. `ARK_API_KEY` ou `BYTEPLUS_ARK_API_KEY` reste inutilisé en mode simulé.

Variables Vercel : `MONTAGE_WORKER_URL`, `MONTAGE_WORKER_SECRET`.

Après déploiement : vérifier `/health`, la région, les limites, le mode simulé et la création d’un MP4. Ne passer jamais `WORKER_MOCK_MODE` à `false` sans approbation distincte.
