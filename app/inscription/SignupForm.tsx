"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthResponse = {
  success: boolean;
  error?: string;
  challengeRequired?: boolean;
};

async function readResponse(response: Response): Promise<AuthResponse> {
  try {
    return (await response.json()) as AuthResponse;
  } catch {
    return { success: false, error: "Réponse du serveur invalide." };
  }
}

export default function SignupForm({ firstPurchaseBonus }: { firstPurchaseBonus: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [challengeRequested, setChallengeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? router.replace("/credits/acheter") : undefined)
      .catch(() => undefined)
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [router]);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!termsAccepted) {
      setError("Vous devez accepter les conditions d’utilisation pour créer votre compte.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
        }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body.success) {
        setError(body.error || "Impossible d’envoyer le code de vérification.");
        return;
      }
      if (body.challengeRequired) setChallengeRequested(true);
      else router.replace("/credits/acheter?bienvenue=1");
    } catch {
      setError("Impossible d’envoyer le code. Réessayez dans quelques instants.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Saisissez le code à six chiffres reçu par e-mail.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body.success) {
        setError(body.error || "Code invalide ou expiré.");
        return;
      }
      router.replace("/credits/acheter?bienvenue=1");
    } catch {
      setError("Impossible de vérifier le code. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={challengeRequested ? verifyCode : requestCode}
      className="rounded-3xl border border-slate-700/80 bg-slate-950/90 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8"
    >
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
        {challengeRequested ? "Vérification" : "Créer mon compte"}
      </p>
      <h2 className="mt-3 text-3xl font-black text-white">
        {challengeRequested ? "Consultez votre e-mail" : "Inscription gratuite"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {challengeRequested
          ? `Nous avons envoyé un code à ${email}.`
          : "Aucun mot de passe à retenir. Votre adresse est vérifiée avec un code à usage unique."}
      </p>

      <div className="mt-7 space-y-5">
        {!challengeRequested ? (
          <>
            <label className="block text-sm font-semibold text-slate-200">
              Nom complet
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
                placeholder="Votre nom"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Adresse e-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="vous@exemple.com"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-white outline-none transition focus:border-cyan-300"
              />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                required
                className="mt-1 h-4 w-4 accent-cyan-400"
              />
              <span>
                J’accepte les conditions d’utilisation et la politique de confidentialité de Rudyo AI.
              </span>
            </label>
          </>
        ) : (
          <label className="block text-sm font-semibold text-slate-200">
            Code à six chiffres
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
              autoFocus
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center text-2xl tracking-[0.35em] text-white outline-none focus:border-cyan-300"
            />
            <span className="mt-2 block text-xs font-normal text-slate-400">
              Le code expire dans 10 minutes et ne peut être utilisé qu’une fois.
            </span>
          </label>
        )}
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || checking}
        className="mt-6 w-full rounded-2xl bg-cyan-400 px-5 py-4 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading || checking
          ? "Veuillez patienter…"
          : challengeRequested
            ? "Vérifier et continuer"
            : "Créer mon compte gratuitement"}
      </button>

      {challengeRequested ? (
        <button
          type="button"
          onClick={() => { setChallengeRequested(false); setOtp(""); setError(""); }}
          className="mt-4 w-full text-sm font-semibold text-slate-300 hover:text-white"
        >
          Modifier mes informations
        </button>
      ) : (
        <p className="mt-5 text-center text-sm text-slate-400">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-bold text-cyan-300 hover:text-cyan-200">
            Se connecter
          </Link>
        </p>
      )}

      {!challengeRequested && firstPurchaseBonus > 0 ? (
        <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-center text-xs font-semibold text-emerald-200">
          Bonus de premier achat : +{firstPurchaseBonus} crédits.
        </p>
      ) : null}
    </form>
  );
}
