import { setupEditableTitle } from "./modules/title.js";
import { renderCalendars, startClock } from "./modules/calendars.js";
import { createDashboard } from "./modules/dashboard.js";
import { createTodoManager } from "./modules/todos.js";

const TITLE_STORAGE_KEY = "homepageTitle";
const DEFAULT_APP_TITLE = "HUB_OS // ARVIND";
const DEFAULT_MARKDOWN = "# Welcome\n## Links\n- [Sample](https://google.com)\n\n## TASKS\n- [ ] This is a task";
const PANTRY_API_BASE = "https://getpantry.cloud/apiv1";
const PANTRY_ID_STORAGE_KEY = "homepagePantryId";
const PANTRY_BASKET_STORAGE_KEY = "homepagePantryBasket";
const DEFAULT_PANTRY_BASKET = "homepage-dashboard";
const LEGACY_MARKDOWN_STORAGE_KEYS = [
  "homepageMarkdown",
  "hubMarkdown",
  "dashboardMarkdown",
  "markdown",
  "homePageMarkdown",
  "hubosMarkdown",
];

function getStoredPantryId() {
  return (localStorage.getItem(PANTRY_ID_STORAGE_KEY) || "").trim();
}

function getStoredPantryBasket() {
  return (localStorage.getItem(PANTRY_BASKET_STORAGE_KEY) || "").trim();
}

function requestPantryId() {
  const entered = window.prompt("Enter your Pantry ID");
  if (!entered) return "";
  return entered.trim();
}

function requestPantrySyncToken() {
  const entered = window.prompt("Enter Pantry sync token (PANTRY_ID[:BASKET_NAME])");
  if (!entered) return "";
  return entered.trim();
}

function requestPantryBasketName() {
  const entered = window.prompt("Enter Pantry basket name (optional)", DEFAULT_PANTRY_BASKET);
  if (!entered) return DEFAULT_PANTRY_BASKET;
  return entered.trim() || DEFAULT_PANTRY_BASKET;
}

function parsePantrySyncToken(token) {
  const parts = token.split(":");
  const pantryId = (parts[0] || "").trim();
  const basketName = (parts[1] || DEFAULT_PANTRY_BASKET).trim() || DEFAULT_PANTRY_BASKET;
  if (!pantryId) return null;
  return { pantryId, basketName };
}

function persistPantryConnection(pantryId, basketName) {
  localStorage.setItem(PANTRY_ID_STORAGE_KEY, pantryId);
  localStorage.setItem(PANTRY_BASKET_STORAGE_KEY, basketName);
}

async function pantryRequest(pantryId, basketName, options = {}) {
  const { method = "GET", body, extraHeaders = {} } = options;
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  const safePantryId = encodeURIComponent(pantryId);
  const safeBasketName = encodeURIComponent(basketName);
  const url = `${PANTRY_API_BASE}/pantry/${safePantryId}/basket/${safeBasketName}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 404 && method === "GET") {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function getLegacyMarkdownFromLocalStorage() {
  for (const key of LEGACY_MARKDOWN_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const legacyJsonKeys = ["homepageData", "hubData", "dashboardData"];
  for (const key of legacyJsonKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.markdown === "string" && parsed.markdown.trim()) {
        return parsed.markdown;
      }
    } catch (_) {
      // Ignore invalid legacy JSON payloads.
    }
  }

  return "";
}

async function ensurePantryBasket(pantryId, basketName, initialMarkdown) {
  const existing = await pantryRequest(pantryId, basketName, { method: "GET" });
  const hasMarkdown = typeof existing?.markdown === "string" && existing.markdown.trim();
  if (hasMarkdown) {
    return existing.markdown;
  }

  const seedMarkdown = initialMarkdown || DEFAULT_MARKDOWN;
  await pantryRequest(pantryId, basketName, {
    method: "PUT",
    body: {
      markdown: seedMarkdown,
      updatedAt: new Date().toISOString(),
      migratedFromLocalStorage: Boolean(initialMarkdown),
    },
  });
  return seedMarkdown;
}

function init() {
  const appTitleEl = document.getElementById("app-title");
  const appTitleInputEl = document.getElementById("app-title-input");
  const cmdInputEl = document.getElementById("cmd-input");
  const clockEl = document.getElementById("clock");
  const calendarContainerEl = document.getElementById("calendars-container");

  const toggleEditorBtn = document.getElementById("toggle-editor-btn");
  const downloadMdBtn = document.getElementById("download-md-btn");
  const cancelEditorBtn = document.getElementById("cancel-editor-btn");
  const commitEditorBtn = document.getElementById("commit-editor-btn");

  const renderContainerEl = document.getElementById("render-container");
  const editorContainerEl = document.getElementById("editor-container");
  const mdRenderEl = document.getElementById("md-render");
  const markdownInputEl = document.getElementById("markdown-input");

  const todoListEl = document.getElementById("todo-list");
  const taskCountEl = document.getElementById("task-count");
  const todoInputEl = document.getElementById("todo-input");
  const authGateEl = document.getElementById("auth-gate");
  const authGateMessageEl = document.getElementById("auth-gate-message");
  const authSigninBtn = document.getElementById("auth-signin-btn");

  let remotePantryId = "";
  let remotePantryBasket = DEFAULT_PANTRY_BASKET;
  let appHydrated = false;
  let saveTimer = null;

  let lastSavedMarkdown = "";

  const dashboard = createDashboard({
    mdRenderEl,
    markdownInputEl,
    onSaveMarkdown: saveSilent,
  });

  const todos = createTodoManager({
    markdownInputEl,
    todoListEl,
    taskCountEl,
    todoInputEl,
    onSaveMarkdown: saveSilent,
  });

  function toggleEditor() {
    renderContainerEl.classList.toggle("hidden");
    editorContainerEl.classList.toggle("hidden");
  }

  function setAuthGate(message, showButton = true) {
    authGateMessageEl.textContent = message;
    authSigninBtn.textContent = "Connect Pantry";
    authSigninBtn.classList.toggle("hidden", !showButton);
    authGateEl.classList.remove("hidden");
  }

  function hideAuthGate() {
    authGateEl.classList.add("hidden");
  }

  function queueRemoteSave(newMd) {
    if (!remotePantryId || !remotePantryBasket) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await pantryRequest(remotePantryId, remotePantryBasket, {
          method: "PUT",
          body: {
            markdown: newMd,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Remote save failed", error);
      }
    }, 350);
  }

  function saveSilent(newMd) {
    lastSavedMarkdown = newMd;
    markdownInputEl.value = newMd;
    dashboard.renderMarkdown(newMd);
    todos.parseTodos();
    renderCalendars(calendarContainerEl, todos.getDueTasks());
    queueRemoteSave(newMd);
  }

  function saveContent() {
    saveSilent(markdownInputEl.value);
    toggleEditor();
  }

  function cancelEditor() {
    markdownInputEl.value = lastSavedMarkdown;
    toggleEditor();
  }

  function downloadMarkdown() {
    const blob = new Blob([markdownInputEl.value], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hub.md";
    a.click();
  }

  setupEditableTitle({
    titleEl: appTitleEl,
    inputEl: appTitleInputEl,
    storageKey: TITLE_STORAGE_KEY,
    defaultTitle: DEFAULT_APP_TITLE,
  });

  toggleEditorBtn.addEventListener("click", toggleEditor);
  downloadMdBtn.addEventListener("click", downloadMarkdown);
  cancelEditorBtn.addEventListener("click", cancelEditor);
  commitEditorBtn.addEventListener("click", saveContent);

  todos.bindInput();
  dashboard.setupSearch(cmdInputEl);

  // Drawer (mobile sidebar) toggle
  const drawerToggleBtn = document.getElementById("drawer-toggle");
  const sidebar = document.getElementById("sidebar");
  const drawerOverlay = document.getElementById("drawer-overlay");

  function openDrawer() {
    sidebar.classList.add("drawer-open");
    drawerOverlay.classList.add("active");
  }

  function closeDrawer() {
    sidebar.classList.remove("drawer-open");
    drawerOverlay.classList.remove("active");
  }

  if (drawerToggleBtn && sidebar && drawerOverlay) {
    drawerToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.contains("drawer-open") ? closeDrawer() : openDrawer();
    });
    drawerOverlay.addEventListener("click", closeDrawer);

    // Keep drawer state sane when switching between breakpoints.
    window.addEventListener("resize", () => {
      if (window.innerWidth > 767) closeDrawer();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (document.activeElement === cmdInputEl) return;
    e.preventDefault();
    cmdInputEl.focus();
    cmdInputEl.select();
  });

  startClock(clockEl);

  async function hydrateFromPantry(pantryId, basketName) {
    try {
      remotePantryId = pantryId;
      remotePantryBasket = basketName;

      const legacyMarkdown = getLegacyMarkdownFromLocalStorage();
      const seededMarkdown = await ensurePantryBasket(pantryId, basketName, legacyMarkdown);
      const remoteData = await pantryRequest(pantryId, basketName, { method: "GET" });

      const remoteMarkdown = typeof remoteData?.markdown === "string"
        ? remoteData.markdown
        : seededMarkdown;

      lastSavedMarkdown = remoteMarkdown;
      markdownInputEl.value = remoteMarkdown;
      dashboard.renderMarkdown(remoteMarkdown);
      todos.parseTodos();
      renderCalendars(calendarContainerEl, todos.getDueTasks());

      appHydrated = true;
      hideAuthGate();
    } catch (error) {
      console.error("Failed to load Pantry data", error);
      appHydrated = false;
      setAuthGate("Could not load Pantry data. Check Pantry ID/network and try again.");
    }
  }

  async function createOrConnectPantry() {
    const pantryId = requestPantryId();
    if (!pantryId) {
      setAuthGate("Pantry ID is required to connect this device.");
      return;
    }

    const basketName = requestPantryBasketName();
    persistPantryConnection(pantryId, basketName);
    window.alert(`Pantry connected. Save this sync token for other devices:\n${pantryId}:${basketName}`);
    await hydrateFromPantry(pantryId, basketName);
  }

  async function connectPantry() {
    const syncToken = requestPantrySyncToken();
    if (syncToken) {
      const parsed = parsePantrySyncToken(syncToken);
      if (!parsed) {
        setAuthGate("Invalid sync token format. Use PANTRY_ID[:BASKET_NAME].");
        return;
      }

      persistPantryConnection(parsed.pantryId, parsed.basketName);
      await hydrateFromPantry(parsed.pantryId, parsed.basketName);
      return;
    }

    const shouldCreateOrConnect = window.confirm(
      "No sync token entered. Connect directly using Pantry ID now?",
    );
    if (!shouldCreateOrConnect) {
      setAuthGate("Enter sync token (PANTRY_ID[:BASKET_NAME]) to connect this device.");
      return;
    }

    await createOrConnectPantry();
  }

  authSigninBtn.addEventListener("click", async () => {
    await connectPantry();
  });

  const storedPantryId = getStoredPantryId();
  const storedBasketName = getStoredPantryBasket() || DEFAULT_PANTRY_BASKET;

  if (!storedPantryId) {
    setAuthGate("Connect using sync token (PANTRY_ID[:BASKET_NAME]) or Pantry ID.");
    return;
  }

  if (appHydrated) return;
  hydrateFromPantry(storedPantryId, storedBasketName);
}

document.addEventListener("DOMContentLoaded", init);
