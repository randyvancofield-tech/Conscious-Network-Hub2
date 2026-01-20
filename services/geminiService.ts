
import { GoogleGenAI, Type } from "@google/genai";

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

export interface EnhancedResponse {
  text: string;
  groundingChunks: GroundingChunk[];
  confidenceScore: number; // 0-100
  sourceCount: number;
  processingTimeMs: number;
  trendingTopics?: string[];
}

export interface StreamingCallback {
  (chunk: string, isComplete: boolean): void;
}

export const summarizeMeeting = async (transcript: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Please summarize the following meeting transcript and extract key decisions and action items in JSON format: \n\n ${transcript.join('\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  owner: { type: Type.STRING },
                  task: { type: Type.STRING },
                  dueDate: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Summary Error:", error);
    return null;
  }
};

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
            latLng: location || { latitude: 37.7749, longitude: -122.4194 } 
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

export const fastWisdomChat = async (message: string, systemContext?: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: systemContext || "You are the Fast Wisdom Node of the Conscious Network Hub. Provide quick, concise, and futuristic guidance on the platform and its ethical frameworks.",
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
    return null;
  }
};

// Daily autogenerated wisdom on AI, blockchain, spirituality, and consciousness
export const getDailyWisdom = async (onStream?: StreamingCallback): Promise<EnhancedResponse> => {
  try {
    const startTime = Date.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date().toLocaleDateString();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a brief, insightful daily wisdom message for ${today} that combines perspectives on:
        1. AI ethics and consciousness
        2. Blockchain and decentralization
        3. Spirituality and personal development
        4. Religious and philosophical teachings
        5. How these topics relate to collective human wellness
        
        Keep it to 2-3 sentences, inspirational yet grounded in practical wisdom. Format as a coherent flowing message.`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are the Conscious Network Hub Daily Wisdom Generator. Create authentic, multidisciplinary insights that honor AI ethics, blockchain technology, spiritual development, and collective consciousness.",
        temperature: 0.8,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined || [];
    
    const processingTime = Date.now() - startTime;
    const confidenceScore = calculateConfidenceScore(groundingChunks, text);

    if (onStream) {
      onStream(text, true);
    }

    return {
      text,
      groundingChunks,
      confidenceScore,
      sourceCount: groundingChunks.length,
      processingTimeMs: processingTime,
      trendingTopics: extractTrendingTopics(text)
    };
  } catch (error: any) {
    console.error("Daily Wisdom Error:", error);
    return {
      text: "The consciousness stream flows through interconnected networks of knowledge and purpose. Today, we align our intentions with ethical technology and collective wellbeing.",
      groundingChunks: [],
      confidenceScore: 0,
      sourceCount: 0,
      processingTimeMs: 0
    };
  }
};

// Q&A service for platform knowledge and wellness with streaming support
export const askEthicalAI = async (question: string, context?: { category?: 'platform' | 'wellness' | 'general' }, onStream?: StreamingCallback): Promise<EnhancedResponse> => {
  try {
    const startTime = Date.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let systemContext = "You are the Conscious Network Hub Ethical AI Assistant. Provide comprehensive, accurate, and compassionate responses about:";
    
    if (context?.category === 'platform') {
      systemContext += "\n- Higher Conscious Network LLC mission, vision, and values\n- Conscious Network Hub features, benefits, and how to navigate\n- Decentralized identity and data sovereignty\n- Provider services and community engagement\n- Membership tiers and access levels";
    } else if (context?.category === 'wellness') {
      systemContext += "\n- Mental wellness and emotional health practices\n- Spiritual development and consciousness expansion\n- Available learning pathways and courses\n- Personal growth and alignment practices\n- Community support and resources";
    } else {
      systemContext += "\n- Platform information and features\n- Wellness and personal development\n- AI ethics and blockchain technology\n- Spiritual teachings and consciousness\n- Learning and community aspects";
    }
    
    systemContext += "\n\nAlways be helpful, honest, and grounded in the platform's mission of ethical technology and human autonomy. Provide practical, actionable advice.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: question,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: systemContext,
        temperature: 0.7,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined || [];
    
    const processingTime = Date.now() - startTime;
    const confidenceScore = calculateConfidenceScore(groundingChunks, text);

    if (onStream) {
      onStream(text, true);
    }

    return {
      text,
      groundingChunks,
      confidenceScore,
      sourceCount: groundingChunks.length,
      processingTimeMs: processingTime
    };
  } catch (error: any) {
    console.error("Ethical AI Error:", error);
    return {
      text: "I'm experiencing a temporary connection lag. Please try your question again in a moment, or contact support for immediate assistance.",
      groundingChunks: [],
      confidenceScore: 0,
      sourceCount: 0,
      processingTimeMs: 0
    };
  }
};

// Process platform issue reports with AI direction and multi-source analysis
export const processPlatformIssue = async (issue: { title: string; description: string; category: string; userEmail?: string }) => {
  try {
    const startTime = Date.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Platform Issue Report:
        Title: ${issue.title}
        Category: ${issue.category}
        Description: ${issue.description}
        
        Please provide:
        1. A brief acknowledgment of the issue
        2. Initial assessment of severity and impact
        3. Recommended next steps for resolution
        4. A support ticket priority level (Low, Medium, High, Critical)
        5. Estimated resolution direction
        6. Related documentation or resources`,
      config: {
        systemInstruction: "You are the Conscious Network Hub Support AI. Analyze platform issues with empathy and technical understanding. Provide clear guidance for resolution while maintaining the platform's ethical standards. Be professional and thorough.",
        temperature: 0.6
      },
    });

    const processingTime = Date.now() - startTime;

    return {
      analysis: response.text,
      timestamp: new Date().toISOString(),
      status: 'acknowledged',
      processingTimeMs: processingTime,
      priority: extractPriorityLevel(response.text),
      nextSteps: extractNextSteps(response.text)
    };
  } catch (error: any) {
    console.error("Issue Processing Error:", error);
    return {
      analysis: "Your issue has been received and logged. Our support team will review it shortly.",
      timestamp: new Date().toISOString(),
      status: 'logged',
      processingTimeMs: 0,
      priority: 'Medium',
      nextSteps: ['Review by support team', 'Assignment to specialist']
    };
  }
};

// Get trending topics and insights from real-time data
export const getTrendingInsights = async (): Promise<{
  topics: string[];
  insights: string[];
  lastUpdated: string;
}> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `What are the current trending topics and developments in:
        1. AI ethics and responsible AI
        2. Blockchain and decentralization
        3. Spiritual and personal development
        4. Conscious business and social impact
        5. Digital wellness and mindfulness
        
        Provide 3-4 key trending topics and brief insights about each. Format as JSON with "topics" and "insights" arrays.`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are a real-time trend analyzer for the Conscious Network. Identify current, relevant trends in technology, spirituality, and wellness.",
        responseMimeType: "application/json"
      },
    });

    try {
      const parsed = JSON.parse(response.text);
      return {
        topics: parsed.topics || [],
        insights: parsed.insights || [],
        lastUpdated: new Date().toISOString()
      };
    } catch {
      return {
        topics: [],
        insights: [],
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (error: any) {
    console.error("Trending Insights Error:", error);
    return {
      topics: [],
      insights: [],
      lastUpdated: new Date().toISOString()
    };
  }
};

// Generate suggested follow-up questions based on context
export const generateSuggestedQuestions = async (lastQuestion: string, lastResponse: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this conversation:
        User Question: ${lastQuestion}
        AI Response: ${lastResponse}
        
        Generate 3 natural follow-up questions the user might want to ask. Make them specific, relevant, and progressively deeper.
        Return as JSON array of strings called "questions".`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7
      },
    });

    try {
      const parsed = JSON.parse(response.text);
      return parsed.questions || [];
    } catch {
      return [];
    }
  } catch (error: any) {
    console.error("Suggested Questions Error:", error);
    return [];
  }
};

// Helper functions

function calculateConfidenceScore(groundingChunks: GroundingChunk[], text: string): number {
  let score = 50; // Base score

  // Add points for number of sources
  const sourceCount = groundingChunks.length || 0;
  score += Math.min(sourceCount * 10, 30);

  // Add points for text length and specificity
  if (text.length > 200) score += 10;
  if (text.includes('research') || text.includes('study') || text.includes('data')) score += 5;

  return Math.min(score, 100);
}

function extractTrendingTopics(text: string): string[] {
  const topics: string[] = [];
  const keywordPatterns = [
    /AI|artificial intelligence/gi,
    /blockchain|crypto|decentralized/gi,
    /consciousness|mindfulness|spiritual/gi,
    /wellness|health|wellbeing/gi,
    /technology|digital|innovation/gi
  ];

  keywordPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) topics.push(match[0].toLowerCase());
    }
  });

  return [...new Set(topics)].slice(0, 5);
}

function extractPriorityLevel(text: string): string {
  if (/critical|urgent|immediate/i.test(text)) return 'Critical';
  if (/high|serious|significant/i.test(text)) return 'High';
  if (/medium|moderate|standard/i.test(text)) return 'Medium';
  return 'Low';
}

function extractNextSteps(text: string): string[] {
  const steps: string[] = [];
  const sentences = text.split('.').slice(0, 5);
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 10 && (
      /recommend|suggest|should|next/i.test(trimmed) ||
      /step|action|follow/i.test(trimmed)
    )) {
      steps.push(trimmed);
    }
  });

  return steps.slice(0, 3);
}
