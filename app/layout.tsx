import type { Metadata } from "next";
import { headers } from "next/headers";
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

const baseMetadata: Metadata = {
  title: "Farozik - Rudyo Vidéo Studio IA",
  description:
    "Préparez les storyboards, intentions visuelles et prompts de vos clips, vidéos promotionnelles et capsules pédagogiques avec RudyoAI.",
  keywords:
    "vidéo IA, flyer animé, clip lyrics, capsule pédagogique, moodle, vidéo promo",
};

export async function generateMetadata():Promise<Metadata>{
 const h=(await headers()).get("host")?.split(":")[0];
 const origin=h==="app.rudyoai.com"?"https://app.rudyoai.com":"https://rudyoai.com";
 return {...baseMetadata,metadataBase:new URL(origin),robots:h==="app.rudyoai.com" ? {index:false,follow:false} : undefined};
}

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
