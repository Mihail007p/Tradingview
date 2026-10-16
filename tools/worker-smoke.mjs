/**
 * Worker smoke check — гоняет реальные маршруты Cloudflare Worker'а
 * прямо в Node (без wrangler и без сети), с заглушками AI и KV.
 *
 *   node tools/worker-smoke.mjs
 *
 * Ловит регрессии маршрутизации: например, когда страница «/» оказывалась
 * за проверкой ключа доступа и вместо интерфейса пользователь видел
 * {"ok":false,"error":"Неверный ключ доступа."}.
 */

import worker from "../src/index.js";

const KEY = "test-key-123";
const html = { name: "html" };

let failed = 0;
let passed = 0;

function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`✔ ${name}`); }
  else { failed++; console.error(`✖ ${name}${extra ? " → " + extra : ""}`); }
}

function fakeKV() {
  const store = new Map();
  return {
    async get(k, opts) {
      const v = store.get(k);
      if (v === undefined) return null;
      return opts && opts.type === "json" ? JSON.parse(v) : v;
    },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

const ANALYSIS = {
  instrument: "BTCUSDT",
  timeframe: "4H",
  market: "crypto",
  chart_type: "candles",
  trend: "uptrend",
  trend_strength: "moderate",
  summary: "Тестовый разбор.",
  levels: { support: [60000, 59000], resistance: [65000, 66000] },
  patterns: ["треугольник"],
  signals: [],
  indicators: ["EMA50"],
  signal: {
    direction: "long",
    entry: 62000,
    stop_loss: 60000,
    take_profits: [65000, 67000, 69000],
    risk_reward: 1.5,
    confidence: 62,
    horizon: "1-2 недели",
  },
  risks: ["новости"],
  invalidations: ["пробой 60000"],
  recommendation: "Вход по плану.",
};

const fakeAI = (behavior) => ({
  async run() {
    if (behavior === "fail") throw new Error("AI недоступен");
    return { response: JSON.stringify(ANALYSIS) };
  },
});

const envWithKey = { ACCESS_KEY: KEY, AI: fakeAI("ok") };
const envNoKey = { AI: fakeAI("ok") };

const call = (path, init = {}, env = envWithKey) =>
  worker.fetch(new Request("https://chart-analyst-bot.example.workers.dev" + path, init), env, {});

const json = async (res) => {
  try { return await res.json(); } catch (_) { return null; }
};

// --- страница и health -----------------------------------------
{
  const res = await call("/");
  const body = await res.text();
  check("GET / без ключа отдаёт HTML (а не JSON с ошибкой)", res.status === 200 && (res.headers.get("content-type") || "").includes("text/html"));
  check("страница содержит интерфейс", body.includes("Chart Analyst") && body.includes("accessKey"));
  check("в скрипте нет вызова $() до объявления", body.indexOf("function $(id)") < body.indexOf('var API = location.origin;'));
}
{
  const res = await call("/index.html");
  check("GET /index.html отдаёт тот же интерфейс", res.status === 200);
}
{
  const res = await call("/api/health");
  const d = await json(res);
  check("GET /api/health без ключа работает", res.status === 200 && d && d.ok === true, JSON.stringify(d));
  check("health сообщает про ключ и журнал", d && d.auth === true && d.journal === false, JSON.stringify(d));
}

// --- журнал -----------------------------------------------------
{
  const res = await call("/api/journal");
  const d = await json(res);
  check("GET /api/journal без ключа → 401 с подсказкой", res.status === 401 && /ключ/i.test(d.error || ""), JSON.stringify(d));
}
{
  const res = await call("/api/journal", { headers: { "X-Api-Key": KEY } });
  const d = await json(res);
  check("GET /api/journal с ключом, но без KV → 503", res.status === 503 && /KV/i.test(d.error || ""), JSON.stringify(d));
}
{
  const env = { ...envWithKey, JOURNAL: fakeKV() };
  const res = await call("/api/journal", { headers: { "X-Api-Key": KEY } }, env);
  const d = await json(res);
  check("GET /api/journal с KV → 200 и пустой список", res.status === 200 && d.ok && Array.isArray(d.entries) && d.stats.total === 0);

  const post = await call("/api/journal", {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ instrument: "BTCUSDT", direction: "long", entry: 100, stop_loss: 95 }),
  }, env);
  const pj = await json(post);
  check("POST /api/journal сохраняет сделку", post.status === 200 && pj.ok && pj.trade.id && pj.entries.length === 1, JSON.stringify(pj));
}
{
  const res = await call("/api/journal?key=" + KEY);
  check("ключ можно передать параметром ?key=", res.status === 503, "status=" + res.status);
}
{
  const res = await call("/api/journal", {}, envNoKey);
  const d = await json(res);
  check("без ACCESS_KEY журнал открыт (защита выключена)", res.status === 503 && /KV/i.test(d.error || ""), "status=" + res.status);
}

// --- анализ -----------------------------------------------------
{
  const res = await call("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("POST /api/analyze без ключа → 401", res.status === 401, "status=" + res.status);
}
{
  const res = await call("/api/analyze", {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ image: "data:image/png;base64,AAAA", balance: 1000, riskPct: 1, mode: "margin" }),
  });
  const d = await json(res);
  check("POST /api/analyze с ключом → 200 + анализ + размер позиции", res.status === 200 && d.ok && d.analysis && d.sizing && d.sizing.qty > 0, JSON.stringify(d).slice(0, 200));
}
{
  const env = { ACCESS_KEY: KEY, AI: fakeAI("fail") };
  const res = await call("/api/analyze", {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ image: "data:image/png;base64,AAAA" }),
  }, env);
  const d = await json(res);
  check("недоступная модель → 502 с понятным текстом", res.status === 502 && /скриншот/i.test(d.error || ""), JSON.stringify(d).slice(0, 200));
}
{
  const res = await call("/api/analyze", {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ image: "не-картинка" }),
  });
  const d = await json(res);
  check("картинка не data URI → 400", res.status === 400 && /data URI/i.test(d.error || ""), JSON.stringify(d));
}

// --- прочее -----------------------------------------------------
{
  const res = await call("/nope");
  check("неизвестный путь → 404", res.status === 404, "status=" + res.status);
}
{
  const res = await call("/api/nope", { headers: { "X-Api-Key": KEY } });
  check("неизвестный /api/* путь → 404", res.status === 404, "status=" + res.status);
}
{
  const res = await call("/api/analyze", { method: "OPTIONS" });
  check("OPTIONS (CORS preflight) → 204 без ключа", res.status === 204, "status=" + res.status);
}

console.log(`\nWorker smoke: ${passed} ок, ${failed} провалено.`);
if (failed) process.exit(1);
