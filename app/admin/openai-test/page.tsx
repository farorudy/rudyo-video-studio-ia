"use client";

import { useState, type FormEvent } from "react";

type Result = {
  success: boolean;
  error?: string;
  providerStatus?: number;
  model?: string;
  answer?: string;
  totalTokens?: number | null;
};

export default function OpenAiTestPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  async function runTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || running) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/openai-diagnostic", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json() as Result;
      setResult(body);
      setToken("");
    } catch {
      setResult({ success: false, error: "DIAGNOSTIC_UNAVAILABLE" });
      setToken("");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100">
      <section className="mx-auto max-w-xl border-l-2 border-cyan-400 pl-6">
        <p className="text-sm font-bold uppercase tracking-widest text-cyan-300">Administration</p>
        <h1 className="mt-3 text-3xl font-bold">Diagnostic OpenAI</h1>
        <p className="mt-3 leading-relaxed text-slate-300">
          Vérifie le même endpoint Chat Completions que le tutorat avec une requête courte. Aucun cours ni quota apprenant n’est utilisé.
        </p>
        <form onSubmit={runTest} className="mt-8 space-y-4">
          <label htmlFor="admin-token" className="block text-sm font-semibold">Jeton administrateur du diagnostic</label>
          <input
            id="admin-token"
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
          <button
            type="submit"
            disabled={running || !token}
            className="rounded-md bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60"
          >
            {running ? "Test en cours…" : "Tester OpenAI"}
          </button>
        </form>
        {result ? (
          <div role="status" className={`mt-6 border-l-2 pl-4 ${result.success ? "border-emerald-400" : "border-amber-400"}`}>
            <p className="font-semibold">{result.success ? "Connexion OpenAI validée" : `Échec : ${result.error || "UNKNOWN_ERROR"}`}</p>
            {result.providerStatus ? <p className="mt-1 text-sm text-slate-300">HTTP fournisseur : {result.providerStatus}</p> : null}
            {result.success ? <p className="mt-1 text-sm text-slate-300">Modèle : {result.model} · Réponse : {result.answer} · Tokens : {result.totalTokens ?? "—"}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}