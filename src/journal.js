/**
 * Trade journal storage.
 * Production: Cloudflare KV (binding `JOURNAL`).
 * Local dev server: a JSON file on disk (see tools/dev-server.mjs).
 *
 * The Worker only needs `env.JOURNAL`; if it's missing we return a clear error
 * instead of silently losing trades.
 */

const PREFIX = "trade:";
const INDEX_KEY = "index";

export function createJournal(env) {
  const kv = env && env.JOURNAL;

  if (!kv) {
    return {
      available: false,
      error:
        "KV-неймспейс JOURNAL не привязан. Выполни: npx wrangler kv namespace create JOURNAL " +
        "и добавь id в wrangler.toml.",
      async list() {
        throw new Error(this.error);
      },
      async add() {
        throw new Error(this.error);
      },
      async update() {
        throw new Error(this.error);
      },
      async remove() {
        throw new Error(this.error);
      },
      async clear() {
        throw new Error(this.error);
      },
    };
  }

  async function readIndex() {
    const raw = await kv.get(INDEX_KEY, { type: "json" });
    return Array.isArray(raw) ? raw : [];
  }

  async function writeIndex(ids) {
    await kv.put(INDEX_KEY, JSON.stringify(ids));
  }

  return {
    available: true,
    error: null,

    async list() {
      const ids = await readIndex();
      const out = [];
      for (const id of ids) {
        const item = await kv.get(PREFIX + id, { type: "json" });
        if (item) out.push(item);
      }
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return out;
    },

    async add(entry) {
      const id = entry.id || `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const record = { ...entry, id, createdAt: entry.createdAt || Date.now() };
      await kv.put(PREFIX + id, JSON.stringify(record));
      const ids = await readIndex();
      ids.unshift(id);
      await writeIndex(ids.slice(0, 500));
      return record;
    },

    async update(id, patch) {
      const key = PREFIX + id;
      const current = await kv.get(key, { type: "json" });
      if (!current) return null;
      const next = { ...current, ...patch, id, updatedAt: Date.now() };
      await kv.put(key, JSON.stringify(next));
      return next;
    },

    async remove(id) {
      await kv.delete(PREFIX + id);
      const ids = await readIndex();
      await writeIndex(ids.filter((x) => x !== id));
      return true;
    },

    async clear() {
      const ids = await readIndex();
      for (const id of ids) await kv.delete(PREFIX + id);
      await writeIndex([]);
      return true;
    },
  };
}
