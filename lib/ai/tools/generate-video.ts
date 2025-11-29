import { readFile } from "node:fs/promises";
import path from "node:path";
import { tool, type UIMessageStreamWriter } from "ai";
import mime from "mime";
import type { Session } from "next-auth";
import { z } from "zod";
import { getAssetsByIds } from "@/lib/db/queries";
import {
  generateVideo as veoGenerateVideo,
  type ImageInput,
  type VeoAspectRatio,
} from "@/lib/services/google/veo";
import type { ChatMessage } from "@/lib/types";

type GenerateVideoProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");

async function resolveAssetToImageInput(
  assetUrl: string
): Promise<ImageInput | null> {
  try {
    // Asset URLs are like /uploads/images/filename.png or /uploads/filename.png
    const filePath = path.join(PUBLIC_DIR, assetUrl);
    const buffer = await readFile(filePath);
    const mimeType = mime.getType(filePath) || "image/png";
    return { data: buffer, mimeType };
  } catch (error) {
    console.error(`Failed to read asset: ${assetUrl}`, error);
    return null;
  }
}

async function resolveAssetIds(assetIds: string[]): Promise<ImageInput[]> {
  if (assetIds.length === 0) return [];

  const assets = await getAssetsByIds(assetIds);
  const inputs: ImageInput[] = [];

  for (const asset of assets) {
    if (asset.type !== "image") continue;
    const input = await resolveAssetToImageInput(asset.url);
    if (input) inputs.push(input);
  }

  return inputs;
}

export const generateVideo = ({
  session,
  dataStream,
  chatId,
}: GenerateVideoProps) =>
  tool({
    description:
      "Generate a video using AI. Supports text-to-video, image-to-video with start/end frames, and reference-based generation.",
    inputSchema: z.object({
      prompt: z
        .string()
        .optional()
        .describe("Text description of the video to generate"),
      startFrameAssetId: z
        .string()
        .optional()
        .describe("Asset UUID to use as the starting frame (image-to-video)"),
      endFrameAssetId: z
        .string()
        .optional()
        .describe("Asset UUID to use as the ending frame (interpolation)"),
      isLooping: z
        .boolean()
        .optional()
        .describe("If true with startFrame, creates a looping video"),
      referenceAssetIds: z
        .array(z.string())
        .optional()
        .describe("Asset UUIDs to use as visual references"),
      styleAssetId: z
        .string()
        .optional()
        .describe("Asset UUID to use as style reference"),
      aspectRatio: z
        .enum(["16:9", "9:16"])
        .optional()
        .describe("Aspect ratio for the generated video"),
    }),
    execute: async ({
      prompt,
      startFrameAssetId,
      endFrameAssetId,
      isLooping,
      referenceAssetIds,
      styleAssetId,
      aspectRatio,
    }) => {
      // Resolve start frame
      let startFrame: ImageInput | undefined;
      if (startFrameAssetId) {
        const [input] = await resolveAssetIds([startFrameAssetId]);
        startFrame = input;
      }

      // Resolve end frame
      let endFrame: ImageInput | undefined;
      if (endFrameAssetId) {
        const [input] = await resolveAssetIds([endFrameAssetId]);
        endFrame = input;
      }

      // Resolve reference images
      const referenceImages = referenceAssetIds
        ? await resolveAssetIds(referenceAssetIds)
        : undefined;

      // Resolve style image
      let styleImage: ImageInput | undefined;
      if (styleAssetId) {
        const [input] = await resolveAssetIds([styleAssetId]);
        styleImage = input;
      }

      // Generate video
      const result = await veoGenerateVideo({
        chatId,
        prompt,
        startFrame,
        endFrame,
        isLooping,
        referenceImages,
        styleImage,
        aspectRatio: aspectRatio as VeoAspectRatio | undefined,
      });

      // Notify UI
      dataStream.write({
        type: "data-assetCreated",
        data: {
          assetId: result.asset.id,
          url: result.asset.url,
          type: "video",
        },
      });

      return {
        assetId: result.asset.id,
        url: result.asset.url,
        message: "Video generated successfully",
      };
    },
  });
