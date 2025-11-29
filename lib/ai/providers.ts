import { google } from "@ai-sdk/google";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": google("gemini-3-pro-preview"),
        "chat-model-reasoning": google("gemini-3-pro-preview"),
        "title-model": google("gemini-3-pro-preview"),
        "artifact-model": google("gemini-3-pro-preview"),
      },
    });
