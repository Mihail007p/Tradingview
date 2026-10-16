/**
 * Chart Analyst Bot — Cloudflare Worker
 *
 * Routes:
 *   GET  /                 -> web UI
 *   GET  /api/health       -> status
 *   POST /api/analyze      -> { image (data URI), question, market, mode, balance, riskPct }
 *   GET  /api/journal      -> list trades + stats
 *   POST /api/journal      -> add trade
 *   PATCH /api/journal/:id -> update (close) trade
 *   DELETE /api/journal/:id
 *   DELETE /api/journal    -> clear all
 */

import { ui } from "./ui.js";
import { analyzeChart, DEFAULT_MODEL } from "./ai.js";
import { createJournal } from "./journal.js";
import { sizePosition, journalStats, computeClose } from "./sizing.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

/** Optional shared secret so nobody else can burn your Workers AI quota. */
function authorized(request, env) {
  if (!env.ACCESS_KEY) return true;
  const header = request.headers.get("X-Api-Key") || "";
  const qs = new URL(request.url).searchParams.get("key") || "";
  return header === env.ACCESS_KEY || qs === env.ACCESS_KEY;
}

function dataUriToBytes(dataUri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri || "");
  if (!m) return { bytes: [], mime: "image/jpeg" };
  const mime = m[1] || "image/jpeg";
  if (!m[2]) return { bytes: [], mime };
  const b64 = m[3];
  const bin = atob(b64);
  const bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function handleAnalyze(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return err("Невалидный JSON.");
  }

  const image = String(body.image || "");
  if (!image.startsWith("data:image/")) return err("Ожидается изображение в формате data URI.");

  const { bytes } = dataUriToBytes(image);
  if (bytes.length && bytes.length > 6 * 1024 * 1024) {
    return err("Изображение слишком большое (максимум ~4.5 МБ после base64).");
  }

  const opts = {
    dataUri: image,
    bytes,
    question: String(body.question || "").slice(0, 500),
    market: String(body.market || "").slice(0, 60),
    mode: body.mode === "spot" ? "spot" : "margin",
    balance: body.balance,
    riskPct: body.riskPct,
  };

  try {
    const { data, model } = await analyzeChart(env, opts);
    const sizing =
      data.signal.direction !== "none"
        ? sizePosition({
            balance: Number(opts.balance) || 0,
            riskPct: Number(opts.riskPct) || 0,
            mode: opts.mode,
            entry: data.signal.entry,
            stop: data.signal.stop_loss,
            targets: data.signal.take_profits,
          })
        : null;

    return json({
      ok: true,
      model,
      analysis: data,
      sizing: sizing && sizing.ok ? sizing : null,
      warnings: sizing && sizing.ok ? sizing.warnings : [],
      disclaimer:
        "Это технический анализ, а не финансовая рекомендация. Решение и риск — твои.",
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: "Модель не вернула корректный анализ. Попробуй более чёткий скриншот.",
        details: e && e.details ? e.details.slice(0, 4) : [String(e && e.message)],
      },
      502
    );
  }
}

async function handleJournal(request, env) {
  const journal = createJournal(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (!journal.available) return err(journal.error, 503);
    const entries = await journal.list();
    return json({ ok: true, entries, stats: journalStats(entries) });
  }

  if (request.method === "DELETE") {
    if (!journal.available) return err(journal.error, 503);
    const id = url.searchParams.get("id");
    if (id) await journal.remove(id);
    else await journal.clear();
    const entries = await journal.list();
    return json({ ok: true, entries, stats: journalStats(entries) });
  }

  if (request.method === "POST") {
    if (!journal.available) return err(journal.error, 503);
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return err("Невалидный JSON.");
    }
    const trade = {
      instrument: String(body.instrument || "—").slice(0, 40),
      timeframe: String(body.timeframe || "—").slice(0, 20),
      direction: body.direction === "short" ? "short" : "long",
      entry: Number(body.entry) || null,
      stop_loss: Number(body.stop_loss) || null,
      take_profits: Array.isArray(body.take_profits) ? body.take_profits.map(Number) : [],
      risk_reward: Number(body.risk_reward) || null,
      confidence: Number(body.confidence) || null,
      qty: Number(body.qty) || null,
      notional: Number(body.notional) || null,
      leverage: Number(body.leverage) || null,
      balance: Number(body.balance) || null,
      riskPct: Number(body.riskPct) || null,
      summary: String(body.summary || "").slice(0, 1000),
      status: "open",
      notes: String(body.notes || "").slice(0, 500),
    };
    const saved = await journal.add(trade);
    const entries = await journal.list();
    return json({ ok: true, trade: saved, entries, stats: journalStats(entries) });
  }

  if (request.method === "PATCH") {
    if (!journal.available) return err(journal.error, 503);
    const id = url.searchParams.get("id");
    if (!id) return err("Не указан id.");
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return err("Невалидный JSON.");
    }

    const patch = { ...body };
    if (body.exitPrice !== undefined && body.exitPrice !== null && body.exitPrice !== "") {
      const entries = await journal.list();
      const trade = entries.find((t) => t.id === id);
      if (!trade) return err("Сделка не найдена.", 404);
      const res = computeClose({ trade, exitPrice: body.exitPrice });
      if (!res.ok) return err(res.reason);
      patch.exitPrice = Number(body.exitPrice);
      patch.status = res.status;
      patch.resultR = res.resultR;
      patch.resultPnl = res.resultPnl;
      patch.closedAt = Date.now();
    }
    if (body.status && !["open", "win", "loss", "breakeven"].includes(body.status)) delete patch.status;
    delete patch.exitPriceRaw;

    const updated = await journal.update(id, patch);
    if (!updated) return err("Сделка не найдена.", 404);
    const entries = await journal.list();
    return json({ ok: true, trade: updated, entries, stats: journalStats(entries) });
  }

  return err("Метод не поддерживается.", 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "chart-analyst-bot",
        model: env.VISION_MODEL || DEFAULT_MODEL,
        journal: createJournal(env).available,
        time: new Date().toISOString(),
      });
    }

    if (!authorized(request, env)) {
      return err("Неверный ключ доступа.", 401);
    }

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }

    if (url.pathname === "/api/journal") {
      return handleJournal(request, env);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(ui(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};
