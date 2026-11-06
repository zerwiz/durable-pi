// openai-compatible.ts — a provider for any OpenAI-compatible endpoint behind DPI_BASE_URL.
//
// WHY (measured 2026-11-06): the backend's model layer was OpenRouter-shaped by construction. At startup it
// fetched OpenRouter's catalogue, threw if a curated id was missing, then filtered that catalogue to the
// curated ids — so a backend pointed at another provider (an opencode-go key, a local llama.cpp, a Jev host)
// could not create a single session: every attempt was refused with "Unknown model".
//
// A hosted app that hardcodes a provider cannot be pointed at another one by configuration. This is the code
// path, and it is SELF-CONTAINED: it uses only the package's public entry points (`./models` and `./api/*`)
// and writes its own api-key auth rather than importing an internal helper the package does not export.
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { createProvider } from "@earendil-works/pi-ai/models";

export type CompatibleModelSpec = { provider: string; id: string; name: string };

/** Parse DPI_EXTRA_MODELS: comma-separated `<provider>/<modelId>[=<Display name>]`. */
export function parseCompatibleModels(raw: string | undefined): CompatibleModelSpec[] {
  const out: CompatibleModelSpec[] = [];
  for (const spec of (raw ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const [ref, display] = spec.split("=");
    const slash = ref.indexOf("/");
    if (slash < 1 || slash === ref.length - 1) continue;
    const provider = ref.slice(0, slash);
    const id = ref.slice(slash + 1);
    out.push({ provider, id, name: (display ?? id).trim() });
  }
  return out;
}

/** The model records the provider exposes, in the shape pi-ai's collection expects. */
export function compatibleModels(raw: string | undefined, baseUrl: string) {
  return parseCompatibleModels(raw).map((m) => ({
    type: "chat" as const,
    id: m.id,
    name: m.name,
    api: "openai-completions" as const,
    baseUrl,
    provider: "openai-compatible",
    reasoning: false,
    input: ["text"] as ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 16384,
  }));
}

/**
 * Our own api-key auth: no internal import, and it says exactly where the key comes from.
 * A stored credential wins; otherwise DPI_API_KEY, then OPENROUTER_API_KEY (where an operator running the
 * OpenRouter-shaped build already keeps a key).
 */
const compatibleAuth = {
  name: "API key for the compatible endpoint",
  async resolve({ credential }: { credential?: { key?: string } }) {
    const key = credential?.key ?? process.env.DPI_API_KEY ?? process.env.OPENROUTER_API_KEY;
    return key ? { apiKey: key } : undefined;
  },
} as unknown as Parameters<typeof createProvider>[0]["auth"]["apiKey"];

export function openaiCompatibleProvider(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = (env.DPI_BASE_URL ?? "").replace(/\/+$/, "");
  if (!baseUrl) throw Error("DPI_PROVIDER=openai-compatible needs DPI_BASE_URL (for example https://host/v1)");
  const models = compatibleModels(env.DPI_EXTRA_MODELS, baseUrl);
  if (models.length === 0)
    throw Error("DPI_PROVIDER=openai-compatible needs at least one model in DPI_EXTRA_MODELS (<provider>/<modelId>)");
  return createProvider({
    id: "openai-compatible",
    name: "OpenAI-compatible endpoint",
    baseUrl,
    auth: { apiKey: compatibleAuth },
    models,
    api: { "openai-completions": openAICompletionsApi() },
  });
}
