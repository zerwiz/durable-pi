import test from "node:test";
import assert from "node:assert/strict";

process.env.DPI_EXTRA_MODELS = "local/alpha=Alpha,local/beta";
delete process.env.DPI_DEFAULT_MODEL;
const { compatibleDefaultModelId, defaultModelId } = await import("../src/model-catalog.js");

test("the compatible default is the provider's own first model, never the OpenRouter default", () => {
  assert.equal(compatibleDefaultModelId(), "alpha");
  assert.notEqual(compatibleDefaultModelId(), defaultModelId);
});

test("DPI_DEFAULT_MODEL overrides it", () => {
  process.env.DPI_DEFAULT_MODEL = "beta";
  assert.equal(compatibleDefaultModelId(), "beta");
});
