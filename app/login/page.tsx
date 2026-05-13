"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Impossible de vous connecter.");
        return;
      }
      router.push("/credits");
    } catch (err) {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 font-sans">
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-10 shadow-xl shadow-slate-950/20">
          <h1 className="text-4xl font-extrabold text-white mb-3">
            Connexion Rudyo
          </h1>
          <p className="text-slate-400 mb-8">
            Identifiez-vous pour suivre vos crédits Rudyo et activer votre plan.
          </p>
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
            {error ? <p className="text-rose-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
