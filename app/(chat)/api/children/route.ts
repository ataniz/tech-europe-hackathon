import { auth } from "@/app/(auth)/auth";
import { getChatById, getChildChats } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const children = await getChildChats(chatId);

  // Return simplified status info
  const childStatuses = children.map((child) => ({
    id: child.id,
    name: child.title,
    status: child.status,
    returnValue: child.returnValue,
  }));

  return Response.json(childStatuses);
}
