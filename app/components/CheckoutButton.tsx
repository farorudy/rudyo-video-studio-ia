"use client";

import { useState } from "react";

type Props = {
  productId: string;
  mode: "credit" | "subscription";
  children: React.ReactNode;
  className?: string;
};

export default function CheckoutButton({
  productId,
  mode,
  children,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ productId, mode }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Paiement indisponible.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Impossible de lancer le paiement.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={
          className ??
          "w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Ouverture du paiement..." : children}
      </button>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
