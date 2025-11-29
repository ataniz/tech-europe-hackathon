"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

type BranchHeaderProps = {
  parentChatId: string;
  parentTitle?: string;
  currentTitle?: string;
};

export function BranchHeader({
  parentChatId,
  parentTitle,
  currentTitle,
}: BranchHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
      <GitBranch className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Branch of</span>
      <Button
        variant="link"
        size="sm"
        className="p-0 h-auto text-sm"
        onClick={() => router.push(`/chat/${parentChatId}`)}
      >
        {parentTitle || "Parent Chat"}
      </Button>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-sm font-medium truncate">
        {currentTitle || "Sub-agent"}
      </span>
    </div>
  );
}
