/**
 * Test script for Banana (image) and Veo (video) generation services
 *
 * Run with: npx tsx scripts/test-media-generation.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// We need to mock the database calls since we're running outside Next.js
// For a true integration test, we'd need the full app context

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";

const OUTPUTS_DIR = path.join(process.cwd(), "test-outputs");

async function getClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

async function testBanana() {
  console.log("\n🍌 Testing Banana (Image Generation)...\n");

  const client = await getClient();

  const prompt = "A cute robot holding a banana, digital art style";
  console.log(`Prompt: "${prompt}"`);

  const config = {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: {
      imageSize: "1K",
    },
  };

  console.log("Generating image...");
  const startTime = Date.now();

  const response = await client.models.generateContentStream({
    model: "gemini-3-pro-image-preview",
    config,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  let imageBuffer: Buffer | null = null;
  let imageMimeType = "image/png";
  let textResponse = "";

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) continue;

    for (const part of chunk.candidates[0].content.parts) {
      if (part.inlineData) {
        imageMimeType = part.inlineData.mimeType || "image/png";
        imageBuffer = Buffer.from(part.inlineData.data || "", "base64");
      } else if (part.text) {
        textResponse += part.text;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!imageBuffer) {
    console.error("❌ No image generated");
    return false;
  }

  await mkdir(OUTPUTS_DIR, { recursive: true });
  const extension = imageMimeType.split("/")[1] || "png";
  const filename = `banana-test-${Date.now()}.${extension}`;
  const filePath = path.join(OUTPUTS_DIR, filename);
  await writeFile(filePath, imageBuffer);

  console.log(`✅ Image generated in ${elapsed}s`);
  console.log(`   Saved to: ${filePath}`);
  console.log(`   Size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  if (textResponse) {
    console.log(`   Text response: ${textResponse}`);
  }

  return true;
}

async function testVeo() {
  console.log("\n🎬 Testing Veo (Video Generation)...\n");

  const client = await getClient();

  const prompt = "A banana spinning slowly on a white background, smooth motion";
  console.log(`Prompt: "${prompt}"`);

  const config = {
    numberOfVideos: 1,
    resolution: "720p",
    aspectRatio: "16:9",
  };

  console.log("Submitting video generation request...");
  const startTime = Date.now();

  let operation = await client.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    prompt,
    config,
  });

  console.log("Polling for completion (this may take 1-3 minutes)...");

  const TIMEOUT_MS = 5 * 60 * 1000;
  const POLL_INTERVAL_MS = 10_000;

  while (!operation.done) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`   ...waiting (${elapsed}s elapsed)`);

    if (Date.now() - startTime > TIMEOUT_MS) {
      console.error("❌ Video generation timed out after 5 minutes");
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await client.operations.getVideosOperation({ operation });
  }

  const videos = operation.response?.generatedVideos;
  if (!videos || videos.length === 0) {
    console.error("❌ No videos were generated");
    return false;
  }

  const videoData = videos[0]?.video;
  if (!videoData?.uri) {
    console.error("❌ Generated video is missing URI");
    return false;
  }

  // Fetch video
  const videoUri = decodeURIComponent(videoData.uri);
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const fetchUrl = `${videoUri}&key=${apiKey}`;

  console.log("Downloading video...");
  const fetchResponse = await fetch(fetchUrl);
  if (!fetchResponse.ok) {
    console.error(`❌ Failed to fetch video: ${fetchResponse.status}`);
    return false;
  }

  const videoBlob = await fetchResponse.blob();
  const buffer = Buffer.from(await videoBlob.arrayBuffer());

  await mkdir(OUTPUTS_DIR, { recursive: true });
  const filename = `veo-test-${Date.now()}.mp4`;
  const filePath = path.join(OUTPUTS_DIR, filename);
  await writeFile(filePath, buffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Video generated in ${elapsed}s`);
  console.log(`   Saved to: ${filePath}`);
  console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  return true;
}

async function main() {
  console.log("=".repeat(50));
  console.log("Media Generation Test Script");
  console.log("=".repeat(50));

  const args = process.argv.slice(2);
  const testImage = args.length === 0 || args.includes("--image");
  const testVideo = args.length === 0 || args.includes("--video");

  let imageSuccess = true;
  let videoSuccess = true;

  if (testImage) {
    try {
      imageSuccess = await testBanana();
    } catch (error) {
      console.error("❌ Banana test failed:", error);
      imageSuccess = false;
    }
  }

  if (testVideo) {
    try {
      videoSuccess = await testVeo();
    } catch (error) {
      console.error("❌ Veo test failed:", error);
      videoSuccess = false;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Results:");
  if (testImage) console.log(`  Banana (Image): ${imageSuccess ? "✅ PASS" : "❌ FAIL"}`);
  if (testVideo) console.log(`  Veo (Video):    ${videoSuccess ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(50));

  process.exit(imageSuccess && videoSuccess ? 0 : 1);
}

main();
