"use client";

export type ExportConfigValues = {
  resolution: "1280x720" | "1920x1080" | "1080x1920";
  transitionType: "cut" | "fade" | "wipe";
  transitionDuree: number;
  musiqueVolume: number;
  voixVolume: number;
  voixFile?: string;
};

type Props = {
  config: ExportConfigValues;
  onChange: (config: ExportConfigValues) => void;
};

const RESOLUTIONS = [
  { value: "1280x720", label: "720p HD (16:9 YouTube)" },
  { value: "1920x1080", label: "1080p Full HD (16:9)" },
  { value: "1080x1920", label: "1080×1920 Vertical (9:16 TikTok / Reels)" },
] as const;

const TRANSITIONS = [
  { value: "cut", label: "Coupure directe (cut)" },
  { value: "fade", label: "Fondu enchaîné (fade)" },
  { value: "wipe", label: "Balayage gauche (wipe)" },
] as const;

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-emerald-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        title={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}

export default function ExportConfig({ config, onChange }: Props) {
  function set<K extends keyof ExportConfigValues>(
    key: K,
    value: ExportConfigValues[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            Export
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Configuration de l&apos;export
          </h3>
        </div>
      </div>

      <p className="text-sm text-slate-300">
        Ajustez la résolution, la transition et les volumes avant de lancer le
        montage final.
      </p>

      {/* Résolution */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
          Résolution
        </label>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() =>
                set("resolution", r.value as ExportConfigValues["resolution"])
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                config.resolution === r.value
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transition */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
          Transition entre clips
        </label>
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() =>
                set(
                  "transitionType",
                  t.value as ExportConfigValues["transitionType"],
                )
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                config.transitionType === t.value
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Durée de transition (masquée si cut) */}
      {config.transitionType !== "cut" && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <Slider
            label="Durée de la transition"
            value={config.transitionDuree}
            min={0.2}
            max={1.5}
            step={0.1}
            onChange={(v) => set("transitionDuree", v)}
            display={`${config.transitionDuree.toFixed(1)} s`}
          />
        </div>
      )}

      {/* Volume musique */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <Slider
          label="Volume musique de fond"
          value={config.musiqueVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set("musiqueVolume", v)}
          display={`${Math.round(config.musiqueVolume * 100)} %`}
        />
      </div>

      {/* Volume voix */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <Slider
          label="Volume voix (si piste voix)"
          value={config.voixVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set("voixVolume", v)}
          display={`${Math.round(config.voixVolume * 100)} %`}
        />
      </div>
    </div>
  );
}
