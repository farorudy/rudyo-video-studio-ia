"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type UserPlan = "FREE" | "STARTER" | "CREATOR" | "STUDIO";
type BillingStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "TRIALING";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  plan: UserPlan;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  monthlyLimit: number;
  monthlyUsed: number;
  billingStatus: BillingStatus;
  allowPremiumAi: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminData = {
  admin: { email: string };
  stats: {
    users: number;
    creditsRemaining: number;
    creditsUsed: number;
    aiUsage: number;
  };
  users: AdminUser[];
  clipOffers: Array<{ code: string; name: string; maxCredits: number; maxPriceEur: number; maxDurationSeconds: number; economics: { enabled: boolean; clientRevenueEur: number; providerCostEur: number; workerCostEur: number; storageCostEur: number; retryReserveEur: number; marginEur: number; actualProviderCostEur: number; actualMarginEur: number; completedProductions: number } }>;
};

const plans: UserPlan[] = ["FREE", "STARTER", "CREATOR", "STUDIO"];
const billingStatuses: BillingStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "INCOMPLETE",
  "CANCELED",
];

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
}

async function fetchAdminData() {
  const response = await fetch("/api/admin/users", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401) {
    return null;
  }
  const payload = (await response.json()) as AdminData & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Chargement de l'administration impossible.");
  }
  return payload;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [query, setQuery] = useState("");
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAdminData = useCallback(async () => {
    const payload = await fetchAdminData();
    if (!payload) {
      setAuthenticated(false);
      setData(null);
      return;
    }
    setData(payload);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminData()
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setAuthenticated(Boolean(payload));
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erreur de chargement.",
        );
        setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data?.users ?? [];
    return (data?.users ?? []).filter(
      (user) =>
        user.email.toLowerCase().includes(normalized) ||
        user.name?.toLowerCase().includes(normalized),
    );
  }, [data?.users, query]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(payload.error || "Connexion administrateur impossible.");
      return;
    }
    setPassword("");
    await loadAdminData();
  }

  async function handleLogout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
    setAuthenticated(false);
    setData(null);
  }

  async function updateUser(
    userId: string,
    payload: Record<string, string | number>,
  ) {
    setBusyUserId(userId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, ...payload }),
      });
      const result = await readJson(response);
      if (!response.ok) {
        throw new Error(result.error || "Modification impossible.");
      }
      setMessage("Modification enregistrée et auditée.");
      await loadAdminData();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Modification impossible.",
      );
    } finally {
      setBusyUserId("");
    }
  }

  if (authenticated === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-200">
        Vérification de la session administrateur…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">
            Rudyo Administration
          </p>
          <h1 className="mt-4 text-4xl font-black">Accès sécurisé</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Cet accès utilise un mot de passe séparé de la connexion utilisateur.
          </p>
          <form className="mt-8 grid gap-5" onSubmit={handleLogin}>
            <label className="grid gap-2 text-sm font-semibold">
              Email administrateur
              <input
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Mot de passe administrateur
              <input
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
              Se connecter
            </button>
          </form>
          <Link className="mt-6 inline-block text-sm text-slate-400 hover:text-white" href="/">
            Retour au site
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/95 px-5 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
              Rudyo Administration
            </p>
            <h1 className="mt-1 text-2xl font-black">Gestion du système</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{data?.admin.email}</span>
            <Link href="/admin/system-tests" className="rounded-xl border border-cyan-400/40 px-4 py-2 font-bold text-cyan-200 hover:bg-cyan-400/10">Tests système</Link>
            <button
              className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800"
              onClick={handleLogout}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Utilisateurs", data?.stats.users ?? 0],
            ["Crédits disponibles", data?.stats.creditsRemaining ?? 0],
            ["Crédits utilisés", data?.stats.creditsUsed ?? 0],
            ["Actions IA", data?.stats.aiUsage ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black text-cyan-300">{value}</p>
            </div>
          ))}
        </section>
        {data?.clipOffers?.length ? <section className="mt-8 space-y-5">
          <h2 className="text-2xl font-black">Économie des formules clips</h2>
          {data.clipOffers.map((offer) => <article key={offer.code} className="rounded-3xl border border-cyan-400/30 bg-cyan-950/20 p-6">
            <h3 className="text-xl font-black">{offer.name}</h3>
            <p className="mt-2 text-slate-300">Plafond client : {offer.maxCredits.toLocaleString("fr-FR")} crédits / {offer.maxPriceEur} € pour {offer.maxDurationSeconds} secondes.</p>
            <p className="mt-2 text-xs text-slate-400">{offer.economics.completedProductions} production(s) mesurée(s).</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{[
              ["Recette plafond", offer.economics.clientRevenueEur],
              ["BytePlus estimé", offer.economics.providerCostEur],
              ["BytePlus réel cumulé", offer.economics.actualProviderCostEur],
              ["Worker", offer.economics.workerCostEur],
              ["Stockage", offer.economics.storageCostEur],
              ["Réserve retry", offer.economics.retryReserveEur],
              ["Marge estimée", offer.economics.marginEur],
              ["Marge réelle cumulée", offer.economics.actualMarginEur],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-black text-cyan-200">{Number(value).toFixed(2)} €</p></div>)}</div>
            <p className={`mt-4 font-bold ${offer.economics.enabled ? "text-emerald-300" : "text-rose-300"}`}>{offer.economics.enabled ? "Formule économiquement autorisée" : "Formule bloquée : validation commerciale requise"}</p>
          </article>)}
        </section> : null}

        {message ? (
          <p className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-6 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Comptes utilisateurs</h2>
              <p className="mt-1 text-sm text-slate-400">
                Plans, facturation, crédits et consommation mensuelle.
              </p>
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400 sm:w-80"
              placeholder="Rechercher par email ou nom"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 grid gap-4">
            {filteredUsers.map((user) => {
              const busy = busyUserId === user.id;
              const creditValue = Number(creditInputs[user.id] ?? "20");
              return (
                <article key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <div className="grid gap-5 xl:grid-cols-[1.3fr_0.8fr_0.8fr_1.5fr] xl:items-center">
                    <div>
                      <p className="font-bold">{user.name || "Utilisateur Rudyo"}</p>
                      <p className="mt-1 break-all text-sm text-cyan-300">{user.email}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Plan
                      <select
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        value={user.plan}
                        disabled={busy}
                        onChange={(event) =>
                          updateUser(user.id, {
                            action: "set_plan",
                            plan: event.target.value,
                          })
                        }
                      >
                        {plans.map((plan) => <option key={plan}>{plan}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Facturation
                      <select
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        value={user.billingStatus}
                        disabled={busy}
                        onChange={(event) =>
                          updateUser(user.id, {
                            action: "set_billing_status",
                            billingStatus: event.target.value,
                          })
                        }
                      >
                        {billingStatuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <div>
                      <div className="mb-3 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-lg bg-emerald-950 px-3 py-1 text-emerald-300">
                          Restants : {user.creditsRemaining}
                        </span>
                        <span className="rounded-lg bg-slate-800 px-3 py-1 text-slate-300">
                          Utilisés : {user.creditsUsed}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
                          type="number"
                          min="1"
                          max="100000"
                          value={creditInputs[user.id] ?? "20"}
                          onChange={(event) =>
                            setCreditInputs((current) => ({
                              ...current,
                              [user.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
                          disabled={busy || !Number.isInteger(creditValue) || creditValue < 1}
                          onClick={() =>
                            updateUser(user.id, {
                              action: "adjust_credits",
                              amount: Math.abs(creditValue),
                            })
                          }
                        >
                          Ajouter
                        </button>
                        <button
                          className="rounded-xl border border-rose-500/50 px-3 py-2 text-sm font-bold text-rose-300 disabled:opacity-50"
                          disabled={busy || !Number.isInteger(creditValue) || creditValue < 1}
                          onClick={() =>
                            updateUser(user.id, {
                              action: "adjust_credits",
                              amount: -Math.abs(creditValue),
                            })
                          }
                        >
                          Retirer
                        </button>
                        <button
                          className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 disabled:opacity-50"
                          disabled={busy}
                          onClick={() =>
                            updateUser(user.id, { action: "reset_monthly_usage" })
                          }
                        >
                          Réinitialiser le mois
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
