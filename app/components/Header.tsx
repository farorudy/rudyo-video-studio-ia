"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex flex-col gap-0">
            <div className="font-bold text-lg text-cyan-400">🎬 Farozik</div>
            <div className="text-xs text-slate-400">Rudyo Vidéo Studio IA</div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Accueil
            </Link>
            <a
              href="#create"
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Créer
            </a>
            <Link
              href="/offres"
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Offres
            </Link>
            <a
              href="#export"
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Exemples
            </a>
            <a
              href="#contact"
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Devis
            </a>
          </nav>

          {/* CTA Button */}
          <button className="hidden md:block px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition">
            Créer ma vidéo
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <svg
              className="w-6 h-6 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 py-4 space-y-3 pb-4">
            <Link
              href="/"
              className="block text-sm text-slate-300 hover:text-white py-2"
            >
              Accueil
            </Link>
            <a
              href="#create"
              className="block text-sm text-slate-300 hover:text-white py-2"
            >
              Créer
            </a>
            <Link
              href="/offres"
              className="block text-sm text-slate-300 hover:text-white py-2"
            >
              Offres
            </Link>
            <a
              href="#export"
              className="block text-sm text-slate-300 hover:text-white py-2"
            >
              Exemples
            </a>
            <a
              href="#contact"
              className="block text-sm text-slate-300 hover:text-white py-2"
            >
              Devis
            </a>
            <button className="w-full px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition mt-2">
              Créer ma vidéo
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
