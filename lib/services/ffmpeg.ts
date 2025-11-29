import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAsset } from "@/lib/db/queries";
import type { Asset } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

const VIDEOS_DIR = path.join(process.cwd(), "public", "uploads", "videos");

type ConcatenateVideosParams = {
  chatId: string;
  inputFiles: string[];
  description?: string;
};

function escapePathForFfmpeg(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    let stdout = "";

    ffmpeg.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = stderr || stdout;
      reject(
        new Error(
          `ffmpeg exited with code ${code ?? "unknown"}: ${
            message ? message.slice(-2000) : "no output"
          }`
        )
      );
    });
  });
}

export async function concatenateVideos({
  chatId,
  inputFiles,
  description,
}: ConcatenateVideosParams): Promise<{ asset: Asset; outputPath: string }> {
  if (inputFiles.length < 2) {
    throw new Error("At least two video files are required to concatenate");
  }

  for (const filePath of inputFiles) {
    await access(filePath);
  }

  await mkdir(VIDEOS_DIR, { recursive: true });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ffmpeg-concat-"));
  const listPath = path.join(tempDir, "inputs.txt");

  try {
    const fileList = inputFiles
      .map((file) => `file '${escapePathForFfmpeg(file)}'`)
      .join("\n");

    await writeFile(listPath, fileList);

    const filename = `${generateUUID()}.mp4`;
    const outputPath = path.join(VIDEOS_DIR, filename);

    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const asset = await createAsset({
      chatId,
      type: "video",
      url: `/uploads/videos/${filename}`,
      prompt: description,
    });

    return { asset, outputPath };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
