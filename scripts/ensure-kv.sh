#!/usr/bin/env bash
# ============================================================
#  Находит (или создаёт) KV-неймспейс для журнала сделок
#  и дописывает binding в wrangler.toml перед деплоем.
#
#  Требует в окружении:
#    CLOUDFLARE_API_TOKEN
#    CLOUDFLARE_ACCOUNT_ID
#
#  Ничего не ломает: если KV недоступен — просто выходит с кодом 1,
#  и воркер деплоится без журнала.
# ============================================================
set -uo pipefail

BINDING="JOURNAL"
TITLE="${KV_TITLE:-chart-analyst-bot-JOURNAL}"
CFG="wrangler.toml"

log() { echo "  $*" >&2; }

# --- читаем только успешные ответы Cloudflare REST API ---------
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

KV_ID=""

# 1. Ищем существующий
log "ищем KV-неймспейс '$TITLE'..."
LIST="$(curl -sS "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" 2>/dev/null || true)"
if [ -n "$LIST" ]; then
  KV_ID="$(printf '%s' "$LIST" | extract_id)"
fi

# 2. Если нет — создаём
if [ -z "$KV_ID" ]; then
  log "не найден, создаём..."
  OUT="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "{\"title\":\"$TITLE\"}" 2>&1 || true)"
  KV_ID="$(printf '%s' "$OUT" | extract_new_id)"
fi

if [ -z "$KV_ID" ]; then
  log "⚠ не удалось получить KV id — деплой без журнала сделок"
  echo "status=skipped (KV недоступен)" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit 1
fi

log "KV id = $KV_ID"

# 3. Дописываем binding, если его ещё нет.
#    ВАЖНО: ищем только незакомментированную строку — в wrangler.toml лежит
#    пример с binding = "JOURNAL" под "#", и наивный grep на него срабатывает.
if grep -Eq "^[[:space:]]*binding[[:space:]]*=[[:space:]]*\"$BINDING\"" "$CFG"; then
  log "binding '$BINDING' уже задан в $CFG вручную — пропускаю"
  echo "status=ok (binding задан вручную)" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

printf '\n# Добавлено CI (scripts/ensure-kv.sh)\n[[kv_namespaces]]\nbinding = "%s"\nid = "%s"\n' \
  "$BINDING" "$KV_ID" >> "$CFG"

log "binding '$BINDING' дописан в $CFG"
echo "status=ok (id=$KV_ID)" >> "${GITHUB_OUTPUT:-/dev/stdout}"
exit 0
