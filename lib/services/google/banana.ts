import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateContentConfig } from "@google/genai";
import mime from "mime";
import { createAsset } from "@/lib/db/queries";
import type { Asset } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import { getGoogleAIClient } from "./client";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "assets");
const MODEL = "gemini-3-pro-image-preview";

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageSize = "1K" | "2K";

export type ReferenceImage = {
  data: Buffer | string; // Buffer or base64 string
  mimeType: string;
};

export type BananaGenerateParams = {
  // Required
  chatId: string;
  prompt: string;

  // Optional
  referenceImages?: ReferenceImage[];
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
};

export type BananaGenerateResult = {
  asset: Asset;
  text?: string;
};

type ContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

function toBase64(input: Buffer | string): string {
  return input instanceof Buffer ? input.toString("base64") : String(input);
}

export async function generateImage(
  params: BananaGenerateParams
): Promise<BananaGenerateResult> {
  const {
    chatId,
    prompt,
    referenceImages,
    aspectRatio,
    imageSize = "1K",
  } = params;

  const client = getGoogleAIClient();

  // Build parts array: text prompt + optional reference images
  const parts: ContentPart[] = [{ text: prompt }];

  if (referenceImages && referenceImages.length > 0) {
    for (const ref of referenceImages) {
      parts.push({
        inlineData: {
          data: toBase64(ref.data),
          mimeType: ref.mimeType,
        },
      });
    }
  }

  const config: GenerateContentConfig = {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: {
      imageSize,
      aspectRatio,
    },
  };

  const response = await client.models.generateContentStream({
    model: MODEL,
    config,
    contents: [{ role: "user", parts }],
  });

  let imageBuffer: Buffer | null = null;
  let imageMimeType = "image/png";
  let textResponse = "";

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) {
      continue;
    }

    for (const part of chunk.candidates[0].content.parts) {
      if (part.inlineData) {
        imageMimeType = part.inlineData.mimeType || "image/png";
        imageBuffer = Buffer.from(part.inlineData.data || "", "base64");
      } else if (part.text) {
        textResponse += part.text;
      }
    }
  }

  if (!imageBuffer) {
    throw new Error("No image generated in response");
  }

  // Ensure uploads directory exists
  await mkdir(UPLOADS_DIR, { recursive: true });

  // Determine file extension and save
  const extension = mime.getExtension(imageMimeType) || "png";
  const filename = `${generateUUID()}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  await writeFile(filePath, imageBuffer);

  // Create asset record
  const asset = await createAsset({
    chatId,
    type: "image",
    url: `/uploads/assets/${filename}`,
    prompt,
  });

  return {
    asset,
    text: textResponse || undefined,
  };
}
