export function createTodoManager({
  markdownInputEl,
  todoListEl,
  taskCountEl,
  todoInputEl,
  onSaveMarkdown,
}) {
  let editingLineIndex = null;

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

    const lines = taskSection.split("\n");
    let count = 0;

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- [ ]") && !trimmed.startsWith("- [x]")) return;

      count++;
      const isDone = trimmed.startsWith("- [x]");
      const taskText = trimmed.replace(/- \[[ x]\]/, "").trim();
      const isEditing = editingLineIndex === lineIndex;
      const matchedTag = taskText.match(/#[a-zA-Z0-9_-]+/);
      const tag = matchedTag ? matchedTag[0] : "";
      const tagColor = tag ? getTagColor(tag.toLowerCase()) : "";

      const div = document.createElement("div");
      div.className = `todo-item ${isDone ? "done" : ""}`;
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
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "todo-action";
        deleteBtn.title = "Delete task";
        deleteBtn.setAttribute("aria-label", "Delete task");
        deleteBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
        deleteBtn.addEventListener("click", () => deleteTodo(lineIndex));
        actions.appendChild(deleteBtn);
      }

      div.appendChild(checkbox);
      div.appendChild(textNode);
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
    });

    taskCountEl.textContent = String(count);
  }

  function bindInput() {
    todoInputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target.value.trim() === "") return;

      let md = markdownInputEl.value;
      if (!md.includes("## TASKS")) md += "\n\n## TASKS";

      const updatedMd = `${md.trim()}\n- [ ] ${e.target.value.trim()}`;
      e.target.value = "";
      onSaveMarkdown(updatedMd);
    });
  }

  return {
    parseTodos,
    bindInput,
  };
}
