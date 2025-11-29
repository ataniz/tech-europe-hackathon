import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createAsset } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type GenerateVideoProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

export const generateVideo = ({
  session,
  dataStream,
  chatId,
}: GenerateVideoProps) =>
  tool({
    description:
      "Generate a video using AI based on a text prompt and optional reference assets.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("Detailed description of the video to generate"),
      referenceAssets: z
        .array(z.string())
        .optional()
        .describe("Optional asset UUIDs to use as visual references"),
    }),
    execute: async ({ prompt, referenceAssets }) => {
      // PLACEHOLDER: Gemini AI Studio integration
      const mockUrl = `/uploads/assets/placeholder-${generateUUID()}.mp4`;

      const asset = await createAsset({
        chatId,
        type: "video",
        url: mockUrl,
        prompt,
      });

      dataStream.write({
        type: "data-assetCreated",
        data: { assetId: asset.id, url: asset.url, type: "video" },
      });

      return {
        assetId: asset.id,
        url: asset.url,
        message: "Video generated successfully",
      };
    },
  });
