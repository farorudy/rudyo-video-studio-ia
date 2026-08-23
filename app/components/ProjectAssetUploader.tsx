"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, FileImage, FileVideo, Trash2, Upload, X } from "lucide-react";

export type UploadedAsset = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  downloadUrl?: string;
};

type PendingFile = {
  id: string;
  file: File;
  type: string;
  previewUrl: string;
  progress: number;
  status: "ready" | "uploading" | "done" | "error" | "canceled";
  error?: string;
};

type UploadResponse = {
  asset?: UploadedAsset;
  assetId?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  downloadUrl?: string;
  error?: string;
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const audioExtensions = new Set(["mp3", "wav", "m4a"]);
const videoExtensions = new Set(["mp4", "mov", "webm"]);
const maxImageBytes = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB || 20) * 1024 * 1024;
const maxAudioBytes = Number(process.env.NEXT_PUBLIC_MAX_AUDIO_UPLOAD_MB || 100) * 1024 * 1024;
const maxVideoBytes = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB || 250) * 1024 * 1024;

const groups = [
  { type: "AUDIO", label: "Chanson MP3 ou WAV", accept: ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4", multiple: false, kind: "audio" },
  { type: "ARTIST_PORTRAIT", label: "Photos de l’artiste", accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, kind: "image" },
  { type: "DECOR", label: "Images de décors", accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, kind: "image" },
  { type: "OUTFIT", label: "Images de tenues", accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, kind: "image" },
  { type: "REFERENCE_VIDEO", label: "Vidéos de référence", accept: ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm", multiple: true, kind: "video" },
  { type: "FIRST_FRAME", label: "Premières images", accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, kind: "image" },
  { type: "LAST_FRAME", label: "Dernières images", accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, kind: "image" },
] as const;

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function validateFile(file: File, kind: string) {
  const ext = extension(file.name);
  const allowed = kind === "image" ? imageExtensions : kind === "audio" ? audioExtensions : videoExtensions;
  const mimeMatches = file.type.startsWith(`${kind}/`) || (kind === "audio" && file.type === "video/mp4");
  if (!allowed.has(ext) || !mimeMatches) return "Ce format de fichier n’est pas accepté.";
  const limit = kind === "image" ? maxImageBytes : kind === "audio" ? maxAudioBytes : maxVideoBytes;
  if (file.size <= 0 || file.size > limit) return "Le fichier dépasse la taille autorisée.";
  return "";
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ProjectAssetUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded?: (asset: UploadedAsset) => void | Promise<void>;
}) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [draggedType, setDraggedType] = useState("");
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const pendingRef = useRef<PendingFile[]>([]);
  const mounted = useRef(true);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    mounted.current = true;
    const activeRequests = requests.current;
    return () => {
      mounted.current = false;
      activeRequests.forEach((request) => request.abort());
      pendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function addFiles(files: FileList | File[], type: string, kind: string) {
    const additions = Array.from(files).map((file) => {
      const error = validateFile(file, kind);
      return {
        id: crypto.randomUUID(),
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: error ? "error" as const : "ready" as const,
        error: error || undefined,
      };
    });
    setPending((current) => [...current, ...additions]);
  }

  function removeFile(id: string) {
    requests.current.get(id)?.abort();
    requests.current.delete(id);
    setPending((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function sendFile(item: PendingFile) {
    return new Promise<UploadedAsset>((resolve, reject) => {
      const request = new XMLHttpRequest();
      requests.current.set(item.id, request);
      request.open("POST", `/api/seedance/projects/${encodeURIComponent(projectId)}/media`);
      request.timeout = 60_000;
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable || !mounted.current) return;
        setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress: Math.round((event.loaded / event.total) * 100) } : entry));
      };
      request.onerror = () => reject(new Error("La connexion a été interrompue pendant l’import."));
      request.onabort = () => {
        const error = new Error("Importation annulée.");
        error.name = "AbortError";
        reject(error);
      };
      request.ontimeout = () => reject(new Error("L’import a dépassé 60 secondes. Vérifiez votre connexion puis réessayez."));
      request.onload = () => {
        const contentType = request.getResponseHeader("content-type") ?? "";
        const rawBody = request.responseText ?? "";
        let body: UploadResponse | null = null;

        if (rawBody && contentType.includes("application/json")) {
          try {
            body = JSON.parse(rawBody) as UploadResponse;
          } catch {
            reject(new Error("Le serveur a renvoyé une réponse JSON invalide."));
            return;
          }
        }

        if (request.status < 200 || request.status >= 300) {
          reject(new Error(body?.error || `Import impossible (${request.status || "réseau"}).`));
          return;
        }
        if (!body) {
          reject(new Error(rawBody ? "Le serveur a renvoyé une réponse non JSON." : "Le serveur a renvoyé une réponse vide."));
          return;
        }

        const asset = body.asset ?? (body.assetId && body.filename && body.mimeType && typeof body.size === "number" ? {
          id: body.assetId,
          type: item.type,
          fileName: body.filename,
          mimeType: body.mimeType,
          sizeBytes: body.size,
          downloadUrl: body.downloadUrl,
        } : null);
        if (!asset) {
          reject(new Error("Le serveur n’a pas confirmé l’enregistrement du fichier."));
          return;
        }
        resolve(asset);
      };
      const form = new FormData();
      form.set("file", item.file);
      form.set("type", item.type);
      request.send(form);
    });
  }

  async function uploadFile(item: PendingFile) {
    if (item.status !== "ready" && item.status !== "error" && item.status !== "canceled") return;
    const group = groups.find((candidate) => candidate.type === item.type);
    const validationError = validateFile(item.file, group?.kind || "image");
    if (validationError) {
      setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", error: validationError } : entry));
      return;
    }

    setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading", progress: 0, error: undefined } : entry));
    try {
      const asset = await sendFile(item);
      if (!mounted.current) return;
      setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "done", progress: 100, error: undefined } : entry));
      await onUploaded?.(asset);
    } catch (error) {
      if (!mounted.current) return;
      const canceled = error instanceof Error && error.name === "AbortError";
      setPending((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        status: canceled ? "canceled" : "error",
        error: error instanceof Error ? error.message : "L’envoi a été interrompu. Vous pouvez recommencer.",
      } : entry));
    } finally {
      requests.current.delete(item.id);
      if (mounted.current) {
        setPending((current) => current.map((entry) => entry.id === item.id && entry.status === "uploading" ? {
          ...entry,
          status: "error",
          error: "L’import ne s’est pas terminé correctement. Vous pouvez recommencer.",
        } : entry));
      }
    }
  }

  const readyFiles = pending.filter((item) => item.status === "ready" || item.status === "error" || item.status === "canceled");

  return (
    <section aria-labelledby="computer-import-title" className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="computer-import-title" className="text-2xl font-black">Importer depuis votre ordinateur</h2>
          <p className="mt-2 text-sm text-slate-400">Projet sélectionné : {projectId}</p>
        </div>
        {readyFiles.length ? (
          <button type="button" onClick={() => readyFiles.forEach((item) => void uploadFile(item))} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">
            Importer {readyFiles.length} fichier{readyFiles.length > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <label
            key={group.type}
            onDragEnter={(event) => { event.preventDefault(); setDraggedType(group.type); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDraggedType("")}
            onDrop={(event) => { event.preventDefault(); setDraggedType(""); addFiles(event.dataTransfer.files, group.type, group.kind); }}
            className={`cursor-pointer rounded-2xl border border-dashed p-4 transition ${draggedType === group.type ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-900 hover:border-cyan-400"}`}
          >
            <span className="flex items-center gap-2 font-bold">
              {group.kind === "audio" ? <FileAudio className="h-5 w-5" /> : group.kind === "video" ? <FileVideo className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
              {group.label}
            </span>
            <span className="mt-3 block text-xs leading-5 text-slate-400">Déposez vos fichiers ici ou cliquez pour parcourir votre ordinateur.</span>
            <input
              type="file"
              accept={group.accept}
              multiple={group.multiple}
              className="sr-only"
              onChange={(event) => { if (event.target.files) addFiles(event.target.files, group.type, group.kind); event.target.value = ""; }}
            />
          </label>
        ))}
      </div>

      {pending.length ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {pending.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                {item.file.type.startsWith("image/") ? <div className="h-full bg-cover bg-center" style={{ backgroundImage: `url(${item.previewUrl})` }} /> : item.file.type.startsWith("video/") ? <video src={item.previewUrl} muted className="h-full w-full object-cover" /> : <FileAudio className="m-auto h-full w-8 text-cyan-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.file.name}</p>
                <p className="mt-1 text-xs text-slate-400">{item.file.type || extension(item.file.name)} · {formatBytes(item.file.size)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${item.progress}%` }} /></div>
                <p className={`mt-2 text-xs ${item.status === "error" ? "text-rose-300" : "text-slate-400"}`}>
                  {item.status === "error" ? item.error : ({ ready: "Prêt à importer", uploading: `Importation ${item.progress} %`, done: "Importé", canceled: "Importation annulée" }[item.status])}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {item.status === "uploading" ? <button type="button" aria-label={`Annuler ${item.file.name}`} onClick={() => requests.current.get(item.id)?.abort()} className="rounded-lg border border-slate-700 p-2"><X className="h-4 w-4" /></button> : null}
                {(item.status === "error" || item.status === "canceled") ? <button type="button" aria-label={`Recommencer ${item.file.name}`} onClick={() => void uploadFile(item)} className="rounded-lg border border-cyan-500 p-2 text-cyan-300"><Upload className="h-4 w-4" /></button> : null}
                {item.status !== "uploading" ? <button type="button" aria-label={`Supprimer ${item.file.name}`} onClick={() => removeFile(item.id)} className="rounded-lg border border-slate-700 p-2 text-slate-300"><Trash2 className="h-4 w-4" /></button> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
