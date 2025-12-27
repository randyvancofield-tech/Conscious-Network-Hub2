
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const getEthicalAIAdvice = async (userPrompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are the Conscious Network Hub Ethical AI. Use Google Search to provide accurate, up-to-date information about decentralization, blockchain ethics, and social learning trends. Always verify platform-specific details: Ethical AI/Blockchain, Provider-Centric Model, Tier-Based Learning, Institutional Integration, and the Social Space.",
        temperature: 0.7,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    return { text, groundingChunks };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "I am currently undergoing a security protocol update. Please try again in a moment.", groundingChunks: [] };
  }
};

export const chatWithEthicalAI = async (message: string, history: ChatMessage[] = []) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      config: {
        systemInstruction: `You are the core intelligence of the Conscious Network Hub. 
        Your mission is to provide deep, reflective, and ethically-sound guidance on decentralization, data sovereignty, and social learning. 
        The platform restores autonomy and protects identity. 
        If a user asks for recent news or facts outside your internal knowledge, suggest using a search-grounded query.
        Keep your tone empowering, futuristic, and intellectually rigorous.`,
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "The neural link is temporarily unstable. Re-establishing connection...";
  }
};
