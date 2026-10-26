const authScreen = document.querySelector("#auth-screen");
const authCard = document.querySelector(".auth-card");
const authForm = document.querySelector("#auth-form");
const authDescription = document.querySelector("#auth-description");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const accessInput = document.querySelector("#access-key");
const revealKey = document.querySelector("#reveal-key");
const conversation = document.querySelector("#conversation");
const welcome = document.querySelector("#welcome");
const messagesNode = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const modelSelect = document.querySelector("#model-select");
const sidebarModelName = document.querySelector("#sidebar-model-name");
const connectionLabel = document.querySelector("#connection-label");
const secureBadge = document.querySelector(".secure-badge");
const toastNode = document.querySelector("#toast");
const topbarTitle = document.querySelector("#topbar-title");

const ACCESS_STORAGE_KEY = "luma-chat-access";
const MODEL_STORAGE_KEY = "luma-chat-model";
let accessKey = "";
let messages = [];
let busy = false;
let toastTimer;

function setAuthError(message) {
  authError.textContent = message;
}

function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove("is-visible"), 2800);
}

function setConnection(online, label) {
  connectionLabel.textContent = label;
  secureBadge.classList.toggle("is-online", online);
}

function setModelOptions(models, defaultModel) {
  if (!Array.isArray(models) || models.length === 0) return;
  modelSelect.replaceChildren();
  for (const model of models) {
    if (!model || typeof model.id !== "string" || typeof model.name !== "string") continue;
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.append(option);
  }
  const saved = sessionStorage.getItem(MODEL_STORAGE_KEY);
  const selected = models.some((model) => model.id === saved) ? saved : defaultModel;
  if (models.some((model) => model.id === selected)) modelSelect.value = selected;
  syncModelLabel();
}

function syncModelLabel() {
  const selected = modelSelect.selectedOptions[0];
  if (selected) sidebarModelName.textContent = selected.textContent;
}

function setReady(ready) {
  input.disabled = !ready;
  sendButton.disabled = !ready || busy || !input.value.trim();
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.disabled = !ready || busy;
  });
}

async function jsonRequest(path, body, key = "") {
  const headers = { "content-type": "application/json" };
  if (key) headers["x-chat-access-key"] = key;

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Ошибка запроса (${response.status})`);
  return data;
}

function showChat() {
  authScreen.classList.add("is-hidden");
  accessKey = sessionStorage.getItem(ACCESS_STORAGE_KEY) || accessKey;
  setReady(true);
  input.focus({ preventScroll: true });
}

function showGate(unconfigured = false) {
  authScreen.classList.remove("is-hidden");
  authCard.classList.toggle("is-unconfigured", unconfigured);
  authDescription.textContent = unconfigured
    ? "Чат создан, но ещё не подключён. Владелец должен добавить секрет ACCESS_KEY в GitHub Actions и выполнить деплой."
    : "Введите личный ключ доступа, чтобы открыть защищённый чат.";
  authSubmit.disabled = unconfigured;
  accessInput.required = !unconfigured;
  setAuthError("");
  setReady(false);
}

function makeMessage(role, text, options = {}) {
  const row = document.createElement("article");
  row.className = `message ${role}${options.error ? " error" : ""}`;

  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Вы" : "✳";
  avatar.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "message-body";
  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "Вы" : "Luma";

  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  name.append(time);

  const content = document.createElement("div");
  content.className = "message-text";
  content.textContent = text;

  body.append(name, content);
  row.append(avatar, body);
  return row;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  });
}

function addMessage(role, text, options = {}) {
  welcome.hidden = true;
  messagesNode.append(makeMessage(role, text, options));
  scrollToBottom();
}

function addThinking() {
  const row = document.createElement("article");
  row.className = "message assistant";
  row.id = "thinking";
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = "✳";
  avatar.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  body.className = "message-body";
  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = "Luma";
  const dots = document.createElement("div");
  dots.className = "thinking";
  dots.setAttribute("aria-label", "Ассистент печатает");
  dots.innerHTML = "<i></i><i></i><i></i>";
  body.append(name, dots);
  row.append(avatar, body);
  messagesNode.append(row);
  scrollToBottom();
}

function resetChat() {
  messages = [];
  messagesNode.replaceChildren();
  welcome.hidden = false;
  topbarTitle.textContent = "Новый диалог";
  input.value = "";
  input.style.height = "auto";
  setReady(Boolean(accessKey) && !busy);
  input.focus({ preventScroll: true });
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy || !accessKey) return;

  messages.push({ role: "user", content });
  if (messages.length === 1) {
    topbarTitle.textContent = content.length > 28 ? `${content.slice(0, 28)}…` : content;
  }
  addMessage("user", content);
  input.value = "";
  input.style.height = "auto";
  busy = true;
  setReady(true);
  sendButton.disabled = true;
  addThinking();

  try {
    const data = await jsonRequest("/api/chat", {
      messages: messages.slice(-24),
      model: modelSelect.value,
    }, accessKey);
    messages.push({ role: "assistant", content: data.answer });
    document.querySelector("#thinking")?.remove();
    addMessage("assistant", data.answer);
  } catch (error) {
    document.querySelector("#thinking")?.remove();
    addMessage("assistant", error.message || "Не удалось получить ответ. Попробуйте ещё раз.", { error: true });
    if (/ключ|доступ/i.test(error.message)) {
      sessionStorage.removeItem(ACCESS_STORAGE_KEY);
      accessKey = "";
      setTimeout(() => showGate(false), 700);
    }
  } finally {
    busy = false;
    setReady(Boolean(accessKey));
  }
}

async function initialize() {
  setConnection(false, "Подключаемся");
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    setModelOptions(status.models, status.defaultModel);
    if (!status.configured) {
      setConnection(false, "Нужно настроить доступ");
      showGate(true);
      return;
    }

    setConnection(true, "Workers AI подключён");
    const saved = sessionStorage.getItem(ACCESS_STORAGE_KEY);
    if (saved) {
      try {
        await jsonRequest("/api/auth", { key: saved });
        accessKey = saved;
        showChat();
        return;
      } catch {
        sessionStorage.removeItem(ACCESS_STORAGE_KEY);
      }
    }
    showGate(false);
  } catch {
    setConnection(false, "Сервер недоступен");
    authDescription.textContent = "Не удалось связаться с сервером. Обновите страницу или попробуйте позже.";
    showGate(true);
    setAuthError("Не удалось проверить подключение.");
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthError("");
  const key = accessInput.value.trim();
  if (!key) return;

  authSubmit.disabled = true;
  authSubmit.firstChild.textContent = "Проверяем… ";
  try {
    await jsonRequest("/api/auth", { key });
    accessKey = key;
    sessionStorage.setItem(ACCESS_STORAGE_KEY, key);
    accessInput.value = "";
    showChat();
  } catch (error) {
    setAuthError(error.message || "Не удалось открыть чат.");
  } finally {
    authSubmit.disabled = false;
    authSubmit.firstChild.textContent = "Открыть чат ";
  }
});

revealKey.addEventListener("click", () => {
  const visible = accessInput.type === "text";
  accessInput.type = visible ? "password" : "text";
  revealKey.textContent = visible ? "Показать" : "Скрыть";
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  sendButton.disabled = !accessKey || busy || !input.value.trim();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

modelSelect.addEventListener("change", () => {
  sessionStorage.setItem(MODEL_STORAGE_KEY, modelSelect.value);
  syncModelLabel();
  showToast(`Выбрана модель: ${modelSelect.selectedOptions[0]?.textContent ?? modelSelect.value}`);
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
});

document.querySelector("#new-chat").addEventListener("click", resetChat);
document.querySelector("#clear-chat").addEventListener("click", () => {
  resetChat();
  showToast("Диалог очищен");
});
document.querySelector("#sign-out").addEventListener("click", () => {
  sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  accessKey = "";
  resetChat();
  showGate(false);
  setConnection(true, "Сеанс завершён");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    resetChat();
  }
});

initialize();
