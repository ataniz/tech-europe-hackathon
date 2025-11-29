import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tool, type UIMessageStreamWriter } from "ai";
import mime from "mime";
import type { Session } from "next-auth";
import { z } from "zod";
import { createAsset, getAssetsByIds } from "@/lib/db/queries";
import {
  generateImage as bananaGenerateImage,
  type AspectRatio,
  type ReferenceImage,
} from "@/lib/services/google/banana";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type GenerateImageProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "assets");

async function resolveReferenceAssets(
  assetIds: string[]
): Promise<ReferenceImage[]> {
  if (assetIds.length === 0) return [];

  const assets = await getAssetsByIds(assetIds);
  const references: ReferenceImage[] = [];

  for (const asset of assets) {
    if (asset.type !== "image") continue;

    try {
      // Asset URLs are like /uploads/assets/filename.png
      const filename = asset.url.replace(/^\/uploads\/assets\//, "");
      const filePath = path.join(UPLOADS_DIR, filename);
      const buffer = await readFile(filePath);
      const mimeType = mime.getType(filePath) || "image/png";

      references.push({ data: buffer, mimeType });
    } catch (error) {
      console.error(`Failed to read reference asset ${asset.id}:`, error);
    }
  }

  return references;
}

export const generateImage = ({
  session,
  dataStream,
  chatId,
}: GenerateImageProps) =>
  tool({
    description:
      "Generate an image using AI based on a text prompt. Can optionally use reference images for style or content guidance.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("Detailed description of the image to generate"),
      referenceAssets: z
        .array(z.string())
        .optional()
        .describe("Optional asset UUIDs to use as visual references"),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("Aspect ratio for the generated image"),
    }),
    execute: async ({ prompt, referenceAssets, aspectRatio }) => {
      // Ensure uploads directory exists
      await mkdir(UPLOADS_DIR, { recursive: true });

      // Resolve reference assets if provided
      const referenceImages = referenceAssets
        ? await resolveReferenceAssets(referenceAssets)
        : undefined;

      // Generate image using Banana service
      const result = await bananaGenerateImage({
        prompt,
        referenceImages,
        aspectRatio: aspectRatio as AspectRatio | undefined,
      });

      // Determine file extension from mime type
      const extension = mime.getExtension(result.mimeType) || "png";
      const filename = `${generateUUID()}.${extension}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      // Save to disk
      await writeFile(filePath, result.buffer);

      // Create asset record
      const asset = await createAsset({
        chatId,
        type: "image",
        url: `/uploads/assets/${filename}`,
        prompt,
      });

      // Notify UI
      dataStream.write({
        type: "data-assetCreated",
        data: { assetId: asset.id, url: asset.url, type: "image" },
      });

      return {
        assetId: asset.id,
        url: asset.url,
        message: result.text || "Image generated successfully",
      };
    },
  });
