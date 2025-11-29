"use client";

import { CheckCircle, Clock, Lock, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChatStatus } from "@/lib/db/schema";
import { useSpawnContext } from "./spawn-context";

type SpawnedAgent = {
  id: string;
  name: string;
  status: ChatStatus;
  returnValue?: { assets?: string[]; summary?: string } | null;
};

type SpawnedAgentsCardProps = {
  chatId: string;
  toolCallId: string;
  initialAgents: Array<{ id: string; name: string }>;
};

const statusIcon: Record<ChatStatus, React.ReactNode> = {
  active: (
    <Clock className="h-4 w-4 animate-pulse text-amber-600 dark:text-amber-300" />
  ),
  returned: <CheckCircle className="h-4 w-4 text-emerald-600" />,
  finalized: <Lock className="h-4 w-4 text-muted-foreground" />,
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SpawnedAgentsCard({
  chatId,
  toolCallId,
  initialAgents,
}: SpawnedAgentsCardProps) {
  const router = useRouter();
  const { onContinueSpawn } = useSpawnContext();

  // Poll for child statuses
  const { data: agents } = useSWR<SpawnedAgent[]>(
    `/api/children?chatId=${chatId}`,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2 seconds
      fallbackData: initialAgents.map((a) => ({
        ...a,
        status: "active" as const,
      })),
    }
  );

  const agentList = agents || [];
  const returned = agentList.filter((a) => a.status !== "active").length;
  const active = agentList.filter((a) => a.status === "active").length;
  const allReturned = agentList.length > 0 && active === 0;

  const handleContinue = async () => {
    // Aggregate return values from all agents
    const output = {
      status: "complete" as const,
      agents: agentList.map((a) => ({
        id: a.id,
        name: a.name,
        returnedAssets: a.returnValue?.assets,
        summary: a.returnValue?.summary,
      })),
    };

    await onContinueSpawn(toolCallId, output);
  };

  return (
    <Card className="w-full border-border/80 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="font-semibold text-foreground text-sm">
            Branches dispatched
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {allReturned
              ? "All branches returned. Click Continue to proceed."
              : "Tap a branch to open its workspace."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className="border-border text-xs" variant="outline">
            {returned}/{agentList.length} returned
          </Badge>
          {active > 0 && (
            <Badge
              className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100"
              variant="secondary"
            >
              {active} active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {agentList.map((agent) => (
          <Button
            className="hover:-translate-y-0.5 w-full justify-between rounded-xl border border-border/70 bg-background px-3 py-3 text-left text-foreground transition-transform duration-150 hover:bg-accent dark:bg-secondary"
            key={agent.id}
            onClick={() => router.push(`/chat/${agent.id}`)}
            variant="ghost"
          >
            <div className="flex items-center gap-3">
              {statusIcon[agent.status]}
              <span className="truncate font-medium">{agent.name}</span>
            </div>
            <Badge
              className="font-semibold text-[10px]"
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
      {allReturned && (
        <CardFooter className="pt-0">
          <Button className="w-full gap-2" onClick={handleContinue}>
            <Play className="h-4 w-4" />
            Continue
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
