"use client";

type ProjectStatusProps = {
  storyboardStatus?: "completed" | "in_progress" | "pending";
  promptsStatus?: "completed" | "in_progress" | "pending";
  mediasStatus?: "completed" | "in_progress" | "pending";
  subtitlesStatus?: "completed" | "in_progress" | "pending";
  overallProgress?: number;
};

export default function ProjectStatus({
  storyboardStatus = "pending",
  promptsStatus = "pending",
  mediasStatus = "pending",
  subtitlesStatus = "pending",
  overallProgress = 0,
}: ProjectStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
      case "in_progress":
        return "bg-cyan-500/20 border-cyan-500/50 text-cyan-400";
      default:
        return "bg-slate-800/50 border-slate-700 text-slate-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "✓ Complété";
      case "in_progress":
        return "⏳ En cours";
      default:
        return "⊗ En attente";
    }
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Status Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-2xl font-bold text-white mb-6">
              État de votre projet
            </h3>

            {[
              { label: "Storyboard", status: storyboardStatus, icon: "🎬" },
              { label: "Prompts IA", status: promptsStatus, icon: "✨" },
              { label: "Médias", status: mediasStatus, icon: "📁" },
              { label: "Sous-titres", status: subtitlesStatus, icon: "📝" },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-4 ${getStatusColor(item.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="font-semibold text-white">
                        {item.label}
                      </div>
                      <div className="text-xs opacity-75">Statut du projet</div>
                    </div>
                  </div>
                  <div className="font-bold text-sm">
                    {getStatusLabel(item.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Card */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent p-6 h-fit">
            <h4 className="font-bold text-white mb-4">Progression globale</h4>

            <div className="space-y-4 mb-6">
              {/* Progress Ring */}
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <svg
                    className="w-full h-full transform -rotate-90"
                    viewBox="0 0 120 120"
                  >
                    {/* Background circle */}
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-slate-700"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${(overallProgress / 100) * 339.29} 339.29`}
                      className="text-cyan-400 transition-all"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-cyan-400">
                        {overallProgress}%
                      </div>
                      <div className="text-xs text-slate-400">Complet</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="border-t border-cyan-500/30 pt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Prochaines étapes
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  {overallProgress < 25 && <li>✓ Générer le storyboard</li>}
                  {overallProgress < 50 && <li>✓ Préparer les prompts</li>}
                  {overallProgress < 75 && <li>✓ Importer les médias</li>}
                  {overallProgress < 100 && <li>✓ Finaliser et exporter</li>}
                </ul>
              </div>
            </div>

            <button className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
              Continuer le projet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
