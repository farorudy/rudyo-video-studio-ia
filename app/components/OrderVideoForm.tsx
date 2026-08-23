"use client";

import { useState } from "react";
import Script from "next/script";

const videoTypes = [
  "Flyer anime",
  "Vidéo promotionnelle",
  "Clip lyrics",
  "Clip IA complet",
  "Capsule de formation",
  "Vidéo événementielle",
  "Pack reseaux sociaux",
];

export default function OrderVideoForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submitOrder(formData: FormData) {
    setStatus("loading");
    setMessage("");

    const payload = {
      prenom: String(formData.get("prenom") || ""),
      nom: String(formData.get("nom") || ""),
      email: String(formData.get("email") || ""),
      telephone: String(formData.get("telephone") || ""),
      typeVideo: String(formData.get("typeVideo") || ""),
      objectif: String(formData.get("objectif") || ""),
      dateLimite: String(formData.get("dateLimite") || ""),
      budget: String(formData.get("budget") || ""),
      fichiers: String(formData.get("fichiers") || ""),
      message: String(formData.get("message") || ""),
      turnstileToken: String(formData.get("cf-turnstile-response") || ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        // Empêche un double envoi lors d’un double-clic ou d’une reprise réseau.
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'envoyer la demande.");
      }

      setStatus("success");
      setMessage(`Demande reçue. Votre identifiant de confirmation est ${data.requestId}.`);
    } catch (orderError) {
      setStatus("error");
      setMessage(
        orderError instanceof Error
          ? orderError.message
          : "Impossible d'envoyer la demande.",
      );
    }
  }

  return (
    <form action={submitOrder} className="grid gap-5">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Prenom
          <input
            name="prenom"
            required
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Nom
          <input
            name="nom"
            required
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Telephone
          <input
            name="telephone"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Type de video
          <select
            name="typeVideo"
            required
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            <option value="">Choisir un service</option>
            {videoTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Budget estime
          <select
            name="budget"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            <option value="">A definir</option>
            <option value="50-150">50 a 150 EUR</option>
            <option value="150-400">150 a 400 EUR</option>
            <option value="400-900">400 a 900 EUR</option>
            <option value="900+">900 EUR et plus</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Objectif principal
        <input
          name="objectif"
          required
          placeholder="Ex : annoncer un concert, lancer une formation, creer un clip..."
          className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
        />
      </label>

      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
        <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      ) : (
        <p className="text-sm text-amber-300">Le formulaire est indisponible : CAPTCHA non configuré.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Date limite
          <input
            name="dateLimite"
            type="date"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Liens fichiers
          <input
            name="fichiers"
            placeholder="Drive, Dropbox, WeTransfer..."
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Message
        <textarea
          name="message"
          rows={5}
          placeholder="Decrivez le style, le public, les formats souhaites et les references."
          className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
        />
      </label>

      <button
        type="submit"
        disabled={status === "loading" || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Envoi en cours..." : "Demander un devis"}
      </button>

      {message ? (
        <p
          className={
            status === "success"
              ? "text-sm font-semibold text-emerald-300"
              : "text-sm font-semibold text-rose-300"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
