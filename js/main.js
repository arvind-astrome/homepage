import { setupEditableTitle } from "./modules/title.js";
import { renderCalendars, startClock } from "./modules/calendars.js";
import { createDashboard } from "./modules/dashboard.js";
import { createTodoManager } from "./modules/todos.js";

const TITLE_STORAGE_KEY = "homepageTitle";
const DEFAULT_APP_TITLE = "HUB_OS // ARVIND";
const DEFAULT_MARKDOWN = "# Welcome\n## Links\n- [Sample](https://google.com)\n\n## TASKS\n- [ ] This is a task";
const JSONBIN_API_BASE = "https://api.jsonbin.io/v3";
const JSONBIN_ACCESS_KEY_STORAGE_KEY = "homepageJsonBinAccessKey";
const JSONBIN_BIN_ID_STORAGE_KEY = "homepageJsonBinId";
const LEGACY_MARKDOWN_STORAGE_KEYS = [
  "homepageMarkdown",
  "hubMarkdown",
  "dashboardMarkdown",
  "markdown",
  "homePageMarkdown",
  "hubosMarkdown",
];

function getStoredJsonBinAccessKey() {
  return (localStorage.getItem(JSONBIN_ACCESS_KEY_STORAGE_KEY) || "").trim();
}

function requestJsonBinAccessKey() {
  const entered = window.prompt("Enter your JSONBin Access Key");
  if (!entered) return "";

  return entered.trim();
}

function requestJsonBinMasterKey() {
  const entered = window.prompt("Enter your JSONBin Master Key (used only once to create/seed a bin)");
  if (!entered) return "";
  return entered.trim();
}

function requestJsonBinSyncToken() {
  const entered = window.prompt("Enter JSONBin sync token (BIN_ID:ACCESS_KEY)");
  if (!entered) return "";
  return entered.trim();
}

function parseSyncToken(token) {
  const parts = token.split(":");
  if (parts.length < 2) return null;

  const binId = parts[0].trim();
  const accessKey = parts.slice(1).join(":").trim();
  if (!binId || !accessKey) return null;
  return { binId, accessKey };
}

function persistConnection(binId, accessKey) {
  localStorage.setItem(JSONBIN_BIN_ID_STORAGE_KEY, binId);
  localStorage.setItem(JSONBIN_ACCESS_KEY_STORAGE_KEY, accessKey);
}

async function jsonBinRequest(path, auth, options = {}) {
  const { method = "GET", body, extraHeaders = {} } = options;
  const authHeader = auth?.masterKey
    ? { "X-Master-Key": auth.masterKey }
    : auth?.accessKey
      ? { "X-Access-Key": auth.accessKey }
      : {};
  const headers = {
    "Content-Type": "application/json",
    ...authHeader,
    ...extraHeaders,
  };

  const response = await fetch(`${JSONBIN_API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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

async function ensureJsonBin(key, initialMarkdown) {
  const created = await jsonBinRequest("/b", { masterKey: key }, {
    method: "POST",
    body: {
      markdown: initialMarkdown || DEFAULT_MARKDOWN,
      updatedAt: new Date().toISOString(),
      migratedFromLocalStorage: Boolean(initialMarkdown),
    },
    extraHeaders: {
      "X-Bin-Name": "homepage-dashboard",
      "X-Bin-Private": "true",
    },
  });

  const createdBinId = created?.metadata?.id;
  if (!createdBinId) {
    throw new Error("Could not create JSONBin record");
  }

  return createdBinId;
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

  let remoteBinId = "";
  let currentJsonBinAccessKey = "";
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
    authSigninBtn.textContent = "Connect JSONBin";
    authSigninBtn.classList.toggle("hidden", !showButton);
    authGateEl.classList.remove("hidden");
  }

  function hideAuthGate() {
    authGateEl.classList.add("hidden");
  }

  function queueRemoteSave(newMd) {
    if (!currentJsonBinAccessKey || !remoteBinId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await jsonBinRequest(`/b/${remoteBinId}`, { accessKey: currentJsonBinAccessKey }, {
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

  async function hydrateFromJsonBin(binId, accessKey) {
    try {
      currentJsonBinAccessKey = accessKey;
      remoteBinId = binId;

      const remoteData = await jsonBinRequest(
        `/b/${remoteBinId}/latest`,
        { accessKey: currentJsonBinAccessKey },
        { extraHeaders: { "X-Bin-Meta": "false" } },
      );

      const remoteMarkdown = typeof remoteData?.markdown === "string"
        ? remoteData.markdown
        : DEFAULT_MARKDOWN;

      lastSavedMarkdown = remoteMarkdown;
      markdownInputEl.value = remoteMarkdown;
      dashboard.renderMarkdown(remoteMarkdown);
      todos.parseTodos();
      renderCalendars(calendarContainerEl, todos.getDueTasks());

      appHydrated = true;
      hideAuthGate();
    } catch (error) {
      console.error("Failed to load JSONBin data", error);
      appHydrated = false;
      setAuthGate("Could not load private data from JSONBin. Check key/network and try again.");
    }
  }

  async function createSeededBinWithMasterKey() {
    const masterKey = requestJsonBinMasterKey();
    if (!masterKey) {
      setAuthGate("Master key is only needed once to seed/create your bin.");
      return;
    }

    const legacyMarkdown = getLegacyMarkdownFromLocalStorage();
    const createdBinId = await ensureJsonBin(masterKey, legacyMarkdown);

    const accessKey = requestJsonBinAccessKey();
    if (!accessKey) {
      setAuthGate("Access key is required for everyday sync after seeding.");
      return;
    }

    persistConnection(createdBinId, accessKey);
    window.alert(`JSONBin ready. Save this sync token for other devices:\n${createdBinId}:${accessKey}`);
    await hydrateFromJsonBin(createdBinId, accessKey);
  }

  async function connectJsonBin() {
    const syncToken = requestJsonBinSyncToken();
    if (syncToken) {
      const parsed = parseSyncToken(syncToken);
      if (!parsed) {
        setAuthGate("Invalid sync token format. Use BIN_ID:ACCESS_KEY.");
        return;
      }

      persistConnection(parsed.binId, parsed.accessKey);
      await hydrateFromJsonBin(parsed.binId, parsed.accessKey);
      return;
    }

    const shouldSeed = window.confirm(
      "No sync token entered. Create and seed a new JSONBin with your Master Key?",
    );
    if (!shouldSeed) {
      setAuthGate("Enter sync token (BIN_ID:ACCESS_KEY) to connect this device.");
      return;
    }

    await createSeededBinWithMasterKey();
  }

  authSigninBtn.addEventListener("click", async () => {
    await connectJsonBin();
  });

  const storedBinId = (localStorage.getItem(JSONBIN_BIN_ID_STORAGE_KEY) || "").trim();
  const storedAccessKey = getStoredJsonBinAccessKey();

  if (!storedBinId || !storedAccessKey) {
    connectJsonBin();
    setAuthGate("Connect using sync token (BIN_ID:ACCESS_KEY) or seed a new bin.");
    return;
  }

  if (appHydrated) return;
  hydrateFromJsonBin(storedBinId, storedAccessKey);
}

document.addEventListener("DOMContentLoaded", init);
