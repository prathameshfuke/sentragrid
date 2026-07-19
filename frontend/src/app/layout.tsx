import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "SentraGrid — Industrial Safety Intelligence",
  description: "AI-powered compound risk detection, geospatial safety heatmap, and permit intelligence for industrial operations. Data is already talking. SentraGrid listens before something breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-void text-bright-text min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
