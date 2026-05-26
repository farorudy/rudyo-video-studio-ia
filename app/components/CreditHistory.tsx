"use client";

import { useEffect, useState } from "react";

type TransactionItem = {
  id: string;
  type: string;
  action: string;
  creditsAmount: number;
  description: string;
  status: string;
  createdAt: string;
};

export default function CreditHistory() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/credits/transactions", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Impossible de charger l’historique.");
          return;
        }
        setTransactions(json.transactions ?? []);
      } catch {
        setError("Impossible de charger l’historique des crédits.");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return <p className="text-slate-400">Chargement de l’historique...</p>;
  }

  if (error) {
    return <p className="text-rose-300">{error}</p>;
  }

  if (transactions.length === 0) {
    return (
      <p className="text-slate-400">
        Aucune transaction de crédits pour le moment.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        <thead>
          <tr>
            <th className="px-4 py-3 text-slate-400">Date</th>
            <th className="px-4 py-3 text-slate-400">Type</th>
            <th className="px-4 py-3 text-slate-400">Action</th>
            <th className="px-4 py-3 text-slate-400">Crédits</th>
            <th className="px-4 py-3 text-slate-400">Statut</th>
            <th className="px-4 py-3 text-slate-400">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-4 py-3 text-slate-300">
                {new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-slate-300">{transaction.type}</td>
              <td className="px-4 py-3 text-slate-300">{transaction.action}</td>
              <td className="px-4 py-3 text-slate-300">
                {transaction.creditsAmount > 0
                  ? `+${transaction.creditsAmount}`
                  : transaction.creditsAmount}
              </td>
              <td className="px-4 py-3 text-slate-300">
                {transaction.status}
              </td>
              <td className="px-4 py-3 text-slate-300">
                {transaction.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
