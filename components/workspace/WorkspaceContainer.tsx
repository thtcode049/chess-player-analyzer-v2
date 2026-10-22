"use client";

import React, { useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
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
    players,
  } = useProfileWorkspaceStore();

  // Handle URL route initialization
  useEffect(() => {
    if (targetPlayerId && targetPlayerId !== activePlayerId) {
      selectSingleProfile(targetPlayerId, initialTab || "profile");
    } else if (initialTab && initialTab !== activeTab && !targetPlayerId) {
      setActiveTab(initialTab);
    }

    if (initialView === "hub") {
      openHub();
    } else if (initialView === "workspace" || targetPlayerId) {
      closeHub();
    }
  }, [targetPlayerId, initialTab, initialView]);

  // If user is viewing Profile Hub
  if (isHubOpen || (!activePlayerId && players.length === 0)) {
    return <ProfileHub />;
  }

  return (
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
  );
}
