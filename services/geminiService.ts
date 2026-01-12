
import { GoogleGenAI } from "@google/genai";

// Fixed: Moved initialization inside functions to ensure latest process.env.API_KEY is used.

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const getWisdomSearch = async (userPrompt: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are the Conscious Network Hub Wisdom Node. Use Google Search to provide accurate, up-to-date information about decentralization, blockchain ethics, and social learning trends.",
        temperature: 0.7,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    return { text, groundingChunks };
  } catch (error: any) {
    console.error("Search Error:", error);
    return { text: "Search layer temporarily offline.", groundingChunks: [] };
  }
};

export const getWisdomMaps = async (userPrompt: string, location?: { latitude: number, longitude: number }) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: location || { latitude: 37.7749, longitude: -122.4194 } // Default to SF if none provided
          }
        },
        systemInstruction: "You are the Wisdom Node specializing in geographic and place-based information for the Conscious Network Hub. Use Google Maps to find restaurants, centers, or locations.",
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    return { text, groundingChunks };
  } catch (error) {
    console.error("Maps Error:", error);
    return { text: "Maps layer temporarily offline.", groundingChunks: [] };
  }
};

export const fastWisdomChat = async (message: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      // Fixed: Using gemini-3-flash-preview for basic text tasks as per guidelines
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: "You are the Fast Wisdom Node of the Conscious Network Hub. Provide quick, concise, and futuristic guidance on the platform and its ethical frameworks.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("Fast Chat Error:", error);
    return "Neural link lag detected.";
  }
};

export const generateWisdomImage = async (prompt: string, aspectRatio: string = "1:1") => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K"
        }
      },
    });

    // Fixed: Properly iterate through response parts to find image data
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    // Note: If error contains "Requested entity was not found.", 
    // the UI should trigger window.aistudio.openSelectKey()
    return null;
  }
};
