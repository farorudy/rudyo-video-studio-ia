"use client";

type Props = {
  name: string;
  credits: number;
  price: string;
  description: string;
  highlight?: boolean;
};

export default function CreditPackCard({
  name,
  credits,
  price,
  description,
  highlight,
}: Props) {
  return (
    <div
      className={`rounded-3xl border p-7 transition ${
        highlight
          ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
          : "border-slate-700 bg-slate-900/80 hover:border-cyan-400"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
        {name}
      </p>
      <p className="mt-4 text-5xl font-bold text-white">{credits}</p>
      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">
        Crédits Rudyo
      </p>
      <p className="mt-4 text-3xl font-semibold text-cyan-400">{price}</p>
      <p className="mt-5 text-sm leading-6 text-slate-300">{description}</p>
      <button className="mt-8 w-full rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
        Acheter
      </button>
    </div>
  );
}
