import Navigation from "@/app/components/Navigation";
import CreditHistory from "@/app/components/CreditHistory";

export default function CreditsHistoryPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 font-sans">
      <Navigation />
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Historique des crédits
          </h1>
          <p className="max-w-3xl text-slate-400 text-lg mb-8">
            Suivez vos achats, utilisations et remboursements de crédits Rudyo.
          </p>
          <CreditHistory />
        </div>
      </section>
    </main>
  );
}
