import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <div className="max-w-lg text-center">
        <p className="text-sm font-black uppercase tracking-widest text-cyan-300">Erreur 404</p>
        <h1 className="mt-3 text-4xl font-black">Cette page n’est pas disponible</h1>
        <p className="mt-4 text-slate-300">Vérifiez l’adresse ou revenez à votre espace Rudyo AI.</p>
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
