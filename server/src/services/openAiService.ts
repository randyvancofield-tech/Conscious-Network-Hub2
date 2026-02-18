import OpenAI from "openai";

let client: OpenAI | null = null;

export const isOpenAIConfigured = (): boolean =>
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export async function chatWithOpenAI(message: string) {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a calm, ethical, spiritually grounded assistant supporting development and reflection.",
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? "";
}
