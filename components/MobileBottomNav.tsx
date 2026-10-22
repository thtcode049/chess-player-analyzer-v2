"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  FolderOpen, 
  Users, 
  Swords, 
  Brain, 
  UploadCloud 
} from "lucide-react";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeTab, setActiveTab, isHubOpen, openHub, closeHub, activeMode, activePlayerId } = useProfileWorkspaceStore();

  const isWorkspace = useMemo(() => {
    const current = typeof window !== "undefined" ? window.location.pathname : pathname;
    return (
      (pathname === "/dashboard" || pathname === "/analyze" || pathname === "/ai-coach" || pathname === "/players") &&
      (current === "/dashboard" || current === "/analyze" || current === "/ai-coach" || current === "/players")
    );
  }, [pathname]);

  const handleNav = (tab: "hub" | "profile" | "board" | "ai") => {
    if (tab === "hub") {
      openHub();
      if (!isWorkspace) {
        window.location.href = "/players";
      } else if (typeof window !== "undefined" && window.location.pathname !== "/players" && window.location.pathname !== "/dashboard") {
        window.history.pushState(null, "", "/dashboard");
      }
    } else {
      setActiveTab(tab);
      closeHub();
      const targetPath = tab === "profile" ? "/dashboard" : tab === "board" ? "/analyze" : "/ai-coach";
      if (!isWorkspace) {
        window.location.href = targetPath;
      } else if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath);
      }
    }
  };

  return (
    <nav
      aria-label="Điều hướng di động"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-lg px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-all"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {/* Hub Button */}
        <button
          type="button"
          onClick={() => handleNav("hub")}
          className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            isWorkspace && isHubOpen
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FolderOpen className={`w-5 h-5 transition-transform duration-200 ${isWorkspace && isHubOpen ? "scale-110" : ""}`} />
          <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${isWorkspace && isHubOpen ? "font-bold" : "font-medium"}`}>
            Thư viện
          </span>
          {isWorkspace && isHubOpen && (
            <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
          )}
        </button>

        {/* Profile Tab */}
        <button
          type="button"
          onClick={() => handleNav("profile")}
          className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            isWorkspace && !isHubOpen && activeTab === "profile"
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users className={`w-5 h-5 transition-transform duration-200 ${isWorkspace && !isHubOpen && activeTab === "profile" ? "scale-110" : ""}`} />
          <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${isWorkspace && !isHubOpen && activeTab === "profile" ? "font-bold" : "font-medium"}`}>
            Hồ sơ
          </span>
          {isWorkspace && !isHubOpen && activeTab === "profile" && (
            <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
          )}
        </button>

        {/* Board Tab */}
        <button
          type="button"
          onClick={() => handleNav("board")}
          className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            isWorkspace && !isHubOpen && activeTab === "board"
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Swords className={`w-5 h-5 transition-transform duration-200 ${isWorkspace && !isHubOpen && activeTab === "board" ? "scale-110" : ""}`} />
          <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${isWorkspace && !isHubOpen && activeTab === "board" ? "font-bold" : "font-medium"}`}>
            Bàn cờ
          </span>
          {isWorkspace && !isHubOpen && activeTab === "board" && (
            <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
          )}
        </button>

        {/* AI Tab */}
        <button
          type="button"
          onClick={() => handleNav("ai")}
          className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            isWorkspace && !isHubOpen && activeTab === "ai"
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Brain className={`w-5 h-5 transition-transform duration-200 ${isWorkspace && !isHubOpen && activeTab === "ai" ? "scale-110" : ""}`} />
            <span className="absolute -top-1 -right-2.5 px-1 py-0.2 rounded-full text-[8px] font-black bg-emerald-500 text-white leading-none">
              AI
            </span>
          </div>
          <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${isWorkspace && !isHubOpen && activeTab === "ai" ? "font-bold" : "font-medium"}`}>
            Trợ lí AI
          </span>
          {isWorkspace && !isHubOpen && activeTab === "ai" && (
            <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
          )}
        </button>

        {/* Import Link */}
        <Link
          href="/import"
          className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            pathname === "/import"
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <UploadCloud className={`w-5 h-5 transition-transform duration-200 ${pathname === "/import" ? "scale-110" : ""}`} />
          <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${pathname === "/import" ? "font-bold" : "font-medium"}`}>
            Nạp ván
          </span>
          {pathname === "/import" && (
            <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
          )}
        </Link>
      </div>
    </nav>
  );
}
