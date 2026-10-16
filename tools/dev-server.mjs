/**
 * Local preview server — mirrors the Worker's API on your machine (Pocket Options edition).
 *
 *   node tools/dev-server.mjs
 *
 * Modes:
 *   DEMO (default)  — no Cloudflare credentials: returns a realistic stub analysis
 *                     so you can click through the whole UI.
 *   LIVE            — set CF_ACCOUNT_ID + CF_API_TOKEN and it calls the real
 *                     Workers AI REST endpoint through the SAME src/ai.js the Worker uses.
 *
 * Math (ставка, результат сделки, статистика) и парсинг ответа — общие модули
 * src/sizing.js и src/ai.js, поэтому превью и продакшн считают одинаково.
 * Journal is stored in tools/journal.json.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeChart, DEFAULT_MODEL, normalizeExpiry } from "../src/ai.js";
import { sizeStake, journalStats, computeClose, normalizeDirection, DEFAULT_PAYOUT } from "../src/sizing.js";
import { ui } from "../src/ui.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL_FILE = path.join(__dirname, "journal.json");

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const MODEL = process.env.VISION_MODEL || DEFAULT_MODEL;
const LIVE = Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);

// ---------------------------------------------------------------- journal io
function readJournal() {
  try {
    const parsed = JSON.parse(fs.readFileSync(JOURNAL_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
function writeJournal(entries) {
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2));
}

// ---------------------------------------------------------------- demo analyzer
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function demoAnalysis(image, ctx) {
  const seed = hash(String(image).slice(-4000) + (ctx.question || ""));
  const rnd = (() => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();

  const universe = [
    { name: "EUR/USD", base: 1.085, dp: 5 },
    { name: "GBP/USD", base: 1.262, dp: 5 },
    { name: "BTC/USD (OTC)", base: 64800, dp: 1 },
    { name: "AUD/CAD (OTC)", base: 0.9, dp: 5 },
    { name: "XAU/USD", base: 2650, dp: 2 },
  ];
  const tfs = ["M1", "M2", "M5"];
  const pick = universe[Math.floor(rnd() * universe.length)];
  const dp = pick.dp;
  const round = (n) => Math.round(n * 10 ** dp) / 10 ** dp;
  const price = round(pick.base * (0.97 + rnd() * 0.06));
  const direction = ["call", "call", "put", "none"][Math.floor(rnd() * 4)];
  const up = direction === "call";
  const trend = up ? "uptrend" : direction === "put" ? "downtrend" : "sideways";
  const expiry = ["1m", "2m", "3m", "5m"][Math.floor(rnd() * 4)];
  const none = direction === "none";

  return {
    instrument: pick.name,
    timeframe: tfs[Math.floor(rnd() * tfs.length)],
    market: "forex",
    chart_type: "японские свечи",
    trend,
    trend_strength: ["weak", "moderate", "strong"][Math.floor(rnd() * 3)],
    summary:
      "Цена " + (up ? "отскочила от локальной поддержки" : direction === "put" ? "отбита от локального сопротивления" : "колеблется в узком диапазоне") +
      ". " + (none ? "Чёткого преимущества для бинарного опциона нет — лучше пропустить вход." : "Для экспирации " + expiry + " есть короткое преимущество по направлению " + (up ? "ВВЕРХ" : "ВНИЗ") + "."),
    levels: {
      support: [round(price * 0.999), round(price * 0.996)],
      resistance: [round(price * 1.001), round(price * 1.004)],
    },
    patterns: [[up ? "бычье поглощение" : "медвежье поглощение", "ложный пробой"][Math.floor(rnd() * 2)]],
    indicators: ["EMA 20 / EMA 50", "RSI " + Math.floor(35 + rnd() * 30), "Bollinger Bands"],
    signal: {
      direction,
      entry: none ? null : price,
      expiry: none ? null : expiry,
      confidence: Math.floor(40 + rnd() * 35),
      reason: none ? "Нет подтверждения направления." : "Отскок от уровня с подтверждением свечой.",
    },
    risks: [
      "Новостной релиз может резко сместить цену.",
      "Низкая волатильность на азиатской сессии — движение может не успеть за экспирацию.",
    ],
    invalidations: [
      up ? "Закрытие свечи ниже " + round(price * 0.996) + " отменит сценарий." : "Закрытие свечи выше " + round(price * 1.004) + " отменит сценарий.",
    ],
    recommendation: none
      ? "Пропусти этот график и дождись чёткого сигнала у границы диапазона."
      : "Вход на открытии следующей свечи, экспирация " + expiry + ". Ставку держи в пределах 1–3% депозита.",
  };
}

// ---------------------------------------------------------------- live (Workers AI REST)
/** Адаптер под интерфейс env.AI.run из Worker'а, но через REST API Cloudflare. */
const restAI = {
  async run(model, body) {
    const res = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + CF_ACCOUNT_ID + "/ai/run/" + model,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + CF_API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(JSON.stringify(data.errors || data).slice(0, 400));
    }
    return data.result;
  },
};

async function liveAnalysis(image, ctx) {
  const { data } = await analyzeChart({ VISION_MODEL: MODEL, AI: restAI }, {
    dataUri: image, bytes: [], question: ctx.question, market: ctx.market,
    expiry: ctx.expiry, payout: ctx.payout,
  });
  return data;
}

// ---------------------------------------------------------------- http
function send(res, code, obj, type = "application/json; charset=utf-8") {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, {
    "content-type": type,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, X-Api-Key",
    "cache-control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > 12 * 1024 * 1024) { req.destroy(); reject(new Error("too large")); }
    });
    req.on("end", () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") return send(res, 204, "");

  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return send(res, 200, ui(), "text/html; charset=utf-8");
    }

    if (url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true, service: "pocket-options-analyst (local)", model: MODEL,
        journal: true, mode: LIVE ? "live" : "demo",
      });
    }

    if (url.pathname === "/api/analyze" && req.method === "POST") {
      const body = await readBody(req);
      const image = String(body.image || "");
      if (!image.startsWith("data:image/")) return send(res, 400, { ok: false, error: "Ожидается data URI изображения." });

      const ctx = {
        question: String(body.question || "").slice(0, 500),
        market: String(body.market || "").slice(0, 60),
        expiry: normalizeExpiry(body.expiry) || null,
        payout: Number(body.payout) || DEFAULT_PAYOUT,
      };

      const started = Date.now();
      let analysis;
      try {
        analysis = LIVE ? await liveAnalysis(image, ctx) : demoAnalysis(image, ctx);
      } catch (e) {
        return send(res, 502, { ok: false, error: "Модель не вернула корректный анализ. Попробуй более чёткий скриншот.", details: [String(e.message || e)] });
      }

      const sizing = analysis.signal && analysis.signal.direction !== "none"
        ? sizeStake({ balance: Number(body.balance) || 0, stakePct: Number(body.stakePct) || 0, payout: ctx.payout })
        : null;

      if (!LIVE) await new Promise((r) => setTimeout(r, 900 + Math.random() * 700));

      return send(res, 200, {
        ok: true,
        model: LIVE ? MODEL : "demo-stub (локальный превью-режим)",
        analysis,
        sizing: sizing && sizing.ok ? sizing : null,
        warnings: sizing && sizing.ok ? sizing.warnings : [],
        ms: Date.now() - started,
        demo: !LIVE,
        disclaimer: "Это технический анализ, а не финансовая рекомендация.",
      });
    }

    if (url.pathname === "/api/journal") {
      let entries = readJournal();

      if (req.method === "GET") {
        return send(res, 200, { ok: true, entries, stats: journalStats(entries) });
      }

      if (req.method === "POST") {
        const b = await readBody(req);
        const trade = {
          id: "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          createdAt: Date.now(),
          instrument: String(b.instrument || "—"), timeframe: String(b.timeframe || "—"),
          direction: normalizeDirection(b.direction),
          entry: Number(b.entry) || null, expiry: normalizeExpiry(b.expiry),
          confidence: Number(b.confidence) || null,
          stake: Number(b.stake) || null, payout: Number(b.payout) || DEFAULT_PAYOUT,
          balance: Number(b.balance) || null, stakePct: Number(b.stakePct) || null,
          summary: String(b.summary || ""), notes: String(b.notes || ""), status: "open",
        };
        entries.unshift(trade);
        writeJournal(entries);
        return send(res, 200, { ok: true, trade, entries, stats: journalStats(entries) });
      }

      if (req.method === "PATCH") {
        const id = url.searchParams.get("id");
        const b = await readBody(req);
        const i = entries.findIndex((t) => t.id === id);
        if (i === -1) return send(res, 404, { ok: false, error: "Сделка не найдена." });
        if (b.exitPrice !== undefined && b.exitPrice !== null && b.exitPrice !== "") {
          const r = computeClose({ trade: entries[i], exitPrice: b.exitPrice });
          if (!r.ok) return send(res, 400, { ok: false, error: r.reason });
          entries[i].exitPrice = Number(b.exitPrice);
          entries[i].status = r.status;
          entries[i].resultR = r.resultR;
          entries[i].resultPnl = r.resultPnl;
          entries[i].closedAt = Date.now();
        }
        if (b.notes !== undefined) entries[i].notes = String(b.notes);
        if (["open", "win", "loss", "breakeven"].includes(b.status)) entries[i].status = b.status;
        writeJournal(entries);
        return send(res, 200, { ok: true, trade: entries[i], entries, stats: journalStats(entries) });
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id");
        entries = id ? entries.filter((t) => t.id !== id) : [];
        writeJournal(entries);
        return send(res, 200, { ok: true, entries, stats: journalStats(entries) });
      }
    }

    return send(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log("────────────────────────────────────────────────");
  console.log("  Pocket Options Analyst — локальный сервер");
  console.log("  http://localhost:" + PORT);
  console.log("  режим: " + (LIVE ? "LIVE (реальный Workers AI, модель " + MODEL + ")" : "DEMO (заглушка без Cloudflare)"));
  console.log("  журнал: " + JOURNAL_FILE);
  if (!LIVE) console.log("  подсказка: export CF_ACCOUNT_ID=... CF_API_TOKEN=... для живого анализа");
  console.log("────────────────────────────────────────────────");
});
