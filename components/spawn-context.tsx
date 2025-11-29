"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { SpawnSubAgentsOutput } from "@/lib/ai/tools/spawn-sub-agents";

type SpawnContextValue = {
  onContinueSpawn: (
    toolCallId: string,
    output: SpawnSubAgentsOutput
  ) => Promise<void>;
};

const SpawnContext = createContext<SpawnContextValue | null>(null);

export function SpawnProvider({
  children,
  onContinueSpawn,
}: {
  children: ReactNode;
  onContinueSpawn: SpawnContextValue["onContinueSpawn"];
}) {
  return (
    <SpawnContext.Provider value={{ onContinueSpawn }}>
      {children}
    </SpawnContext.Provider>
  );
}

export function useSpawnContext() {
  const context = useContext(SpawnContext);
  if (!context) {
    throw new Error("useSpawnContext must be used within SpawnProvider");
  }
  return context;
}
