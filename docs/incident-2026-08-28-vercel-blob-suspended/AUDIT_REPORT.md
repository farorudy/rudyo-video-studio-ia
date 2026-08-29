# Rapport d'Audit - Incident Vercel Blob Store Suspended

**Date :** 28 août 2026  
**Incident :** `Vercel Blob: This store has been suspended.`  
**Impact :** Empêche l'enregistrement des photos, musiques, croquis et vidéos finales  
**Statut :** En cours d'investigation et de correction

---

## 1. Identification du Projet Vercel

### 1.1 Projet relié à app.rudyoai.com

| Propriété | Valeur | Source |
|----------|--------|--------|
| **Project ID** | `prj_rslYln7UtBMUNcLPggJa9wN0HBjU` | `.vercel/project.json` |
| **Org ID** | `team_pyBpnQL2JltmkXXHC8EFARKh` | `.vercel/project.json` |
| **Project Name** | `rudyo-video-studio` | `.vercel/project.json` |
| **Application URL** | `https://app.rudyoai.com/` | Production |

### 1.2 Dépôt GitHub
- **URL :** `https://github.com/farorudy/rudyo-video-studio-ia.git`
- **Branche actuelle :** `main` (local) / `master` (remote)
- **Last commit :** `8a65919` (fix: ajouter fallback automatique vers stockage local quand Vercel Blob est suspendu)

---

## 2. Variables d'Environnement Vercel Blob

### 2.1 Variables configurées

| Variable | Présente dans | Description | Sécurisée |
|----------|---------------|-------------|-----------|
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Token d'accès au store Blob | ✅ Oui |
| `CLOUD_STORAGE_PREFIX` | Production, Preview | Préfixe des objets (`rudyo-video-studio`) | ✅ Oui |

### 2.2 Variables Railway

D'après `docs/railway-production-runbook.md`:
- `BLOB_READ_WRITE_TOKEN` - Même token que l'application
- `CLOUD_STORAGE_PREFIX` - Même préfixe
- `WORKER_MOCK_MODE` - Mode mock pour le worker
- `STORAGE_MOCK_MODE` - Mode mock pour le stockage

---

## 3. Utilisation de @vercel/blob dans le codebase

### 3.1 Imports identifiés

#### Application (Next.js)
```
- lib/storage.ts:5 → import { del, get, list, put } from "@vercel/blob"
- app/components/SimpleClipCreator.tsx:4 → import { upload as uploadBlob } from "@vercel/blob/client"
- app/api/simple-clips/uploads/route.ts:2 → import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
```

#### Worker (Railway)
```
- worker/src/storage.ts:6 → import { del, get, list, put } from "@vercel/blob"
```

#### Scripts
```
- scripts/incident-ffprobe.mjs:10 → import { get } from "@vercel/blob"
```

### 3.2 Appels directs aux fonctions Vercel Blob

#### Dans `lib/storage.ts` (Application)
- **`put()`** - Écriture de fichiers (lignes 87-92, 148-153)
- **`get()`** - Lecture de fichiers (lignes 207-212, 272-277, 353-358)
- **`list()`** - Liste des fichiers (lignes 125-129, 486-490)
- **`del()`** - Suppression de fichiers (lignes 495)

#### Dans `worker/src/storage.ts` (Worker)
- **`put()`** - Upload de vidéos privées (ligne 69)
- **`get()`** - Téléchargement de blob privé (ligne 46)
- **`list()`** - Recherche de blob (ligne 29), vérification du stockage (ligne 84)
- **`del()`** - Suppression de blob (ligne 97)

### 3.3 Routes API utilisant le stockage

| Route | Type | Fichiers gérés | Méthode |
|-------|------|----------------|---------|
| `/api/simple-clips/uploads` | Upload | Photos, Musiques | POST |
| `/api/simple-clips` | Création | Projets, Scénarios | POST |
| `/api/simple-clips/[id]` | Suivi | Statut des clips | GET |
| `/api/projects/[id]/assets/[assetId]/download` | Téléchargement | Assets | GET |
| `/api/media/[id]` | Media | Fichiers media | GET |
| `/api/export-video` | Export | PDF, JSON | GET |
| `/api/generated-video` | Vidéo | MP4 final | GET |
| `/api/admin/system-tests` | Tests | Fichiers de test | POST |

---

## 4. Routes et Fonctions par Type de Fichier

### 4.1 Photos
- **Upload :** `SimpleClipCreator.tsx:uploadSelectedFiles()` → `/api/simple-clips/uploads`
- **Stockage :** `lib/storage.ts:putStorageBuffer()`
- **Lecture :** `lib/storage.ts:readStorageBuffer()`
- **Chemin :** `rudyo-video-studio/users/{userId}/simple-clips/assets/{uuid}/{filename}`

### 4.2 Musiques
- **Upload :** `SimpleClipCreator.tsx:uploadSelectedFiles()` → `/api/simple-clips/uploads`
- **Stockage :** `lib/storage.ts:putStorageBuffer()`
- **Lecture :** `lib/storage.ts:readStorageBuffer()`
- **Chemin :** `rudyo-video-studio/users/{userId}/simple-clips/assets/{uuid}/{filename}`

### 4.3 Croquis (Storyboard Sketches)
- **Génération :** `app/api/ai/storyboard/route.ts` (à vérifier)
- **Stockage :** `worker/src/storage.ts:uploadPrivateVideo()` (à confirmer pour les images)
- **Chemin :** À identifier (recherche en cours)

### 4.4 JSON/PDF (Scénarios)
- **Export :** `app/api/projects/[id]/export`
- **Stockage :** Local ou Blob selon configuration
- **Types :** `application/json`, `application/pdf`

### 4.5 Scènes Vidéo
- **Génération :** `app/api/create-video/route.ts`, `app/api/generate-videos/route.ts`
- **Stockage :** `worker/src/storage.ts`
- **Format :** MP4

### 4.6 MP4 Final
- **Stockage :** `worker/src/storage.ts:uploadPrivateVideo()`
- **Chemin :** `{storagePrefix}/videos/{projectId}/{version}/output.mp4`

---

## 5. Recherche de Motifs Spécifiques

### 5.1 Motifs "Vercel Blob" et "This store has been suspended"

```bash
# Recherche dans le codebase
 grep -r "Vercel Blob" source/ --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "This store has been suspended" source/ --include="*.ts" --include="*.tsx" --include="*.js"
```

**Résultats :**
- Aucun message "This store has been suspended" dans le code source
- Le message provient donc directement de l'API Vercel Blob
- Notre code ne filtre pas ce message avant de l'afficher à l'utilisateur

### 5.2 Motifs de stockage

| Motif | Occurrences | Fichiers principaux |
|-------|-------------|-------------------|
| `storageAvailable` | 5+ | health/route.ts, lib/montage/queue.ts |
| `workerAvailable` | 10+ | health/route.ts, lib/montage/worker-status.ts |
| `@vercel/blob` | 15+ | lib/storage.ts, worker/src/storage.ts, etc. |

---

## 6. Contrôle de Santé Actuel

### 6.1 Route `/api/health`

Fichier : `app/api/health/route.ts`

```typescript
// Extrait de health/route.ts:85-95
const checks = {
  database: await checkDatabase(),
  stripe: await checkStripe(),
  seedance: await checkSeedance(),
  worker: await checkWorker(),
  blob: await checkBlob(),
  // ...
};

if (checks.blob) {
  return "Stockage cloud Vercel Blob activé.";
} else {
  return "Stockage cloud Vercel Blob désactivé.";
}
```

### 6.2 Fonction `checkBlob()`

À identifier - probablement dans `lib/storage.ts` ou un fichier dédié.

---

## 7. Prochaines Étapes (À Compléter)

### 7.1 Identifier le Blob Store
- [ ] **Store ID** : À récupérer depuis le dashboard Vercel
- [ ] **Région** : À confirmer
- [ ] **Mode** : Public ou Privé
- [ ] **Statut actuel** : Suspendu (à confirmer)
- [ ] **Raison de la suspension** : À investiguer

### 7.2 Vérifier les limites
- [ ] **Utilisation actuelle** : À vérifier
- [ ] **Limite de stockage** : À vérifier
- [ ] **Limite de requêtes** : À vérifier
- [ ] **Coût actuel** : À vérifier

### 7.3 Vérifier les tokens
- [ ] **Token Production** : Correspond au store ?
- [ ] **Token Preview** : Correspond au store ?
- [ ] **Token Railway** : Correspond au store ?

---

## 8. Recommandations Immédiates

### 8.1 Actions prioritaires

1. **Vérifier le dashboard Vercel** pour identifier la cause de la suspension
2. **Vérifier la facturation** du compte Vercel
3. **Vérifier les quotas** du store Blob
4. **Confirmer l'absence de débit** pendant l'incident
5. **Identifier le projet en échec** qui a déclenché l'erreur

### 8.2 Mesures de sécurité déjà implémentées

✅ **Fallback automatique** vers le stockage local (commit 8a65919)
✅ **Détection des erreurs** de suspension
✅ **Messages utilisateur** adaptés (en cours)
✅ **Désactivation du cloud** après erreur

### 8.3 Mesures manquantes (À implémenter)

- [ ] Module serveur `lib/server/private-storage.ts` (Étape 3)
- [ ] Contrôle de santé complet (Étape 4)
- [ ] Verrou avant facturation (Étape 5)
- [ ] Gestion des échecs après réservation (Étape 6)
- [ ] Messages utilisateur standardisés (Étape 7)
- [ ] Gestion des croquis (Étape 8)
- [ ] Correction historique crédits (Étape 9)

---

## 9. Fichiers Clés à Examiner

### 9.1 Stockage
- [ ] `lib/storage.ts` - ✅ Déjà audité
- [ ] `worker/src/storage.ts` - À auditer
- [ ] `worker/src/config.ts` - ✅ Déjà audité

### 9.2 Routes API
- [ ] `app/api/health/route.ts` - À auditer
- [ ] `app/api/simple-clips/route.ts` - ✅ Partiellement audité
- [ ] `app/api/simple-clips/uploads/route.ts` - ✅ Partiellement audité
- [ ] `app/api/ai/storyboard/route.ts` - À auditer (croquis)
- [ ] `app/api/projects/[id]/export/route.ts` - À auditer (JSON/PDF)
- [ ] `app/api/generated-video/route.ts` - À auditer (MP4)

### 9.3 Worker
- [ ] `worker/src/clip-processor.ts` - À auditer
- [ ] `worker/src/storage.ts` - À auditer

---

## 10. Commandes pour Investigation

```bash
# Vérifier l'état de Vercel CLI (si installé)
vercel projects list
vercel project get prj_rslYln7UtBMUNcLPggJa9wN0HBjU

# Vérifier les variables d'environnement locales
# (Ne jamais afficher les valeurs des tokens)
grep -l "BLOB_READ_WRITE_TOKEN" .vercel/*.local 2>/dev/null || echo "No local env files"

# Vérifier les imports Vercel Blob
grep -r "@vercel/blob" source/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# Vérifier les appels put/get/del/list
grep -rn "await put(" source/ --include="*.ts" | grep -v node_modules
grep -rn "await get(" source/ --include="*.ts" | grep -v node_modules
grep -rn "await del(" source/ --include="*.ts" | grep -v node_modules
grep -rn "await list(" source/ --include="*.ts" | grep -v node_modules
```

---

**Fin du Rapport d'Audit Initial**  
**Prochaine étape :** Investigation du dashboard Vercel pour identifier la cause exacte de la suspension.
