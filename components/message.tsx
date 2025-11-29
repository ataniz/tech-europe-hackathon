"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { CornerDownRight } from "lucide-react";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { AssetPreview } from "./asset-preview";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { BotIcon, StoryboardIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { SpawnedAgentsCard } from "./spawned-agents-card";
import { Weather } from "./weather";

// Helper to parse JSON message content
type ParsedMessageContent = {
  text: string;
  uploads?: Array<{ url: string; name: string; contentType: string }>;
  attachments?: Array<{ assetId: string; type: string }>;
};

function parseMessageContent(text: string): ParsedMessageContent {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "text" in parsed) {
      return parsed as ParsedMessageContent;
    }
  } catch {
    // Not JSON, return as plain text
  }
  return { text };
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-200/60 bg-amber-50/70 text-amber-700 shadow-sm dark:border-amber-300/40 dark:bg-amber-400/15 dark:text-amber-100">
            <BotIcon />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                )) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            // Normalize type - handle both "tool-{name}" and "tool-invocation" formats
            const rawType = part.type as string;
            const type =
              rawType === "tool-invocation" && (part as any).toolName
                ? `tool-${(part as any).toolName}`
                : rawType;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning" && (part as any).text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={(part as any).text}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                // Parse JSON message content for user messages
                const partText = (part as any).text as string;
                const parsed =
                  message.role === "user"
                    ? parseMessageContent(partText)
                    : { text: partText };
                const hasUploads = parsed.uploads && parsed.uploads.length > 0;
                const hasAttachments =
                  parsed.attachments && parsed.attachments.length > 0;

                return (
                  <div className="flex flex-col gap-2" key={key}>
                    {/* Uploads - shown above the message */}
                    {hasUploads && (
                      <div className="flex flex-row justify-end gap-2">
                        {parsed.uploads?.map((upload) => (
                          <PreviewAttachment
                            attachment={{
                              name: upload.name,
                              contentType: upload.contentType,
                              url: upload.url,
                            }}
                            key={upload.url}
                          />
                        ))}
                      </div>
                    )}

                    {/* Message text */}
                    <MessageContent
                      className={cn("shadow-sm", {
                        "w-fit break-words rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-right text-primary-foreground":
                          message.role === "user",
                        "w-full max-w-full rounded-2xl border border-border/70 bg-card px-4 py-3 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                    >
                      <Response>{sanitizeText(parsed.text)}</Response>
                    </MessageContent>

                    {/* Attachments - shown below with L-arrow indicator */}
                    {hasAttachments && (
                      <div className="flex flex-row items-start justify-end gap-2">
                        <CornerDownRight className="mt-1 h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-row gap-2">
                          {parsed.attachments?.map((attachment) => (
                            <AssetPreview
                              assetId={attachment.assetId}
                              key={attachment.assetId}
                              showAttachButton={false}
                              size="sm"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-getWeather" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={partAny.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={<Weather weatherAtLocation={partAny.output} />}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-createDocument") {
              const partAny = part as any;
              const { toolCallId } = partAny;

              if (partAny.output && "error" in partAny.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(partAny.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={partAny.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const partAny = part as any;
              const { toolCallId } = partAny;

              if (partAny.output && "error" in partAny.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(partAny.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...partAny.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={partAny.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={partAny.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in partAny.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(partAny.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={partAny.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-spawnSubAgents") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;
              // Handle both streaming state names and DB-loaded state names
              const hasOutput =
                state === "output-available" || state === "result";
              const output = partAny.output || partAny.result;
              const input = partAny.input || partAny.args;

              // Get agents from output (if available) or use input names as placeholders
              const outputAgents = output?.agents || output?.spawnedChats || [];
              const inputAgents = input?.agents || [];

              // Use output agents if available, otherwise use input for initial display
              const initialAgents =
                outputAgents.length > 0
                  ? outputAgents.map((c: { id: string; name: string }) => ({
                      id: c.id,
                      name: c.name,
                    }))
                  : inputAgents.map((a: { name: string }, i: number) => ({
                      id: `pending-${i}`, // Placeholder ID until real one is available
                      name: a.name,
                    }));

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-spawnSubAgents" />
                  <ToolContent>
                    {/* Always show SpawnedAgentsCard - it will poll for real data */}
                    <SpawnedAgentsCard
                      chatId={chatId}
                      initialAgents={initialAgents}
                      toolCallId={toolCallId}
                    />
                  </ToolContent>
                </Tool>
              );
            }

            if (
              type === "tool-generateImage" ||
              type === "tool-generateVideo" ||
              type === "tool-concatenateVideos"
            ) {
              const partAny = part as any;
              const { toolCallId, state } = partAny;
              const hasOutput =
                state === "output-available" || state === "result";
              const output = partAny.output || partAny.result;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type={type} />
                  <ToolContent>
                    {(state === "input-available" || state === "call") && (
                      <ToolInput input={partAny.input || partAny.args} />
                    )}
                    {hasOutput && output?.assetId && (
                      <AssetPreview
                        assetId={output.assetId}
                        showAttachButton={true}
                        size="lg"
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-returnToParent") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;
              const hasOutput =
                state === "output-available" || state === "result";

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-returnToParent" />
                  <ToolContent>
                    {(state === "input-available" || state === "call") && (
                      <ToolInput input={partAny.input || partAny.args} />
                    )}
                    {hasOutput && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          <div className="text-green-600 text-sm">
                            ✓ Returned to parent chat
                          </div>
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return false;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <BotIcon />
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">Thinking...</div>
        </div>
      </div>
    </motion.div>
  );
};
