/**
 * Position sizing + risk checks. Pure math, no AI.
 * Works the same in the Worker and in the local dev server.
 */

export function sizePosition({ balance, riskPct, mode, entry, stop, targets = [] }) {
  const b = Number(balance);
  const rp = Number(riskPct);
  const e = Number(entry);
  const s = Number(stop);

  if (![b, rp, e, s].every(Number.isFinite) || b <= 0 || rp <= 0 || e <= 0 || s <= 0) {
    return { ok: false, reason: "Нужны корректные: депозит, риск %, вход и стоп." };
  }
  if (e === s) return { ok: false, reason: "Вход и стоп совпадают — расчёт невозможен." };

  const riskAmount = (b * rp) / 100;
  const stopDistance = Math.abs(e - s);
  const stopPct = (stopDistance / e) * 100;
  let qty = riskAmount / stopDistance;
  let notional = qty * e;
  let leverage = notional / b;

  const warnings = [];
  let capped = false;

  if (mode === "spot") {
    // No leverage on spot: notional cannot exceed the balance.
    if (notional > b) {
      notional = b;
      qty = notional / e;
      leverage = 1;
      capped = true;
      warnings.push(
        `Спот без плеча: размер урезан до депозита. Фактический риск ${(
          ((stopDistance / e) * 100 * qty * e) / b
        ).toFixed(2)}% вместо ${rp}%.`
      );
    } else {
      leverage = 1;
    }
  }

  if (leverage > 10) {
    warnings.push(`Требуется плечо ${leverage.toFixed(1)}x — выше 10x. Снизь риск или найди более близкий стоп.`);
  }
  if (stopPct > 8) {
    warnings.push(`Стоп далековат: ${stopPct.toFixed(2)}% от цены входа.`);
  }

  const rr = targets.length ? Math.abs(targets[0] - e) / stopDistance : null;
  if (rr !== null && rr < 1.5) {
    warnings.push(`R:R = ${rr.toFixed(2)} — ниже 1.5. Такая сделка редко оправдана математически.`);
  }

  const round = (n, d = 6) => {
    const f = 10 ** d;
    return Math.round(n * f) / f;
  };

  return {
    ok: true,
    riskAmount: round(riskAmount, 2),
    stopDistance: round(stopDistance, 8),
    stopPct: round(stopPct, 3),
    qty: round(qty, 6),
    notional: round(notional, 2),
    leverage: round(leverage, 2),
    requiredMargin: round(notional / Math.max(leverage, 1), 2),
    capped,
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
  // Expectancy in R per trade
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

export function computeClose({ trade, exitPrice }) {
  const entry = Number(trade.entry);
  const stop = Number(trade.stop_loss);
  const exit = Number(exitPrice);
  if (![entry, stop, exit].every(Number.isFinite) || entry === stop) {
    return { ok: false, reason: "Не хватает данных для расчёта результата." };
  }

  const dir = trade.direction === "short" ? -1 : 1;
  const risk = Math.abs(entry - stop);
  const resultR = Math.round(((exit - entry) * dir / risk) * 100) / 100;

  const qty = Number(trade.qty) || 0;
  const resultPnl = Math.round((exit - entry) * dir * qty * 100) / 100;

  let status = "breakeven";
  if (resultR > 0.05) status = "win";
  else if (resultR < -0.05) status = "loss";

  return { ok: true, status, resultR, resultPnl };
}
