import { access } from "node:fs/promises";
import path from "node:path";
import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getAssetsByIds } from "@/lib/db/queries";
import { concatenateVideos as ffmpegConcatenateVideos } from "@/lib/services/ffmpeg";
import type { ChatMessage } from "@/lib/types";

type ConcatenateVideosProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");

function toAbsoluteAssetPath(assetUrl: string): string {
  const normalizedUrl = assetUrl.startsWith("/") ? assetUrl.slice(1) : assetUrl;
  return path.join(PUBLIC_DIR, normalizedUrl);
}

async function resolveVideoPaths(assetIds: string[]): Promise<string[]> {
  const assets = await getAssetsByIds(assetIds);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  const missingAssets = assetIds.filter((id) => !assetMap.has(id));
  if (missingAssets.length > 0) {
    throw new Error(`Assets not found: ${missingAssets.join(", ")}`);
  }

  const videoPaths: string[] = [];

  for (const assetId of assetIds) {
    const asset = assetMap.get(assetId);
    if (!asset) continue;

    if (asset.type !== "video") {
      throw new Error(`Asset ${assetId} is not a video`);
    }

    const filePath = toAbsoluteAssetPath(asset.url);
    await access(filePath);
    videoPaths.push(filePath);
  }

  return videoPaths;
}

export const concatenateVideos = ({
  session,
  dataStream,
  chatId,
}: ConcatenateVideosProps) =>
  tool({
    description:
      "Concatenate multiple video assets in order using FFmpeg and save as a new video asset.",
    inputSchema: z.object({
      videoAssetIds: z
        .array(z.string())
        .min(2, "Provide at least two video asset IDs")
        .describe("Ordered list of video asset IDs to concatenate"),
      note: z
        .string()
        .optional()
        .describe("Optional context for the combined clip"),
    }),
    execute: async ({ videoAssetIds, note }) => {
      const videoPaths = await resolveVideoPaths(videoAssetIds);

      const description = note
        ? `Concatenated videos (${videoAssetIds.join(", ")}): ${note}`
        : `Concatenated videos: ${videoAssetIds.join(", ")}`;

      const { asset } = await ffmpegConcatenateVideos({
        chatId,
        inputFiles: videoPaths,
        description,
      });

      dataStream.write({
        type: "data-assetCreated",
        data: {
          assetId: asset.id,
          url: asset.url,
          type: "video",
        },
      });

      return {
        assetId: asset.id,
        url: asset.url,
        message: "Videos concatenated successfully",
      };
    },
  });
