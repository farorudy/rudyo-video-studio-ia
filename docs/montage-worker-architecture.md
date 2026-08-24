# Architecture du montage final

```text
Next.js valide le projet, réserve les crédits et crée ClipWorkerJob + FinalExport
        |
        +-- POST /jobs signé HMAC --> Railway Serverless (réveil)
        |
Railway produit le MP4 simulé depuis photo + musique
      |
      v
QUEUED -> CLAIMED -> PREPARING -> RENDERING -> UPLOADING
   ^         |             heartbeat + lease                 |
   |         +-- crash : reprise après expiration -----------+
   |
RETRYING (backoff)                         SUCCEEDED -> téléchargement authentifié
   |
FAILED -> remboursement transactionnel -> REFUNDED
```

Le manifeste persistant contient l’ordre des scènes, leurs clés Blob privées, leurs durées, la musique originale, le format, la résolution, la transition, l’option de sous-titres et la clé de sortie. Il ne contient aucun secret ni URL publique temporaire.

Les clips sont normalisés à 30 fps et aux dimensions de sortie, assemblés, bouclés si nécessaire jusqu’à la durée de la musique, puis encodés en H.264/AAC, `yuv420p`, avec `faststart`. FFprobe valide chaque entrée et le résultat avant l’upload privé.

Limite actuelle : l’option de sous-titres est transportée dans le manifeste, mais aucun texte horodaté n’est produit par le parcours « clip simple ». Le worker n’invente donc pas de paroles. Une source de cues validée devra être ajoutée avant d’activer l’incrustation.

Le mode réel reste verrouillé par `REAL_SEEDANCE_APPROVAL_REQUIRED`. Il ne pourra appeler exclusivement BytePlus Seedance qu’après une nouvelle approbation explicite du coût. Le déploiement initial conserve obligatoirement `WORKER_MOCK_MODE=true`.
