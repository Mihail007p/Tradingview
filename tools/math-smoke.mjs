/**
 * Unit-проверки бинарной математики Pocket Options и разбора ответа AI.
 *
 *   node tools/math-smoke.mjs
 */

import { sizeStake, computeClose, breakEvenWinRate, journalStats } from "../src/sizing.js";
import { normalize, normalizeExpiry, extractJson } from "../src/ai.js";

let failed = 0;
let passed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`✔ ${name}`); }
  else { failed++; console.error(`✖ ${name}${extra ? " → " + extra : ""}`); }
}

// --- ставка
{
  const z = sizeStake({ balance: 1000, stakePct: 2, payout: 85 });
  check("ставка 2% от $1000 = $20", z.ok && z.stake === 20, JSON.stringify(z));
  check("выигрыш при выплате 85% = $17", z.potentialProfit === 17);
  check("проигрыш = сумма ставки", z.potentialLoss === 20);
  check("break-even при 85% ≈ 54.05%", Math.abs(breakEvenWinRate(85) - 54.054) < 0.01);
  check("обычная ставка без предупреждений", z.warnings.length === 0, JSON.stringify(z.warnings));
}
{
  const z = sizeStake({ balance: 1000, stakePct: 10, payout: 60 });
  check("ставка 10% даёт предупреждения (риск и низкая выплата)", z.ok && z.warnings.length === 2, JSON.stringify(z.warnings));
}
{
  const z = sizeStake({ balance: 10, stakePct: 2, payout: 85 });
  check("ставка ниже минимума $1 — предупреждение", z.ok && z.warnings.some((w) => /минимальной/.test(w)));
}
{
  check("некорректные входные данные → ok:false", sizeStake({ balance: 0, stakePct: 2 }).ok === false);
}

// --- результат сделки
{
  const r = computeClose({ trade: { direction: "call", entry: 1.1, stake: 20, payout: 85 }, exitPrice: 1.1005 });
  check("CALL выигрывает, если цена выше входа", r.ok && r.status === "win" && r.resultPnl === 17 && r.resultR === 0.85, JSON.stringify(r));
}
{
  const r = computeClose({ trade: { direction: "call", entry: 1.1, stake: 20, payout: 85 }, exitPrice: 1.0995 });
  check("CALL проигрывает, если цена ниже входа", r.status === "loss" && r.resultPnl === -20 && r.resultR === -1);
}
{
  const r = computeClose({ trade: { direction: "put", entry: 1.1, stake: 20, payout: 85 }, exitPrice: 1.0995 });
  check("PUT выигрывает, если цена ниже входа", r.status === "win" && r.resultPnl === 17);
}
{
  const r = computeClose({ trade: { direction: "put", entry: 1.1, stake: 20, payout: 85 }, exitPrice: 1.1 });
  check("ничья (цена не изменилась) → breakeven, 0$", r.status === "breakeven" && r.resultPnl === 0);
}
{
  const r = computeClose({ trade: { direction: "short", entry: 100, stake: 10 }, exitPrice: 99 });
  check("старая запись short трактуется как PUT", r.status === "win");
}
{
  check("нет цены выхода → ok:false", computeClose({ trade: { direction: "call", entry: 1 }, exitPrice: "" }).ok === false);
}

// --- статистика
{
  const s = journalStats([
    { status: "win", resultR: 0.85, resultPnl: 17 },
    { status: "loss", resultR: -1, resultPnl: -20 },
    { status: "open" },
  ]);
  check("статистика: 1 из 2 закрытых в плюс, Σ$ = -3", s.closed === 2 && s.winRate === 50 && s.totalPnl === -3, JSON.stringify(s));
}

// --- экспирации и разбор ответа
{
  check("экспирация «1 мин» → 1m", normalizeExpiry("1 мин") === "1m");
  check("экспирация «5 min» → 5m", normalizeExpiry("5 min") === "5m");
  check("неподдерживаемая экспирация → null", normalizeExpiry("7m") === null);
}
{
  const raw = '```json\n{"signal":{"direction":"Long","entry":"1.0858","expiry":"2 min","confidence":"70"}, "levels":{"support":[1,2]}}\n```';
  const n = normalize(extractJson(raw));
  check("модельный long → call, строка-цена → число", n.signal.direction === "call" && n.signal.entry === 1.0858);
  check("экспирация нормализована до 2m, уверенность 70", n.signal.expiry === "2m" && n.signal.confidence === 70, JSON.stringify(n.signal));
}
{
  const n = normalize({ signal: { direction: "put", entry: 5, expiry: "1m" } });
  check("direction none очищает вход и экспирацию", normalize({ signal: { direction: "none", entry: 5, expiry: "1m" } }).signal.entry === null);
  check("put сохраняется", n.signal.direction === "put");
}

console.log(`\nMath smoke: ${passed} ок, ${failed} провалено.`);
if (failed) process.exit(1);
