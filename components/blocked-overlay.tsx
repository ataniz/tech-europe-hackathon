"use client";

import { Loader2 } from "lucide-react";

type BlockedOverlayProps = {
  activeCount: number;
};

export function BlockedOverlay({ activeCount }: BlockedOverlayProps) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-2">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Waiting for {activeCount} branch{activeCount > 1 ? "es" : ""} to
          return...
        </p>
      </div>
    </div>
  );
}
