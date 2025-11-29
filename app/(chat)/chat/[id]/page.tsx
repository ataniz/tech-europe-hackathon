import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  getChatById,
  getChildChats,
  getMessagesByChatId,
  getParentChat,
} from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  // Fetch branching metadata
  const parentChat = chat.parentChatId ? await getParentChat(id) : null;
  const childChats =
    chat.chatType === "orchestrator" ? await getChildChats(id) : [];
  const activeChildCount = childChats.filter(
    (c) => c.status === "active"
  ).length;

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  // Check if this is a sub-agent that needs auto-start
  // (has user message but no assistant response yet)
  const needsAutoStart =
    chat.chatType === "sub-agent" &&
    uiMessages.length === 1 &&
    uiMessages[0].role === "user";

  // Common branch props
  const branchProps = {
    parentChatId: chat.parentChatId ?? undefined,
    parentTitle: parentChat?.title,
    currentTitle: chat.title,
    chatType: chat.chatType,
    chatStatus: chat.status,
    activeChildCount,
    autoStartResponse: needsAutoStart,
  };

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialLastContext={chat.lastContext ?? undefined}
          initialMessages={uiMessages}
          initialVisibilityType={chat.visibility}
          isReadonly={session?.user?.id !== chat.userId}
          {...branchProps}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={chatModelFromCookie.value}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
        {...branchProps}
      />
      <DataStreamHandler />
    </>
  );
}
