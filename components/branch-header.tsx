"use client";

import { ChevronRight, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BranchHeaderProps = {
  parentChatId: string;
  parentTitle?: string;
  currentTitle?: string;
  actions?: React.ReactNode;
};

export function BranchHeader({
  parentChatId,
  parentTitle,
  currentTitle,
  actions,
}: BranchHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-2 py-2 md:px-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Branch of</span>
        <Button
          className="h-auto p-0 text-sm"
          onClick={() => router.push(`/chat/${parentChatId}`)}
          size="sm"
          variant="link"
        >
          {parentTitle || "Parent Chat"}
        </Button>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="truncate font-medium text-sm">
          {currentTitle || "Sub-agent"}
        </span>
      </div>

      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}
