"use client";

import { useState } from "react";
import { Download } from "lucide-react";

function responseFileName(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { return fallback; }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1] || fallback;
}

async function errorMessage(response: Response) {
  const raw = await response.text();
  if (response.headers.get("content-type")?.includes("application/json") && raw) {
    try {
      const body = JSON.parse(raw) as { error?: unknown };
      if (typeof body.error === "string") return body.error;
    } catch {
      // The status-specific fallback below is safer than surfacing a parser error.
    }
  }
  return `Téléchargement impossible (${response.status}).`;
}

export default function SecureDownloadButton({
  href,
  fallbackName,
  label = "Télécharger",
  className = "",
}: {
  href: string;
  fallbackName: string;
  label?: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setDownloading(true);
    setError("");
    let objectUrl = "";
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const blob = await response.blob();
      if (!blob.size) throw new Error("Le fichier téléchargé est vide.");

      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = responseFileName(response.headers.get("content-disposition"), fallbackName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Téléchargement impossible.");
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      setDownloading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        aria-label={`${label} ${fallbackName}`}
        className={className}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {downloading ? "Téléchargement en cours…" : label}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-sm text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
