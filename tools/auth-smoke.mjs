/**
 * Auth smoke check — прогоняет ввод ключа доступа в инлайновом <script>
 * из src/ui.js через настоящие обработчики событий.
 *
 *   node tools/auth-smoke.mjs
 *
 * Зачем: пользователь вводил ПРАВИЛЬНЫЙ пароль — и «ничего не происходило»:
 *  1) при первой загрузке без ключа журнал успевал получить 401 и навсегда
 *     (до перезагрузки) уходил в локальный режим, а ввод ключа после этого
 *     перепроверял только /api/health;
 *  2) /api/health ключ вообще не проверял — при неверном пароле интерфейс
 *     показывал «онлайн», и понять, что пароль не подошёл, было нельзя;
 *  3) голый localStorage в начале скрипта при броске (приватный режим,
 *     заблокированные cookies) убивал весь интерфейс целиком.
 * Здесь проверяется: ввод верного ключа без перезагрузки возвращает
 * серверный журнал и статус «ключ принят», неверный — честный статус,
 * а бросающий localStorage не мешает странице работать.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "secret-123";

function makeEl(id) {
  const classes = new Set(["hide"]);
  const el = {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    placeholder: "",
    disabled: false,
    className: "",
    src: "",
    style: {},
    files: [],
    children: [],
    _listeners: {},
    _clicks: 0,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => (force === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : force ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    addEventListener(type, fn) {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    focus() {},
    click() { el._clicks++; },
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    closest() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return makeEl(id + "-child"); },
  };
  return el;
}

function fire(target, type, event) {
  const ev = Object.assign({ target, preventDefault() {}, stopPropagation() {} }, event || {});
  for (const fn of target._listeners[type] || []) fn(ev);
}

const SERVER_TRADE = {
  id: "srv1", createdAt: 1700000000000, instrument: "SRV/USD", timeframe: "M1",
  direction: "call", entry: 1.1, expiry: "1m", stake: 10, payout: 85,
  confidence: 55, status: "open",
};
const SERVER_STATS = { total: 1, open: 1, closed: 0, wins: 0, losses: 0, winRate: 0, totalR: 0, totalPnl: 0, avgR: 0, expectancy: 0, bestR: 0, worstR: 0 };

function buildSandbox({ throwStorage = false } = {}) {
  const cache = new Map();
  const docListeners = {};
  const doc = {
    getElementById: (id) => {
      if (!cache.has(id)) cache.set(id, makeEl(id));
      return cache.get(id);
    },
    querySelectorAll: () => [],
    querySelector: () => makeEl("q"),
    createElement: (t) => makeEl(t),
    addEventListener(type, fn) {
      (docListeners[type] = docListeners[type] || []).push(fn);
    },
    body: makeEl("body"),
    documentElement: makeEl("html"),
  };

  const store = new Map();
  const storage = throwStorage
    ? {
        getItem() { throw new Error("localStorage blocked"); },
        setItem() { throw new Error("localStorage blocked"); },
        removeItem() { throw new Error("localStorage blocked"); },
      }
    : {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };

  const reply = (status, body) =>
    Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) });

  const sandbox = {
    console,
    document: doc,
    location: { origin: "https://example.workers.dev", search: "", href: "https://example.workers.dev/" },
    localStorage: storage,
    navigator: { userAgent: "node" },
    URLSearchParams,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    alert() {},
    confirm() { return true; },
    Image: class {},
    FileReader: class {},
    fetch: (url, opts) => {
      const key = (opts && opts.headers && opts.headers["X-Api-Key"]) || "";
      const valid = key === SECRET;
      if (String(url).includes("/api/health")) {
        return reply(200, { ok: true, model: "@cf/test/model", journal: true, auth: true, keyValid: valid });
      }
      if (String(url).includes("/api/journal")) {
        if (!valid) return reply(401, { ok: false, error: "Нужен ключ доступа." });
        return reply(200, { ok: true, entries: [SERVER_TRADE], stats: SERVER_STATS });
      }
      return reply(404, { ok: false, error: "Not found" });
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return { sandbox, cache, docListeners };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const source = fs.readFileSync(path.join(ROOT, "src", "ui.js"), "utf8");
const match = source.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error("✖ src/ui.js: не найден инлайновый <script>");
  process.exit(1);
}

const checks = [];
function ok(name, cond) {
  checks.push([name, Boolean(cond)]);
  if (!cond) console.error("✖ " + name);
}

// --- сценарий 1: пароль вводят ПОСЛЕ загрузки страницы -------------------
{
  const { sandbox, cache } = buildSandbox();
  vm.runInNewContext(match[1], vm.createContext(sandbox), { filename: "ui-inline.js [auth]" });
  await wait(30);
  const $ = (id) => cache.get(id);

  ok("без ключа статус честно просит ключ, а не «онлайн»",
    /нужен ключ/.test($("status").textContent));
  ok("без ключа журнал ушёл в локальный режим (пуст)",
    /Журнал пуст/.test($("jlist").innerHTML));

  // пользователь вводит правильный пароль — без перезагрузки страницы
  const keyEl = $("accessKey");
  keyEl.value = SECRET;
  fire(keyEl, "input", { target: keyEl });
  await wait(700); // дебаунс 400 мс + запросы

  ok("правильный пароль после загрузки: серверный журнал вернулся сам",
    $("jlist").innerHTML.includes("SRV/USD"));
  ok("правильный пароль: статус показывает «ключ принят»",
    /ключ принят/.test($("status").textContent));

  // а теперь неверный пароль
  keyEl.value = "wrong-pass";
  fire(keyEl, "input", { target: keyEl });
  await wait(700);

  ok("неверный пароль: статус честно показывает «неверный ключ»",
    /неверный ключ/.test($("status").textContent));
  ok("неверный пароль: точка статуса красная", $("dot").className.includes("bad"));
}

// --- сценарий 2: localStorage бросает (приватный режим и т.п.) -----------
{
  const { sandbox, cache } = buildSandbox({ throwStorage: true });
  let threw = false;
  try {
    vm.runInNewContext(match[1], vm.createContext(sandbox), { filename: "ui-inline.js [storage]" });
    await wait(30);
  } catch (_) {
    threw = true;
  }
  ok("бросающий localStorage не убивает интерфейс при загрузке", !threw);

  const $ = (id) => cache.get(id);
  let inputThrew = false;
  try {
    const keyEl = $("accessKey");
    keyEl.value = SECRET;
    fire(keyEl, "input", { target: keyEl });
    await wait(700);
  } catch (_) {
    inputThrew = true;
  }
  ok("ввод пароля при бросающем localStorage не падает", !inputThrew);
  ok("и пароль при этом всё равно применяется", /ключ принят/.test($("status").textContent));
}

const failed = checks.filter(([, c]) => !c).length;
for (const [name, c] of checks) if (c) console.log("✔ " + name);
console.log(`\nAuth smoke: ${checks.length - failed} ок, ${failed} провалено.`);
process.exit(failed ? 1 : 0);
