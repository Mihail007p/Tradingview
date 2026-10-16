/**
 * UI smoke check — запускает инлайновый <script> из ответа ui() в песочнице
 * с DOM-заглушками и падает, если скрипт бросает ошибку при загрузке.
 *
 *   node tools/ui-smoke.mjs
 *
 * Зачем: страница отдаётся воркером как единый HTML, и любая ошибка времени
 * выполнения (или SyntaxError!) в скрипте полностью убивает интерфейс —
 * кнопки, табы, загрузка скриншота и пароль перестают работать, а на экране
 * остаётся «пустой» сайт.
 *
 * ВАЖНО: скрипт берётся ИМЕННО из html, который отдаёт ui() после обработки
 * template literal, а не из текста src/ui.js. Раньше тест смотрел на текст
 * файла и не видел, что escape-последовательности template literal портят
 * клиентский скрипт (SyntaxError «Unexpected identifier 'font'» на странице,
 * из-за которого «после выбора скриншота ничего не происходило»).
 */

import vm from "node:vm";
import { ui } from "../src/ui.js";

function el(id) {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    placeholder: "",
    disabled: false,
    className: "",
    checked: false,
    style: {},
    dataset: {},
    files: [],
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    blur() {},
    click() {},
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    removeChild() {},
    closest() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return el(id + "-child"); },
    insertAdjacentHTML() {},
    scrollIntoView() {},
  };
}

/** @param {"ok"|"no-kv"|"no-auth"|"offline"} scenario */
function buildSandbox(scenario) {
  const cache = new Map();
  const doc = {
    getElementById: (id) => {
      if (!cache.has(id)) cache.set(id, el(id));
      return cache.get(id);
    },
    querySelectorAll: () => [],
    querySelector: () => el("q"),
    createElement: (t) => el(t),
    addEventListener() {},
    body: el("body"),
    documentElement: el("html"),
  };

  const store = new Map();
  const responses = {
    ok: { status: 200, body: { ok: true, journal: true, entries: [], stats: {} } },
    "no-kv": { status: 503, body: { ok: false, error: "KV-неймспейс JOURNAL не привязан." } },
    "no-auth": { status: 401, body: { ok: false, error: "Нужен ключ доступа." } },
    offline: null,
  };

  const sandbox = {
    console,
    document: doc,
    location: { origin: "https://example.workers.dev", search: "", href: "https://example.workers.dev/" },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    navigator: { userAgent: "node" },
    URLSearchParams,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    alert() {},
    confirm() { return true; },
    FormData: class {},
    Blob: class {},
    Image: class { set src(_v) { if (this.onload) setTimeout(() => this.onload(), 0); } },
    FileReader: class {
      readAsDataURL() {
        if (this.onload) setTimeout(() => this.onload({ target: { result: "data:image/png;base64,AA" } }), 0);
      }
    },
    fetch: () => {
      const r = responses[scenario];
      if (!r) return Promise.reject(new Error("simulated network failure"));
      return Promise.resolve({
        status: r.status,
        ok: r.status >= 200 && r.status < 300,
        json: () => Promise.resolve(r.body),
      });
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

// Скрипт именно из ответа ui() (то, что реально получает браузер), —
// только так ловятся ошибки обработки escape в template literal.
const html = ui();
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error("✖ src/ui.js: не найден инлайновый <script> с логикой интерфейса");
  process.exit(1);
}

const scenarios = ["ok", "no-kv", "no-auth", "offline"];
let failed = 0;

for (const scenario of scenarios) {
  const sandbox = buildSandbox(scenario);
  try {
    vm.runInNewContext(match[1], vm.createContext(sandbox), { filename: `ui-inline.js [${scenario}]` });
    // даём промисам loadJournal()/health() дойти до конца
    await new Promise((r) => setTimeout(r, 10));
    console.log(`✔ UI загружается без ошибок — сценарий: ${scenario}`);
  } catch (e) {
    failed++;
    console.error(`✖ UI упал — сценарий: ${scenario}: ${e.constructor.name}: ${e.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} из ${scenarios.length} сценариев провалено.`);
  process.exit(1);
}
console.log("\nUI smoke: всё чисто.");
