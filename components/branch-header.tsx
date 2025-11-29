"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

type BranchHeaderProps = {
  parentChatId: string;
  parentTitle?: string;
};

export function BranchHeader({ parentChatId, parentTitle }: BranchHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
      <GitBranch className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Branch of</span>
      <Button
        variant="link"
        size="sm"
        className="p-0 h-auto"
        onClick={() => router.push(`/chat/${parentChatId}`)}
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        {parentTitle || "Parent Chat"}
      </Button>
    </div>
  );
}
