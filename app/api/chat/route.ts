import { N8N_SYSTEM_PROMPT } from "@/lib/n8n-knowledge";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  defaultHeaders: {
    "HTTP-Referer": "https://n8n-expert.vercel.app",
    "X-Title": "n8n Expert",
  },
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await client.chat.completions.create({
    model: "anthropic/claude-3.5-sonnet",
    messages: [
      { role: "system", content: N8N_SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    max_tokens: 4096,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
