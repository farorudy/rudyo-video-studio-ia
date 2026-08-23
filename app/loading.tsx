export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-300" />
        <p className="mt-4 font-semibold text-slate-300">Chargement de votre espace Rudyo AI…</p>
      </div>
    </main>
  );
}
