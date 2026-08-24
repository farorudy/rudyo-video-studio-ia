import { CLIP_PLANS } from "@/lib/tiktok-offer";

const descriptions = {
  TIKTOK: "Jusqu’à 3 min 30",
  LONG: "Jusqu’à 5 minutes",
  PREMIUM: "Jusqu’à 7 minutes",
} as const;

export default function ClipPlanCards({ compact = false }: { compact?: boolean }) {
  return <section className={compact ? "" : "mx-auto max-w-7xl px-4 py-14 md:px-8"}>
    <div className="mb-7 max-w-4xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Formules clips automatiques</p>
      <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Trois durées, trois prix fixes.</h2>
      <p className="mt-4 leading-7 text-slate-300">Choisissez votre formule avant d’ajouter votre musique. Si votre solde est insuffisant, Rudyo vous propose d’acheter seulement les crédits manquants.</p>
    </div>
    <div className="grid gap-5 md:grid-cols-3">
      {Object.values(CLIP_PLANS).map((plan) => <article key={plan.code} className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <h3 className="text-2xl font-black text-white">{plan.name.replace("Formule ", "")}</h3>
        <p className="mt-3 text-lg font-bold text-cyan-200">{descriptions[plan.code]}</p>
        <p className="mt-5 text-3xl font-black text-white">{plan.maxCredits.toLocaleString("fr-FR")} crédits</p>
        <p className="mt-2 text-slate-300">{plan.maxPriceEur} €</p>
      </article>)}
    </div>
  </section>;
}
