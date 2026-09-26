import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

export const metadata: Metadata = {
  title: "ChessLook | Nền tảng Phân tích Cờ vua & Cố vấn Chiến lược AI",
  description:
    "Hệ thống phân tích ván đấu cờ vua chuyên sâu, bóc tách Repertoire khai cuộc, cấu trúc Tốt và huấn luyện chiến thuật cùng AI Đại kiện tướng.",
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
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8">
          {children}
        </main>
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-6 mb-16 md:mb-0 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50">
          <p>© 2026 ChessLook. Nền tảng phân tích ván đấu & cố vấn chiến thuật chuyên sâu dành cho kỳ thủ.</p>
        </footer>
        <MobileBottomNav />
      </body>
    </html>
  );
}
