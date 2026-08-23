import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import { BETA_USER_TESTS, getBetaTestLabel } from "@/lib/beta-user-tests";
import type { ModelCreditUnit } from "@/lib/model-credit-rates";
import { notFound } from "next/navigation";

const unitLabels: Record<ModelCreditUnit, string> = {
  "per image": "par image",
  "per second": "par seconde",
  "per request": "par requete",
  "per shot": "par plan",
};

function getMinimumQuantity(requirement: string) {
  const match = requirement.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

function getMinimumCredits(credits: number, unit: ModelCreditUnit, requirement: string) {
  if (unit === "per image" || unit === "per request" || unit === "per shot") {
    return credits;
  }

  return credits * getMinimumQuantity(requirement);
}

export default function BetaTestsPage() {
  if (process.env.BETA_TESTS_ENABLED !== "true") notFound();
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-24 md:px-8">
        <div className="max-w-4xl">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Tests beta utilisateurs
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Un test terrain pour chaque usage IA.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Utilisez ces scenarios pour observer des testeurs reels, verifier la
            comprehension des credits et identifier les points de friction avant
            une mise en production large.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/pricing"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Voir la grille credits
            </Link>
            <Link
              href="/studio"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 font-bold text-white hover:border-cyan-400"
            >
              Ouvrir le Studio
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 md:px-8">
        {BETA_USER_TESTS.map((test, index) => (
          <article
            key={test.id}
            className="border border-slate-800 bg-slate-950 p-5 md:p-7"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Test {index + 1} - {getBetaTestLabel(test)}
                </p>
                <h2 className="mt-3 text-2xl font-black md:text-4xl">
                  {test.usage}
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  <span className="font-bold text-white">Profil : </span>
                  {test.testerProfile}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  <span className="font-bold text-white">Objectif : </span>
                  {test.goal}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  <span className="font-bold text-white">Brief : </span>
                  {test.brief}
                </p>
              </div>

              <div className="min-w-44 border border-cyan-400/30 bg-cyan-400/10 p-4">
                <p className="text-sm text-cyan-100">Modeles a tester</p>
                <p className="mt-2 text-4xl font-black text-cyan-300">
                  {test.models.length}
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="text-lg font-black">Parcours testeur</h3>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  {test.steps.map((step) => (
                    <li key={step} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 bg-cyan-300" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="text-lg font-black">Validation</h3>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {test.expectedOutcome}
                </p>
                <div className="mt-5 space-y-2 text-sm text-slate-300">
                  {test.successCriteria.map((criterion) => (
                    <p key={criterion}>OK - {criterion}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto border border-slate-800">
              <table className="min-w-[760px] w-full border-collapse bg-slate-950 text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">Modele</th>
                    <th className="px-4 py-3 font-bold">Resolution</th>
                    <th className="px-4 py-3 text-right font-bold">
                      Credits
                    </th>
                    <th className="px-4 py-3 font-bold">Unite</th>
                    <th className="px-4 py-3 font-bold">Minimum</th>
                    <th className="px-4 py-3 text-right font-bold">
                      Cout min.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {test.models.map((model) => (
                    <tr
                      key={`${test.id}-${model.model}-${model.resolution}`}
                      className="text-slate-200"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        {model.model}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {model.resolution}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-cyan-300">
                        {model.credits}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {unitLabels[model.unit]}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {model.requirement}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-300">
                        {getMinimumCredits(
                          model.credits,
                          model.unit,
                          model.requirement,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-lg font-black">Questions a poser</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {test.feedbackQuestions.map((question) => (
                  <p
                    key={question}
                    className="border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300"
                  >
                    {question}
                  </p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
