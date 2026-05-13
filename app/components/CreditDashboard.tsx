"use client";

import { useEffect, useState } from "react";

type BalanceResponse = {
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  plan: string;
  monthlyLimit: number;
  monthlyUsed: number;
  billingStatus: string;
};

export default function CreditDashboard() {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBalance() {
      try {
        const res = await fetch("/api/credits/balance", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Impossible de charger le solde.");
          return;
        }
        setBalance(json);
      } catch (err) {
        setError("Impossible de charger le solde de crédits.");
      } finally {
        setLoading(false);
      }
    }

    loadBalance();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8 text-center text-slate-400">
        Chargement du tableau de bord crédits…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/40 bg-rose-950/30 p-8 text-center text-rose-200">
        <p>{error}</p>
        <p className="mt-2 text-sm text-slate-400">
          Connectez-vous ou créez un compte pour consulter vos crédits Rudyo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            Crédit interne Rudyo
          </p>
          <h2 className="text-3xl font-bold text-white">
            Mon solde de crédits
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/offres"
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 text-center"
          >
            Acheter des crédits
          </a>
          <a
            href="/credits/history"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 text-center"
          >
            Voir l’historique
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Crédits restants
          </p>
          <p className="mt-4 text-4xl font-bold text-emerald-300">
            {balance!.creditsRemaining}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Crédits utilisés
          </p>
          <p className="mt-4 text-4xl font-bold text-slate-200">
            {balance!.creditsUsed}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Plan actuel
          </p>
          <p className="mt-4 text-2xl font-bold text-white">{balance!.plan}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Limite mensuelle
          </p>
          <p className="mt-4 text-3xl font-bold text-sky-300">
            {balance!.monthlyLimit}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            générations IA restantes ce mois
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Usage ce mois
          </p>
          <p className="mt-4 text-3xl font-bold text-amber-300">
            {balance!.monthlyUsed}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            générations IA consommées
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-sm text-slate-400">
        <p className="font-medium text-slate-100">Note importante</p>
        <p className="mt-3">
          Les crédits Rudyo sont des crédits internes utilisables uniquement sur
          la plateforme Rudyo Video Studio IA. Ils ne constituent pas des
          crédits OpenAI et ne donnent pas accès directement aux services
          OpenAI.
        </p>
      </div>
    </div>
  );
}
