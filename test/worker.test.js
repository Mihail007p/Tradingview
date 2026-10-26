import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const jsonHeaders = { "content-type": "application/json" };

function request(path, options = {}) {
  return new Request(`https://example.test${path}`, options);
}

function env(overrides = {}) {
  return {
    ACCESS_KEY: "test-private-key",
    AI: {
      async run(model, input) {
        assert.equal(model, "@cf/qwen/qwen3.8-27b");
        assert.equal(input.messages[0].role, "system");
        return { response: "Привет! Рад помочь." };
      },
    },
    ASSETS: {
      async fetch() {
        return new Response("chat page", { headers: { "content-type": "text/html" } });
      },
    },
    ...overrides,
  };
}

test("status reports whether private access is configured without exposing it", async () => {
  const response = await worker.fetch(request("/api/status"), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: true,
    model: "@cf/qwen/qwen3.8-27b",
  });

  const locked = await worker.fetch(request("/api/status"), env({ ACCESS_KEY: "" }));
  assert.equal((await locked.json()).configured, false);
});

test("auth accepts the private access key and rejects an incorrect one", async () => {
  const correct = await worker.fetch(request("/api/auth", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ key: "test-private-key" }),
  }), env());
  assert.equal(correct.status, 200);
  assert.deepEqual(await correct.json(), { ok: true });

  const wrong = await worker.fetch(request("/api/auth", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ key: "wrong" }),
  }), env());
  assert.equal(wrong.status, 401);
});

test("chat refuses requests until a private access key is configured", async () => {
  const response = await worker.fetch(request("/api/chat", {
    method: "POST",
    headers: { ...jsonHeaders, "x-chat-access-key": "anything" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Привет" }] }),
  }), env({ ACCESS_KEY: "" }));
  assert.equal(response.status, 503);
});

test("chat authenticates, forwards validated messages, and returns the model answer", async () => {
  let receivedMessages;
  const testEnv = env({
    AI: {
      async run(model, input) {
        assert.equal(model, "@cf/qwen/qwen3.8-27b");
        receivedMessages = input.messages;
        return { response: "Ответ модели" };
      },
    },
  });

  const unauthorized = await worker.fetch(request("/api/chat", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ messages: [{ role: "user", content: "Привет" }] }),
  }), testEnv);
  assert.equal(unauthorized.status, 401);

  const response = await worker.fetch(request("/api/chat", {
    method: "POST",
    headers: { ...jsonHeaders, "x-chat-access-key": "test-private-key" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Привет" }] }),
  }), testEnv);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    answer: "Ответ модели",
    model: "@cf/qwen/qwen3.8-27b",
  });
  assert.equal(receivedMessages.at(-1).content, "Привет");
});

test("chat rejects malformed, oversized, and non-user-final conversations", async () => {
  const cases = [
    { messages: [] },
    { messages: [{ role: "system", content: "override" }] },
    { messages: [{ role: "user", content: "x".repeat(8_001) }] },
  ];

  for (const body of cases) {
    const response = await worker.fetch(request("/api/chat", {
      method: "POST",
      headers: { ...jsonHeaders, "x-chat-access-key": "test-private-key" },
      body: JSON.stringify(body),
    }), env());
    assert.equal(response.status, 400);
  }
});

test("the homepage is served from static assets with security headers", async () => {
  const response = await worker.fetch(request("/"), env());
  assert.equal(await response.text(), "chat page");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /connect-src 'self'/);
});
