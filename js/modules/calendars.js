function getOrCreateTooltip() {
  let tip = document.getElementById("cal-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "cal-tooltip";
    tip.className = "cal-tooltip hidden";
    document.body.appendChild(tip);
  }
  return tip;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function renderCalendars(container, dueTasks = []) {
  container.innerHTML = "";

  const dueDateMap = new Map();
  dueTasks.forEach(({ text, date, isDone }) => {
    if (!date) return;
    if (!dueDateMap.has(date)) dueDateMap.set(date, []);
    dueDateMap.get(date).push({ text, isDone });
  });

  const tooltip = getOrCreateTooltip();
  const today = new Date();
  let monthOffset = Number(container.dataset.monthOffset || "0");

  function renderMonth() {
    container.innerHTML = "";
    tooltip.classList.add("hidden");

    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    const year = d.getFullYear();
    const month = d.getMonth();

    const wrap = document.createElement("div");
    wrap.className = "p-2 bg-slate-900/40 rounded border border-slate-800";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between mb-1";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "px-1 rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500";
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.textContent = "‹";
    prevBtn.addEventListener("click", () => {
      monthOffset -= 1;
      container.dataset.monthOffset = String(monthOffset);
      renderMonth();
    });

    const title = document.createElement("div");
    title.className = "text-[9px] font-bold text-slate-500 uppercase tracking-tighter";
    title.textContent = `${d.toLocaleString("default", { month: "short" })} ${year}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "px-1 rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500";
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.textContent = "›";
    nextBtn.addEventListener("click", () => {
      monthOffset += 1;
      container.dataset.monthOffset = String(monthOffset);
      renderMonth();
    });

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    wrap.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    ["S", "M", "T", "W", "T", "F", "S"].forEach((day) => {
      const el = document.createElement("div");
      el.className = "text-slate-800 font-bold";
      el.textContent = day;
      grid.appendChild(el);
    });

    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();

    for (let j = 0; j < first; j++) {
      grid.appendChild(document.createElement("div"));
    }

    for (let day = 1; day <= days; day++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
      const isToday =
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();
      const hasDue = dueDateMap.has(dateStr);

      const cell = document.createElement("div");
      cell.textContent = day;

      if (isToday && hasDue) {
        cell.className = "curr-day due-day";
      } else if (isToday) {
        cell.className = "curr-day";
      } else if (hasDue) {
        cell.className = "due-day";
      } else {
        cell.className = "text-slate-600";
      }

      if (hasDue) {
        const tasks = dueDateMap.get(dateStr);
        cell.addEventListener("mouseenter", () => {
          tooltip.innerHTML = tasks
            .map(
              (t) =>
                `<div class="cal-tooltip-task${t.isDone ? " done" : ""}">${t.text}</div>`
            )
            .join("");
          const rect = cell.getBoundingClientRect();
          tooltip.style.top = `${rect.bottom + 6}px`;
          tooltip.style.left = `${rect.left}px`;
          tooltip.classList.remove("hidden");
        });
        cell.addEventListener("mouseleave", () => {
          tooltip.classList.add("hidden");
        });
      }

      grid.appendChild(cell);
    }

    wrap.appendChild(grid);
    container.appendChild(wrap);
  }

  renderMonth();
}

export function startClock(clockEl) {
  setInterval(() => {
    clockEl.textContent = new Date().toLocaleTimeString("en-GB");
  }, 1000);
}
