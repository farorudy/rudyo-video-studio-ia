"use client";

const steps = ["Modèle", "Compte", "Crédits", "Génération", "Résultat"];

type StepProgressProps = {
  currentStep: number;
};

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const active = index <= currentStep;

          return (
            <div key={step} className="flex flex-col items-center gap-2">
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-slate-800 text-slate-400",
                ].join(" ")}
              >
                {index + 1}
              </div>
              <p
                className={[
                  "text-center text-xs font-medium",
                  active ? "text-cyan-200" : "text-slate-500",
                ].join(" ")}
              >
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
