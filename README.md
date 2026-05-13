# Rudyo Video Studio

Application Next.js pour générer un storyboard, préparer des prompts vidéo et orchestrer un montage.

## Mode sans IA

Le flux principal peut tourner sans service IA externe.

- Le storyboard retombe automatiquement sur une version locale si Ollama n'est pas disponible.
- L'analyse musique locale découpe le morceau en sections avec un BPM estimé.
- La préparation des clips produit quand même les plans, prompts et exports texte/JSON.
- Les aperçus image passent par un fallback SVG local si le fournisseur distant échoue.
- Le montage final repose sur vos fichiers mp4 dans media/plans et sur FFmpeg.

Flux recommandé sans IA :

1. Lancez le storyboard.
2. Analysez votre morceau audio.
3. Préparez les clips.
4. Créez ou tournez vos rushs en dehors de l'application.
5. Uploadez les mp4 dans media/plans.
6. Lancez le montage final.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Stockage cloud (production)

Le projet supporte maintenant 2 modes de stockage automatiquement :

- **Local** (par défaut): écrit dans `media/*`.
- **Cloud** (si `BLOB_READ_WRITE_TOKEN` est défini): écrit dans Vercel Blob.

Variables d'environnement importantes :

- `BLOB_READ_WRITE_TOKEN`: active le stockage cloud.
- `CLOUD_STORAGE_PREFIX` (optionnel): préfixe des objets Blob (par défaut `rudyo-video-studio`).
- `REPLICATE_API_TOKEN` (optionnel): génération vidéo automatisée.
- `REPLICATE_VIDEO_MODEL` (optionnel): modèle Replicate, ex. `bytedance/seedance-1-pro`.
- `OLLAMA_BASE_URL` et `OLLAMA_MODEL` (optionnel): amélioration locale via Ollama. L'application reste utilisable sans eux.
- `DEFAULT_AI_PROVIDER` (optionnel): `ollama`, `openai` ou `blackbox`.
- `OPENAI_API_KEY` et `OPENAI_MODEL` (optionnel): génération storyboard / prompts via OpenAI.
- `OPENAI_BASE_URL` (optionnel): base personnalisée pour OpenAI-compatible.
- `BLACKBOX_API_KEY` et `BLACKBOX_MODEL` (optionnel): génération storyboard / prompts via Blackbox AI.
- `BLACKBOX_BASE_URL` (optionnel): base personnalisée pour Blackbox AI (par défaut `https://api.blackbox.ai`).

## Déploiement en ligne (Vercel)

1. Importer le repo sur Vercel.
2. Ajouter les variables d'environnement (`BLOB_READ_WRITE_TOKEN`, etc.).
3. Déployer.

Une fois déployé, les endpoints API (`upload`, `projects`, exports JSON/TXT, vidéo finale, miniature) utilisent le stockage cloud automatiquement.

## Note montage FFmpeg

Le montage s'appuie sur `ffmpeg` / `ffprobe` via les scripts `scripts/montage.js` et `scripts/montage-advanced.js`.

- En local/VPS: installez FFmpeg sur la machine.
- En serverless strict: prévoyez un worker dédié (container/VM) si FFmpeg n'est pas disponible.

L'analyse audio locale utilise aussi `ffprobe` (inclus avec FFmpeg).
# rudyo-video-studio-ia
