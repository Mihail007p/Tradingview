import assert from "node:assert/strict";
import { analyzeChart, DEFAULT_MODEL, FALLBACK_MODEL, extractJson } from "../src/ai.js";

const verdict = {
  summary: "Недостаточно подтверждений для входа.",
  signal: { direction: "none", entry: null, expiry: null, confidence: 0 },
};
const content = JSON.stringify(verdict);
const opts = {
  dataUri: "data:image/png;base64,AQID", bytes: [1, 2, 3],
  market: "EUR/USD", expiry: "3m", payout: 85,
};

// Verify the actual payload sent to Workers AI, not just configuration constants.
for (const response of [
  { response: content },
  { choices: [{ message: { content, reasoning_content: "Internal analysis" } }] },
  { result: { choices: [{ message: { content } }] } },
  { response: `<think>Example: {"signal":{"direction":"call"}}</think>\n${content}` },
]) {
  let calls = 0;
  const result = await analyzeChart({ AI: { async run(model, body) {
    calls++;
    assert.equal(model, DEFAULT_MODEL);
    assert.equal(body.temperature, 0);
    assert.equal(body.chat_template_kwargs.enable_thinking, true);
    assert.equal(body.max_completion_tokens, 8192);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.image, undefined);
    assert.equal(body.messages[1].content[1].image_url.url, opts.dataUri);
    assert.match(body.messages[0].content, /ANALYSIS CHECKLIST/);
    assert.match(body.messages[1].content[0].text, /EUR\/USD/);
    return response;
  } } }, opts);
  assert.equal(calls, 1);
  assert.equal(result.model, DEFAULT_MODEL);
  assert.equal(result.data.signal.direction, "none");
}

// A failed or incomplete thinking response must fall back without an image-less Gemma retry.
for (const mode of ["throw", "bad-json", "thinking-only"]) {
  const calls = [];
  const result = await analyzeChart({ AI: { async run(model, body) {
    calls.push(model);
    assert.equal(body.temperature, 0);
    if (model === DEFAULT_MODEL) {
      if (mode === "throw") throw new Error("Model unavailable");
      return { response: mode === "bad-json" ? "not JSON" : `<think>${content}` };
    }
    assert.equal(model, FALLBACK_MODEL);
    assert.equal(body.chat_template_kwargs, undefined);
    assert.equal(body.max_tokens, 2000);
    return { response: content };
  } } }, opts);
  assert.deepEqual(calls, [DEFAULT_MODEL, FALLBACK_MODEL]);
  assert.equal(result.model, FALLBACK_MODEL);
}

// Overrides retain both image formats, but must not get unsupported thinking options.
{
  const calls = [];
  const result = await analyzeChart({ VISION_MODEL: "custom-vision", AI: { async run(model, body) {
    calls.push(model);
    assert.equal(model, "custom-vision");
    assert.equal(body.temperature, 0);
    assert.equal(body.chat_template_kwargs, undefined);
    if (!body.image) throw new Error("Legacy format required");
    assert.deepEqual(body.image, opts.bytes);
    return { response: content };
  } } }, opts);
  assert.equal(calls.length, 2);
  assert.equal(result.model, "custom-vision");
}

// Choosing the fallback explicitly must not retry the same model twice.
{
  let calls = 0;
  await assert.rejects(analyzeChart({ VISION_MODEL: FALLBACK_MODEL, AI: { async run() {
    calls++;
    throw new Error("Unavailable");
  } } }, opts), { message: "AI_ANALYSIS_FAILED" });
  assert.equal(calls, 2);
}

{
  let calls = 0;
  await assert.rejects(analyzeChart({ AI: { async run() {
    calls++;
    return { response: "not JSON" };
  } } }, opts), (err) => err.message === "AI_ANALYSIS_FAILED" && err.details.length === 3);
  assert.equal(calls, 3);
}
assert.equal(extractJson(`<think>${content}`), null);
assert.deepEqual(extractJson(`\u0060\u0060\u0060json\n${content}\n\u0060\u0060\u0060`), verdict);
console.log("✔ AI smoke: temperature 0, thinking, image payloads, response formats, fallback and errors");
