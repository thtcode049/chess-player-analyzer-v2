"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer";
import { Loader2 } from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const playerId = searchParams.get("playerId") || undefined;
  return (
    <WorkspaceContainer
      initialTab="profile"
      initialView={view === "hub" ? "hub" : undefined}
      targetPlayerId={playerId}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải không gian làm việc...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
