import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createAsset } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type GenerateImageProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

export const generateImage = ({
  session,
  dataStream,
  chatId,
}: GenerateImageProps) =>
  tool({
    description: "Generate an image using AI based on a text prompt.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("Detailed description of the image to generate"),
    }),
    execute: async ({ prompt }) => {
      // PLACEHOLDER: Gemini AI Studio integration
      // For now, create mock asset
      const mockUrl = `/uploads/assets/placeholder-${generateUUID()}.png`;

      const asset = await createAsset({
        chatId,
        type: "image",
        url: mockUrl,
        prompt,
      });

      dataStream.write({
        type: "data-assetCreated",
        data: { assetId: asset.id, url: asset.url, type: "image" },
      });

      return {
        assetId: asset.id,
        url: asset.url,
        message: "Image generated successfully",
      };
    },
  });
