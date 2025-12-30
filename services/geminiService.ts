
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ScoutResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export const performScout = async (prompt: string): Promise<ScoutResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are OmniScout AI, a high-performance autonomous web agent. 
      Your objective is to scout the web for this request: "${prompt}".
      Provide a detailed analysis and specific findings.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No analysis generated.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources = chunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri,
      }));

    return { text, sources };
  } catch (error) {
    console.error("Scout Error:", error);
    return { text: "Scout failed to initialize connection to cognitive cluster.", sources: [] };
  }
};

export const getThought = async (context: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Short internal thought (10 words) for an AI agent performing: "${context}"`,
    });
    return response.text?.trim() || "Analyzing semantic structures...";
  } catch (error) {
    return "Processing data streams...";
  }
};
