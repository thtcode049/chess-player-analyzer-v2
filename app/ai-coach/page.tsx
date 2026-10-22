"use client";

import React, { Suspense } from "react";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer";
import { Loader2 } from "lucide-react";

export default function AiCoachPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải trợ lí AI...</p>
        </div>
      }
    >
      <WorkspaceContainer initialTab="ai" />
    </Suspense>
  );
}
