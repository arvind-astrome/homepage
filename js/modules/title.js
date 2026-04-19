export function setupEditableTitle({
  titleEl,
  inputEl,
  storageKey,
  defaultTitle,
}) {
  const savedTitle = localStorage.getItem(storageKey) || defaultTitle;
  titleEl.textContent = savedTitle;

  function commitTitle() {
    const nextTitle = inputEl.value.trim() || defaultTitle;
    titleEl.textContent = nextTitle;
    localStorage.setItem(storageKey, nextTitle);
    inputEl.classList.add("hidden");
    titleEl.classList.remove("hidden");
  }

  function cancelTitle() {
    inputEl.classList.add("hidden");
    titleEl.classList.remove("hidden");
  }

  titleEl.addEventListener("click", () => {
    inputEl.value = titleEl.textContent;
    titleEl.classList.add("hidden");
    inputEl.classList.remove("hidden");
    inputEl.focus();
    inputEl.select();
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commitTitle();
    if (e.key === "Escape") cancelTitle();
  });

  inputEl.addEventListener("blur", () => {
    commitTitle();
  });
}
