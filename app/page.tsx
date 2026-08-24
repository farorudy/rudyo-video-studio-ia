import Navigation from "@/app/components/Navigation";
import SimpleClipCreator from "@/app/components/SimpleClipCreator";

export default function HomePage() {
  return (
    <main className="min-h-screen text-slate-100">
      <Navigation />
      <SimpleClipCreator />
      <section id="comment-ca-marche" className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Comment ça marche</p>
        <h2 className="mt-4 text-3xl font-black sm:text-5xl">Trois éléments. Un clip prêt à partager.</h2>
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {["Ajoutez votre photo", "Ajoutez votre chanson", "Décrivez votre idée"].map((label, index) => (
            <article key={label} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-cyan-400 font-black text-slate-950">{index + 1}</span>
              <h3 className="mt-5 text-lg font-black">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Rudyo AI prépare automatiquement le scénario, les scènes et le montage.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
