import { setupEditableTitle } from "./modules/title.js";
import { renderCalendars, startClock } from "./modules/calendars.js";
import { createDashboard } from "./modules/dashboard.js";
import { createTodoManager } from "./modules/todos.js";

const TITLE_STORAGE_KEY = "homepageTitle";
const DEFAULT_APP_TITLE = "HUB_OS // ARVIND";
const MARKDOWN_STORAGE_KEY = "homepageData";
const DEFAULT_MARKDOWN = "# Welcome\n## Links\n- [Sample](https://google.com)\n\n## TASKS\n- [ ] This is a task";

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

  function saveSilent(newMd) {
    lastSavedMarkdown = newMd;
    markdownInputEl.value = newMd;
    localStorage.setItem(MARKDOWN_STORAGE_KEY, newMd);
    dashboard.renderMarkdown(newMd);
    todos.parseTodos();
    renderCalendars(calendarContainerEl, todos.getDueTasks());
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

  const savedData = localStorage.getItem(MARKDOWN_STORAGE_KEY) || DEFAULT_MARKDOWN;
  lastSavedMarkdown = savedData;
  markdownInputEl.value = savedData;

  dashboard.renderMarkdown(savedData);
  todos.parseTodos();

  startClock(clockEl);
  renderCalendars(calendarContainerEl, todos.getDueTasks());
}

document.addEventListener("DOMContentLoaded", init);
