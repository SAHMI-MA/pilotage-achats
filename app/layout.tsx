import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./followup.css";

export const metadata: Metadata = {
  title: "Pilotage achats · Projets & fournisseurs",
  description: "Vos consultations, vos offres et vos prochaines actions dans un tableau de bord unique.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
