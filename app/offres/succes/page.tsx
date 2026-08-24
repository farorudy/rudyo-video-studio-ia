import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ session_id?: string; projectId?: string }>;
};

export default async function SuccesPage({ searchParams }: Props) {
  const { session_id: sessionId, projectId } = await searchParams;
  if (projectId) {
    redirect(`/?resumeProjectId=${encodeURIComponent(projectId)}&payment=success`);
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-2xl items-center justify-center py-16">
        <div className="w-full rounded-lg border border-emerald-400/30 bg-slate-950/90 p-8 text-center shadow-2xl shadow-emerald-950/20">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
            Paiement valide
          </p>
          <h1 className="mt-4 text-3xl font-black text-white">
            Vos tokens arrivent dans votre compte.
          </h1>
          <p className="mt-4 leading-7 text-slate-300">
            Stripe a confirme le paiement. Le solde est credite uniquement par
            le webhook securise, jamais depuis cette page.
          </p>
          {sessionId ? (
            <p className="mt-4 break-all rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
              Session Stripe : {sessionId}
            </p>
          ) : null}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/credits"
              className="rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Voir mon solde
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-white transition hover:border-emerald-300"
            >
              Retour aux packs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
