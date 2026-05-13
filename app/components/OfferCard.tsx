"use client";

type Props = {
  title: string;
  price: string;
  duration: string;
  description: string;
  highlight?: boolean;
};

export default function OfferCard({
  title,
  price,
  duration,
  description,
  highlight,
}: Props) {
  return (
    <div
      className={`rounded-3xl border p-8 transition ${
        highlight
          ? "border-cyan-500 bg-gradient-to-br from-cyan-500/15 to-blue-950 shadow-xl shadow-cyan-500/10"
          : "border-slate-700 bg-slate-900/80 hover:border-cyan-400"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
        {duration}
      </p>
      <h3 className="mt-4 text-3xl font-bold text-white">{title}</h3>
      <p className="mt-4 text-4xl font-bold text-cyan-400">{price}</p>
      <p className="mt-5 text-sm leading-6 text-slate-300">{description}</p>
      <button className="mt-8 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
        Commander
      </button>
    </div>
  );
}
