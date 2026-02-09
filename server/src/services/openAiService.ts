import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatWithOpenAI(message: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await client.chat.completions.create({
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
