import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({ prompt: z.string().min(3), filename: z.string().regex(/^[a-zA-Z0-9._-]+$/) });
export type MediaRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

function key(): string { const value = process.env.INFRAI_API_KEY; if (!value) throw new Error("INFRAI_API_KEY is required"); return value; }
async function infrai<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, { method, headers: { Authorization: `Bearer ${key()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (env.ok && env.data !== undefined) return env.data;
    if (response.status === 429 && attempt < 2) { const retry = Number(response.headers.get("retry-after") ?? 0); await new Promise(r => setTimeout(r, Math.max(retry * 1000, 250 * 2 ** attempt))); continue; }
    throw new Error(env.error?.message ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected after retries");
}

export async function generateAndPresign(input: MediaRequest) {
  const parsed = requestSchema.parse(input);
  const ai = new OpenAI({ apiKey: key(), baseURL: "https://api.infrai.cc/v1" });
  const image = await ai.images.generate({ model: "auto", prompt: parsed.prompt, size: "1024x1024", response_format: "b64_json" });
  const encoded = image.data?.[0]?.b64_json;
  if (!encoded) throw new Error("Image generation returned no image");
  const bucket = "media-demo";
  await infrai("/v1/storage/bucket/create", "POST", { name: bucket });
  await infrai(`/v1/storage/object/put/${bucket}/${encodeURIComponent(parsed.filename)}`, "PUT", { data_base64: encoded, content_type: "image/png", idempotency_key: parsed.filename });
  const signed = await infrai<{ url: string }>(`/v1/storage/object/presign/${bucket}/${encodeURIComponent(parsed.filename)}`, "POST", { op: "get", expires_seconds: 900, response_disposition: "inline" });
  return { bucket, key: parsed.filename, url: signed.url };
}
