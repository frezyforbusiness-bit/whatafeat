import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/features/auth-provider";
import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Whatafeat — find your next feat",
  description: "Find independent artists. Trade verses. Lock in feats.",
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
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <Suspense fallback={<p>loading the scene…</p>}>{children}</Suspense>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
