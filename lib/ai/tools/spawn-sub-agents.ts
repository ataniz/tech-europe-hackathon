import type { UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  createSubAgentChat,
  saveMessages,
  updateChatType,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

// Input schema for spawnSubAgents
export const spawnSubAgentsInputSchema = z.object({
  agents: z
    .array(
      z.object({
        name: z.string().describe("Name/title for this sub-agent branch"),
        brief: z
          .string()
          .describe("The specific task/brief for this sub-agent"),
        referenceAssets: z
          .array(z.string())
          .optional()
          .describe("Asset UUIDs to include as references"),
      })
    )
    .min(1)
    .max(10),
});

export type SpawnSubAgentsInput = z.infer<typeof spawnSubAgentsInputSchema>;

// Output schema - what gets returned when agents complete
export const spawnSubAgentsOutputSchema = z.object({
  status: z.enum(["pending", "complete"]),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      returnedAssets: z.array(z.string()).optional(),
      summary: z.string().optional(),
    })
  ),
});

export type SpawnSubAgentsOutput = z.infer<typeof spawnSubAgentsOutputSchema>;

type SpawnedAgent = {
  id: string;
  name: string;
  brief: string;
};

// Factory function that returns the tool with execute
export function spawnSubAgents({
  session,
  dataStream,
  chatId: parentChatId,
}: {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
}) {
  return tool({
    description:
      "Spawn parallel sub-agent chats to work on separate creative tasks. Each sub-agent will work independently and return their results. ",
    inputSchema: spawnSubAgentsInputSchema,
    execute: async (input: SpawnSubAgentsInput) => {
      // 1. Update current chat type to 'orchestrator'
      await updateChatType(parentChatId, "orchestrator");

      // 2. Create sub-agent chats
      const spawnedAgents: SpawnedAgent[] = [];

      for (const agent of input.agents) {
        const subChat = await createSubAgentChat({
          parentChatId,
          title: agent.name,
          userId: session.user.id,
        });

        // Create first user message with brief
        await saveMessages({
          messages: [
            {
              id: generateUUID(),
              chatId: subChat.id,
              role: "user",
              parts: [{ type: "text", text: agent.brief }],
              attachments: [],
              createdAt: new Date(),
            },
          ],
        });

        spawnedAgents.push({
          id: subChat.id,
          name: agent.name,
          brief: agent.brief,
        });
      }

      // Note: We don't auto-trigger AI responses here anymore.
      // Instead, when the user visits a sub-agent chat, it will auto-start
      // streaming if there's no assistant response yet. This allows the user
      // to see the streaming response and interact with the sub-agent.

      // 5. Return pending status - the AI should stop here and wait
      // for sub-agents to complete before continuing
      return {
        status: "pending" as const,
        agents: spawnedAgents.map((a) => ({
          id: a.id,
          name: a.name,
        })),
      };
    },
  });
}
