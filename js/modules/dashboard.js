export function createDashboard({
  mdRenderEl,
  markdownInputEl,
  onSaveMarkdown,
}) {
  const renderer = new window.marked.Renderer();
  let sectionIndex = 0;

  renderer.heading = function (text, level) {
    if (level === 2) {
      const html = sectionIndex++ > 0 ? "</div>" : "";
      return `${html}<div class="md-section"><h2>${text}</h2>`;
    }
    return `<h${level}>${text}</h${level}>`;
  };

  renderer.link = function (href, title, text) {
    const safeHref = href || "#";
    const safeTitle = title ? ` title="${title}"` : "";
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${safeTitle}>${text}</a>`;
  };

  function normalizeAddedSectionItem(rawInput) {
    const value = rawInput.trim();
    if (!value) return { item: "", error: "empty" };

    const parts = value.split("|");
    if (parts.length < 2) return { item: "", error: "format" };

    const key = parts[0].trim();
    const url = parts.slice(1).join("|").trim();
    if (!key || !url) return { item: "", error: "format" };

    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { item: "", error: "url" };
      }
    } catch (e) {
      return { item: "", error: "url" };
    }

    return { item: `- [${key}](${url})`, error: "" };
  }

  function addItemToSection(sectionIdx, rawInput) {
    const normalized = normalizeAddedSectionItem(rawInput);
    const newItem = normalized.item;
    if (!newItem) return { ok: false, error: normalized.error };

    const md = markdownInputEl.value;
    const parts = md.split("## TASKS");
    const dashboard = parts[0];
    const dashboardLines = dashboard.replace(/\r/g, "").split("\n");
    const sectionHeadingLines = [];

    dashboardLines.forEach((line, i) => {
      if (/^##\s+/.test(line.trim())) sectionHeadingLines.push(i);
    });

    if (sectionIdx < 0 || sectionIdx >= sectionHeadingLines.length) {
      return { ok: false, error: "section" };
    }

    const sectionStart = sectionHeadingLines[sectionIdx] + 1;
    const sectionEnd =
      sectionIdx + 1 < sectionHeadingLines.length
        ? sectionHeadingLines[sectionIdx + 1]
        : dashboardLines.length;

    let insertAt = sectionEnd;
    while (insertAt > sectionStart && dashboardLines[insertAt - 1].trim() === "") {
      insertAt -= 1;
    }

    dashboardLines.splice(insertAt, 0, newItem);

    const updatedDashboard = dashboardLines.join("\n");
    const updatedMd =
      updatedDashboard +
      (parts.length > 1 ? `## TASKS${parts.slice(1).join("## TASKS")}` : "");

    onSaveMarkdown(updatedMd);
    return { ok: true, error: "" };
  }

  function attachSectionAddControls() {
    const sections = mdRenderEl.querySelectorAll(".md-section");

    sections.forEach((section, sectionIdx) => {
      const row = document.createElement("div");
      row.className = "section-add-row";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "section-add-btn";
      addBtn.title = "Add item";
      addBtn.setAttribute("aria-label", "Add item");
      addBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span>';

      const input = document.createElement("input");
      input.type = "text";
      input.className = "section-add-input hidden";
      input.placeholder = "key | https://example.com";

      addBtn.addEventListener("click", () => {
        input.classList.remove("hidden");
        input.classList.remove("invalid");
        input.focus();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const result = addItemToSection(sectionIdx, input.value);
          if (!result.ok) {
            input.classList.add("invalid");
            input.title = "Use format: key | https://example.com";
            input.focus();
          }
        }

        if (e.key === "Escape") {
          input.value = "";
          input.classList.remove("invalid");
          input.classList.add("hidden");
        }
      });

      input.addEventListener("input", () => {
        if (input.classList.contains("invalid")) input.classList.remove("invalid");
      });

      input.addEventListener("blur", () => {
        if (input.value.trim() === "") input.classList.add("hidden");
      });

      row.appendChild(addBtn);
      row.appendChild(input);
      section.appendChild(row);
    });
  }

  function renderMarkdown(text) {
    sectionIndex = 0;
    const dashboardContent = text.split("## TASKS")[0];
    mdRenderEl.innerHTML = window.marked.parse(dashboardContent, { renderer }) + "</div>";
    attachSectionAddControls();
    window.lucide.createIcons();
  }

  function setupSearch(cmdInputEl) {
    cmdInputEl.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const links = mdRenderEl.querySelectorAll("a");
      const sections = mdRenderEl.querySelectorAll(".md-section");

      if (query === "") {
        links.forEach((l) => l.classList.remove("match"));
        sections.forEach((s) => s.classList.remove("dimmed"));
        return;
      }

      links.forEach((l) => {
        if (l.textContent.toLowerCase().includes(query)) l.classList.add("match");
        else l.classList.remove("match");
      });

      sections.forEach((s) => {
        if (s.querySelector(".match")) s.classList.remove("dimmed");
        else s.classList.add("dimmed");
      });
    });

    cmdInputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const match = mdRenderEl.querySelector("a.match");
      if (!match) return;
      window.open(match.href, "_blank");
      cmdInputEl.value = "";
      onSaveMarkdown(markdownInputEl.value);
    });
  }

  return {
    renderMarkdown,
    setupSearch,
  };
}
