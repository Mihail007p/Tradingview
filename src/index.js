const MODEL = "@cf/qwen/qwen3.8-27b";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TOTAL_LENGTH = 32_000;

const SYSTEM_PROMPT = `Ты полезный, доброжелательный ИИ-помощник. Отвечай на языке пользователя, обычно на русском. Для вопросов о коде давай точные и практически применимые ответы. Если не уверен — прямо скажи об этом. Не утверждай, что выполнял действия вне чата.`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeEqual(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }

  return difference === 0;
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
    return null;
  }

  const messages = [];
  let totalLength = 0;

  for (const item of input.slice(-MAX_MESSAGES)) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return null;
    }

    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    totalLength += content.length;
    if (totalLength > MAX_TOTAL_LENGTH) return null;
    messages.push({ role: item.role, content });
  }

  if (messages.at(-1)?.role !== "user") return null;
  return messages;
}

function errorMessage(error) {
  if (error && typeof error.message === "string") return error.message;
  return String(error ?? "Unknown error");
}

async function handleApi(request, env, pathname) {
  if (request.method === "GET" && pathname === "/api/status") {
    return json({ configured: Boolean(env.ACCESS_KEY), model: MODEL });
  }

  if (request.method === "POST" && pathname === "/api/auth") {
    if (!env.ACCESS_KEY) {
      return json({ error: "Чат ещё не настроен. Добавьте секрет ACCESS_KEY в GitHub." }, 503);
    }

    const body = await readJson(request);
    const accessKey = typeof body?.key === "string" ? body.key : "";
    if (!accessKey || accessKey.length > 512 || !safeEqual(accessKey, env.ACCESS_KEY)) {
      return json({ error: "Неверный ключ доступа." }, 401);
    }

    return json({ ok: true });
  }

  if (request.method === "POST" && pathname === "/api/chat") {
    if (!env.ACCESS_KEY) {
      return json({ error: "Чат ещё не настроен. Добавьте секрет ACCESS_KEY в GitHub." }, 503);
    }

    const accessKey = request.headers.get("x-chat-access-key") ?? "";
    if (!safeEqual(accessKey, env.ACCESS_KEY)) {
      return json({ error: "Нужен действительный ключ доступа." }, 401);
    }

    if (!env.AI?.run) {
      return json({ error: "В Cloudflare Worker не настроена привязка Workers AI." }, 503);
    }

    const body = await readJson(request);
    const messages = cleanMessages(body?.messages);
    if (!messages) {
      return json({ error: "Проверьте формат и размер сообщения." }, 400);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 1_500,
        temperature: 0.4,
      });

      const answer = result?.response ?? result?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) {
        console.error("Workers AI returned an unexpected response shape");
        return json({ error: "Модель вернула пустой ответ. Попробуйте ещё раз." }, 502);
      }

      return json({ answer: answer.trim(), model: MODEL });
    } catch (error) {
      console.error("Workers AI request failed:", errorMessage(error));
      return json({ error: "Cloudflare AI временно недоступен. Проверьте квоту и попробуйте позже." }, 502);
    }
  }

  return json({ error: "Маршрут API не найден." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url.pathname);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
      });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-frame-options", "DENY");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    headers.set("content-security-policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    headers.set("cache-control", "no-cache");

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
