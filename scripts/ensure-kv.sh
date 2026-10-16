#!/usr/bin/env bash
# ============================================================
#  Находит (или создаёт) KV-неймспейс для журнала сделок
#  и дописывает binding в wrangler.toml перед деплоем.
#
#  Требует в окружении:
#    CLOUDFLARE_API_TOKEN
#    CLOUDFLARE_ACCOUNT_ID
#
#  Необязательно:
#    KV_NAMESPACE_ID  — готовый id неймспейса (секрет/переменная репозитория).
#                       Если задан, ничего искать и создавать не нужно.
#    KV_TITLE         — имя неймспейса (по умолчанию chart-analyst-bot-JOURNAL)
#
#  Ничего не ломает: если KV недоступен — выходит с кодом 1, воркер
#  деплоится без серверного журнала (в UI тогда работает локальный журнал
#  в браузере). Все ответы Cloudflare печатаются в лог, чтобы причина была
#  видна прямо в CI, а не «не удалось получить KV id».
# ============================================================
set -uo pipefail

BINDING="JOURNAL"
TITLE="${KV_TITLE:-chart-analyst-bot-JOURNAL}"
CFG="wrangler.toml"
CF_API="https://api.cloudflare.com/client/v4"

log() { echo "  $*" >&2; }

finish() { # finish <exit-code> <status-string>
  echo "status=$2" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit "$1"
}

# --- читаем ответы Cloudflare REST API --------------------------
extract_id() {
  TITLE="$TITLE" node -e '
    let s = "";
    process.stdin.on("data", d => (s += d)).on("end", () => {
      try {
        const o = JSON.parse(s);
        if (o.success !== true || !Array.isArray(o.result)) return;
        const hit = o.result.find(x => x.title === process.env.TITLE);
        if (hit && /^[0-9a-f]{32}$/.test(hit.id)) process.stdout.write(hit.id);
      } catch (_) {}
    });
  '
}

extract_new_id() {
  node -e '
    let s = "";
    process.stdin.on("data", d => (s += d)).on("end", () => {
      try {
        const o = JSON.parse(s);
        if (o.success === true && o.result && /^[0-9a-f]{32}$/.test(o.result.id)) {
          process.stdout.write(o.result.id);
        }
      } catch (_) {}
    });
  '
}

# Печатает причину отказа Cloudflare (permissions / account id / лимиты)
cf_errors() {
  node -e '
    let s = "";
    process.stdin.on("data", d => (s += d)).on("end", () => {
      try {
        const o = JSON.parse(s);
        if (o.success === true) return;
        const errs = Array.isArray(o.errors) ? o.errors : [];
        if (!errs.length) { console.error("  ответ без success и без errors"); return; }
        for (const e of errs) console.error(`  Cloudflare: [${e.code}] ${e.message}`);
        if (errs.some(e => Number(e.code) === 10000)) {
          console.error("  → похоже, у CLOUDFLARE_API_TOKEN нет прав на Workers KV Storage (Edit).");
        }
        if (errs.some(e => [6003, 7003].includes(Number(e.code)))) {
          console.error("  → проверь CLOUDFLARE_ACCOUNT_ID.");
        }
      } catch (_) { console.error("  ответ не JSON"); }
    });
  '
}

KV_ID=""

# 0. Если id передали снаружи — используем как есть.
if [ -n "${KV_NAMESPACE_ID:-}" ]; then
  if [[ "$KV_NAMESPACE_ID" =~ ^[0-9a-f]{32}$ ]]; then
    log "используем KV_NAMESPACE_ID из окружения"
    KV_ID="$KV_NAMESPACE_ID"
  else
    log "⚠ KV_NAMESPACE_ID задан, но не похож на id (32 hex) — игнорирую"
  fi
fi

# 1. Ищем существующий (с пагинацией: список может не поместиться в одну страницу)
if [ -z "$KV_ID" ]; then
  log "ищем KV-неймспейс '$TITLE'..."
  PAGE=1
  while [ "$PAGE" -le 20 ]; do
    LIST="$(curl -sS "$CF_API/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces?per_page=100&page=$PAGE" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" 2>&1 || true)"
    if [ -z "$LIST" ]; then log "⚠ пустой ответ списка KV"; break; fi
    FOUND="$(printf '%s' "$LIST" | extract_id)"
    if [ -n "$FOUND" ]; then KV_ID="$FOUND"; break; fi
    printf '%s' "$LIST" | cf_errors >&2 || true
    printf '%s' "$LIST" | grep -q '"success":true' || break
    PAGE="$((PAGE + 1))"
  done
fi

# 2. Если нет — создаём
if [ -z "$KV_ID" ]; then
  log "не найден, создаём..."
  OUT="$(curl -sS -X POST "$CF_API/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    --data "{\"title\":\"$TITLE\"}" 2>&1 || true)"
  KV_ID="$(printf '%s' "$OUT" | extract_new_id)"
  if [ -z "$KV_ID" ]; then printf '%s' "$OUT" | cf_errors >&2 || true; fi
fi

# 3. Последний шанс — wrangler CLI (те же креды, но другой путь запроса)
if [ -z "$KV_ID" ]; then
  log "пробуем через wrangler kv namespace create..."
  WOUT="$(npx --yes wrangler kv namespace create "$TITLE" 2>&1 || true)"
  printf '%s\n' "$WOUT" | sed 's/^/  /' >&2
  KV_ID="$(printf '%s' "$WOUT" | grep -oE '[0-9a-f]{32}' | head -1)"
fi

if [ -z "$KV_ID" ]; then
  log "⚠ не удалось получить KV id — деплой без серверного журнала (в UI будет локальный журнал браузера)"
  log "  подсказка: можно вручную создать неймспейс и добавить секрет репозитория KV_NAMESPACE_ID"
  finish 1 "skipped (KV недоступен)"
fi

log "KV id = $KV_ID"

# 4. Дописываем binding, если его ещё нет.
#    ВАЖНО: ищем только незакомментированную строку — в wrangler.toml лежит
#    пример с binding = "JOURNAL" под "#", и наивный grep на него срабатывает.
if grep -Eq "^[[:space:]]*binding[[:space:]]*=[[:space:]]*\"$BINDING\"" "$CFG"; then
  log "binding '$BINDING' уже задан в $CFG вручную — пропускаю"
  finish 0 "ok (binding задан вручную)"
fi

printf '\n# Добавлено CI (scripts/ensure-kv.sh)\n[[kv_namespaces]]\nbinding = "%s"\nid = "%s"\n' \
  "$BINDING" "$KV_ID" >> "$CFG"

log "binding '$BINDING' дописан в $CFG"
finish 0 "ok (id=$KV_ID)"
