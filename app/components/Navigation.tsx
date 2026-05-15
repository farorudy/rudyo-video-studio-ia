"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/pricing", label: "Tarifs" },
  { href: "/studio", label: "Studio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projets" },
  { href: "/order-video", label: "Commande video" },
];

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-cyan-400 transition hover:text-cyan-300"
          >
            Farozik Rudyo
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
            <Link
              href="/login"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400"
            >
              Connexion
            </Link>
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
            <Link
              href="/login"
              className="rounded-lg bg-cyan-400 px-3 py-2 text-center text-sm font-black text-slate-950"
              onClick={() => setMobileMenuOpen(false)}
            >
              Connexion
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
