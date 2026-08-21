# Studio Clip Seedance — guide d’installation

Le studio est disponible sur `/studio-clip-seedance`. Il conserve dans
PostgreSQL les projets, l’identité de l’artiste, les médias, les consentements,
les scènes, les tâches BytePlus, les variantes, les tokens et les budgets.

## Où placer `ARK_API_KEY`

La clé doit exister uniquement côté serveur.

- En local : créez `.env.local` à la racine du dossier `source` et ajoutez
  `ARK_API_KEY=votre_valeur_secrete`.
- Sur Vercel : ouvrez le projet Rudyo, puis **Settings → Environment Variables**,
  créez `ARK_API_KEY` pour Production et Preview, puis redéployez.
- Ne placez jamais cette valeur dans une variable commençant par `NEXT_PUBLIC_`.
- Ne commitez jamais `.env.local`.

```dotenv
ARK_API_KEY=
BYTEPLUS_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
BYTEPLUS_ENABLED_MODELS=dreamina-seedance-2-0-260128
BYTEPLUS_VIDEO_MODEL=dreamina-seedance-2-0-260128
BYTEPLUS_GENERATE_AUDIO=false
BYTEPLUS_WATERMARK=false
```

`BYTEPLUS_ENABLED_MODELS` doit contenir uniquement les modèles activés et
vérifiés dans le compte ModelArk. Les modèles historiques sans identifiant
officiel confirmé restent masqués.

## Mode démonstration

Lorsque `ARK_API_KEY` est absente, le studio passe explicitement en mode
démonstration. Il crée des projets et simule le cycle d’une tâche, mais ne
produit aucun MP4, ne contacte pas BytePlus et ne comptabilise aucun token.

## Suivi et facturation

- Une ressource `GenerationTask` et une clé d’idempotence sont créées avant
  l’appel BytePlus.
- Une erreur réseau ambiguë produit l’état `SUBMISSION_UNKNOWN` et ne déclenche
  jamais de nouvel envoi automatique.
- Après succès, le MP4 temporaire est immédiatement copié vers Vercel Blob.
- La consommation réelle provient de `usage.completion_tokens`.
- Les coûts restent vides tant que
  `BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL` ne contient pas un tarif vérifié.

Exemple de configuration d’un tarif vérifié :

```dotenv
BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL={"dreamina-seedance-2-0-260128":0.00}
USD_TO_EUR_RATE=
```

Remplacez `0.00` uniquement après vérification du tarif dans la console
BytePlus. Rudyo ne prétend pas lire un solde ModelArk lorsqu’aucune API
officielle ne le fournit.

## Rendu final

Les rendus longs ne sont pas exécutés dans une requête Vercel. Configurez un
worker FFmpeg HTTPS avec `FINAL_RENDER_WORKER_URL` et
`FINAL_RENDER_WORKER_TOKEN`. L’API `/api/seedance/projects/[id]/exports` place
alors la demande dans la file du worker. Sans worker, elle refuse clairement le
rendu au lieu de bloquer une fonction web.

## Déploiement

```bash
npx prisma generate
npx prisma migrate deploy
npm run test:seedance
npx tsc --noEmit
npm run lint
npm run build
```
