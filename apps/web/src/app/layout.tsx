import type { Metadata } from "next";
import PasswordGate from "@/components/PasswordGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "FutureDev – Vom Quereinsteiger zum Product Engineer",
  description:
    "FutureDev ist die Lern-App, die dich ohne Vorwissen bis zur Jobreife als Product Engineer bringt. Lerne Programmieren, Web, Mobile, Backend, KI – mit Text und Audio, Quiz und Praxisaufgaben.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "FutureDev – Vom Quereinsteiger zum Product Engineer",
    description:
      "Die Lern-App für den schnellsten Weg zur Jobreife. Text und Audio, Quiz und Praxis – alles, was du brauchst.",
    url: "https://futuredev.domenicmoran.de",
    siteName: "FutureDev",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <PasswordGate>{children}</PasswordGate>
      </body>
    </html>
  );
}