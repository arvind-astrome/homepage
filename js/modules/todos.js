const DATE_RE = /@(\d{4}-\d{2}-\d{2})/;

function pad(n) {
  return String(n).padStart(2, "0");
}

function createDatePicker(anchorEl, onSelect) {
  const existing = document.getElementById("todo-date-picker");
  if (existing) existing.remove();

  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();

  const picker = document.createElement("div");
  picker.id = "todo-date-picker";
  picker.className = "date-picker";

  function render() {
    picker.innerHTML = "";

    const header = document.createElement("div");
    header.className = "dp-header";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "dp-nav";
    prevBtn.textContent = "‹";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      month--;
      if (month < 0) { month = 11; year--; }
      render();
    });

    const label = document.createElement("span");
    label.textContent = `${new Date(year, month).toLocaleString("default", { month: "short" })} ${year}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "dp-nav";
    nextBtn.textContent = "›";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      month++;
      if (month > 11) { month = 0; year++; }
      render();
    });

    header.appendChild(prevBtn);
    header.appendChild(label);
    header.appendChild(nextBtn);
    picker.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "dp-grid";

    ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
      const el = document.createElement("div");
      el.className = "dp-day-label";
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(document.createElement("div"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "dp-cell";
      cell.textContent = day;
      if (
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate()
      ) {
        cell.classList.add("today");
      }
      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(dateStr);
        picker.remove();
        document.removeEventListener("click", closeOnOutside);
      });
      grid.appendChild(cell);
    }

    picker.appendChild(grid);
  }

  render();

  const rect = anchorEl.getBoundingClientRect();
  picker.style.top = `${rect.top - 10}px`;
  picker.style.left = `${rect.right + 6}px`;
  document.body.appendChild(picker);

  function closeOnOutside(e) {
    if (!picker.contains(e.target)) {
      picker.remove();
      document.removeEventListener("click", closeOnOutside);
    }
  }
  setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
}

export function createTodoManager({
  markdownInputEl,
  todoListEl,
  taskCountEl,
  todoInputEl,
  onSaveMarkdown,
}) {
  let editingLineIndex = null;
  let _parsedDueTasks = [];

  function getTagColor(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = (hash << 5) - hash + tag.charCodeAt(i);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 78% 62%)`;
  }

  function toggleTodo(lineIndex, isChecked) {
    const md = markdownInputEl.value;
    const parts = md.split("## TASKS");
    if (parts.length < 2) return;

    const lines = parts[1].split("\n");
    if (!lines[lineIndex]) return;

    lines[lineIndex] = lines[lineIndex].replace(/\[( |x)\]/, isChecked ? "[x]" : "[ ]");
    const updatedMd = parts[0] + "## TASKS" + lines.join("\n");
    onSaveMarkdown(updatedMd);
  }

  function startInlineEdit(lineIndex) {
    editingLineIndex = lineIndex;
    parseTodos();
  }

  function commitInlineEdit(lineIndex) {
    const md = markdownInputEl.value;
    const parts = md.split("## TASKS");
    if (parts.length < 2) return;

    const lines = parts[1].split("\n");
    if (!lines[lineIndex]) return;

    const editInput = document.querySelector(`.todo-edit-input[data-edit-line="${lineIndex}"]`);
    if (!editInput) return;

    const updatedTaskText = editInput.value.trim();
    if (updatedTaskText === "") return;

    const prefixMatch = lines[lineIndex].match(/^(\s*-\s*\[[ x]\]\s*)/);
    const prefix = prefixMatch ? prefixMatch[1] : "- [ ] ";
    lines[lineIndex] = `${prefix}${updatedTaskText}`;

    editingLineIndex = null;
    const updatedMd = parts[0] + "## TASKS" + lines.join("\n");
    onSaveMarkdown(updatedMd);
  }

  function cancelInlineEdit() {
    editingLineIndex = null;
    parseTodos();
  }

  function deleteTodo(lineIndex) {
    const md = markdownInputEl.value;
    const parts = md.split("## TASKS");
    if (parts.length < 2) return;

    const lines = parts[1].split("\n");
    if (!lines[lineIndex]) return;
    lines.splice(lineIndex, 1);

    if (editingLineIndex === lineIndex) editingLineIndex = null;
    if (editingLineIndex !== null && editingLineIndex > lineIndex) editingLineIndex -= 1;

    const updatedMd = parts[0] + "## TASKS" + lines.join("\n");
    onSaveMarkdown(updatedMd);
  }

  function parseTodos() {
    const md = markdownInputEl.value;
    const taskSection = md.split("## TASKS")[1] || "";
    todoListEl.innerHTML = "";
    _parsedDueTasks = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    const lines = taskSection.split("\n");
    let count = 0;

    // Collect tasks first so we can sort by due date
    const taskItems = [];
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- [ ]") && !trimmed.startsWith("- [x]")) return;
      const isDone = trimmed.startsWith("- [x]");
      const rawText = trimmed.replace(/- \[[ x]\]/, "").trim();
      const dateMatch = rawText.match(DATE_RE);
      const dueDate = dateMatch ? dateMatch[1] : "";
      taskItems.push({ lineIndex, isDone, rawText, dueDate });
    });

    // Sort: undone with due date first (ascending), undone without date, done tasks last
    taskItems.sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    const todayTasks = [];
    const otherTasks = [];
    const completedTasks = [];

    taskItems.forEach((task) => {
      if (task.isDone) {
        completedTasks.push(task);
      } else if (task.dueDate === todayStr) {
        todayTasks.push(task);
      } else {
        otherTasks.push(task);
      }
    });

    function renderSectionDivider(label) {
      const divider = document.createElement("div");
      divider.className = "todo-section-divider";

      const text = document.createElement("span");
      text.className = "todo-section-label";
      text.textContent = label;
      divider.appendChild(text);

      todoListEl.appendChild(divider);
    }

    function renderTask({ lineIndex, isDone, rawText, dueDate }) {
      count++;
      const taskText = rawText.replace(DATE_RE, "").trim();
      const isEditing = editingLineIndex === lineIndex;
      const matchedTag = taskText.match(/#[a-zA-Z0-9_-]+/);
      const tag = matchedTag ? matchedTag[0] : "";
      const tagColor = tag ? getTagColor(tag.toLowerCase()) : "";
      const isTodayTask = dueDate === todayStr;

      _parsedDueTasks.push({ text: rawText.replace(DATE_RE, "").replace(/#[a-zA-Z0-9_-]+/, "").trim(), date: dueDate, isDone });

      const div = document.createElement("div");
      div.className = `todo-item ${isDone ? "done" : ""}`;
      if (isTodayTask) {
        div.classList.add("is-today");
      }
      if (tagColor) {
        div.classList.add("tagged");
        div.style.setProperty("--tag-color", tagColor);
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isDone;
      checkbox.disabled = isEditing;
      checkbox.addEventListener("change", () => toggleTodo(lineIndex, checkbox.checked));

      let textNode;
      if (isEditing) {
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.className = "todo-edit-input";
        editInput.value = taskText;
        editInput.setAttribute("data-edit-line", String(lineIndex));
        editInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") commitInlineEdit(lineIndex);
          if (e.key === "Escape") cancelInlineEdit();
        });
        textNode = editInput;
      } else {
        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = taskText;
        textSpan.title = "Click to edit";
        textSpan.style.cursor = "text";
        textSpan.addEventListener("click", () => startInlineEdit(lineIndex));
        textNode = textSpan;
      }

      const actions = document.createElement("div");
      actions.className = "todo-actions";

      if (tag) {
        const tagPill = document.createElement("span");
        tagPill.className = "tag-pill";
        tagPill.textContent = tag;
        actions.appendChild(tagPill);
      }

      if (isEditing) {
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "todo-action";
        saveBtn.title = "Save task";
        saveBtn.setAttribute("aria-label", "Save task");
        saveBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">check</span>';
        saveBtn.addEventListener("click", () => commitInlineEdit(lineIndex));

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "todo-action";
        cancelBtn.title = "Cancel edit";
        cancelBtn.setAttribute("aria-label", "Cancel edit");
        cancelBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
        cancelBtn.addEventListener("click", () => cancelInlineEdit());

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
      } else {
        const dueDateBtn = document.createElement("button");
        dueDateBtn.type = "button";
        dueDateBtn.className = "todo-action";
        dueDateBtn.title = dueDate ? `Due: ${dueDate} — click to change` : "Set due date";
        dueDateBtn.setAttribute("aria-label", "Set due date");
        dueDateBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">event</span>';
        if (dueDate) dueDateBtn.classList.add("has-due");
        dueDateBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          createDatePicker(dueDateBtn, (dateStr) => setDueDate(lineIndex, dateStr));
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "todo-action";
        deleteBtn.title = "Delete task";
        deleteBtn.setAttribute("aria-label", "Delete task");
        deleteBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
        deleteBtn.addEventListener("click", () => deleteTodo(lineIndex));
        actions.appendChild(dueDateBtn);
        actions.appendChild(deleteBtn);
      }

      const inner = document.createElement("div");
      inner.className = "todo-inner";
      inner.appendChild(textNode);
      if (dueDate && !isEditing) {
        const dateLabel = document.createElement("span");
        dateLabel.className = "todo-due-label" + (dueDate < todayStr ? " overdue" : dueDate === todayStr ? " due-today" : "");
        dateLabel.textContent = dueDate;
        inner.appendChild(dateLabel);
      }

      div.appendChild(checkbox);
      div.appendChild(inner);
      div.appendChild(actions);
      todoListEl.appendChild(div);

      if (isEditing) {
        setTimeout(() => {
          const input = document.querySelector(`.todo-edit-input[data-edit-line="${lineIndex}"]`);
          if (!input) return;
          input.focus();
          input.select();
        }, 0);
      }
    }

    if (todayTasks.length > 0) {
      renderSectionDivider("TODAY");
      todayTasks.forEach(renderTask);
    }

    if (otherTasks.length > 0) {
      renderSectionDivider("OTHER");
      otherTasks.forEach(renderTask);
    }

    if (completedTasks.length > 0) {
      renderSectionDivider("COMPLETED");
      completedTasks.forEach(renderTask);
    }

    taskCountEl.textContent = String(count);
  }

  function setDueDate(lineIndex, dateStr) {
    const md = markdownInputEl.value;
    const parts = md.split("## TASKS");
    if (parts.length < 2) return;
    const lines = parts[1].split("\n");
    if (!lines[lineIndex]) return;
    // Remove any existing date, then append new one
    lines[lineIndex] = lines[lineIndex].replace(DATE_RE, "").trimEnd();
    if (dateStr) lines[lineIndex] += ` @${dateStr}`;
    const updatedMd = parts[0] + "## TASKS" + lines.join("\n");
    onSaveMarkdown(updatedMd);
  }

  function bindInput() {
    todoInputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target.value.trim() === "") return;

      let md = markdownInputEl.value;
      if (!md.includes("## TASKS")) md += "\n\n## TASKS";

      const updatedMd = `${md.trim()}\n- [ ] ${e.target.value.trim()}`;
      e.target.value = "";
      const existing = document.getElementById("todo-date-picker");
      if (existing) existing.remove();
      onSaveMarkdown(updatedMd);
    });

    // keep this block but with no @ trigger — just a dummy to satisfy syntax
    if (false) {
    }
  }

  function getDueTasks() {
    return _parsedDueTasks.filter((t) => t.date);
  }

  return {
    parseTodos,
    bindInput,
    getDueTasks,
  };
}
