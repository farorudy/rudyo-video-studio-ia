"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/components/SessionProvider";

type AuthResponse = {
  success: boolean;
  error?: string;
  challengeRequired?: boolean;
  user?: { email: string; name: string | null; plan?: string };
  credits?: { balance: number };
};

async function readResponse(response: Response): Promise<AuthResponse> {
  try {
    return (await response.json()) as AuthResponse;
  } catch {
    return { success: false, error: "Réponse du serveur invalide." };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { status, refreshSession } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeRequested, setChallengeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() || undefined }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body.success) {
        setError(body.error || "Impossible d’envoyer le code.");
        return;
      }
      if (body.challengeRequired) setChallengeRequested(true);
      else router.replace("/dashboard");
    } catch {
      setError("Impossible d’envoyer le code. Réessayez.");
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
      await refreshSession();
      router.replace("/dashboard");
    } catch {
      setError("Impossible de vérifier le code. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] px-5 py-10 text-slate-100">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 md:grid-cols-[1fr_440px] md:items-center">
        <div>
          <Link href="/" className="text-sm font-bold text-cyan-200">Rudyo AI</Link>
          <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">Votre identité, vraiment vérifiée.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Un code temporaire est envoyé à votre adresse. Connaître une adresse e-mail ne suffit plus pour accéder à son compte.
          </p>
        </div>

        <form
          onSubmit={challengeRequested ? verifyCode : requestCode}
          className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/90 p-7 shadow-2xl"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Connexion sécurisée</p>
            <h2 className="mt-3 text-3xl font-black">{challengeRequested ? "Saisissez votre code" : "Recevez votre code"}</h2>
          </div>

          {!challengeRequested ? (
            <>
              <label className="block text-sm font-semibold">
                Adresse e-mail
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 outline-none focus:border-cyan-300" />
              </label>
              <label className="block text-sm font-semibold">
                Nom facultatif
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 outline-none focus:border-cyan-300" />
              </label>
            </>
          ) : (
            <label className="block text-sm font-semibold">
              Code à six chiffres
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} required className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center text-2xl tracking-[0.35em] outline-none focus:border-cyan-300" />
              <span className="mt-2 block text-xs font-normal text-slate-400">Expiration dans 10 minutes, usage unique.</span>
            </label>
          )}

          {error ? <div role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100">{error}</div> : null}

          <button type="submit" disabled={loading || status === "loading"} className="w-full rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 disabled:opacity-60">
            {loading || status === "loading" ? "Veuillez patienter…" : challengeRequested ? "Vérifier et me connecter" : "Recevoir mon code sécurisé"}
          </button>

          {challengeRequested ? (
            <button type="button" onClick={() => { setChallengeRequested(false); setOtp(""); setError(""); }} className="w-full text-sm font-semibold text-slate-300 hover:text-white">
              Utiliser une autre adresse
            </button>
          ) : null}

          {!challengeRequested ? (
            <p className="text-center text-sm text-slate-400">
              Pas encore de compte ?{" "}
              <Link href="/inscription" className="font-bold text-cyan-300 hover:text-cyan-200">
                S’inscrire gratuitement
              </Link>
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
