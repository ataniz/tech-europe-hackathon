import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  getChatById,
  setChatReturnValue,
  updateChatStatus,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type ReturnToParentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

export const returnToParent = ({
  session,
  dataStream,
  chatId,
}: ReturnToParentProps) =>
  tool({
    description:
      "Return results to the parent orchestrator chat. Call when sub-agent task is complete.",
    inputSchema: z.object({
      assets: z.array(z.string()).describe("Asset UUIDs to return to parent"),
      summary: z
        .string()
        .optional()
        .describe("Brief summary of what was accomplished"),
    }),
    execute: async ({ assets, summary }) => {
      const chat = await getChatById({ id: chatId });

      if (!chat || chat.chatType !== "sub-agent") {
        throw new Error("Can only return from sub-agent chats");
      }

      // Set status to 'returned' and store return value
      await updateChatStatus(chatId, "returned");
      await setChatReturnValue(chatId, { assets, summary });

      // Signal UI to navigate to parent
      dataStream.write({
        type: "data-branchReturned",
        data: {
          chatId,
          navigateTo: chat.parentChatId,
        },
      });

      return {
        success: true,
        message: "Returned to parent chat",
        navigateTo: chat.parentChatId,
      };
    },
  });
