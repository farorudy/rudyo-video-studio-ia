"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function RouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) router.back(); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Studio scénario" className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 shadow-2xl"><button ref={closeRef} type="button" onClick={() => router.back()} aria-label="Fermer le studio" className="absolute right-4 top-4 z-10 rounded-full bg-slate-900 p-2 text-white focus:ring-2 focus:ring-cyan-300"><X /></button>{children}</div></div>;
}
