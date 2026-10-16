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
<title>Chart Analyst — ИИ-разбор графиков</title>
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
    border:1.5px dashed var(--line);border-radius:12px;padding:26px 16px;text-align:center;
    cursor:pointer;transition:.15s;background:var(--panel2)
  }
  .drop:hover,.drop.over{border-color:var(--blue);background:rgba(76,141,255,.07)}
  .drop .ico{font-size:28px;margin-bottom:8px;opacity:.85}
  .drop b{display:block;font-size:14px}
  .drop span{color:var(--muted);font-size:12px}
  #file{display:none}
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
  .badge.long{background:rgba(38,208,124,.15);color:var(--green);border:1px solid rgba(38,208,124,.4)}
  .badge.short{background:rgba(255,92,108,.15);color:var(--red);border:1px solid rgba(255,92,108,.4)}
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
      <h1>Chart Analyst</h1>
      <div class="sub">ИИ-разбор торговых графиков · Cloudflare Workers AI</div>
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
          <div class="drop" id="drop">
            <div class="ico">🖼️</div>
            <b>Перетащи сюда скриншот</b>
            <span>или кликни · или вставь Ctrl+V</span>
          </div>
          <input type="file" id="file" accept="image/*">
          <div class="preview" id="preview">
            <img id="pimg" alt="предпросмотр">
            <button id="pclear" title="Убрать">✕</button>
          </div>
        </div>

        <div class="card">
          <h3>Параметры</h3>
          <label class="f"><span>Рынок</span>
            <select id="market">
              <option value="">Определить по графику</option>
              <option value="crypto">Криптовалюта</option>
              <option value="forex">Форекс / металлы</option>
              <option value="stocks">Акции</option>
              <option value="futures">Фьючерсы</option>
              <option value="indices">Индексы</option>
            </select>
          </label>

          <label class="f"><span>Режим</span>
            <div class="seg" id="mode">
              <button data-v="margin" class="on">Маржа / фьючерсы</button>
              <button data-v="spot">Спот</button>
            </div>
          </label>

          <div class="row">
            <label class="f"><span>Депозит ($)</span><input id="balance" type="number" value="1000" min="0" step="any"></label>
            <label class="f"><span>Риск на сделку (%)</span><input id="risk" type="number" value="1" min="0.05" max="100" step="0.05"></label>
          </div>

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
      <h3>Статистика</h3>
      <div class="tstats" id="stats"></div>
      <div id="jlist"></div>
    </div>
  </section>

  <div class="foot">
    Бот даёт технический анализ на основе визуального разбора графика. Это не финансововая рекомендация.<br>
    Управление риском и ответственность за сделки остаются на тебе.
  </div>
</div>

<script>
(function(){
  "use strict";

  var API = location.origin;
  var KEY = localStorage.getItem("ca_key") || "";
  var state = { image:null, result:null, mode:"margin" };

  // ---------- access key field ----------
  var $key = $("accessKey");
  if ($key) {
    $key.value = KEY;
    $key.addEventListener("input", function(){
      KEY = $key.value.trim();
      if (KEY) localStorage.setItem("ca_key", KEY);
      else localStorage.removeItem("ca_key");
    });
  }

  var $ = function(id){ return document.getElementById(id); };

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
        $("dot").className = "dot ok";
        $("status").textContent = d.journal ? "онлайн · " + (d.model || "").replace("@cf/meta/","") : "KV не подключён";
        if (!d.journal) $("dot").className = "dot bad";
      })
      .catch(function(){
        $("dot").className = "dot bad";
        $("status").textContent = "сервер недоступен";
      });
  }
  health();

  // ---------- image input ----------
  function resizeImage(file, cb){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var MAX = 1536;
        var w = img.width, h = img.height;
        var scale = Math.min(1, MAX / Math.max(w, h));
        var cw = Math.round(w*scale), ch = Math.round(h*scale);
        var c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#000"; ctx.fillRect(0,0,cw,ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        cb(c.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = function(){
        var r2 = new FileReader();
        r2.onload = function(ev){ cb(ev.target.result); };
        r2.readAsDataURL(file);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setImage(dataUri){
    state.image = dataUri;
    $("pimg").src = dataUri;
    $("preview").style.display = "block";
    $("go").disabled = false;
  }

  function handleFiles(files){
    if (!files || !files.length) return;
    var f = files[0];
    if (!f.type || f.type.indexOf("image/") !== 0) return;
    resizeImage(f, setImage);
  }

  var drop = $("drop");
  drop.addEventListener("click", function(){ $("file").click(); });
  drop.addEventListener("dragover", function(e){ e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", function(){ drop.classList.remove("over"); });
  drop.addEventListener("drop", function(e){
    e.preventDefault(); drop.classList.remove("over");
    handleFiles(e.dataTransfer.files);
  });
  $("file").addEventListener("change", function(e){ handleFiles(e.target.files); });
  $("pclear").addEventListener("click", function(){
    state.image = null; $("preview").style.display = "none"; $("pimg").src = ""; $("go").disabled = true;
  });

  document.addEventListener("paste", function(e){
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i=0;i<items.length;i++){
      if (items[i].type.indexOf("image") === 0){
        handleFiles([items[i].getAsFile()]);
        Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(x, idx){
          if (idx === 0){ x.click(); }
        });
        break;
      }
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("#mode button"), function(b){
    b.addEventListener("click", function(){
      Array.prototype.forEach.call(document.querySelectorAll("#mode button"), function(x){ x.classList.remove("on"); });
      b.classList.add("on");
      state.mode = b.getAttribute("data-v");
    });
  });

  // ---------- render ----------
  function directionWord(d){ return d === "long" ? "ЛОНГ" : d === "short" ? "ШОРТ" : "ВНЕ РЫНКА"; }
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
    var cls = s.direction === "long" ? "g" : s.direction === "short" ? "r" : "a";

    var html = '<div class="verdict">'
      + '<span class="badge ' + s.direction + '">' + directionWord(s.direction) + "</span>"
      + '<div class="meta">'
      + (a.instrument ? '<span class="chip">' + esc(a.instrument) + "</span>" : "")
      + (a.timeframe ? '<span class="chip">' + esc(a.timeframe) + "</span>" : "")
      + '<span class="chip">' + trendWord(a.trend) + (a.trend_strength ? " · " + esc(a.trend_strength) : "") + "</span>"
      + (a.market ? '<span class="chip">' + esc(a.market) + "</span>" : "")
      + (s.horizon ? '<span class="chip">⏱ ' + esc(s.horizon) + "</span>" : "")
      + "</div></div>";

    html += '<div class="conf"><span style="font-size:11.5px;color:var(--muted)">УВЕРЕННОСТЬ</span>'
      + '<div class="bar"><i style="width:' + s.confidence + '%"></i></div>'
      + "<b>" + s.confidence + "%</b></div>";

    if (s.direction !== "none"){
      var tp = s.take_profits || [];
      html += '<div class="kv">'
        + '<div><span>Вход</span><b>' + fmt(s.entry) + "</b></div>"
        + '<div><span>Стоп</span><b class="r">' + fmt(s.stop_loss) + "</b></div>"
        + '<div><span>Тейк 1</span><b class="g">' + fmt(tp[0]) + "</b></div>"
        + '<div><span>Тейк 2</span><b class="g">' + (tp[1] ? fmt(tp[1]) : "—") + "</b></div>"
        + '<div><span>R:R</span><b class="' + (s.risk_reward >= 2 ? "g" : s.risk_reward >= 1.5 ? "a" : "r") + '">'
        + fmt(s.risk_reward) + "</b></div>"
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
      html += '<div class="sec"><h4>Размер позиции</h4><div class="kv">'
        + '<div><span>Риск</span><b class="a">$' + fmt(z.riskAmount) + "</b></div>"
        + '<div><span>Объём</span><b>' + fmt(z.qty) + "</b></div>"
        + '<div><span>Номинал</span><b>$' + fmt(z.notional) + "</b></div>"
        + '<div><span>Плечо</span><b class="' + (z.leverage > 10 ? "r" : "b") + '">' + fmt(z.leverage) + "x</b></div>"
        + '<div><span>Стоп</span><b>' + fmt(z.stopPct) + "%</b></div>"
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

    html += '<div class="model" style="margin-top:12px">модель: ' + esc(d.model) + "</div>";
    if (d.demo) html += '<div class="warn">ДЕМО-режим: анализ сгенерирован заглушкой, без обращения к Workers AI.</div>';

    $("result").innerHTML = html;

    var saveBtn = $("save");
    if (saveBtn) saveBtn.addEventListener("click", function(){ saveTrade(a, d.sizing); });
    var againBtn = $("again");
    if (againBtn) againBtn.addEventListener("click", analyze);
  }

  // ---------- analyze ----------
  function analyze(){
    if (!state.image) return;
    $("go").disabled = true;
    $("result").innerHTML = '<div class="empty"><div class="spin"></div>'
      + '<div style="margin-top:14px">Модель читает график…<br><span style="font-size:12px">обычно 5–20 секунд</span></div></div>';

    var payload = {
      image: state.image,
      question: $("question").value,
      market: $("market").value,
      mode: state.mode,
      balance: Number($("balance").value) || 0,
      riskPct: Number($("risk").value) || 0
    };

    fetch(API + "/api/analyze", { method:"POST", headers: hdr(), body: JSON.stringify(payload) })
      .then(function(r){ return r.json().then(function(j){ return { status:r.status, body:j }; }); })
      .then(function(res){
        var d = res.body;
        if (!d.ok){
          if (res.status === 401 && $key){
            $key.focus();
            $key.style.borderColor = "var(--red)";
            setTimeout(function(){ $key.style.borderColor = ""; }, 2500);
          }
          var msg = '<div class="err"><b>Не удалось разобрать график</b><div style="margin-top:6px">'
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
      .then(function(){ $("go").disabled = false; });
  }

  $("go").addEventListener("click", analyze);

  // ---------- journal ----------
  function saveTrade(a, sizing){
    var trade = {
      instrument: a.instrument || "—",
      timeframe: a.timeframe || "—",
      direction: a.signal.direction,
      entry: a.signal.entry,
      stop_loss: a.signal.stop_loss,
      take_profits: a.signal.take_profits || [],
      risk_reward: a.signal.risk_reward,
      confidence: a.signal.confidence,
      qty: sizing ? sizing.qty : null,
      notional: sizing ? sizing.notional : null,
      leverage: sizing ? sizing.leverage : null,
      balance: Number($("balance").value) || null,
      riskPct: Number($("risk").value) || null,
      summary: a.summary || ""
    };
    fetch(API + "/api/journal", { method:"POST", headers: hdr(), body: JSON.stringify(trade) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (j.ok){
          loadJournal();
          Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(t){
            if (t.getAttribute("data-tab") === "journal") t.click();
          });
        } else {
          alert("Ошибка сохранения: " + (j.error || "?"));
        }
      });
  }

  function statCard(label, value, cls){
    return '<div><span>' + label + '</span><b class="' + (cls || "") + '">' + value + "</b></div>";
  }

  function renderJournal(entries, stats){
    $("jcount").textContent = entries.length ? String(entries.length) : "";

    var s = stats || {};
    $("stats").innerHTML =
        statCard("Сделок", s.total || 0)
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
      var dirCls = t.direction === "long" ? "g" : "r";

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
        + '<td class="num ' + dirCls + '">' + (t.direction === "long" ? "ЛОНГ" : "ШОРТ") + "</td>"
        + '<td class="num">' + fmt(t.entry) + "</td>"
        + '<td class="num r">' + fmt(t.stop_loss) + "</td>"
        + '<td class="num g">' + fmt((t.take_profits && t.take_profits[0])) + "</td>"
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
      + "<th>Дата</th><th>Инструмент</th><th>Напр.</th><th>Вход</th><th>Стоп</th><th>Тейк</th>"
      + "<th>R:R</th><th>Увер.</th><th>Статус</th><th>Закрытие</th><th></th>"
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
        fetch(API + "/api/journal?id=" + encodeURIComponent(id), {
          method:"PATCH", headers: hdr(), body: JSON.stringify({ exitPrice: Number(price) })
        }).then(function(r){ return r.json(); }).then(function(j){
          if (!j.ok) alert("Ошибка: " + (j.error || "?")); else loadJournal();
        });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function(b){
      b.addEventListener("click", function(){
        if (!confirm("Удалить сделку из журнала?")) return;
        fetch(API + "/api/journal?id=" + encodeURIComponent(b.getAttribute("data-del")), {
          method:"DELETE", headers: hdr()
        }).then(function(r){ return r.json(); }).then(loadJournal);
      });
    });
  }

  function loadJournal(){
    fetch(API + "/api/journal", { headers: hdr() })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (j.ok) renderJournal(j.entries || [], j.stats);
        else $("jlist").innerHTML = '<div class="err">' + esc(j.error) + "</div>";
      })
      .catch(function(e){
        $("jlist").innerHTML = '<div class="err">Не удалось загрузить журнал: ' + esc(String(e)) + "</div>";
      });
  }

  loadJournal();
})();
</script>
</body>
</html>`;
}
