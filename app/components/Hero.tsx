"use client";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-sm font-semibold text-cyan-400">
                Studio IA en direct
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
              Créez des vidéos professionnelles
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
                avec l'IA
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Transformez une idée, une affiche, une chanson, une formation ou
              un événement en vidéo prête à publier en quelques minutes.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              {[
                "🎬 Storyboard IA",
                "✨ Prompts vidéo",
                "📄 Export PDF",
                "🎞️ Montage MP4",
                "📱 Formats réseaux",
              ].map((badge) => (
                <div
                  key={badge}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-700 bg-slate-900/50 text-sm text-slate-300"
                >
                  {badge}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button className="px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all">
                Commencer maintenant
              </button>
              <button className="px-8 py-4 rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-bold text-lg hover:bg-cyan-500/20 transition-all">
                Voir les offres
              </button>
            </div>
          </div>

          {/* Right Side - Dashboard Card */}
          <div className="hidden lg:block relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-3xl blur-3xl"></div>
            <div className="relative rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/80 to-slate-950 p-8 shadow-2xl">
              {/* Header du dashboard */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Projet actuel</div>
                    <div className="text-white font-semibold">
                      Bòd lanmè pa lwen
                    </div>
                  </div>
                </div>
                <div className="text-2xl">🎬</div>
              </div>

              {/* Stats Grid */}
              <div className="space-y-4">
                {[
                  {
                    label: "Storyboard",
                    status: "✓ Généré",
                    color: "text-emerald-400",
                  },
                  {
                    label: "Plans vidéo",
                    status: "✓ 25 plans",
                    color: "text-emerald-400",
                  },
                  {
                    label: "Prompts IA",
                    status: "✓ Prêts",
                    color: "text-emerald-400",
                  },
                  {
                    label: "Progression",
                    status: "75%",
                    color: "text-cyan-400",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                  >
                    <span className="text-sm text-slate-400">{item.label}</span>
                    <span className={`text-sm font-semibold ${item.color}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    Prêt pour l'export
                  </span>
                  <span className="text-xs text-cyan-400 font-semibold">
                    75%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 w-3/4 rounded-full transition-all"></div>
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full mt-6 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                Créer mon clip MP4
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
