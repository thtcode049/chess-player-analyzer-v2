import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { ProfileWorkspaceProvider } from "@/lib/stores/profileWorkspaceStore";

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
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        <ProfileWorkspaceProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 py-3 sm:py-6 pb-6">
            {children}
          </main>
          <MobileBottomNav />
        </ProfileWorkspaceProvider>
      </body>
    </html>
  );
}
