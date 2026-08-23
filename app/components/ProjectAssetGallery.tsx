"use client";

import Image from "next/image";
import { FileAudio, FileVideo } from "lucide-react";
import SecureDownloadButton from "@/app/components/SecureDownloadButton";

export type ProjectAsset = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
};

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.ceil(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ProjectAssetGallery({
  projectId,
  assets,
  selectedIds,
  onToggleSelection,
}: {
  projectId: string;
  assets: ProjectAsset[];
  selectedIds?: string[];
  onToggleSelection?: (assetId: string) => void;
}) {
  if (!assets.length) return <p className="mt-5 text-sm text-slate-400">Aucun média importé dans ce projet.</p>;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => {
        const downloadUrl = `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(asset.id)}/download`;
        const previewUrl = `${downloadUrl}?preview=1`;
        return (
          <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="relative grid aspect-video place-items-center bg-slate-950">
              {asset.mimeType.startsWith("image/") ? (
                <Image unoptimized fill sizes="(max-width: 768px) 100vw, 33vw" src={previewUrl} alt={`Aperçu de ${asset.fileName}`} className="object-cover" />
              ) : asset.mimeType.startsWith("video/") ? (
                <video controls preload="metadata" src={previewUrl} className="h-full w-full object-cover" />
              ) : asset.mimeType.startsWith("audio/") ? (
                <div className="w-full p-4"><FileAudio className="mx-auto h-10 w-10 text-cyan-300" /><audio controls preload="metadata" src={previewUrl} className="mt-3 w-full" /></div>
              ) : <FileVideo className="h-10 w-10 text-slate-400" />}
            </div>
            <div className="p-4">
              <p className="truncate font-bold text-white" title={asset.fileName}>{asset.fileName}</p>
              <p className="mt-1 text-xs text-slate-400">{asset.type} · {formatBytes(asset.sizeBytes)}</p>
              <p className="mt-2 text-xs font-bold text-emerald-300">Importé</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onToggleSelection ? (
                  <button
                    type="button"
                    aria-pressed={selectedIds?.includes(asset.id) || false}
                    aria-label={`Sélectionner ${asset.fileName}`}
                    onClick={() => onToggleSelection(asset.id)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold ${selectedIds?.includes(asset.id) ? "border-violet-300 bg-violet-300 text-slate-950" : "border-slate-700 text-slate-100"}`}
                  >
                    {selectedIds?.includes(asset.id) ? "Sélectionné" : "Sélectionner"}
                  </button>
                ) : null}
                <SecureDownloadButton
                  href={downloadUrl}
                  fallbackName={asset.fileName}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
