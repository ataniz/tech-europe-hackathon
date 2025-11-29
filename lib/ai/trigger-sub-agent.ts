import { convertToModelMessages, generateText, stepCountIs } from "ai";
import type { Session } from "next-auth";
import { SUB_AGENT_SYSTEM_PROMPT } from "./prompts";
import { myProvider } from "./providers";
import { generateImage } from "./tools/generate-image";
import { generateVideo } from "./tools/generate-video";
import { concatenateVideos } from "./tools/concatenate-videos";
import { returnToParent } from "./tools/return-to-parent";
import {
  createStreamId,
  getChatById,
  getMessagesByChatId,
  saveMessages,
} from "@/lib/db/queries";
import { convertToUIMessages, generateUUID } from "@/lib/utils";

const SUB_AGENT_MODEL = "chat-model" as const;

/**
 * Triggers AI response for a sub-agent chat in the background.
 * Runs the AI to completion and saves all messages to the database.
 */
export async function triggerSubAgentResponse({
  chatId,
  session,
  parentContext,
}: {
  chatId: string;
  session: Session;
  parentContext?: string;
}) {
  console.log(`[Sub-agent ${chatId}] Starting AI response...`);

  try {
    const chat = await getChatById({ id: chatId });
    if (!chat || chat.chatType !== "sub-agent") {
      console.error(`[Sub-agent ${chatId}] Invalid chat or not a sub-agent`);
      return;
    }

    const messagesFromDb = await getMessagesByChatId({ id: chatId });
    const uiMessages = convertToUIMessages(messagesFromDb);

    if (uiMessages.length === 0) {
      console.error(`[Sub-agent ${chatId}] No messages found`);
      return;
    }

    // Create stream ID for resumability
    const streamId = generateUUID();
    await createStreamId({ streamId, chatId });

    // Build system prompt with parent context
    const systemPromptWithContext = parentContext
      ? `${SUB_AGENT_SYSTEM_PROMPT}\n\n${parentContext}`
      : SUB_AGENT_SYSTEM_PROMPT;

    // Create a mock dataStream writer for tools
    const mockDataStream = {
      write: (data: unknown) => {
        console.log(`[Sub-agent ${chatId}] Tool data:`, JSON.stringify(data).slice(0, 200));
      },
      merge: () => {},
    };

    console.log(`[Sub-agent ${chatId}] Calling generateText...`);

    const { text, steps } = await generateText({
      model: myProvider.languageModel(SUB_AGENT_MODEL),
      system: systemPromptWithContext,
      messages: convertToModelMessages(uiMessages),
      stopWhen: stepCountIs(5),
      tools: {
        generateImage: generateImage({
          session,
          dataStream: mockDataStream as any,
          chatId,
        }),
        generateVideo: generateVideo({
          session,
          dataStream: mockDataStream as any,
          chatId,
        }),
        concatenateVideos: concatenateVideos({
          session,
          dataStream: mockDataStream as any,
          chatId,
        }),
        returnToParent: returnToParent({
          session,
          dataStream: mockDataStream as any,
          chatId,
        }),
      },
      providerOptions: {
        google: {
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          ],
        },
      },
    });

    console.log(`[Sub-agent ${chatId}] Response: text="${text.slice(0, 100)}...", steps=${steps.length}`);

    // Build message parts in the same format as streaming (toUIMessageStream)
    const parts: Array<{ type: string; [key: string]: unknown }> = [];

    // Process all steps to extract tool calls and results
    for (const step of steps) {
      // Add tool invocations from this step
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const toolCall of step.toolCalls) {
          // Find matching result
          const toolResult = step.toolResults?.find(
            (r) => r.toolCallId === toolCall.toolCallId
          );

          // Use the same format as toUIMessageStream: type="tool-{toolName}"
          // Cast to any to access args/result - AI SDK types are complex generics
          const toolCallAny = toolCall as any;
          const toolResultAny = toolResult as any;
          parts.push({
            type: `tool-${toolCallAny.toolName}`,
            toolCallId: toolCallAny.toolCallId,
            toolName: toolCallAny.toolName,
            // Use 'input' and 'output' like streaming does
            input: toolCallAny.args,
            output: toolResultAny?.result,
            // Use 'output-available' state like streaming does
            state: "output-available",
          });
        }
      }
    }

    // Add final text content at the end
    if (text && text.trim()) {
      parts.push({ type: "text", text });
    }

    console.log(`[Sub-agent ${chatId}] Built ${parts.length} parts:`, parts.map(p => p.type).join(", "));

    // Save assistant message
    if (parts.length > 0) {
      const assistantMessage = {
        id: generateUUID(),
        chatId,
        role: "assistant" as const,
        parts,
        attachments: [],
        createdAt: new Date(),
      };

      await saveMessages({ messages: [assistantMessage] });
      console.log(`[Sub-agent ${chatId}] Saved message with ${parts.length} parts`);
    } else {
      console.warn(`[Sub-agent ${chatId}] No parts to save`);
    }

  } catch (error) {
    console.error(`[Sub-agent ${chatId}] Error:`, error);
  }
}
