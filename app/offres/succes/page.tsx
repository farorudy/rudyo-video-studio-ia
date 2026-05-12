export default function SuccesPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-extrabold text-white mb-3">
          Paiement confirmé !
        </h1>
        <p className="text-slate-400 mb-8">
          Merci pour votre commande. Vous recevrez un email de confirmation sous
          peu. Nous vous contacterons dans les{" "}
          <strong className="text-slate-200">24 heures</strong> pour démarrer
          votre projet.
        </p>
        <a
          href="mailto:hello@farozik.com?subject=Ma%20commande%20Rudyo%20Video%20Studio"
          className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-all mb-4"
        >
          Envoyer les éléments (affiche, musique…)
        </a>
        <br />
        <a
          href="/offres"
          className="text-slate-500 hover:text-slate-300 text-sm underline"
        >
          ← Retour aux offres
        </a>
      </div>
    </main>
  );
}
