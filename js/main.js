import { setupEditableTitle } from "./modules/title.js";
import { renderCalendars, startClock } from "./modules/calendars.js";
import { createDashboard } from "./modules/dashboard.js";
import { createTodoManager } from "./modules/todos.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const TITLE_STORAGE_KEY = "homepageTitle";
const DEFAULT_APP_TITLE = "HUB_OS // ARVIND";
const DEFAULT_MARKDOWN = "# Welcome\n## Links\n- [Sample](https://google.com)\n\n## TASKS\n- [ ] This is a task";

// Fill this with your Firebase Web app config from Firebase Console.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDftd8lJQb1XDGUNZxIHZ99r4P55V2G6tU",
  authDomain: "homepage-e11f0.firebaseapp.com",
  projectId: "homepage-e11f0",
  storageBucket: "homepage-e11f0.firebasestorage.app",
  messagingSenderId: "298196620750",
  appId: "1:298196620750:web:85703126d3390f3a8ac79f"
};

// Use your Firebase Auth UID (from Authentication > Users).
const OWNER_UID = "REPLACE_WITH_OWNER_UID";

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

  const firebaseConfigured = FIREBASE_CONFIG.projectId !== "REPLACE_ME" && OWNER_UID !== "REPLACE_WITH_OWNER_UID";
  let remoteDocRef = null;
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
    authSigninBtn.classList.toggle("hidden", !showButton);
    authGateEl.classList.remove("hidden");
  }

  function hideAuthGate() {
    authGateEl.classList.add("hidden");
  }

  function queueRemoteSave(newMd) {
    if (!remoteDocRef) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await setDoc(
          remoteDocRef,
          {
            markdown: newMd,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
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

  if (!firebaseConfigured) {
    setAuthGate("Set FIREBASE_CONFIG and OWNER_UID in js/main.js to enable private remote storage.", false);
    return;
  }

  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const provider = new GoogleAuthProvider();

  authSigninBtn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code.includes("popup") || code.includes("cancelled")) {
        await signInWithRedirect(auth, provider);
        return;
      }
      setAuthGate("Sign-in failed. Check Firebase Auth setup and authorized domains.");
      console.error("Sign-in failed", error);
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setAuthGate("Sign in with your owner Google account to access this private dashboard.");
      return;
    }

    if (user.uid !== OWNER_UID) {
      setAuthGate("This account is not authorized for this workspace.", false);
      setTimeout(() => signOut(auth), 300);
      return;
    }

    hideAuthGate();

    if (appHydrated) return;
    appHydrated = true;

    remoteDocRef = doc(db, "users", OWNER_UID, "private", "homepage");

    try {
      const snap = await getDoc(remoteDocRef);
      const remoteMarkdown = snap.exists() && typeof snap.data().markdown === "string"
        ? snap.data().markdown
        : DEFAULT_MARKDOWN;

      lastSavedMarkdown = remoteMarkdown;
      markdownInputEl.value = remoteMarkdown;
      dashboard.renderMarkdown(remoteMarkdown);
      todos.parseTodos();
      renderCalendars(calendarContainerEl, todos.getDueTasks());

      if (!snap.exists()) {
        queueRemoteSave(remoteMarkdown);
      }
    } catch (error) {
      console.error("Failed to load remote markdown", error);
      setAuthGate("Could not load private data from Firestore. Check network and rules.", false);
      appHydrated = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
