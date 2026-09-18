import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/features/auth-provider";
import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";

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
  title: "Whatafeat — Find your next collaborator",
  description: "Discover independent artists. Trade verses. Book features.",
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
          <Suspense fallback={<p>Loading Whatafeat…</p>}>{children}</Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
