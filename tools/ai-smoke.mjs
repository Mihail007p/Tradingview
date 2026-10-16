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
// Default is the FAST mode: thinking off, tight completion budget — the bot answers quickly.
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
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
    assert.equal(body.max_completion_tokens, 2048);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.image, undefined);
    assert.equal(body.messages[1].content[1].image_url.url, opts.dataUri);
    assert.match(body.messages[0].content, /ANALYSIS CHECKLIST/);
    assert.match(body.messages[1].content[0].text, /EUR\/USD/);
    assert.match(body.messages[1].content[0].text, /быстрый/);
    return response;
  } } }, opts);
  assert.equal(calls, 1);
  assert.equal(result.model, DEFAULT_MODEL);
  assert.equal(result.mode, "fast");
  assert.equal(result.data.signal.direction, "none");
}

// DEEP mode opts into thinking — but with a budget well below the old 8192.
{
  let calls = 0;
  const result = await analyzeChart({ AI: { async run(model, body) {
    calls++;
    assert.equal(model, DEFAULT_MODEL);
    assert.equal(body.chat_template_kwargs.enable_thinking, true);
    assert.equal(body.max_completion_tokens, 4096);
    assert.match(body.messages[1].content[0].text, /глубокий/);
    return { response: content };
  } } }, { ...opts, mode: "deep" });
  assert.equal(calls, 1);
  assert.equal(result.mode, "deep");
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
// Обрезанный по лимиту токенов JSON спасается, а не отправляет запрос на медленный fallback.
{
  const full = JSON.stringify(verdict);
  const cut = full.slice(0, full.lastIndexOf('"', full.length - 12)); // внутри последнего значения
  const salvaged = extractJson(cut);
  assert.ok(salvaged && typeof salvaged === "object");
  assert.equal(typeof salvaged.summary, "string");
  assert.equal(extractJson("{not json"), null);
}
console.log("✔ AI smoke: temperature 0, быстрый/глубокий режимы, image payloads, response formats, fallback and errors");
