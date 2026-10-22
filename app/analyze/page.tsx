"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer";
import { Loader2 } from "lucide-react";

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const playerId = searchParams.get("playerId") || undefined;
  return <WorkspaceContainer initialTab="board" targetPlayerId={playerId} />;
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải bàn cờ phân tích...</p>
        </div>
      }
    >
      <AnalyzePageContent />
    </Suspense>
  );
}
