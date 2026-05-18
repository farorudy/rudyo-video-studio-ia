"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  | (LoginSuccess & { success: true; authenticated?: boolean })
  | { success: false; authenticated?: boolean; error?: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readSessionResponse(response: Response): Promise<SessionResponse> {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      error: "Impossible de créer votre session. Réessayez.",
    };
  }

  try {
    return JSON.parse(text) as SessionResponse;
  } catch {
    return {
      success: false,
      error: "Impossible de créer votre session. Réessayez.",
    };
  }
}

function getFriendlyError(error?: string) {
  if (!error) {
    return "Impossible de créer votre session. Réessayez.";
  }

  if (
    error.includes("Configuration serveur") ||
    error.includes("DATABASE_URL") ||
    error.includes("AUTH_COOKIE_SECRET")
  ) {
    return "Configuration serveur incomplète. Veuillez contacter l'administrateur.";
  }

  return error;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [success, setSuccess] = useState<LoginSuccess | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const json = await readSessionResponse(response);
        if (active && json.success) {
          setSuccess({ user: json.user, credits: json.credits });
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Adresse email invalide.");
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

      if (!response.ok || !json.success) {
        setError(getFriendlyError(!json.success ? json.error : undefined));
        return;
      }

      setSuccess({
        user: json.user,
        credits: json.credits,
      });
      window.setTimeout(() => router.push("/studio"), 1200);
    } catch {
      setError("Impossible de créer votre session. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-10 md:grid-cols-[1fr_440px] md:items-center md:px-8 lg:gap-16">
        <div className="max-w-3xl">
          <Link
            href="/"
            className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-200"
          >
            Farozik - Rudyo Video Studio IA
          </Link>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
            Votre idée devient une vidéo.
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">
            Connexion Rudyo
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Identifiez-vous pour accéder à votre Studio IA, suivre vos crédits
            Rudyo et créer vos vidéos.
          </p>

          <div className="mt-8 rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
              Accès bêta gratuit
            </p>
            <p className="mt-3 text-xl font-black text-white">
              Créez votre compte FREE avec votre email et recevez 20 crédits
              pour tester Rudyo Video Studio IA.
            </p>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              Aucune carte bancaire requise.
            </p>
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              Compte FREE activé automatiquement.
            </p>
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              20 crédits offerts pour démarrer.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-cyan-950/30 md:p-8">
          {success ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Bienvenue dans Rudyo Video Studio IA.
              </p>
              <h2 className="mt-4 text-3xl font-black text-white">
                Votre compte FREE est activé.
              </h2>
              <p className="mt-3 leading-7 text-slate-300">
                Vous disposez de {success.credits.balance} crédits pour tester
                la création de vidéos assistées par IA.
              </p>

              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-sm text-slate-200">
                <p>Email : {success.user.email}</p>
                <p>Nom : {success.user.name || "Non renseigné"}</p>
                <p>Plan actuel : {success.user.plan ?? "FREE"}</p>
                <p>Solde de crédits : {success.credits.balance}</p>
              </div>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/studio"
                  className="inline-flex justify-center rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 hover:bg-emerald-300"
                >
                  Créer ma première vidéo
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 font-bold text-white hover:border-cyan-300"
                >
                  Voir mes crédits
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Accéder au Studio IA
                </p>
                <h2 className="mt-3 text-3xl font-black text-white">
                  Créer ou retrouver mon compte
                </h2>
              </div>

              <label className="block text-sm font-semibold text-slate-200">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white outline-none transition focus:border-cyan-300"
                  placeholder="client@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-200">
                Nom facultatif
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white outline-none transition focus:border-cyan-300"
                  placeholder="Votre nom"
                  autoComplete="name"
                  maxLength={80}
                />
              </label>

              {error ? (
                <div
                  className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || checkingSession}
                aria-busy={loading || checkingSession}
                className="w-full rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading || checkingSession
                  ? "Connexion en cours..."
                  : "Accéder au Studio IA"}
              </button>

              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4 text-sm leading-6 text-slate-300">
                <p>Version bêta : connexion simplifiée par email.</p>
                <p className="mt-2">
                  Pour la version commerciale, une authentification renforcée
                  sera ajoutée : lien magique, Google Login ou mot de passe.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
