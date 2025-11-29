"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  active: <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />,
  returned: <CheckCircle className="h-4 w-4 text-green-500" />,
  finalized: <Lock className="h-4 w-4 text-muted-foreground" />,
};

export function SpawnedAgentsCard({ agents }: SpawnedAgentsCardProps) {
  const router = useRouter();
  const returned = agents.filter((a) => a.status !== "active").length;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Spawned Branches</span>
          <span className="text-muted-foreground">
            {returned}/{agents.length} returned
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.map((agent) => (
          <Button
            key={agent.id}
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => router.push(`/chat/${agent.id}`)}
          >
            {statusIcon[agent.status]}
            <span className="truncate">{agent.name}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
