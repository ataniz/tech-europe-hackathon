import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { concatenateVideos } from "./ai/tools/concatenate-videos";
import type { generateImage } from "./ai/tools/generate-image";
import type { generateVideo } from "./ai/tools/generate-video";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { returnToParent } from "./ai/tools/return-to-parent";
import type { spawnSubAgents } from "./ai/tools/spawn-sub-agents";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type spawnSubAgentsTool = InferUITool<ReturnType<typeof spawnSubAgents>>;
type concatenateVideosTool = InferUITool<
  ReturnType<typeof concatenateVideos>
>;
type generateImageTool = InferUITool<ReturnType<typeof generateImage>>;
type generateVideoTool = InferUITool<ReturnType<typeof generateVideo>>;
type returnToParentTool = InferUITool<ReturnType<typeof returnToParent>>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  spawnSubAgents: spawnSubAgentsTool;
  concatenateVideos: concatenateVideosTool;
  generateImage: generateImageTool;
  generateVideo: generateVideoTool;
  returnToParent: returnToParentTool;
};

export type SpawnedAgentsData = {
  chats: Array<{ id: string; name: string }>;
};

export type AssetCreatedData = {
  assetId: string;
  url: string;
  type: "image" | "video";
};

export type BranchReturnedData = {
  chatId: string;
  navigateTo: string | null;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  // Branching data types
  spawnedAgents: SpawnedAgentsData;
  assetCreated: AssetCreatedData;
  branchReturned: BranchReturnedData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
