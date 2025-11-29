"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { SpawnSubAgentsOutput } from "@/lib/ai/tools/spawn-sub-agents";
import type { ChatStatus, ChatType, Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { AttachmentProvider } from "./attachment-context";
import { BlockedOverlay } from "./blocked-overlay";
import { BranchHeader } from "./branch-header";
import { PlusIcon } from "./icons";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { SidebarToggle } from "./sidebar-toggle";
import { SpawnProvider } from "./spawn-context";
import { toast } from "./toast";
import { Button } from "./ui/button";
import { useSidebar } from "./ui/sidebar";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  autoStartResponse,
  initialLastContext,
  parentChatId,
  parentTitle,
  currentTitle,
  chatType,
  chatStatus,
  activeChildCount = 0,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  autoStartResponse?: boolean;
  initialLastContext?: AppUsage;
  parentChatId?: string;
  parentTitle?: string;
  currentTitle?: string;
  chatType?: ChatType;
  chatStatus?: ChatStatus;
  activeChildCount?: number;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });
  const { open: isSidebarOpen } = useSidebar();
  const router = useRouter();

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolResult,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Auto-start AI response for sub-agent chats that haven't started yet
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  useEffect(() => {
    if (autoStartResponse && !hasAutoStarted && status === "ready") {
      setHasAutoStarted(true);
      // Trigger AI response - the initial user message is already there
      sendMessage();
    }
  }, [autoStartResponse, hasAutoStarted, status, sendMessage]);

  // Handler for continuing after spawn agents return
  const handleContinueSpawn = async (
    _toolCallId: string,
    output: SpawnSubAgentsOutput
  ) => {
    // Build a summary of what the sub-agents returned
    const agentSummaries = output.agents
      .map((a) => {
        const assets = a.returnedAssets?.length
          ? `Assets: ${a.returnedAssets.join(", ")}`
          : "No assets";
        const summary = a.summary || "Task completed";
        return `- ${a.name}: ${summary} (${assets})`;
      })
      .join("\n");

    // Send a user message to continue the conversation with sub-agent results
    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `All sub-agents have completed their work. Here are the results:\n\n${agentSummaries}\n\nPlease continue with the next steps.`,
        },
      ],
    });
  };

  return (
    <AttachmentProvider>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        {parentChatId ? null : (
          <ChatHeader
            chatId={id}
            isReadonly={isReadonly}
            selectedVisibilityType={initialVisibilityType}
          />
        )}

        {parentChatId && (
          <BranchHeader
            actions={
              isSidebarOpen ? null : (
                <div className="flex items-center gap-1">
                  <SidebarToggle className="h-8 px-2 md:h-fit md:px-2" />
                  <Button
                    className="h-8 px-2 md:h-fit md:px-2"
                    onClick={() => {
                      router.push("/");
                      router.refresh();
                    }}
                    variant="outline"
                  >
                    <PlusIcon />
                  </Button>
                </div>
              )
            }
            currentTitle={currentTitle}
            parentChatId={parentChatId}
            parentTitle={parentTitle}
          />
        )}

        <SpawnProvider onContinueSpawn={handleContinueSpawn}>
          <Messages
            chatId={id}
            isArtifactVisible={isArtifactVisible}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />
        </SpawnProvider>

        <div className="relative sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {activeChildCount > 0 && (
            <BlockedOverlay activeCount={activeChildCount} />
          )}
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AttachmentProvider>
  );
}
