/**
 * Thin helper around the Lovable AI Gateway (OpenAI-compatible).
 * Reads LOVABLE_API_KEY from env; caller passes the model id and messages.
 */

const BASE_URL = "https://ai.gateway.lovable.dev/v1";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function completeChat({
  model,
  messages,
  temperature = 0.4,
}: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "custom-node",
    },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Stream chat completion via SSE. Yields text deltas as they arrive.
 */
export async function* streamChat({
  model,
  messages,
  temperature = 0.5,
}: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "custom-node",
    },
    body: JSON.stringify({ model, messages, temperature, stream: true }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}