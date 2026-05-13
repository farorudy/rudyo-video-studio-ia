import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Farozik - Rudyo Vidéo Studio IA",
  description:
    "Transformez vos affiches, chansons, formations et événements en vidéos professionnelles prêtes à publier. Studio vidéo assisté par IA pour artistes, associations, formations et événements.",
  keywords:
    "vidéo IA, flyer animé, clip lyrics, capsule pédagogique, moodle, vidéo promo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
