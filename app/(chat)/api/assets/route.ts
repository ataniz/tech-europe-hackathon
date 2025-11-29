import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAssetById, getAssetsByChatId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const chatId = searchParams.get("chatId");

  if (id) {
    const asset = await getAssetById(id);
    return Response.json(asset);
  }

  if (chatId) {
    const assets = await getAssetsByChatId(chatId);
    return Response.json(assets);
  }

  return new ChatSDKError("bad_request:api").toResponse();
}
