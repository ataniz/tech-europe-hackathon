import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGoogleAIClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
