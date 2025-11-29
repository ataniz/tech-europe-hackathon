import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { triggerSubAgentResponse } from "@/lib/ai/trigger-sub-agent";
import {
  createSubAgentChat,
  getMessagesByChatId,
  saveMessages,
  updateChatType,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type SpawnSubAgentsProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

export const spawnSubAgents = ({
  session,
  dataStream,
  chatId,
}: SpawnSubAgentsProps) =>
  tool({
    description:
      "Spawn parallel sub-agent chats to work on separate tasks. Each sub-agent receives context and a specific brief.",
    inputSchema: z.object({
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
    }),
    execute: async ({ agents }) => {
      // 1. Update current chat type to 'orchestrator'
      await updateChatType(chatId, "orchestrator");

      // 2. Get parent message history for context
      const parentMessages = await getMessagesByChatId({ id: chatId });
      const parentContext = parentMessages
        .map((m) => {
          const parts = m.parts as Array<{ type: string; text?: string }>;
          const content = parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text)
            .join(" ");
          return `${m.role}: ${content}`;
        })
        .join("\n");

      // 3. Create sub-agent chats and trigger AI responses
      const spawnedChats = [];
      const triggerPromises = [];

      for (const agent of agents) {
        const subChat = await createSubAgentChat({
          parentChatId: chatId,
          title: agent.name,
          userId: session.user.id,
        });

        // Create first user message with brief (plain text, not JSON)
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

        spawnedChats.push({ id: subChat.id, name: agent.name });

        // Trigger AI response in background (fire-and-forget)
        triggerPromises.push(
          triggerSubAgentResponse({
            chatId: subChat.id,
            session,
            parentContext: `## Parent Conversation Context\n${parentContext}`,
          })
        );
      }

      // Fire all sub-agent triggers without waiting
      Promise.all(triggerPromises).catch((err) =>
        console.error("Error triggering sub-agents:", err)
      );

      // 4. Write to dataStream for UI update
      dataStream.write({
        type: "data-spawnedAgents",
        data: { chats: spawnedChats },
      });

      return {
        spawnedChats,
        message: `Spawned ${agents.length} sub-agents. Waiting for all to return.`,
      };
    },
  });
