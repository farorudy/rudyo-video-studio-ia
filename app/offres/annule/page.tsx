export default function AnnulePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">↩️</div>
        <h1 className="text-3xl font-extrabold text-white mb-3">
          Paiement annulé
        </h1>
        <p className="text-slate-400 mb-8">
          Aucun montant n'a été débité. Vous pouvez reprendre votre commande
          quand vous le souhaitez.
        </p>
        <a
          href="/offres"
          className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
        >
          ← Retour aux offres
        </a>
      </div>
    </main>
  );
}
