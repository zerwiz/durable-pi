// The provider adapter's own tests: parse, model records, and the two refusals.
//   npm test -- tests/openai-compatible.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { compatibleModels, parseCompatibleModels, openaiCompatibleProvider } from "../src/openai-compatible.js";

test("DPI_EXTRA_MODELS parses provider/modelId with and without a display name", () => {
  const specs = parseCompatibleModels("opencode-go/deepseek-v4.1-flash=DeepSeek V4.1 Flash, local/qwen3.6-35b");
  assert.equal(specs.length, 2);
  assert.deepEqual(specs[0], { provider: "opencode-go", id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" });
  assert.deepEqual(specs[1], { provider: "local", id: "qwen3.6-35b", name: "qwen3.6-35b" });
});

test("a malformed entry is skipped, not guessed at", () => {
  assert.deepEqual(parseCompatibleModels("nonsense, /noprovider, provider/, ,"), []);
});

test("model records carry the endpoint's baseUrl and the chat api", () => {
  const models = compatibleModels("opencode-go/deepseek-v4.1-flash=Flash", "https://opencode.ai/inference/go/openai/v1");
  assert.equal(models.length, 1);
  assert.equal(models[0].id, "deepseek-v4.1-flash");
  assert.equal(models[0].api, "openai-completions");
  assert.equal(models[0].baseUrl, "https://opencode.ai/inference/go/openai/v1");
  assert.equal(models[0].type, "chat");
  assert.equal(models[0].provider, "openai-compatible");
});

test("the provider refuses to build without a base URL", () => {
  assert.throws(() => openaiCompatibleProvider({ DPI_EXTRA_MODELS: "a/b" } as NodeJS.ProcessEnv), /DPI_BASE_URL/);
});

test("the provider refuses to build with no models", () => {
  assert.throws(
    () => openaiCompatibleProvider({ DPI_BASE_URL: "http://127.0.0.1:8080/v1" } as NodeJS.ProcessEnv),
    /DPI_EXTRA_MODELS/,
  );
});

test("a well-formed environment builds a provider whose id and models are ours", () => {
  const provider = openaiCompatibleProvider({
    DPI_BASE_URL: "http://127.0.0.1:8080/v1",
    DPI_EXTRA_MODELS: "local/qwen3.6-35b=Qwen 3.6 (local)",
  } as NodeJS.ProcessEnv);
  assert.equal(provider.id, "openai-compatible");
  const ids = provider.getModels().map((m: { id: string }) => m.id);
  assert.deepEqual(ids, ["qwen3.6-35b"]);
});
