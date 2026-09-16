import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Chess Player Analyzer V2 | AI Strategic Coaching & Opening Explorer",
  description:
    "Advanced chess analytics platform featuring Transposition-safe Opening Trees, Empirical Bayesian Shrinkage, 8-Axis Playing Style Radars, and AI Grandmaster Strategic Coaching.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased flex flex-col">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50">
          <p>© 2026 Chess Player Analyzer V2. Powered by Next.js, FastAPI, Supabase & Stockfish WASM.</p>
        </footer>
      </body>
    </html>
  );
}
