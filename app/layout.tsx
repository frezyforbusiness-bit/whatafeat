import type { Metadata } from "next";
import "./globals.css";
import App from "@/features/app";
import { Suspense } from "react";

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
    <html lang="en">
      <body className="antialiased"><Suspense fallback={<p>Loading Whatafeat…</p>}><App/></Suspense>{children}</body>
    </html>
  );
}
