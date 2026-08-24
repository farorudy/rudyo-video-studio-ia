"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/components/SessionProvider";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const { status, user, logout } = useSession();
  const links = status === "authenticated"
    ? [
        { href: "/", label: "Créer mon clip" },
        { href: "/creations", label: "Mes créations" },
        { href: "/credits", label: "Mes crédits" },
        { href: "/dashboard", label: "Mon compte" },
      ]
    : [
        { href: "/", label: "Accueil" },
        { href: "/#comment-ca-marche", label: "Comment ça marche" },
        { href: "/pricing", label: "Tarifs" },
      ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setMobileMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const sessionActions = status === "authenticated" && user ? (
    <div className="flex items-center gap-2">
      <Link href="/dashboard" className="max-w-44 truncate text-sm font-semibold text-cyan-200">
        {user.name || user.email} · {user.credits.balance} crédits
      </Link>
      <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 disabled:opacity-60">
        {loggingOut ? "Déconnexion…" : "Déconnexion"}
      </button>
    </div>
  ) : status === "anonymous" ? (
    <div className="flex items-center gap-2">
      <Link href="/login" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400">
        Se connecter
      </Link>
      <Link href="/inscription" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
        Créer un compte
      </Link>
    </div>
  ) : <span className="text-sm text-slate-400">Session…</span>;

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-cyan-400 transition hover:text-cyan-300"
          >
            Rudyo AI
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {sessionActions}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 md:hidden"
            aria-label="Ouvrir le menu"
          >
            Menu
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="grid gap-2 border-t border-slate-800 py-4 md:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {status === "authenticated" && user ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-cyan-200" onClick={() => setMobileMenuOpen(false)}>
                  {user.name || user.email} · {user.credits.balance} crédits
                </Link>
                <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60">
                  {loggingOut ? "Déconnexion…" : "Déconnexion"}
                </button>
              </>
            ) : status === "anonymous" ? (
              <>
                <Link href="/login" className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-100" onClick={() => setMobileMenuOpen(false)}>Se connecter</Link>
                <Link href="/inscription" className="rounded-lg bg-cyan-400 px-3 py-2 text-center text-sm font-black text-slate-950" onClick={() => setMobileMenuOpen(false)}>Créer un compte</Link>
              </>
            ) : <span className="px-3 py-2 text-sm text-slate-400">Session…</span>}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
