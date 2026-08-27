import type { Metadata } from "next";
import { SessionProvider } from "@/app/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rudyo AI - Studio vidéo IA",
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
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
