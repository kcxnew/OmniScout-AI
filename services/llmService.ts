
import { GoogleGenAI, Type } from "@google/genai";
import { logger } from '../lib/logger';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface SelectorSuggestion {
  selector: string;
  confidence: number;
  reasoning: string;
}

/**
 * Uses Gemini to analyze the accessibility tree and candidate elements 
 * to suggest the most robust selector for a given automation goal.
 */
export async function verifyAndSuggestSelector({ semanticTree, candidates, prompt }: {
  semanticTree: any;
  candidates: any[];
  prompt: string;
}): Promise<SelectorSuggestion> {
  logger.info({ prompt }, 'LLM: Requesting selector suggestion');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a high-performance web automation architect. Your task is to identify the most robust CSS or XPath selector for the given element description.
      
Element Description: "${prompt}"

Accessibility Tree (Partial):
${JSON.stringify(semanticTree).slice(0, 4000)}

Candidate Actionable Elements:
${JSON.stringify(candidates).slice(0, 4000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selector: { 
              type: Type.STRING, 
              description: "The CSS selector or XPath. Prefer ID or unique attributes over brittle positional XPaths." 
            },
            confidence: { 
              type: Type.NUMBER, 
              description: "Confidence score between 0 and 1." 
            },
            reasoning: { 
              type: Type.STRING, 
              description: "Brief technical justification for this choice." 
            }
          },
          required: ["selector", "confidence", "reasoning"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}") as SelectorSuggestion;
    logger.info({ result }, 'LLM: Selector verified');
    return result;
  } catch (error) {
    logger.error({ error }, "LLM: Selector Verification Failed");
    // Fallback logic if LLM fails
    return {
      selector: "body",
      confidence: 0.1,
      reasoning: "System fallback due to LLM timeout/error."
    };
  }
}
