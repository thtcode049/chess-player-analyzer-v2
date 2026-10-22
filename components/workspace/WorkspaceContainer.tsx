"use client";

import React, { useEffect, Suspense } from "react";
import { Loader2, Swords } from "lucide-react";
import { useProfileWorkspaceStore, WorkspaceTab } from "@/lib/stores/profileWorkspaceStore";
import ProfileHub from "@/components/profile/ProfileHub";
import ProfileDetailContent from "@/components/workspace/ProfileDetailContent";
import { AnalyzeContent } from "@/components/workspace/AnalyzeView";
import AiCoachView from "@/components/workspace/AiCoachView";

interface WorkspaceContainerProps {
  initialTab?: WorkspaceTab;
  initialView?: "hub" | "workspace";
  targetPlayerId?: string;
}

export default function WorkspaceContainer({
  initialTab,
  initialView,
  targetPlayerId,
}: WorkspaceContainerProps) {
  const {
    activeTab,
    setActiveTab,
    isHubOpen,
    openHub,
    closeHub,
    activePlayerId,
    selectSingleProfile,
    isMatchupLoading,
    multiProfiles,
    players,
  } = useProfileWorkspaceStore();

  const mountedRef = React.useRef(false);

  // Handle URL route initialization
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (targetPlayerId) {
        selectSingleProfile(targetPlayerId, initialTab || "profile");
      } else if (initialTab) {
        setActiveTab(initialTab);
      }
    } else {
      if (targetPlayerId && targetPlayerId !== activePlayerId) {
        selectSingleProfile(targetPlayerId, activeTab);
      }
    }

    if (initialView === "hub") {
      openHub();
    } else if (initialView === "workspace" || targetPlayerId) {
      closeHub();
    }
  }, [targetPlayerId, initialTab, initialView]);

  return (
    <>
      {/* Full-Screen Matchup Loading Overlay */}
      {isMatchupLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-4 animate-scale-in">
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Swords className="w-8 h-8 text-emerald-500" />
              <div className="absolute inset-0 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-base sm:text-lg text-foreground">
                Đang Áp Dụng Tổ Hợp Đa Hồ Sơ
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Đang nạp dữ liệu ván đấu và tổng hợp cây khai cuộc đối đầu{" "}
                {multiProfiles.length > 0 && (
                  <b className="text-foreground">
                    ({multiProfiles.map((m) => m.player.canonical_name).join(" vs ")})
                  </b>
                )}...
              </p>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 animate-pulse w-full" />
            </div>
          </div>
        </div>
      )}

      {/* If user is explicitly viewing Profile Hub */}
      {isHubOpen ? (
        <ProfileHub />
      ) : (
        <div className="w-full relative">
          {/* Tab 1: Hồ sơ & Ván đấu (Keep-Alive: mount hidden when not active) */}
          <div style={{ display: activeTab === "profile" ? "block" : "none" }}>
            <ProfileDetailContent targetPlayerId={activePlayerId || undefined} />
          </div>

          {/* Tab 2: Bàn cờ Phân tích & Khai cuộc (Keep-Alive: engine worker and board position remain intact) */}
          <div style={{ display: activeTab === "board" ? "block" : "none" }}>
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-muted-foreground font-medium">Đang tải bàn cờ phân tích...</p>
                </div>
              }
            >
              <AnalyzeContent />
            </Suspense>
          </div>

          {/* Tab 3: Trợ lí AI (Keep-Alive: conversation history, draft message and scroll position intact) */}
          <div style={{ display: activeTab === "ai" ? "block" : "none" }}>
            <AiCoachView />
          </div>
        </div>
      )}
    </>
  );
}
