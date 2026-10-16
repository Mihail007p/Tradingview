/**
 * Workers AI vision layer.
 * Sends a chart screenshot to a multimodal model and gets back STRICT JSON.
 */

export const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const FALLBACK_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const SYSTEM_PROMPT = `You are a professional trading desk analyst (technical analysis only).
You read a chart screenshot from a terminal (TradingView / exchange / broker) and return a strict JSON verdict.

HARD RULES:
1. Return ONLY a single valid JSON object. No markdown, no code fences, no commentary before or after.
2. All human-readable text fields MUST be in Russian.
3. All numeric fields MUST be JSON numbers (not strings). If a value is unknown or not applicable, use null.
4. Never invent a setup that is not visible. If the chart is unclear, unreadable, or there is no edge,
   return direction = "none" and say so honestly in "summary".
5. Read price levels from the visible price axis as precisely as you can. Do not guess wildly.
6. Confidence must reflect genuine uncertainty: 0-100 integer.

SCHEMA:
{
  "instrument": string|null,
  "timeframe": string|null,
  "market": string|null,
  "chart_type": string|null,
  "trend": "uptrend"|"downtrend"|"sideways"|null,
  "trend_strength": "weak"|"moderate"|"strong"|null,
  "summary": string,
  "levels": {
    "support": [number, number],
    "resistance": [number, number]
  },
  "patterns": [string],
  "indicators": [string],
  "signal": {
    "direction": "long"|"short"|"none",
    "entry": number|null,
    "stop_loss": number|null,
    "take_profits": [number, number, number],
    "risk_reward": number|null,
    "confidence": number,
    "horizon": string|null
  },
  "risks": [string],
  "invalidations": [string],
  "recommendation": string
}`;

function userPrompt(ctx) {
  const lines = [
    "Разбери этот график и верни JSON строго по схеме из системного промпта.",
    "",
    `Режим торговли: ${ctx.mode === "spot" ? "спот (без плеча)" : "фьючерсы / маржа (плечо доступно)"}.`,
    `Рынок (если известен): ${ctx.market || "не указан, определи сам по графику"}.`,
  ];

  if (ctx.balance && ctx.riskPct) {
    lines.push(
      `Трейдер рискует ${ctx.riskPct}% от депозита ${ctx.balance} на сделку. ` +
        "Учитывай это: ставь стоп по структуре рынка, а не подгоняй под депозит."
    );
  }

  if (ctx.question && ctx.question.trim()) {
    lines.push("", `Дополнительный вопрос трейдера: ${ctx.question.trim()}`);
  }

  lines.push(
    "",
    "Требования к стопу и целям:",
    "- stop_loss должен лежать за ближайшей структурной точкой (swing high/low, граница диапазона, уровень), а не произвольно.",
    "- take_profits должны быть у реальных зон ликвидности / уровней / границ диапазона.",
    "- risk_reward считай по первому тейку: (|target1 - entry| / |entry - stop_loss|), округли до 2 знаков.",
    "- Если направление none, все поля signal кроме direction и confidence ставь в null."
  );

  return lines.join("\n");
}

/** Workers AI accepts images in a couple of shapes depending on the model. Build both. */
function buildPayloads(model, promptText, dataUri, bytes) {
  const inlineMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: dataUri } },
      ],
    },
  ];

  const fieldMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: promptText },
  ];

  return {
    inline: {
      model,
      body: {
        messages: inlineMessages,
        max_tokens: 1400,
        temperature: 0.2,
      },
    },
    field: {
      model,
      body: {
        messages: fieldMessages,
        image: bytes, // Array<number> — legacy shape used by llava / llama-3.2-11b-vision
        max_tokens: 1400,
        temperature: 0.2,
      },
    },
  };
}

/** Normalize the many response shapes Workers AI can return. */
function extractText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result.response === "string") return result.response;
  if (result.result && typeof result.result.response === "string") return result.result.response;
  if (Array.isArray(result.choices) && result.choices[0]) {
    const c = result.choices[0];
    return c.text || c.message?.content || "";
  }
  return "";
}

/** Pull the first JSON object out of a model reply, tolerating ```json fences and chatter. */
export function extractJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    // try to repair: remove trailing commas
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
    } catch (_e) {
      return null;
    }
  }
}

/** Coerce the model output into the shape the UI expects. */
export function normalize(rawObj) {
  const o = rawObj && typeof rawObj === "object" ? rawObj : {};
  const sig = o.signal && typeof o.signal === "object" ? o.signal : {};
  const lvl = o.levels && typeof o.levels === "object" ? o.levels : {};

  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-eE]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const arr = (v) => (Array.isArray(v) ? v : []).filter((x) => x !== null && x !== undefined && x !== "");

  let direction = String(sig.direction ?? "none").toLowerCase();
  if (!["long", "short", "none"].includes(direction)) direction = "none";

  let trend = o.trend ? String(o.trend).toLowerCase() : null;
  if (!["uptrend", "downtrend", "sideways"].includes(trend)) trend = null;

  const entry = num(sig.entry);
  const stop = num(sig.stop_loss);
  const targets = arr(sig.take_profits).map(num).filter((x) => x !== null).slice(0, 3);

  let rr = num(sig.risk_reward);
  if (rr === null && entry !== null && stop !== null && targets.length > 0) {
    const risk = Math.abs(entry - stop);
    if (risk > 0) rr = Math.round((Math.abs(targets[0] - entry) / risk) * 100) / 100;
  }

  let confidence = num(sig.confidence);
  if (confidence === null) confidence = 0;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    instrument: o.instrument ? String(o.instrument) : null,
    timeframe: o.timeframe ? String(o.timeframe) : null,
    market: o.market ? String(o.market) : null,
    chart_type: o.chart_type ? String(o.chart_type) : null,
    trend,
    trend_strength: o.trend_strength ? String(o.trend_strength) : null,
    summary: o.summary ? String(o.summary) : "",
    levels: {
      support: arr(lvl.support).map(num).filter((x) => x !== null).slice(0, 4),
      resistance: arr(lvl.resistance).map(num).filter((x) => x !== null).slice(0, 4),
    },
    patterns: arr(o.patterns).map(String).slice(0, 6),
    indicators: arr(o.indicators).map(String).slice(0, 8),
    signal: {
      direction,
      entry,
      stop_loss: stop,
      take_profits: targets,
      risk_reward: rr,
      confidence,
      horizon: sig.horizon ? String(sig.horizon) : null,
    },
    risks: arr(o.risks).map(String).slice(0, 5),
    invalidations: arr(o.invalidations).map(String).slice(0, 5),
    recommendation: o.recommendation ? String(o.recommendation) : "",
  };
}

export async function analyzeChart(env, opts) {
  const { dataUri, bytes, question, market, mode, balance, riskPct } = opts;

  const promptText = userPrompt({ question, market, mode, balance, riskPct });
  const primary = env.VISION_MODEL || DEFAULT_MODEL;
  const models = [primary];
  if (primary !== FALLBACK_MODEL) models.push(FALLBACK_MODEL);

  const errors = [];

  for (const model of models) {
    const { inline, field } = buildPayloads(model, promptText, dataUri, bytes);

    for (const attempt of [inline, field]) {
      try {
        const res = await env.AI.run(attempt.model, attempt.body);
        const text = extractText(res);
        const parsed = extractJson(text);
        if (parsed) {
          return { data: normalize(parsed), model, warnings: [] };
        }
        errors.push(`${model}: не удалось распарсить JSON (${text.slice(0, 120)}…)`);
      } catch (err) {
        errors.push(`${model}: ${err?.message || String(err)}`);
      }
    }
  }

  throw Object.assign(new Error("AI_ANALYSIS_FAILED"), { details: errors });
}
