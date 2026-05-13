"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="font-bold text-lg text-cyan-400 hover:text-cyan-300 transition"
          >
            🎬 Farozik
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-slate-300 hover:text-white transition text-sm"
            >
              Accueil
            </Link>
            <Link
              href="/offres"
              className="text-slate-300 hover:text-white transition text-sm"
            >
              Offres & tarifs
            </Link>
            <Link
              href="/credits"
              className="text-slate-300 hover:text-white transition text-sm"
            >
              Crédits
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition text-sm"
            >
              Connexion
            </Link>
            <Link
              href="/studio"
              className="text-slate-300 hover:text-white transition text-sm"
            >
              Studio
            </Link>
            <a
              href="mailto:contact@cipfaro.com"
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/30"
            >
              Contact
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-slate-700 hover:bg-slate-900"
          >
            <span className="text-slate-300">☰</span>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 py-4 space-y-3">
            <Link
              href="/"
              className="block text-slate-300 hover:text-white transition text-sm py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Accueil
            </Link>
            <Link
              href="/offres"
              className="block text-slate-300 hover:text-white transition text-sm py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Offres & tarifs
            </Link>
            <Link
              href="/studio"
              className="block text-slate-300 hover:text-white transition text-sm py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Studio
            </Link>
            <a
              href="mailto:contact@cipfaro.com"
              className="block rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white text-center transition hover:shadow-lg hover:shadow-cyan-500/30"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
