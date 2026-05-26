"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

type HealthCheck = {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
};

type HealthResponse = {
  ok: boolean;
  checks: HealthCheck[];
};

const statusStyles = {
  ok: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  error: "border-red-300/30 bg-red-300/10 text-red-100",
};

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = (await response.json()) as HealthResponse;

        if (active) {
          setHealth(data);
          setError("");
        }
      } catch {
        if (active) {
          setError("Statut système indisponible.");
        }
      }
    }

    loadHealth();

    return () => {
      active = false;
    };
  }, []);

  const checks = health?.checks ?? [];
  const hasWarning = checks.some((check) => check.status === "warning");
  const hasError = Boolean(error) || checks.some((check) => check.status === "error");
  const Icon = hasError ? AlertTriangle : hasWarning ? Activity : CheckCircle2;
  const label = hasError
    ? "Action requise"
    : hasWarning
      ? "Mode dégradé"
      : "Système prêt";
  const status = hasError ? "error" : hasWarning ? "warning" : "ok";

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div
          className={[
            "grid h-10 w-10 place-items-center rounded-lg border",
            statusStyles[status],
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">Statut Rudyo</h2>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {error ? (
          <p className="rounded-lg border border-red-300/30 bg-red-300/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {checks.map((check) => (
          <div
            key={check.name}
            className="flex items-start justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2"
          >
            <span className="text-sm font-semibold capitalize text-slate-200">
              {check.name}
            </span>
            <span
              className={[
                "rounded-md border px-2 py-1 text-right text-xs font-bold",
                statusStyles[check.status],
              ].join(" ")}
              title={check.message}
            >
              {check.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
