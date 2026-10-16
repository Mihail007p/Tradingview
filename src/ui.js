/**
 * Single-page UI. Served as a string from the Worker (no build step, no CDN).
 * Client JS avoids template literals so this file stays a clean JS template string.
 */

export function ui() {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pocket Options Analyst — ИИ-разбор графиков</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234c8dff'/%3E%3Cpath d='M6 22l6-7 5 4 9-11' stroke='%23fff' stroke-width='2.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
  :root{
    --bg:#0b0e13; --panel:#121722; --panel2:#171d2b; --line:#232b3b;
    --text:#e6ecf5; --muted:#8b97ad; --dim:#5d6879;
    --green:#26d07c; --red:#ff5c6c; --amber:#ffb020; --blue:#4c8dff; --violet:#a97bff;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background:radial-gradient(1200px 600px at 80% -10%,#16203a 0%,transparent 60%),var(--bg);
    color:var(--text);
    font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Arial,sans-serif;
    min-height:100vh;
  }
  a{color:var(--blue)}
  .wrap{max-width:1180px;margin:0 auto;padding:20px 18px 60px}

  header.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:6px 0 18px}
  .logo{
    width:38px;height:38px;border-radius:10px;display:grid;place-items:center;
    background:linear-gradient(135deg,var(--blue),var(--violet));font-size:19px;
    box-shadow:0 6px 20px rgba(76,141,255,.28)
  }
  h1{font-size:19px;margin:0;letter-spacing:.2px}
  .sub{color:var(--muted);font-size:12.5px;margin-top:2px}
  .spacer{flex:1}
  .pill{
    display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);
    background:var(--panel);border:1px solid var(--line);padding:6px 11px;border-radius:999px
  }
  .keypill{
    font:inherit;font-size:12px;color:var(--text);
    background:var(--panel);border:1px solid var(--line);padding:6px 11px;border-radius:999px;
    width:180px;outline:none
  }
  .keypill::placeholder{color:var(--dim)}
  .keypill:focus{border-color:var(--blue)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--dim)}
  .dot.ok{background:var(--green);box-shadow:0 0 0 4px rgba(38,208,124,.15)}
  .dot.bad{background:var(--red);box-shadow:0 0 0 4px rgba(255,92,108,.15)}
  .dot.load{background:var(--amber);animation:pulse 1s infinite}
  .dot.warn{background:var(--amber);box-shadow:0 0 0 4px rgba(255,176,32,.15)}
  @keyframes pulse{50%{opacity:.35}}

  .tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:0}
  .tab{
    background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);
    font:inherit;font-size:14px;padding:10px 16px;cursor:pointer;border-radius:6px 6px 0 0
  }
  .tab:hover{color:var(--text);background:rgba(255,255,255,.03)}
  .tab.on{color:var(--text);border-bottom-color:var(--blue)}

  .grid{display:grid;grid-template-columns:400px 1fr;gap:18px;align-items:start}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}

  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
  .card + .card{margin-top:14px}
  .card h3{margin:0 0 12px;font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);font-weight:600}

  .drop{
    display:block;
    border:1.5px dashed var(--line);border-radius:12px;padding:26px 16px;text-align:center;
    cursor:pointer;transition:.15s;background:var(--panel2)
  }
  .drop:hover,.drop.over{border-color:var(--blue);background:rgba(76,141,255,.07)}
  .drop:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
  .drop .ico{font-size:28px;margin-bottom:8px;opacity:.85}
  .drop b{display:block;font-size:14px}
  .drop span{color:var(--muted);font-size:12px}
  /* НЕ display:none: ряд браузеров (Safari, встроенные браузеры) игнорируют
     программный .click() по полю с display:none — диалог выбора не открывается
     и «ничего не происходит». Поле остаётся в потоке, но невидимо. */
  #file{
    position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;
    clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0
  }
  .preview{margin-top:12px;position:relative;display:none}
  .preview img{width:100%;border-radius:10px;border:1px solid var(--line);display:block;max-height:340px;object-fit:contain;background:#000}
  .preview button{
    position:absolute;top:8px;right:8px;background:rgba(0,0,0,.72);border:1px solid var(--line);
    color:#fff;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:15px;line-height:1
  }

  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  label.f{display:block;margin-bottom:11px}
  label.f span{display:block;font-size:11.5px;color:var(--muted);margin-bottom:5px;letter-spacing:.3px}
  input,select,textarea{
    width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);
    border-radius:9px;padding:9px 11px;font:inherit;font-size:13.5px;outline:none
  }
  input:focus,select:focus,textarea:focus{border-color:var(--blue)}
  textarea{resize:vertical;min-height:62px}
  .seg{display:flex;gap:6px}
  .seg button{
    flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--muted);
    padding:9px;border-radius:9px;cursor:pointer;font:inherit;font-size:13px
  }
  .seg button.on{background:rgba(76,141,255,.16);border-color:var(--blue);color:var(--text)}

  .btn{
    width:100%;padding:12px;border:0;border-radius:10px;cursor:pointer;font:inherit;font-weight:600;
    font-size:14.5px;background:linear-gradient(135deg,var(--blue),var(--violet));color:#fff;
    display:flex;align-items:center;justify-content:center;gap:9px
  }
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn.ghost{background:var(--panel2);border:1px solid var(--line);color:var(--text);font-weight:500}
  .btn.sm{width:auto;padding:8px 14px;font-size:13px}

  .empty{
    text-align:center;padding:56px 20px;color:var(--dim);
    border:1px dashed var(--line);border-radius:14px;background:var(--panel)
  }
  .empty .ico{font-size:40px;opacity:.5;margin-bottom:12px}

  .verdict{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px}
  .badge{
    font-weight:800;font-size:15px;letter-spacing:1.2px;padding:9px 18px;border-radius:10px;text-transform:uppercase
  }
  .badge.call{background:rgba(38,208,124,.15);color:var(--green);border:1px solid rgba(38,208,124,.4)}
  .badge.put{background:rgba(255,92,108,.15);color:var(--red);border:1px solid rgba(255,92,108,.4)}
  .badge.none{background:rgba(255,176,32,.13);color:var(--amber);border:1px solid rgba(255,176,32,.4)}
  .meta{display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-size:11.5px;color:var(--muted);background:var(--panel2);border:1px solid var(--line);padding:4px 10px;border-radius:999px;font-family:var(--mono)}

  .conf{display:flex;align-items:center;gap:10px;margin:14px 0}
  .bar{flex:1;height:7px;background:var(--panel2);border-radius:99px;overflow:hidden;border:1px solid var(--line)}
  .bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--amber),var(--green))}
  .conf b{font-family:var(--mono);font-size:13px;min-width:78px;text-align:right;color:var(--muted)}

  .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;margin-bottom:14px}
  .kv div{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 11px}
  .kv span{display:block;font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.5px}
  .kv b{font-family:var(--mono);font-size:14.5px;font-weight:600}
  .g{color:var(--green)} .r{color:var(--red)} .a{color:var(--amber)} .b{color:var(--blue)}

  .sec{margin-top:16px}
  .sec h4{margin:0 0 8px;font-size:11.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--dim)}
  .sec p{margin:0;color:#cdd7e6;font-size:13.5px}
  ul.list{margin:0;padding-left:18px;color:#cdd7e6;font-size:13.5px}
  ul.list li{margin:3px 0}
  .tags{display:flex;flex-wrap:wrap;gap:6px}
  .tag{font-size:12px;background:rgba(169,123,255,.12);border:1px solid rgba(169,123,255,.32);color:#cbb4ff;padding:4px 10px;border-radius:7px}

  table{width:100%;border-collapse:collapse;font-size:13px}
  th{
    text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim);
    font-weight:600;padding:8px 9px;border-bottom:1px solid var(--line)
  }
  td{padding:9px;border-bottom:1px solid var(--line);vertical-align:middle}
  tr:last-child td{border-bottom:0}
  td.num{font-family:var(--mono)}
  .tstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:9px;margin-bottom:16px}
  .tstats div{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px}
  .tstats span{display:block;font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.4px}
  .tstats b{font-family:var(--mono);font-size:16px}

  .warn{
    background:rgba(255,176,32,.09);border:1px solid rgba(255,176,32,.3);color:#ffd88a;
    border-radius:10px;padding:9px 12px;font-size:12.5px;margin-top:9px
  }
  .err{
    background:rgba(255,92,108,.1);border:1px solid rgba(255,92,108,.35);color:#ffb3ba;
    border-radius:10px;padding:12px;font-size:13px
  }
  .err pre{margin:8px 0 0;font-size:11px;color:var(--muted);white-space:pre-wrap;word-break:break-word}

  .foot{margin-top:22px;text-align:center;color:var(--dim);font-size:11.5px;line-height:1.7}
  .hide{display:none!important}
  .spin{
    width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
    border-radius:50%;animation:sp .7s linear infinite;display:inline-block
  }
  @keyframes sp{to{transform:rotate(360deg)}}
  .acts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
  .acts .btn{width:auto}
  .model{font-family:var(--mono);font-size:11px;color:var(--dim)}
  .closeRow{display:flex;gap:6px;align-items:center}
  .closeRow input{width:88px;padding:6px 8px;font-size:12.5px}
  .mini{
    padding:6px 10px;font-size:12px;border-radius:8px;cursor:pointer;font:inherit;
    background:var(--panel2);border:1px solid var(--line);color:var(--text)
  }
  .mini:hover{border-color:var(--blue)}
  .mini.danger:hover{border-color:var(--red);color:var(--red)}
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <div class="logo">📈</div>
    <div>
      <h1>Pocket Options Analyst</h1>
      <div class="sub">ИИ-разбор графиков для бинарных опционов · Pocket Options</div>
    </div>
    <div class="spacer"></div>
    <input id="accessKey" type="password" class="keypill" placeholder="Ключ доступа" autocomplete="off" spellcheck="false">
    <div class="pill"><i class="dot" id="dot"></i><span id="status">проверка…</span></div>
  </header>

  <div class="tabs">
    <button class="tab on" data-tab="analyze">Анализ</button>
    <button class="tab" data-tab="journal">Журнал сделок <span id="jcount" class="chip"></span></button>
  </div>

  <!-- ============ ANALYZE ============ -->
  <section id="tab-analyze">
    <div class="grid">
      <div>
        <div class="card">
          <h3>Скриншот графика</h3>
          <label class="drop" id="drop" for="file" role="button" tabindex="0" aria-label="Добавить скриншот графика">
            <div class="ico">🖼️</div>
            <b>Перетащи сюда скриншот</b>
            <span>или кликни · или вставь Ctrl+V</span>
            <span style="display:block;margin-top:4px">PNG, JPG или WebP</span>
            <input type="file" id="file" accept="image/*">
          </label>
          <div class="preview" id="preview">
            <img id="pimg" alt="предпросмотр">
            <button id="pclear" title="Убрать">✕</button>
          </div>
          <div class="err hide" id="imgmsg" role="alert" style="margin-top:10px"></div>
        </div>

        <div class="card">
          <h3>Параметры</h3>
          <div class="row">
            <label class="f"><span>Актив</span>
              <select id="market">
                <option value="">Определить по графику</option>
                <option value="forex">Валютные пары</option>
                <option value="otc">OTC-пары (выходные)</option>
                <option value="crypto">Криптовалюта</option>
                <option value="stocks">Акции</option>
                <option value="indices">Индексы / металлы</option>
              </select>
            </label>
            <label class="f"><span>Экспирация</span>
              <select id="expiry">
                <option value="">Выбрать по графику</option>
                <option value="15s">15 сек</option>
                <option value="30s">30 сек</option>
                <option value="1m">1 мин</option>
                <option value="2m">2 мин</option>
                <option value="3m">3 мин</option>
                <option value="5m">5 мин</option>
                <option value="10m">10 мин</option>
                <option value="15m">15 мин</option>
                <option value="30m">30 мин</option>
                <option value="1h">1 час</option>
              </select>
            </label>
          </div>

          <div class="row">
            <label class="f"><span>Депозит ($)</span><input id="balance" type="number" value="1000" min="0" step="any"></label>
            <label class="f"><span>Ставка (% депозита)</span><input id="stake" type="number" value="2" min="0.1" max="100" step="0.1"></label>
          </div>

          <label class="f"><span>Выплата брокера (%)</span><input id="payout" type="number" value="85" min="1" max="200" step="1"></label>

          <label class="f"><span>Скорость анализа</span>
            <select id="mode">
              <option value="fast">Быстрый — сразу отвечает (по умолчанию)</option>
              <option value="deep">Глубокий — с рассуждениями, медленнее</option>
            </select>
          </label>

          <label class="f"><span>Вопрос к графику (необязательно)</span>
            <textarea id="question" placeholder="Например: стоит ли входить от уровня 0.618? Или: жду ретест пробитого уровня — подтверди."></textarea>
          </label>

          <button class="btn" id="go" disabled>Проанализировать</button>
        </div>
      </div>

      <div>
        <div class="card">
          <h3>Результат</h3>
          <div id="result">
            <div class="empty">
              <div class="ico">🔍</div>
              <div>Загрузи скриншот графика,<br>чтобы получить разбор</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ JOURNAL ============ -->
  <section id="tab-journal" class="hide">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <h3 style="margin:0">Статистика</h3>
        <button class="mini danger" id="jclear">Очистить журнал</button>
      </div>
      <div class="tstats" id="stats" style="margin-top:12px"></div>
      <div id="jlist"></div>
    </div>
  </section>

  <div class="foot">
    Бот даёт технический анализ на основе визуального разбора графика. Это не финансовая рекомендация.<br>
    Управление риском и ответственность за сделки остаются на тебе.
  </div>
</div>

<script>
(function(){
  "use strict";

  function $(id){ return document.getElementById(id); }

  var API = location.origin;

  // Доступ к localStorage обёрнут в try/catch: в приватном режиме, при
  // заблокированных cookies и во встроенных браузерах он БРОСАЕТ исключение.
  // Раньше голый localStorage.getItem стоял в самом начале скрипта — и при
  // броске умирал ВЕСЬ интерфейс: клик по скриншоту «ничего не делал»,
  // а введённый пароль никуда не применялся.
  function storeGet(k){
    try { return localStorage.getItem(k); } catch(_){ return null; }
  }
  function storeSet(k, v){
    try { localStorage.setItem(k, v); } catch(_){}
  }
  function storeRemove(k){
    try { localStorage.removeItem(k); } catch(_){}
  }

  var KEY = (new URLSearchParams(location.search).get("key") || storeGet("ca_key") || "").trim();
  if (KEY) storeSet("ca_key", KEY);
  var state = { image:null, result:null };

  // ---------- access key field ----------
  // ВАЖНО: $() объявлена выше — раньше вызов $("accessKey") шёл до её
  // присваивания и весь скрипт падал с TypeError: $ is not a function,
  // из-за чего кнопки/табы/журнал не работали вообще.
  var $key = $("accessKey");

  function needKey(){
    if (!$key) return;
    $key.focus();
    $key.placeholder = "Введи ключ доступа (иначе будет локальный режим)";
    $key.style.borderColor = "var(--red)";
    setTimeout(function(){ $key.style.borderColor = ""; }, 2500);
  }

  if ($key) {
    $key.value = KEY;
    var keyTimer = null;
    var onKeyChanged = function(){
      KEY = $key.value.trim();
      if (KEY) storeSet("ca_key", KEY);
      else storeRemove("ca_key");
      // Раньше здесь вызывался только health(), который ключ не проверял:
      // журнал при первой загрузке без ключа уже успевал навсегда уйти в
      // локальный режим (401), и правильный пароль, введённый после этого,
      // «не работал» до перезагрузки страницы. Теперь смена ключа сбрасывает
      // локальный режим и заново проверяет сервер: ключ + журнал.
      if (keyTimer) clearTimeout(keyTimer);
      keyTimer = setTimeout(function(){
        journalLocal = false;
        journalReason = "";
        health();
        loadJournal();
      }, 400);
    };
    // "change" — в дополнение к "input": автозаполнение и менеджеры паролей
    // в части браузеров меняют значение без события input.
    $key.addEventListener("input", onKeyChanged);
    $key.addEventListener("change", onKeyChanged);
  }

  function hdr(extra){
    var h = { "Content-Type":"application/json" };
    if (KEY) h["X-Api-Key"] = KEY;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function fmt(n, d){
    if (n === null || n === undefined || isNaN(n)) return "—";
    var x = Number(n);
    if (Math.abs(x) >= 1000) return x.toLocaleString("ru-RU", {maximumFractionDigits:2});
    return x.toFixed(d === undefined ? 2 : d);
  }

  // ---------- tabs ----------
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(t){
    t.addEventListener("click", function(){
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(x){ x.classList.remove("on"); });
      t.classList.add("on");
      var name = t.getAttribute("data-tab");
      $("tab-analyze").classList.toggle("hide", name !== "analyze");
      $("tab-journal").classList.toggle("hide", name !== "journal");
      if (name === "journal") loadJournal();
    });
  });

  // ---------- health ----------
  function health(){
    fetch(API + "/api/health", { headers: hdr() })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var model = (d.model || "").replace("@cf/meta/","");
        // Сервер теперь сообщает, принят ли присланный ключ (keyValid).
        // Раньше статус при любом пароле показывал «онлайн», и понять,
        // что пароль не подошёл, было невозможно.
        if (d.auth && !d.keyValid){
          $("dot").className = "dot bad";
          $("status").textContent = KEY ? "неверный ключ доступа" : "нужен ключ доступа";
          return;
        }
        var keyNote = d.auth ? " · ключ принят" : "";
        if (journalLocal){
          // статус уже показывает локальный журнал — не перетираем
          $("dot").className = "dot warn";
          $("status").textContent = "онлайн · " + model + keyNote + " · журнал локально";
          return;
        }
        $("dot").className = "dot ok";
        $("status").textContent = d.journal
          ? "онлайн · " + model + keyNote
          : "онлайн · журнал локально (KV не подключён)" + keyNote;
        if (!d.journal) $("dot").className = "dot warn";
      })
      .catch(function(){
        $("dot").className = "dot bad";
        $("status").textContent = "сервер недоступен";
      });
  }
  health();

  // ---------- image input ----------
  // Раньше добавление скриншота падало молча сразу в нескольких местах,
  // и пользователь видел только «ничего не произошло»:
  //  1) <input type=file> не сбрасывался: после удаления скриншота (✕)
  //     повторный выбор ТОГО ЖЕ файла не вызывал change — добавить заново
  //     было нельзя;
  //  2) у скриншотов из перетаскивания/буфера обмена MIME-тип часто пуст —
  //     такой файл молча отбрасывался проверкой f.type;
  //  3) при ошибке декодирования (HEIC и т.п.) исходник уходил в модель
  //     как есть, превью не показывалось, а ошибки не было видно.
  // Теперь каждое падение показывает понятную подсказку в #imgmsg.
  function showImageError(msg){
    var box = $("imgmsg");
    if (!box) return;
    box.textContent = msg;
    box.classList.remove("hide");
  }
  function clearImageError(){
    var box = $("imgmsg");
    if (!box) return;
    box.textContent = "";
    box.classList.add("hide");
  }

  function looksLikeImage(f){
    if (!f) return false;
    if (f.type && f.type.indexOf("image/") === 0) return true;
    if (/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(String(f.name || ""))) return true;
    // тип пуст (drag-and-drop, буфер обмена) — даём шанс декодировщику
    return !f.type || f.type === "application/octet-stream";
  }

  function resizeImage(file, cb, eb){
    var reader = new FileReader();
    reader.onload = function(e){
      var original = e.target && e.target.result;
      if (!original){ if (eb) eb(new Error("empty read")); return; }
      var img = new Image();
      img.onload = function(){
        try {
          // 1280px достаточно для читаемости графика, но заметно быстрее для
          // vision-модели, чем большие скриншоты (меньше пикселей → быстрее предобработка).
          var MAX = 1280;
          var w = img.width, h = img.height;
          if (!w || !h) throw new Error("zero size");
          var scale = Math.min(1, MAX / Math.max(w, h));
          var cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
          var c = document.createElement("canvas");
          c.width = cw; c.height = ch;
          var ctx = c.getContext && c.getContext("2d");
          if (!ctx){ cb(original); return; }
          ctx.fillStyle = "#000"; ctx.fillRect(0,0,cw,ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          cb(c.toDataURL("image/jpeg", 0.82));
        } catch (err) {
          if (eb) eb(err);
        }
      };
      img.onerror = function(){ if (eb) eb(new Error("decode failed")); };
      img.src = original;
    };
    reader.onerror = function(){ if (eb) eb(new Error("read failed")); };
    reader.readAsDataURL(file);
  }

  function setImage(dataUri){
    state.image = dataUri;
    $("pimg").src = dataUri;
    $("preview").style.display = "block";
    $("go").disabled = false;
    clearImageError();
  }

  function rejectImage(){
    state.image = null;
    $("preview").style.display = "none";
    $("pimg").src = "";
    $("go").disabled = true;
    showImageError("Не удалось прочитать эту картинку. Если это HEIC/HEIF с телефона — " +
      "пересохрани её как PNG или JPG (или сделай скриншот заново) и попробуй ещё раз.");
  }

  function handleFiles(files){
    var f = files && files[0];
    if (!f) return;
    if (f.size === 0){
      showImageError("Файл пустой — скриншот не сохранился. Сделай скриншот ещё раз.");
      return;
    }
    if (!looksLikeImage(f)){
      showImageError("Это не картинка" + (f.type ? " (" + f.type + ")" : "") +
        ". Нужен скриншот графика в формате PNG, JPG или WebP.");
      return;
    }
    clearImageError();
    resizeImage(f, setImage, rejectImage);
  }

  var drop = $("drop");
  var fileInput = $("file");
  function openPicker(){
    // сброс ДО открытия: иначе повторный выбор того же файла не даст change
    fileInput.value = "";
    fileInput.click();
  }
  // Клик мышью открывает диалог БЕЗ JavaScript: зона загрузки — это
  // <label for="file">, и браузер сам «нажимает» поле файла. Программный
  // fileInput.click() по полю с display:none ряд браузеров игнорирует —
  // клик по зоне выглядел как «ничего не происходит». JS-открытие осталось
  // только для клавиатуры (Enter/Space) и клика по превью (заменить снимок).
  drop.addEventListener("keydown", function(e){
    if (e.key === "Enter" || e.key === " "){ e.preventDefault(); openPicker(); }
  });
  $("preview").addEventListener("click", function(e){
    if (e.target && e.target.id === "pclear") return;
    openPicker();
  });
  drop.addEventListener("dragover", function(e){ e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", function(){ drop.classList.remove("over"); });
  drop.addEventListener("drop", function(e){
    e.preventDefault(); drop.classList.remove("over");
    var files = e.dataTransfer && e.dataTransfer.files;
    if ((!files || !files.length) && e.dataTransfer && e.dataTransfer.items){
      // часть браузеров отдаёт перетащенную картинку только через items
      files = [];
      for (var i=0;i<e.dataTransfer.items.length;i++){
        var it = e.dataTransfer.items[i];
        if (it.kind === "file"){ var got = it.getAsFile && it.getAsFile(); if (got) files.push(got); }
      }
    }
    handleFiles(files);
  });
  fileInput.addEventListener("change", function(e){
    try { handleFiles(e.target.files); }
    finally { e.target.value = ""; } // тот же скриншот можно добавить повторно
  });
  $("pclear").addEventListener("click", function(e){
    if (e && e.stopPropagation) e.stopPropagation();
    state.image = null; $("preview").style.display = "none"; $("pimg").src = ""; $("go").disabled = true;
    fileInput.value = "";
    clearImageError();
  });

  document.addEventListener("paste", function(e){
    if (!e.clipboardData) return;
    var pasted = null;
    if (e.clipboardData.files && e.clipboardData.files.length){
      pasted = e.clipboardData.files;
    } else if (e.clipboardData.items){
      for (var i=0;i<e.clipboardData.items.length;i++){
        var item = e.clipboardData.items[i];
        if (item.type && item.type.indexOf("image") === 0){
          pasted = [item.getAsFile && item.getAsFile()]; // getAsFile() бывает null
          break;
        }
      }
    }
    if (!pasted || !pasted[0]) return;
    handleFiles(pasted);
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(x, idx){
      if (idx === 0){ x.click(); }
    });
  });

  // ---------- render ----------
  function directionWord(d){ return d === "call" ? "ВВЕРХ · CALL" : d === "put" ? "ВНИЗ · PUT" : "НЕТ СИГНАЛА"; }
  function trendWord(t){
    return t === "uptrend" ? "Восходящий" : t === "downtrend" ? "Нисходящий" : t === "sideways" ? "Боковик" : "—";
  }

  function esc(s){
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function listBlock(title, items, cls){
    if (!items || !items.length) return "";
    var li = "";
    for (var i=0;i<items.length;i++) li += "<li>" + esc(items[i]) + "</li>";
    return '<div class="sec"><h4>' + title + '</h4><ul class="list">' + li + "</ul></div>";
  }

  function tagsBlock(title, items){
    if (!items || !items.length) return "";
    var s = "";
    for (var i=0;i<items.length;i++) s += '<span class="tag">' + esc(items[i]) + "</span>";
    return '<div class="sec"><h4>' + title + '</h4><div class="tags">' + s + "</div></div>";
  }

  function renderResult(d){
    var a = d.analysis, s = a.signal;
    var cls = s.direction === "call" ? "g" : s.direction === "put" ? "r" : "a";

    var html = '<div class="verdict">'
      + '<span class="badge ' + s.direction + '">' + directionWord(s.direction) + "</span>"
      + '<div class="meta">'
      + (a.instrument ? '<span class="chip">' + esc(a.instrument) + "</span>" : "")
      + (a.timeframe ? '<span class="chip">' + esc(a.timeframe) + "</span>" : "")
      + '<span class="chip">' + trendWord(a.trend) + (a.trend_strength ? " · " + esc(a.trend_strength) : "") + "</span>"
      + (a.market ? '<span class="chip">' + esc(a.market) + "</span>" : "")
      + (s.expiry ? '<span class="chip">⏱ экспирация ' + esc(s.expiry) + "</span>" : "")
      + "</div></div>";

    html += '<div class="conf"><span style="font-size:11.5px;color:var(--muted)">УВЕРЕННОСТЬ</span>'
      + '<div class="bar"><i style="width:' + s.confidence + '%"></i></div>'
      + "<b>" + s.confidence + "%</b></div>";

    if (s.direction !== "none"){
      html += '<div class="kv">'
        + '<div><span>Вход (цена)</span><b>' + fmt(s.entry) + "</b></div>"
        + '<div><span>Экспирация</span><b class="b">' + esc(s.expiry || "—") + "</b></div>"
        + '<div><span>Направление</span><b class="' + (s.direction === "call" ? "g" : "r") + '">' + (s.direction === "call" ? "CALL ↑" : "PUT ↓") + "</b></div>"
        + "</div>";
    }

    var sup = (a.levels && a.levels.support) || [];
    var res = (a.levels && a.levels.resistance) || [];
    if (sup.length || res.length){
      html += '<div class="kv">'
        + '<div><span>Поддержка</span><b class="g">' + (sup.length ? sup.map(function(x){return fmt(x);}).join(" / ") : "—") + "</b></div>"
        + '<div><span>Сопротивление</span><b class="r">' + (res.length ? res.map(function(x){return fmt(x);}).join(" / ") : "—") + "</b></div>"
        + "</div>";
    }

    if (a.summary) html += '<div class="sec"><h4>Разбор</h4><p>' + esc(a.summary) + "</p></div>";

    html += tagsBlock("Паттерны и формации", a.patterns);
    html += tagsBlock("Индикаторы / что видно", a.indicators);
    html += listBlock("Риски", a.risks);
    html += listBlock("Что отменит сценарий", a.invalidations);

    if (d.sizing){
      var z = d.sizing;
      html += '<div class="sec"><h4>Ставка</h4><div class="kv">'
        + '<div><span>Сумма ставки</span><b class="a">$' + fmt(z.stake) + "</b></div>"
        + '<div><span>Выигрыш</span><b class="g">+$' + fmt(z.potentialProfit) + "</b></div>"
        + '<div><span>Проигрыш</span><b class="r">−$' + fmt(z.potentialLoss) + "</b></div>"
        + '<div><span>Break-even</span><b>' + fmt(z.breakEvenWinRate) + "%</b></div>"
        + "</div></div>";
    }

    if (a.recommendation) html += '<div class="sec"><h4>Итог</h4><p>' + esc(a.recommendation) + "</p></div>";

    var warns = d.warnings || [];
    for (var i=0;i<warns.length;i++){
      html += '<div class="warn">⚠ ' + esc(warns[i]) + "</div>";
    }

    html += '<div class="acts">'
      + '<button class="btn ghost sm" id="save">＋ В журнал</button>'
      + '<button class="btn ghost sm" id="again">↻ Повторить анализ</button>'
      + "</div>";

    var took = d.ms ? " · " + (Math.round(d.ms / 100) / 10) + " с" : "";
    html += '<div class="model" style="margin-top:12px">модель: ' + esc(d.model) + took + " · режим: " + (d.mode === "deep" ? "глубокий" : "быстрый") + "</div>";
    if (d.demo) html += '<div class="warn">ДЕМО-режим: анализ сгенерирован заглушкой, без обращения к Workers AI.</div>';

    $("result").innerHTML = html;

    var saveBtn = $("save");
    if (saveBtn) saveBtn.addEventListener("click", function(){ saveTrade(a, d.sizing); });
    var againBtn = $("again");
    if (againBtn) againBtn.addEventListener("click", analyze);
  }

  // ---------- analyze ----------
  // Режим скорости: "fast" — модель отвечает сразу (по умолчанию),
  // "deep" — с внутренними рассуждениями, медленнее. Выбор запоминается.
  (function(){
    var m = $("mode");
    if (!m) return;
    var saved = storeGet("ca_mode");
    if (saved === "deep" || saved === "fast") m.value = saved;
    m.addEventListener("change", function(){ storeSet("ca_mode", m.value); });
  })();

  function analyze(){
    if (!state.image) return;
    var modeEl = $("mode");
    var mode = modeEl && modeEl.value === "deep" ? "deep" : "fast";
    $("go").disabled = true;
    var t0 = Date.now();
    var hint = mode === "deep"
      ? "глубокий режим · обычно 10–30 секунд"
      : "быстрый режим · обычно 3–10 секунд";
    $("result").innerHTML = '<div class="empty"><div class="spin"></div>'
      + '<div style="margin-top:14px" id="waitmsg">Модель читает график…<br><span style="font-size:12px">'
      + hint + "</span></div></div>";
    var waitTimer = setInterval(function(){
      var el = document.getElementById("waitmsg");
      if (!el){ clearInterval(waitTimer); return; }
      var sec = Math.round((Date.now() - t0) / 1000);
      el.innerHTML = "Модель читает график… " + sec + " с<br><span style=\"font-size:12px\">" + hint + "</span>";
    }, 500);

    var payload = {
      image: state.image,
      question: $("question").value,
      market: $("market").value,
      expiry: $("expiry").value,
      payout: Number($("payout").value) || 85,
      balance: Number($("balance").value) || 0,
      stakePct: Number($("stake").value) || 0,
      mode: mode
    };

    fetch(API + "/api/analyze", { method:"POST", headers: hdr(), body: JSON.stringify(payload) })
      .then(function(r){ return r.json().then(function(j){ return { status:r.status, body:j }; }); })
      .then(function(res){
        var d = res.body;
        if (!d.ok){
          if (res.status === 401){
            needKey();
          }
          var msg = '<div class="err"><b>'
            + (res.status === 401 ? "Нужен ключ доступа" : "Не удалось разобрать график")
            + '</b><div style="margin-top:6px">'
            + esc(d.error || "неизвестная ошибка") + "</div>";
          if (d.details && d.details.length){
            msg += "<pre>" + esc(d.details.join("\\n")) + "</pre>";
          }
          msg += "</div>";
          $("result").innerHTML = msg;
          return;
        }
        state.result = d;
        renderResult(d);
      })
      .catch(function(e){
        $("result").innerHTML = '<div class="err"><b>Ошибка сети</b><div style="margin-top:6px">' + esc(String(e)) + "</div></div>";
      })
      .then(function(){ clearInterval(waitTimer); $("go").disabled = false; });
  }

  $("go").addEventListener("click", analyze);

  // ---------- journal ----------
  // Журнал живёт на сервере (Cloudflare KV). Если KV не привязан или ключ
  // доступа не подошёл — автоматически переключаемся на локальный журнал
  // в localStorage, чтобы кнопка «Сохранить сделку» и статистика работали.
  var LOCAL_KEY = "ca_journal_v1";
  var journalLocal = false;
  var journalReason = "";

  function lsAll(){
    try {
      var a = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch(_){ return []; }
  }
  function lsSorted(){
    return lsAll().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
  }
  function lsPersist(entries){
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0,500))); } catch(_){}
  }
  // зеркало journalStats() из src/sizing.js
  function lsStats(entries){
    entries = entries || [];
    var closed = entries.filter(function(e){ return e.status && e.status !== "open"; });
    var wins = closed.filter(function(e){ return e.status === "win"; });
    var losses = closed.filter(function(e){ return e.status === "loss"; });
    var bes = closed.filter(function(e){ return e.status === "breakeven"; });
    var rs = closed.map(function(e){ return Number(e.resultR); }).filter(function(x){ return isFinite(x); });
    var totalR = rs.reduce(function(a,x){ return a+x; }, 0);
    var pnl = closed.map(function(e){ return Number(e.resultPnl); }).filter(function(x){ return isFinite(x); });
    var totalPnl = pnl.reduce(function(a,x){ return a+x; }, 0);
    var avgWin = wins.length ? wins.reduce(function(a,e){ return a + Number(e.resultR||0); },0)/wins.length : 0;
    var avgLoss = losses.length ? losses.reduce(function(a,e){ return a + Number(e.resultR||0); },0)/losses.length : 0;
    var r2 = function(x){ return Math.round(x*100)/100; };
    return {
      total: entries.length,
      open: entries.filter(function(e){ return e.status === "open"; }).length,
      closed: closed.length,
      wins: wins.length,
      losses: losses.length,
      breakeven: bes.length,
      winRate: closed.length ? r2((wins.length/closed.length)*100) : 0,
      totalR: r2(totalR),
      totalPnl: r2(totalPnl),
      avgR: closed.length ? r2(totalR/closed.length) : 0,
      avgWin: r2(avgWin),
      avgLoss: r2(avgLoss),
      expectancy: closed.length ? r2(totalR/closed.length) : 0,
      bestR: rs.length ? Math.max.apply(null, rs) : 0,
      worstR: rs.length ? Math.min.apply(null, rs) : 0
    };
  }
  function newLocalId(){
    return "l_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
  }
  function lsAdd(trade){
    var rec = { id: newLocalId(), status: "open", createdAt: Date.now() };
    for (var k in trade) if (trade[k] !== undefined) rec[k] = trade[k];
    rec.status = "open";
    var all = lsAll();
    all.unshift(rec);
    lsPersist(all);
    return rec;
  }
  // зеркало computeClose() из src/sizing.js
  function lsClose(id, exitPrice){
    var exit = Number(exitPrice);
    var all = lsAll();
    for (var i=0;i<all.length;i++){
      if (all[i].id !== id) continue;
      var t = all[i];
      var entry = Number(t.entry);
      if (!isFinite(entry) || !isFinite(exit) || entry <= 0 || exit <= 0) return false;
      var dir = (t.direction === "put" || t.direction === "short") ? "put" : "call";
      var stake = Number(t.stake) || 0;
      var payout = Number(t.payout) || 85;
      var status = exit === entry ? "breakeven" : ((dir === "call" && exit > entry) || (dir === "put" && exit < entry)) ? "win" : "loss";
      var resultR = status === "win" ? payout / 100 : status === "loss" ? -1 : 0;
      var resultPnl = status === "win" ? stake * payout / 100 : status === "loss" ? -stake : 0;
      t.exitPrice = exit;
      t.status = status;
      t.resultR = Math.round(resultR * 100) / 100;
      t.resultPnl = Math.round(resultPnl * 100) / 100;
      t.closedAt = Date.now();
      lsPersist(all);
      return true;
    }
    return false;
  }
  function lsRemove(id){
    lsPersist(lsAll().filter(function(t){ return t.id !== id; }));
  }
  function lsClear(){ lsPersist([]); }

  function useLocalJournal(reason){
    if (journalLocal) return;
    journalLocal = true;
    journalReason = reason || "серверный журнал недоступен";
    var $st = $("status");
    if ($st) $st.textContent = "журнал локально · " + journalReason;
    var $dot = $("dot");
    if ($dot) $dot.className = "dot warn";
  }

  // один общий запрос: всегда отдаёт { status, body }, без падений на не-JSON
  function jf(method, url, body){
    var opts = { method: method || "GET", headers: hdr() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(API + url, opts)
      .then(function(r){
        return r.json()
          .catch(function(){ return { ok:false, error:"Сервер вернул не JSON (HTTP " + r.status + ")" }; })
          .then(function(j){ return { status: r.status, body: j }; });
      })
      .catch(function(e){ return { status: 0, body: { ok:false, error:"Сеть недоступна: " + e } }; });
  }

  function saveTrade(a, sizing){
    var trade = {
      instrument: a.instrument || "—",
      timeframe: a.timeframe || "—",
      direction: a.signal.direction,
      entry: a.signal.entry,
      expiry: a.signal.expiry,
      confidence: a.signal.confidence,
      stake: sizing ? sizing.stake : null,
      payout: Number($("payout").value) || 85,
      balance: Number($("balance").value) || null,
      stakePct: Number($("stake").value) || null,
      summary: a.summary || ""
    };
    if (journalLocal){ lsAdd(trade); afterSave(); return; }
    jf("POST", "/api/journal", trade).then(function(res){
      if (res.status === 401){ needKey(); useLocalJournal("нужен ключ доступа к серверному журналу"); lsAdd(trade); afterSave(); return; }
      if (res.status === 503){ useLocalJournal("на сервере не подключён KV"); lsAdd(trade); afterSave(); return; }
      if (res.body && res.body.ok){ afterSave(); return; }
      alert("Ошибка сохранения: " + ((res.body && res.body.error) || "?"));
    });
  }

  function afterSave(){
    loadJournal();
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(t){
      if (t.getAttribute("data-tab") === "journal") t.click();
    });
  }

  function closeTrade(id, price){
    if (journalLocal){ lsClose(id, price); loadJournal(); return; }
    jf("PATCH", "/api/journal?id=" + encodeURIComponent(id), { exitPrice: Number(price) }).then(function(res){
      if (res.status === 401 || res.status === 503){
        useLocalJournal(res.status === 401 ? "нужен ключ доступа к серверному журналу" : "на сервере не подключён KV");
        lsClose(id, price); loadJournal(); return;
      }
      if (!res.body || !res.body.ok) alert("Ошибка: " + ((res.body && res.body.error) || "?"));
      else loadJournal();
    });
  }

  function delTrade(id){
    if (journalLocal){ lsRemove(id); loadJournal(); return; }
    jf("DELETE", "/api/journal?id=" + encodeURIComponent(id)).then(function(res){
      if (res.status === 401 || res.status === 503){
        useLocalJournal(res.status === 401 ? "нужен ключ доступа к серверному журналу" : "на сервере не подключён KV");
        lsRemove(id); loadJournal(); return;
      }
      loadJournal();
    });
  }

  function clearJournal(){
    if (journalLocal){ lsClear(); loadJournal(); return; }
    jf("DELETE", "/api/journal").then(function(res){
      if (res.status === 401 || res.status === 503){
        useLocalJournal(res.status === 401 ? "нужен ключ доступа к серверному журналу" : "на сервере не подключён KV");
        lsClear();
      }
      loadJournal();
    });
  }

  function statCard(label, value, cls){
    return '<div><span>' + label + '</span><b class="' + (cls || "") + '">' + value + "</b></div>";
  }

  function renderJournal(entries, stats){
    $("jcount").textContent = entries.length ? String(entries.length) : "";

    var note = journalLocal
      ? '<div class="warn" style="margin-bottom:12px">Серверный журнал недоступен'
        + (journalReason ? " (" + esc(journalReason) + ")" : "")
        + ", поэтому сделки сохраняются <b>локально в этом браузере</b> "
        + "и не синхронизируются между устройствами.</div>"
      : "";

    var s = stats || {};
    $("stats").innerHTML = note
      + statCard("Сделок", s.total || 0)
      + statCard("Открыто", s.open || 0, "b")
      + statCard("Винрейт", (s.closed ? (s.winRate + "%") : "—"), s.winRate >= 50 ? "g" : "a")
      + statCard("Прибыль", (s.wins || 0) + " / " + (s.losses || 0))
      + statCard("Σ R", fmt(s.totalR), s.totalR > 0 ? "g" : s.totalR < 0 ? "r" : "")
      + statCard("Σ P&L", (s.totalPnl > 0 ? "+" : "") + fmt(s.totalPnl) + "$", s.totalPnl > 0 ? "g" : s.totalPnl < 0 ? "r" : "")
      + statCard("Ср. R", fmt(s.avgR), s.avgR > 0 ? "g" : s.avgR < 0 ? "r" : "")
      + statCard("Ожидание", fmt(s.expectancy) + "R", s.expectancy > 0 ? "g" : s.expectancy < 0 ? "r" : "")
      + statCard("Лучшая", fmt(s.bestR) + "R", "g")
      + statCard("Худшая", fmt(s.worstR) + "R", "r");

    if (!entries.length){
      $("jlist").innerHTML = '<div class="empty"><div class="ico">📓</div><div>Журнал пуст.<br>'
        + 'Сохрани сделку после анализа, чтобы вести статистику.</div></div>';
      return;
    }

    var rows = "";
    for (var i=0;i<entries.length;i++){
      var t = entries[i];
      var date = new Date(t.createdAt).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
      var stCls = t.status === "win" ? "g" : t.status === "loss" ? "r" : t.status === "open" ? "b" : "a";
      var stTxt = t.status === "win" ? "Вин" : t.status === "loss" ? "Лосс" : t.status === "open" ? "Открыта" : "Б/У";
      var dirCls = t.direction === "call" ? "g" : "r";

      var action = "";
      if (t.status === "open"){
        action = '<div class="closeRow"><input type="number" step="any" placeholder="цена" data-exit="' + t.id + '">'
          + '<button class="mini" data-close="' + t.id + '">Закрыть</button></div>';
      } else {
        action = '<span style="font-family:var(--mono);font-size:12px;color:var(--muted)">'
          + esc(t.exitPrice === null || t.exitPrice === undefined ? "" : t.exitPrice) + "</span>";
      }

      rows += "<tr>"
        + '<td style="color:var(--muted);font-size:12px">' + esc(date) + "</td>"
        + "<td><b>" + esc(t.instrument) + '</b><br><span style="color:var(--dim);font-size:11.5px">' + esc(t.timeframe) + "</span></td>"
        + '<td class="num ' + dirCls + '">' + (t.direction === "call" ? "ВВЕРХ" : "ВНИЗ") + "</td>"
        + '<td class="num">' + fmt(t.entry) + "</td>"
        + '<td class="num">' + esc(t.expiry || "—") + "</td>"
        + '<td class="num">$' + fmt(t.stake) + "</td>"
        + '<td class="num">' + fmt(t.risk_reward) + "</td>"
        + '<td class="num">' + (t.confidence ? t.confidence + "%" : "—") + "</td>"
        + '<td class="num ' + stCls + '"><b>' + stTxt + "</b>"
        + (t.resultR !== null && t.resultR !== undefined ? '<br><span style="font-size:11.5px">' + (t.resultR>0?"+":"") + fmt(t.resultR) + "R</span>" : "")
        + "</td>"
        + "<td>" + action + "</td>"
        + '<td><button class="mini danger" data-del="' + t.id + '">✕</button></td>'
        + "</tr>";
    }

    $("jlist").innerHTML = '<div style="overflow-x:auto"><table><thead><tr>'
      + "<th>Дата</th><th>Актив</th><th>Напр.</th><th>Вход</th><th>Экспир.</th><th>Ставка</th>"
      + "<th>Увер.</th><th>Статус</th><th>Цена на экспирации</th><th></th>"
      + "</tr></thead><tbody>" + rows + "</tbody></table></div>";

    Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function(b){
      b.addEventListener("click", function(){
        var id = b.getAttribute("data-close");
        var inp = document.querySelector('[data-exit="' + id + '"]');
        var price = inp ? inp.value : "";
        if (!price || isNaN(Number(price))) { alert("Введи цену выхода"); return; }

        // защита от опечатки: цена выхода не может быть далеко от входа
        var row = b.closest("tr");
        var entryTxt = row ? row.children[3].textContent.replace(/\\s/g, "").replace(",", ".") : "";
        var entryNum = parseFloat(entryTxt);
        if (isFinite(entryNum) && entryNum > 0) {
          var dev = Math.abs(Number(price) - entryNum) / entryNum;
          if (dev > 0.5 && !confirm("Цена выхода отличается от входа больше чем на 50%. Точно продолжить?")) return;
        }
        closeTrade(id, price);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function(b){
      b.addEventListener("click", function(){
        if (!confirm("Удалить сделку из журнала?")) return;
        delTrade(b.getAttribute("data-del"));
      });
    });
  }

  function loadJournal(){
    if (journalLocal){
      var local = lsSorted();
      renderJournal(local, lsStats(local));
      return;
    }
    jf("GET", "/api/journal").then(function(res){
      if (res.status === 401){ needKey(); useLocalJournal("нужен ключ доступа к серверному журналу"); loadJournal(); health(); return; }
      if (res.status === 503){ useLocalJournal("на сервере не подключён KV"); loadJournal(); return; }
      if (res.status === 0){
        $("jlist").innerHTML = '<div class="err">' + esc((res.body && res.body.error) || "Сеть недоступна") + "</div>";
        return;
      }
      if (res.body && res.body.ok) renderJournal(res.body.entries || [], res.body.stats);
      else $("jlist").innerHTML = '<div class="err">' + esc((res.body && res.body.error) || "Не удалось загрузить журнал") + "</div>";
    });
  }

  loadJournal();

  // ---------- clear journal ----------
  var $jclear = $("jclear");
  if ($jclear){
    $jclear.addEventListener("click", function(){
      if (confirm("Очистить весь журнал? Действие необратимо.")) clearJournal();
    });
  }
})();
</script>
</body>
</html>`;
}
