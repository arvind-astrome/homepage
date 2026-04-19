export function renderCalendars(container) {
  container.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);

    const wrap = document.createElement("div");
    wrap.className = "p-2 bg-slate-900/40 rounded border border-slate-800";
    wrap.innerHTML = `<div class="text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-tighter">${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}</div>`;

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    ["S", "M", "T", "W", "T", "F", "S"].forEach((day) => {
      grid.innerHTML += `<div class="text-slate-800 font-bold">${day}</div>`;
    });

    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    for (let j = 0; j < first; j++) grid.innerHTML += "<div></div>";

    for (let day = 1; day <= days; day++) {
      const cls = i === 0 && day === new Date().getDate() ? "curr-day" : "text-slate-600";
      grid.innerHTML += `<div class="${cls}">${day}</div>`;
    }

    wrap.appendChild(grid);
    container.appendChild(wrap);
  }
}

export function startClock(clockEl) {
  setInterval(() => {
    clockEl.textContent = new Date().toLocaleTimeString("en-GB");
  }, 1000);
}
