"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatStatus } from "@/lib/db/schema";

type SpawnedAgent = {
  id: string;
  name: string;
  status: ChatStatus;
};

type SpawnedAgentsCardProps = {
  agents: SpawnedAgent[];
};

const statusIcon: Record<ChatStatus, React.ReactNode> = {
  active: (
    <Clock className="h-4 w-4 text-amber-600 animate-pulse dark:text-amber-300" />
  ),
  returned: <CheckCircle className="h-4 w-4 text-emerald-600" />,
  finalized: <Lock className="h-4 w-4 text-muted-foreground" />,
};

export function SpawnedAgentsCard({ agents }: SpawnedAgentsCardProps) {
  const router = useRouter();
  const returned = agents.filter((a) => a.status !== "active").length;
  const active = agents.filter((a) => a.status === "active").length;

  return (
    <Card className="w-full border-border/80 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold text-foreground">
            Branches dispatched
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Tap a branch to open its workspace.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="border-border text-xs">
            {returned}/{agents.length} returned
          </Badge>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100"
          >
            {active} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.map((agent) => (
          <Button
            key={agent.id}
            variant="ghost"
            className="w-full justify-between rounded-xl border border-border/70 bg-background px-3 py-3 text-left text-foreground transition-transform duration-150 hover:-translate-y-0.5 hover:bg-accent dark:bg-secondary"
            onClick={() => router.push(`/chat/${agent.id}`)}
          >
            <div className="flex items-center gap-3">
              {statusIcon[agent.status]}
              <span className="truncate font-medium">{agent.name}</span>
            </div>
            <Badge
              className="text-[10px] font-semibold"
              variant={
                agent.status === "returned"
                  ? "secondary"
                  : agent.status === "finalized"
                    ? "outline"
                    : "default"
              }
            >
              {agent.status === "active"
                ? "In progress"
                : agent.status === "returned"
                  ? "Returned"
                  : "Finalized"}
            </Badge>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
