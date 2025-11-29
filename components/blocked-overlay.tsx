"use client";

import { Loader2 } from "lucide-react";

type BlockedOverlayProps = {
  activeCount: number;
};

export function BlockedOverlay({ activeCount }: BlockedOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="space-y-2 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Waiting for {activeCount} branch{activeCount > 1 ? "es" : ""} to
          return...
        </p>
      </div>
    </div>
  );
}
