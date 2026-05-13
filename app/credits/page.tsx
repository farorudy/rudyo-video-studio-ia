import CreditDashboard from "@/app/components/CreditDashboard";
import Navigation from "@/app/components/Navigation";

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 font-sans">
      <Navigation />
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Crédits Rudyo & abonnements
          </h1>
          <p className="max-w-3xl text-slate-400 text-lg">
            Gérez vos crédits internes pour générer storyboards, prompts vidéo,
            exports PDF et préparer vos workflows IA sur Rudyo Video Studio IA.
            Les crédits Rudyo sont internes à la plateforme Rudyo et ne
            constituent pas des crédits OpenAI.
          </p>
        </div>

        <div className="mt-8">
          <CreditDashboard />
        </div>
      </section>
    </main>
  );
}
