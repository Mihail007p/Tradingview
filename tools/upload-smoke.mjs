/**
 * Upload smoke check — прогоняет добавление скриншота в инлайновом <script>
 * из src/ui.js через настоящие обработчики событий (change / click / drop /
 * paste), а не только загрузку страницы.
 *
 *   node tools/upload-smoke.mjs
 *
 * Зачем: ui-smoke проверяет лишь, что скрипт не падает при старте. А путь
 * загрузки ломался молча, и пользователь видел просто «скриншот не
 * добавляется»:
 *  1) <input type=file> не сбрасывался → повторный выбор того же скриншота
 *     после удаления (✕) не вызывал change;
 *  2) файл без MIME-типа (drag-and-drop / буфер обмена) молча отбрасывался;
 *  3) недекодируемая картинка (HEIC) уходила дальше без превью и без ошибки;
 *  4) getAsFile() из буфера обмена может вернуть null.
 * Здесь каждый из этих сценариев проверяется на DOM-заглушках с записью
 * слушателей событий.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeEl(id) {
  const classes = new Set();
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
  if (id === "canvas") {
    el.getContext = () => ({ fillStyle: "", fillRect() {}, drawImage() {} });
    el.toDataURL = () => "data:image/jpeg;base64,RESIZED";
    el.width = 0;
    el.height = 0;
  }
  return el;
}

function fire(target, type, event) {
  const ev = Object.assign({ target, preventDefault() {} }, event || {});
  for (const fn of target._listeners[type] || []) fn(ev);
}

function buildSandbox() {
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
    // Картинка «декодируется», если в data URI нет маркера broken (HEIC и т.п.)
    Image: class {
      set src(v) {
        this._src = v;
        this.width = 2000;
        this.height = 800;
        setTimeout(() => {
          if (String(v).includes("broken")) { if (this.onerror) this.onerror(); }
          else if (this.onload) this.onload();
        }, 0);
      }
      get src() { return this._src; }
    },
    FileReader: class {
      readAsDataURL(file) {
        setTimeout(() => {
          if (this.onload) this.onload({ target: { result: file._dataUri } });
        }, 0);
      }
    },
    fetch: () =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ ok: true, journal: true, entries: [], stats: {} }),
      }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return { sandbox, cache, docListeners };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

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

const { sandbox, cache, docListeners } = buildSandbox();
vm.runInNewContext(match[1], vm.createContext(sandbox), { filename: "ui-inline.js [upload]" });
await tick();

const $ = (id) => cache.get(id);
const fileEl = $("file");
const validPng = { name: "chart.png", type: "image/png", size: 1234, _dataUri: "data:image/png;base64,OK" };

function pick(file) {
  fileEl.files = [file];
  fileEl.value = "C:\\fakepath\\" + (file.name || "blob");
  fire(fileEl, "change", { target: fileEl });
}

// 1) Обычный выбор скриншота: превью, активная кнопка, input сброшен
pick(validPng);
await tick();
ok("выбор PNG показывает превью", $("preview").style.display === "block");
ok("превью — ужатый JPEG с канваса", $("pimg").src === "data:image/jpeg;base64,RESIZED");
ok("кнопка «Проанализировать» активна", $("go").disabled === false);
ok("input сброшен после выбора (тот же файл можно выбрать снова)", fileEl.value === "");
ok("ошибки загрузки нет", $("imgmsg").classList.contains("hide"));

// 2) Удалить (✕) и добавить ТОТ ЖЕ скриншот заново — регрессия №1
fire($("pclear"), "click", { target: $("pclear") });
ok("после ✕ превью скрыто и кнопка выключена", $("preview").style.display === "none" && $("go").disabled === true);
pick(validPng);
await tick();
ok("тот же скриншот добавляется повторно", $("preview").style.display === "block" && $("go").disabled === false);

// 3) Не картинка — понятная ошибка вместо тишины
fire($("pclear"), "click", { target: $("pclear") });
pick({ name: "notes.txt", type: "text/plain", size: 10, _dataUri: "data:text/plain;base64,AA" });
await tick();
ok("не-картинка: показана ошибка", !$("imgmsg").classList.contains("hide") && /не картинка/i.test($("imgmsg").textContent));
ok("не-картинка: кнопка остаётся выключена", $("go").disabled === true);

// 4) Скриншот без MIME-типа (drag-and-drop / буфер) — регрессия №2
pick({ name: "", type: "", size: 100, _dataUri: "data:image/png;base64,OK2" });
await tick();
ok("файл без MIME-типа принимается", $("preview").style.display === "block" && $("go").disabled === false);

// 5) Недекодируемая картинка (HEIC) — видимая подсказка, а не тишина (№3)
fire($("pclear"), "click", { target: $("pclear") });
pick({ name: "photo.heic", type: "image/heic", size: 100, _dataUri: "data:image/heic;base64,broken" });
await tick();
ok("HEIC: показана подсказка про PNG/JPG", /Не удалось прочитать/.test($("imgmsg").textContent));
ok("HEIC: превью нет, кнопка выключена", $("preview").style.display === "none" && $("go").disabled === true);

// 6) Вставка Ctrl+V: files из буфера + getAsFile() === null не роняет скрипт (№4)
for (const fn of docListeners.paste || []) {
  fn({ clipboardData: { files: [validPng], items: [] }, preventDefault() {} });
}
await tick();
ok("Ctrl+V добавляет скриншот", $("preview").style.display === "block" && $("go").disabled === false);

let pasteThrew = false;
try {
  for (const fn of docListeners.paste || []) {
    fn({
      clipboardData: { files: [], items: [{ type: "image/png", getAsFile: () => null }] },
      preventDefault() {},
    });
  }
} catch (_) {
  pasteThrew = true;
}
ok("Ctrl+V с null из getAsFile() не падает", !pasteThrew);

// 7) Перетаскивание, где картинка есть только в dataTransfer.items
fire($("pclear"), "click", { target: $("pclear") });
fire($("drop"), "drop", {
  target: $("drop"),
  dataTransfer: {
    files: [],
    items: [{ kind: "file", type: "image/png", getAsFile: () => validPng }],
  },
});
await tick();
ok("drop через dataTransfer.items добавляет скриншот", $("preview").style.display === "block" && $("go").disabled === false);

// 8) Клик по зоне открывает выбор файла.
// Зона загрузки — <label for="file">: диалог открывает САМ БРАУЗЕР, без JS.
// Программный .click() по полю с display:none часть браузеров игнорирует —
// клик выглядел как «ничего не происходит». Эмулируем поведение браузера:
// клик по label активирует связанное поле файла.
fire($("drop"), "click", { target: $("drop") });
const labelLinked = /<label[^>]*id="drop"[^>]*for="file"/.test(source);
const inputHiddenNotNone = !/#file\s*\{\s*display\s*:\s*none/.test(source);
ok("зона загрузки связана с полем файла через <label for>", labelLinked);
ok("поле файла не спрятано через display:none", inputHiddenNotNone);
if (labelLinked) fileEl.click(); // нативная активация label браузером
ok("клик по зоне загрузки открывает диалог файла", fileEl._clicks > 0);

// 9) Enter по зоне (клавиатура) тоже открывает выбор файла — JS-путь
const clicksBefore = fileEl._clicks;
fire($("drop"), "keydown", { target: $("drop"), key: "Enter" });
ok("Enter по зоне загрузки открывает диалог файла", fileEl._clicks > clicksBefore);

const failed = checks.filter(([, c]) => !c).length;
for (const [name, c] of checks) if (c) console.log("✔ " + name);
console.log(`\nUpload smoke: ${checks.length - failed} ок, ${failed} провалено.`);
process.exit(failed ? 1 : 0);
