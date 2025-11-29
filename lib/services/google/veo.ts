import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type GenerateVideosConfig,
  type GenerateVideosParameters,
  type Image,
  type VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from "@google/genai";
import { createAsset } from "@/lib/db/queries";
import type { Asset } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import { getGoogleAIClient } from "./client";

const VIDEOS_DIR = path.join(process.cwd(), "public", "uploads", "videos");
const DEFAULT_MODEL = "veo-3.1-fast-generate-preview";
const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export type VeoModel =
  | "veo-3.1-fast-generate-preview"
  | "veo-3.1-generate-preview";
export type VeoAspectRatio = "16:9" | "9:16";
export type VeoResolution = "720p" | "1080p";

export type ImageInput = {
  data: Buffer | string; // Buffer or base64
  mimeType: string;
};

export type VeoGenerateParams = {
  // Required
  chatId: string;

  // Core params
  prompt?: string;
  model?: VeoModel;
  aspectRatio?: VeoAspectRatio;
  resolution?: VeoResolution;

  // Image-to-Video (start frame)
  startFrame?: ImageInput;

  // Interpolation (end frame)
  endFrame?: ImageInput;

  // Looping (reuse startFrame as endFrame)
  isLooping?: boolean;

  // Reference-based generation
  referenceImages?: ImageInput[];

  // Style reference (separate from asset references)
  styleImage?: ImageInput;
};

export type VeoGenerateResult = {
  asset: Asset;
  uri: string;
};

function toBase64(input: Buffer | string): string {
  return input instanceof Buffer ? input.toString("base64") : String(input);
}

function toImage(input: ImageInput): Image {
  return {
    imageBytes: toBase64(input.data),
    mimeType: input.mimeType,
  };
}

export async function generateVideo(
  params: VeoGenerateParams
): Promise<VeoGenerateResult> {
  const {
    chatId,
    prompt,
    model = DEFAULT_MODEL,
    aspectRatio = "16:9",
    resolution = "720p",
    startFrame,
    endFrame,
    isLooping = false,
    referenceImages,
    styleImage,
  } = params;

  // Validate: need at least prompt or startFrame
  if (!prompt && !startFrame) {
    throw new Error("Either prompt or startFrame is required");
  }

  const client = getGoogleAIClient();

  // Build config
  const config: GenerateVideosConfig = {
    numberOfVideos: 1,
    resolution,
    aspectRatio,
  };

  // Build payload
  const payload: GenerateVideosParameters = {
    model,
    config,
  };

  // Add prompt if provided
  if (prompt) {
    payload.prompt = prompt;
  }

  // Handle start frame (image-to-video)
  if (startFrame) {
    payload.image = toImage(startFrame);

    // Handle end frame or looping
    const finalEndFrame = isLooping ? startFrame : endFrame;
    if (finalEndFrame) {
      config.lastFrame = toImage(finalEndFrame);
    }
  }

  // Handle reference images
  if (referenceImages || styleImage) {
    const refs: VideoGenerationReferenceImage[] = [];

    if (referenceImages) {
      for (const img of referenceImages) {
        refs.push({
          image: toImage(img),
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }

    if (styleImage) {
      refs.push({
        image: toImage(styleImage),
        referenceType: VideoGenerationReferenceType.STYLE,
      });
    }

    if (refs.length > 0) {
      config.referenceImages = refs;
    }
  }

  // Submit video generation request
  let operation = await client.models.generateVideos(payload);

  // Poll until done or timeout
  const startTime = Date.now();
  while (!operation.done) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      throw new Error("Video generation timed out after 5 minutes");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await client.operations.getVideosOperation({ operation });
  }

  // Extract video from response
  const videos = operation.response?.generatedVideos;
  if (!videos || videos.length === 0) {
    throw new Error("No videos were generated");
  }

  const videoData = videos[0]?.video;
  if (!videoData?.uri) {
    throw new Error("Generated video is missing URI");
  }

  // Fetch video from URI
  const videoUri = decodeURIComponent(videoData.uri);
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const fetchUrl = `${videoUri}&key=${apiKey}`;

  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch video: ${response.status} ${response.statusText}`
    );
  }

  const videoBlob = await response.blob();
  const buffer = Buffer.from(await videoBlob.arrayBuffer());

  // Ensure videos directory exists
  await mkdir(VIDEOS_DIR, { recursive: true });

  // Save to disk
  const filename = `${generateUUID()}.mp4`;
  const filePath = path.join(VIDEOS_DIR, filename);
  await writeFile(filePath, buffer);

  // Create asset record
  const asset = await createAsset({
    chatId,
    type: "video",
    url: `/uploads/videos/${filename}`,
    prompt: prompt || undefined,
  });

  return {
    asset,
    uri: videoUri,
  };
}
