/**
 * Local preview server — mirrors the Worker's API on your machine.
 *
 *   node tools/dev-server.mjs
 *
 * Modes:
 *   DEMO (default)  — no Cloudflare credentials: returns a realistic stub analysis
 *                     so you can click through the whole UI.
 *   LIVE            — set CF_ACCOUNT_ID + CF_API_TOKEN and it calls the real
 *                     Workers AI REST endpoint with the same prompt as the Worker.
 *
 * Journal is stored in tools/journal.json.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const JOURNAL_FILE = path.join(__dirname, "journal.json");

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const MODEL = process.env.VISION_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
const LIVE = Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);

// ---------------------------------------------------------------- journal io
function readJournal() {
  try {
    const raw = fs.readFileSync(JOURNAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
function writeJournal(entries) {
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2));
}

// ---------------------------------------------------------------- math (mirrors src/sizing.js)
function sizePosition({ balance, riskPct, mode, entry, stop, targets = [] }) {
  const b = Number(balance), rp = Number(riskPct), e = Number(entry), s = Number(stop);
  if (![b, rp, e, s].every(Number.isFinite) || b <= 0 || rp <= 0 || e <= 0 || s <= 0) return null;
  if (e === s) return null;

  const riskAmount = (b * rp) / 100;
  const stopDistance = Math.abs(e - s);
  const stopPct = (stopDistance / e) * 100;
  let qty = riskAmount / stopDistance;
  let notional = qty * e;
  let leverage = notional / b;
  const warnings = [];
  let capped = false;

  if (mode === "spot") {
    if (notional > b) { notional = b; qty = notional / e; leverage = 1; capped = true;
      warnings.push("Спот без плеча: размер урезан до депозита."); }
    else leverage = 1;
  }
  if (leverage > 10) warnings.push("Требуется плечо " + leverage.toFixed(1) + "x — выше 10x.");
  if (stopPct > 8) warnings.push("Стоп далековат: " + stopPct.toFixed(2) + "% от цены входа.");

  const rr = targets.length ? Math.abs(targets[0] - e) / stopDistance : null;
  if (rr !== null && rr < 1.5) warnings.push("R:R = " + rr.toFixed(2) + " — ниже 1.5.");

  const r = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;
  return { ok: true, riskAmount: r(riskAmount, 2), stopDistance: r(stopDistance, 8), stopPct: r(stopPct, 3),
    qty: r(qty, 6), notional: r(notional, 2), leverage: r(leverage, 2), capped, warnings };
}

function journalStats(entries = []) {
  const closed = entries.filter((e) => e.status && e.status !== "open");
  const wins = closed.filter((e) => e.status === "win");
  const losses = closed.filter((e) => e.status === "loss");
  const rV = closed.map((e) => Number(e.resultR)).filter(Number.isFinite);
  const totalR = rV.reduce((a, x) => a + x, 0);
  const totalPnl = closed.map((e) => Number(e.resultPnl)).filter(Number.isFinite).reduce((a, x) => a + x, 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    total: entries.length,
    open: entries.filter((e) => e.status === "open").length,
    closed: closed.length, wins: wins.length, losses: losses.length,
    breakeven: closed.filter((e) => e.status === "breakeven").length,
    winRate: closed.length ? r2((wins.length / closed.length) * 100) : 0,
    totalR: r2(totalR), totalPnl: r2(totalPnl),
    avgR: closed.length ? r2(totalR / closed.length) : 0,
    avgWin: wins.length ? r2(wins.reduce((a, e) => a + Number(e.resultR || 0), 0) / wins.length) : 0,
    avgLoss: losses.length ? r2(losses.reduce((a, e) => a + Number(e.resultR || 0), 0) / losses.length) : 0,
    expectancy: closed.length ? r2(totalR / closed.length) : 0,
    bestR: rV.length ? Math.max(...rV) : 0, worstR: rV.length ? Math.min(...rV) : 0,
  };
}

function computeClose({ trade, exitPrice }) {
  const entry = Number(trade.entry), stop = Number(trade.stop_loss), exit = Number(exitPrice);
  if (![entry, stop, exit].every(Number.isFinite) || entry === stop) return { ok: false };
  const dir = trade.direction === "short" ? -1 : 1;
  const risk = Math.abs(entry - stop);
  const resultR = Math.round((((exit - entry) * dir) / risk) * 100) / 100;
  const resultPnl = Math.round((exit - entry) * dir * (Number(trade.qty) || 0) * 100) / 100;
  let status = "breakeven";
  if (resultR > 0.05) status = "win"; else if (resultR < -0.05) status = "loss";
  return { ok: true, status, resultR, resultPnl };
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
    { name: "BTCUSDT", base: 64800, market: "crypto", dp: 1 },
    { name: "ETHUSDT", base: 3180, market: "crypto", dp: 2 },
    { name: "SOLUSDT", base: 152, market: "crypto", dp: 2 },
    { name: "EURUSD", base: 1.085, market: "forex", dp: 5 },
    { name: "XAUUSD", base: 2650, market: "forex", dp: 2 },
    { name: "NASDAQ 100", base: 20450, market: "indices", dp: 1 },
    { name: "AAPL", base: 231, market: "stocks", dp: 2 },
  ];
  const tfs = ["15m", "1h", "4h", "1D"];
  const wanted = String(ctx.market || "").trim();
  const pool = wanted ? universe.filter((u) => u.market === wanted) : universe;
  const pick = (pool.length ? pool : universe)[Math.floor(rnd() * (pool.length || universe.length))];
  const instrument = pick.name;
  const dp = pick.dp;
  const timeframe = tfs[Math.floor(rnd() * tfs.length)];

  const round = (n) => Math.round(n * 10 ** dp) / 10 ** dp;
  const price = pick.base * (0.86 + rnd() * 0.28);
  const direction = ["long", "long", "short", "none"][Math.floor(rnd() * 4)];
  const long = direction === "long";
  const entry = round(price);
  const stopDist = price * (0.008 + rnd() * 0.02);
  const stop = round(long ? entry - stopDist : entry + stopDist);
  const t1 = round(long ? entry + stopDist * (1.8 + rnd() * 1.6) : entry - stopDist * (1.8 + rnd() * 1.6));
  const t2 = round(long ? t1 + stopDist * (1 + rnd()) : t1 - stopDist * (1 + rnd()));

  const trend = long ? "uptrend" : direction === "short" ? "downtrend" : "sideways";

  return {
    instrument, timeframe,
    market: pick.market,
    chart_type: "японские свечи",
    trend,
    trend_strength: ["weak", "moderate", "strong"][Math.floor(rnd() * 3)],
    summary:
      "Цена удерживается " + (long ? "выше" : "ниже") + " локальной зоны " +
      (long ? "поддержки" : "сопротивления") + ", структура " +
      (trend === "sideways" ? "без ярко выраженного направления — диапазон" : (long ? "восходящая, Higher High / Higher Low" : "нисходящая, Lower High / Lower Low")) +
      ". Объём " + ["падает на откате — коррекция, а не разворот", "растёт на импульсе — есть подтверждение", "ровный, без аномалий"][Math.floor(rnd() * 3)] +
      ". Сценарий рабочий при удержании уровня " + (long ? fmt(stop) : fmt(stop)) + ".",
    levels: {
      support: long ? [stop, round(stop - stopDist * 0.9)] : [round(entry - stopDist * 1.4), round(entry - stopDist * 2.3)],
      resistance: long ? [t1, t2] : [stop, round(stop + stopDist * 0.9)],
    },
    patterns: [["бычий флаг", "двойное дно", "поглощение", "вымпел"][Math.floor(rnd() * 4)], "ретест уровня"],
    indicators: ["EMA 50 / EMA 200", "RSI " + Math.floor(40 + rnd() * 30), "объёмный профиль"],
    signal: {
      direction,
      entry: direction === "none" ? null : entry,
      stop_loss: direction === "none" ? null : stop,
      take_profits: direction === "none" ? [] : [t1, t2],
      risk_reward: direction === "none" ? null : Math.round((Math.abs(t1 - entry) / Math.abs(entry - stop)) * 100) / 100,
      confidence: Math.floor(38 + rnd() * 52),
      horizon: ["внутри дня", "1–3 дня", "неделя"][Math.floor(rnd() * 3)],
    },
    risks: [
      "Стоп стоит близко к зоне ликвидности — возможен сбор стопов перед движением.",
      "Старший таймфрейм не подтверждает направление.",
    ],
    invalidations: [
      (long ? "Закрепление ниже " : "Закрепление выше ") + fmt(stop) + " отменит сценарий.",
      "Потеря структуры на старшем таймфрейме.",
    ],
    recommendation:
      direction === "none"
        ? "Явного преимущества нет: цена в середине диапазона. Разумнее ждать подхода к границе диапазона и реакции на ней."
        : "Сценарий приоритетный, но входить лучше на ретесте, а не на пробое. Частичная фиксация на первом тейке, остаток — по тренду.",
  };

  function fmt(n) { return n === null || n === undefined ? "—" : String(round(n)); }
}

// ---------------------------------------------------------------- live (Workers AI REST)
async function liveAnalysis(image, ctx) {
  const sys = fs.readFileSync(path.join(ROOT, "src", "ai.js"), "utf8");
  const m = /const SYSTEM_PROMPT = `([\s\S]*?)`;/.exec(sys);
  const SYSTEM_PROMPT = m ? m[1] : "You are a trading analyst. Return JSON only.";

  const userText = [
    "Разбери этот график и верни JSON строго по схеме из системного промпта.",
    "",
    "Режим торговли: " + (ctx.mode === "spot" ? "спот (без плеча)" : "фьючерсы / маржа (плечо доступно)") + ".",
    "Рынок (если известен): " + (ctx.market || "не указан, определи сам по графику") + ".",
    ctx.balance && ctx.riskPct ? "Трейдер рискует " + ctx.riskPct + "% от депозита " + ctx.balance + " на сделку." : "",
    ctx.question ? "\nВопрос трейдера: " + ctx.question : "",
  ].join("\n");

  const res = await fetch(
    "https://api.cloudflare.com/client/v4/accounts/" + CF_ACCOUNT_ID + "/ai/run/" + MODEL,
    {
      method: "POST",
      headers: { Authorization: "Bearer " + CF_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: image } },
          ] },
        ],
        max_tokens: 1400,
        temperature: 0.2,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(JSON.stringify(data.errors || data).slice(0, 400));
  }

  const text = data?.result?.response || data?.result?.text || "";
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Модель не вернула JSON: " + text.slice(0, 200));
  return JSON.parse(text.slice(start, end + 1));
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
      const { ui } = await import(path.join(ROOT, "src", "ui.js"));
      return send(res, 200, ui(), "text/html; charset=utf-8");
    }

    if (url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true, service: "chart-analyst-bot (local)", model: MODEL,
        journal: true, mode: LIVE ? "live" : "demo",
      });
    }

    if (url.pathname === "/api/analyze" && req.method === "POST") {
      const body = await readBody(req);
      const image = String(body.image || "");
      if (!image.startsWith("data:image/")) return send(res, 400, { ok: false, error: "Ожидается data URI изображения." });

      const started = Date.now();
      let analysis;
      try {
        analysis = LIVE ? await liveAnalysis(image, body) : demoAnalysis(image, body);
      } catch (e) {
        return send(res, 502, { ok: false, error: "Ошибка Workers AI: " + String(e.message || e), details: [String(e.message || e)] });
      }

      const sizing = analysis.signal && analysis.signal.direction !== "none"
        ? sizePosition({
            balance: Number(body.balance) || 0, riskPct: Number(body.riskPct) || 0,
            mode: body.mode === "spot" ? "spot" : "margin",
            entry: analysis.signal.entry, stop: analysis.signal.stop_loss,
            targets: analysis.signal.take_profits || [],
          })
        : null;

      if (!LIVE) await new Promise((r) => setTimeout(r, 900 + Math.random() * 700));

      return send(res, 200, {
        ok: true,
        model: LIVE ? MODEL : "demo-stub (локальный превью-режим)",
        analysis,
        sizing,
        warnings: sizing ? sizing.warnings : [],
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
          direction: b.direction === "short" ? "short" : "long",
          entry: Number(b.entry) || null, stop_loss: Number(b.stop_loss) || null,
          take_profits: Array.isArray(b.take_profits) ? b.take_profits.map(Number) : [],
          risk_reward: Number(b.risk_reward) || null, confidence: Number(b.confidence) || null,
          qty: Number(b.qty) || null, notional: Number(b.notional) || null,
          leverage: Number(b.leverage) || null, balance: Number(b.balance) || null,
          riskPct: Number(b.riskPct) || null,
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
          if (!r.ok) return send(res, 400, { ok: false, error: "Не хватает данных для расчёта." });
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
  console.log("  Chart Analyst — локальный сервер");
  console.log("  http://localhost:" + PORT);
  console.log("  режим: " + (LIVE ? "LIVE (реальный Workers AI, модель " + MODEL + ")" : "DEMO (заглушка без Cloudflare)"));
  console.log("  журнал: " + JOURNAL_FILE);
  if (!LIVE) console.log("  подсказка: export CF_ACCOUNT_ID=... CF_API_TOKEN=... для живого анализа");
  console.log("────────────────────────────────────────────────");
});
