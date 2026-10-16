/**
 * Расчёт ставки и результатов для Pocket Options (бинарные опционы). Чистая математика, без AI.
 * Одинаково работает в Worker и в локальном dev-сервере.
 *
 *  - CALL выигрывает, если цена на экспирации выше цены входа; PUT — если ниже.
 *  - Выигрыш = ставка × выплата%, проигрыш = −ставка.
 *  - Ничья (цена не изменилась) — ставка возвращается, результат 0 (проверь правило брокера).
 */

export const DEFAULT_PAYOUT = 85; // типичная выплата по популярным парам, % (вводится вручную)
export const MIN_STAKE = 1; // минимальная ставка Pocket Options, $
export const MAX_STAKE_PCT = 5; // предупреждение, если ставка больше этого % депозита

/** Break-even винрейт при выплате p%: 100 / (100 + p). */
export function breakEvenWinRate(payoutPct) {
  return (100 / (100 + payoutPct)) * 100;
}

export function sizeStake({ balance, stakePct, payout = DEFAULT_PAYOUT }) {
  const b = Number(balance);
  const sp = Number(stakePct);
  const p = Number(payout);

  if (![b, sp, p].every(Number.isFinite) || b <= 0 || sp <= 0 || p <= 0) {
    return { ok: false, reason: "Нужны корректные: депозит, сумма ставки (%) и выплата (%)." };
  }

  const round = (n, d = 2) => {
    const f = 10 ** d;
    return Math.round(n * f) / f;
  };

  const stake = round((b * sp) / 100, 2);
  const warnings = [];

  if (stake < MIN_STAKE) {
    warnings.push(`Ставка $${stake} ниже минимальной $${MIN_STAKE} на Pocket Options.`);
  }
  if (sp > MAX_STAKE_PCT) {
    warnings.push(`Ставка ${sp}% депозита — выше ${MAX_STAKE_PCT}%. На бинарках серия из 3–4 убытков уже сильно бьёт по счёту.`);
  }
  if (p < 70) {
    warnings.push(`Выплата ${p}% низкая: чтобы выйти в ноль, нужен винрейт ${breakEvenWinRate(p).toFixed(1)}%.`);
  }

  return {
    ok: true,
    stake,
    payout: round(p, 2),
    potentialProfit: round((stake * p) / 100, 2),
    potentialLoss: round(stake, 2),
    breakEvenWinRate: round(breakEvenWinRate(p), 2),
    stakePct: round(sp, 3),
    warnings,
  };
}

export function journalStats(entries = []) {
  const closed = entries.filter((e) => e.status && e.status !== "open");
  const wins = closed.filter((e) => e.status === "win");
  const losses = closed.filter((e) => e.status === "loss");
  const bes = closed.filter((e) => e.status === "breakeven");

  const rValues = closed.map((e) => Number(e.resultR)).filter(Number.isFinite);
  const totalR = rValues.reduce((a, x) => a + x, 0);
  const pnl = closed.map((e) => Number(e.resultPnl)).filter(Number.isFinite);
  const totalPnl = pnl.reduce((a, x) => a + x, 0);

  const avgWin = wins.length ? wins.reduce((a, e) => a + Number(e.resultR || 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, e) => a + Number(e.resultR || 0), 0) / losses.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  // Ожидание в долях ставки на сделку
  const expectancy = closed.length ? totalR / closed.length : 0;

  return {
    total: entries.length,
    open: entries.filter((e) => e.status === "open").length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: bes.length,
    winRate: Math.round(winRate * 10) / 10,
    totalR: Math.round(totalR * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgR: closed.length ? Math.round((totalR / closed.length) * 100) / 100 : 0,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    bestR: rValues.length ? Math.max(...rValues) : 0,
    worstR: rValues.length ? Math.min(...rValues) : 0,
  };
}

/** Старые записи: long/short → call/put. */
export function normalizeDirection(d) {
  if (d === "put" || d === "short") return "put";
  return "call";
}

/**
 * Результат бинарной сделки по цене экспирации.
 * resultR   — прибыль в долях ставки (выигрыш = выплата/100, проигрыш = −1).
 * resultPnl — прибыль в $ (выигрыш = ставка × выплата/100, проигрыш = −ставка).
 */
export function computeClose({ trade, exitPrice }) {
  const entry = Number(trade.entry);
  const exit = Number(exitPrice);
  if (![entry, exit].every(Number.isFinite) || entry <= 0 || exit <= 0) {
    return { ok: false, reason: "Не хватает данных для расчёта результата (нужны цена входа и цена выхода)." };
  }

  const dir = normalizeDirection(trade.direction);
  const stake = Number(trade.stake) || 0;
  const payout = Number(trade.payout) || DEFAULT_PAYOUT;

  let status;
  if (exit === entry) status = "breakeven";
  else if ((dir === "call" && exit > entry) || (dir === "put" && exit < entry)) status = "win";
  else status = "loss";

  const resultR = status === "win" ? payout / 100 : status === "loss" ? -1 : 0;
  const resultPnl =
    status === "win" ? (stake * payout) / 100 : status === "loss" ? -stake : 0;

  return {
    ok: true,
    status,
    resultR: Math.round(resultR * 100) / 100,
    resultPnl: Math.round(resultPnl * 100) / 100,
  };
}
