/**
 * Chart Analyst Bot — Cloudflare Worker
 *
 * Routes:
 *   GET  /                 -> web UI
 *   GET  /api/health       -> status
 *   POST /api/analyze      -> { image (data URI), question, market, expiry, payout, balance, stakePct }
 *   GET  /api/journal      -> list trades + stats
 *   POST /api/journal      -> add trade
 *   PATCH /api/journal/:id -> update (close) trade
 *   DELETE /api/journal/:id
 *   DELETE /api/journal    -> clear all
 */

import { ui } from "./ui.js";
import { analyzeChart, DEFAULT_MODEL, normalizeExpiry } from "./ai.js";
import { createJournal } from "./journal.js";
import { sizeStake, journalStats, computeClose, normalizeDirection, DEFAULT_PAYOUT } from "./sizing.js";

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
  // Секрет мог попасть в Cloudflare с переводом строки/пробелами по краям
  // (например, `echo "$ACCESS_KEY" | wrangler secret put ...` добавляет \n),
  // а пользователь вводит ключ без них — сравниваем обе стороны обрезанными,
  // иначе «правильный» пароль никогда не совпадёт с секретом.
  const expected = String((env && env.ACCESS_KEY) || "").trim();
  if (!expected) return true;
  const header = (request.headers.get("X-Api-Key") || "").trim();
  const qs = (new URL(request.url).searchParams.get("key") || "").trim();
  return header === expected || qs === expected;
}

function authRequired(env) {
  return Boolean(String((env && env.ACCESS_KEY) || "").trim());
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
    expiry: normalizeExpiry(body.expiry) || null,
    payout: Number(body.payout) || DEFAULT_PAYOUT,
    balance: body.balance,
    stakePct: body.stakePct,
    // "fast" (по умолчанию) — без thinking, отвечает сразу; "deep" — с thinking.
    mode: body.mode === "deep" ? "deep" : "fast",
  };

  const started = Date.now();
  try {
    const { data, model } = await analyzeChart(env, opts);
    const sizing =
      data.signal.direction !== "none"
        ? sizeStake({
            balance: Number(opts.balance) || 0,
            stakePct: Number(opts.stakePct) || 0,
            payout: opts.payout,
          })
        : null;

    return json({
      ok: true,
      model,
      mode: opts.mode,
      ms: Date.now() - started,
      analysis: data,
      sizing: sizing && sizing.ok ? sizing : null,
      warnings: sizing && sizing.ok ? sizing.warnings : [],
      disclaimer:
        "Это решение ИИ-трейдера по разбору графика, а не финансовая рекомендация. Решение и риск — твои.",
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
      direction: normalizeDirection(body.direction),
      entry: Number(body.entry) || null,
      expiry: normalizeExpiry(body.expiry),
      confidence: Number(body.confidence) || null,
      stake: Number(body.stake) || null,
      payout: Number(body.payout) || DEFAULT_PAYOUT,
      balance: Number(body.balance) || null,
      stakePct: Number(body.stakePct) || null,
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

const KEY_HINT =
  "Нужен ключ доступа. Введи его в поле «Ключ доступа» вверху страницы " +
  "(или открой сайт по ссылке с ?key=ТВОЙ_КЛЮЧ). Только тогда доступны анализ и журнал.";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // --- UI отдаём всегда -----------------------------------------------
    // Раньше страница тоже была за ключом, и без ?key= пользователь видел
    // только JSON {"error":"Неверный ключ доступа."} — даже поля для ввода
    // ключа не было. Сама HTML-страница бесплатна (не тратит квоту Workers AI),
    // поэтому её отдаём открыто, а ключ проверяем на /api/*.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(ui(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "chart-analyst-bot",
        model: env.VISION_MODEL || DEFAULT_MODEL,
        journal: createJournal(env).available,
        auth: authRequired(env),
        // Принимается ли ключ, присланный с этим запросом. Раньше health
        // ключ не проверял вовсе, и интерфейс при НЕВЕРНОМ пароле показывал
        // «онлайн» — пользователь не мог понять, что пароль не подошёл.
        keyValid: authorized(request, env),
        time: new Date().toISOString(),
      });
    }

    if (url.pathname.startsWith("/api/")) {
      if (!authorized(request, env)) {
        return err(KEY_HINT, 401);
      }

      if (url.pathname === "/api/analyze" && request.method === "POST") {
        return handleAnalyze(request, env);
      }

      if (url.pathname === "/api/journal") {
        return handleJournal(request, env);
      }

      return err("Not found", 404);
    }

    return err("Not found", 404);
  },
};
