"use client";

import Link from "next/link";
import { useState } from "react";

type LoginSuccess = {
  user: {
    email: string;
    name: string | null;
    plan?: string;
  };
  credits: {
    balance: number;
    total?: number;
    used?: number;
  };
};

type SessionResponse =
  | (LoginSuccess & { success: true })
  | { success: false; error?: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readSessionResponse(response: Response): Promise<SessionResponse> {
  const text = await response.text();
  if (!text) {
    return {
      success: false,
      error: "Réponse serveur vide pendant la création de session.",
    };
  }

  try {
    return JSON.parse(text) as SessionResponse;
  } catch {
    return {
      success: false,
      error: "Réponse serveur invalide pendant la création de session.",
    };
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<LoginSuccess | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail) {
      setError("Veuillez saisir une adresse email.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Veuillez saisir une adresse email valide.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: normalizedEmail,
          name: normalizedName || undefined,
        }),
      });
      const json = await readSessionResponse(response);

      if (!response.ok) {
        setError(
          !json.success && json.error
            ? json.error
            : "Impossible de créer votre session. Réessayez.",
        );
        return;
      }

      if (!json.success) {
        setError(
          json.error || "Impossible de créer votre session. Réessayez.",
        );
        return;
      }

      setSuccess({
        user: json.user,
        credits: json.credits,
      });
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 font-sans">
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-10 shadow-xl shadow-slate-950/20">
          <h1 className="mb-3 text-4xl font-extrabold text-white">
            Connexion Rudyo
          </h1>
          <p className="mb-8 text-slate-400">
            Identifiez-vous pour suivre vos crédits Rudyo et activer votre plan.
          </p>

          {success ? (
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/25 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Session créée
              </p>
              <h2 className="mt-3 text-2xl font-black text-white">
                Bienvenue {success.user.name || success.user.email}
              </h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-200">
                <p>Email : {success.user.email}</p>
                <p>Nom : {success.user.name || "Non renseigné"}</p>
                <p>Solde Rudyo : {success.credits.balance} crédits</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300"
                >
                  Ouvrir le tableau de bord
                </Link>
                <Link
                  href="/studio"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-white hover:border-emerald-400"
                >
                  Aller au Studio IA
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <label className="block text-sm text-slate-300">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-emerald-400"
                  required
                />
              </label>
              <label className="block text-sm text-slate-300">
                Nom (facultatif)
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-emerald-400"
                />
              </label>
              {error ? (
                <div
                  className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
