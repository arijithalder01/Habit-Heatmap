/* ---------- Config ---------- */
const STORAGE_KEY = 'habit-heatmap-data-v1';
const WEEKS = 53;
const COLORS = [
  { name: 'green', hex: '#3fb950' },
  { name: 'blue', hex: '#58a6ff' },
  { name: 'purple', hex: '#a371f7' },
  { name: 'pink', hex: '#f778ba' },
  { name: 'orange', hex: '#f0883e' },
  { name: 'red', hex: '#f85149' },
  { name: 'teal', hex: '#39c5cf' },
  { name: 'yellow', hex: '#e3b341' },
];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ---------- State ---------- */
let state = loadState();
let editingHabitId = null; // set when modal opened in "edit" mode

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to default */ }
  const defaultHabit = { id: uid(), name: 'Read', color: COLORS[0].hex };
  return { habits: [defaultHabit], logs: { [defaultHabit.id]: {} }, activeHabitId: defaultHabit.id };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function activeHabit() {
  return state.habits.find(h => h.id === state.activeHabitId) || state.habits[0];
}

/* ---------- Date helpers ---------- */
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(date, n) {
  const c = new Date(date);
  c.setDate(c.getDate() + n);
  return c;
}

/* Build a WEEKS x 7 grid of dates ending on the most recent Saturday on/after today,
   starting from the Sunday that begins (WEEKS-1) weeks before that. */
function buildDateGrid() {
  const today = startOfDay(new Date());
  const endWeekStart = addDays(today, -today.getDay()); // Sunday of current week
  const gridStart = addDays(endWeekStart, -(WEEKS - 1) * 7);
  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(gridStart, w * 7 + d));
    }
    weeks.push(week);
  }
  return { weeks, today };
}

/* ---------- Color helpers ---------- */
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function levelColor(hex, level) {
  if (level <= 0) return '#161b22';
  const { r, g, b } = hexToRgb(hex);
  const alpha = [0, 0.35, 0.55, 0.75, 1][level];
  // blend toward panel background for low levels, full color at level 4
  const bg = { r: 22, g: 27, b: 34 };
  const mix = c => Math.round(bg[c] + (hexToRgb(hex)[c] - bg[c]) * alpha);
  return `rgb(${mix('r')}, ${mix('g')}, ${mix('b')})`;
}

/* ---------- Rendering ---------- */
function renderHabitTabs() {
  const wrap = document.getElementById('habitTabs');
  wrap.innerHTML = '';
  state.habits.forEach(h => {
    const tab = document.createElement('div');
    tab.className = 'habit-tab' + (h.id === state.activeHabitId ? ' active' : '');
    tab.style.color = h.id === state.activeHabitId ? h.color : '';
    tab.innerHTML = `<span class="dot" style="background:${h.color}"></span>${escapeHtml(h.name)}<span class="edit">✎</span>`;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit')) {
        openHabitModal(h.id);
      } else {
        state.activeHabitId = h.id;
        saveState();
        renderAll();
      }
    });
    wrap.appendChild(tab);
  });
}

function renderMonthLabels(weeks) {
  const wrap = document.getElementById('monthLabels');
  wrap.innerHTML = '';
  let lastMonth = -1;
  weeks.forEach(week => {
    const first = week[0];
    const label = document.createElement('span');
    if (first.getMonth() !== lastMonth && first.getDate() <= 7) {
      label.textContent = MONTH_NAMES[first.getMonth()];
      lastMonth = first.getMonth();
    }
    wrap.appendChild(label);
  });
}

function renderDayLabels() {
  const wrap = document.getElementById('dayLabels');
  wrap.innerHTML = '';
  DAY_LABELS.forEach(l => {
    const s = document.createElement('span');
    s.textContent = l;
    wrap.appendChild(s);
  });
}

function renderGrid() {
  const habit = activeHabit();
  const logs = state.logs[habit.id] || {};
  const { weeks, today } = buildDateGrid();
  renderMonthLabels(weeks);

  const grid = document.getElementById('heatmapGrid');
  grid.innerHTML = '';
  const tooltip = document.getElementById('tooltip');

  weeks.forEach(week => {
    week.forEach(date => {
      const cell = document.createElement('div');
      const key = toKey(date);
      const isFuture = date > today;
      const level = logs[key] || 0;
      cell.className = 'cell' + (isFuture ? ' future' : '');
      cell.style.background = levelColor(habit.color, level);
      cell.dataset.date = key;

      if (!isFuture) {
        cell.addEventListener('click', () => {
          const current = logs[key] || 0;
          const next = (current + 1) % 5;
          logs[key] = next;
          state.logs[habit.id] = logs;
          saveState();
          cell.style.background = levelColor(habit.color, next);
          renderStats();
        });
      }

      cell.addEventListener('mouseenter', (e) => {
        tooltip.textContent = `${key} — level ${level}${isFuture ? ' (future)' : ''}`;
        tooltip.classList.remove('hidden');
        positionTooltip(e);
      });
      cell.addEventListener('mousemove', positionTooltip);
      cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));

      grid.appendChild(cell);
    });
  });
}

function positionTooltip(e) {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.left = e.clientX + 14 + 'px';
  tooltip.style.top = e.clientY + 14 + 'px';
}

function renderStats() {
  const habit = activeHabit();
  const logs = state.logs[habit.id] || {};
  const today = startOfDay(new Date());

  // current streak
  let current = 0;
  let cursor = new Date(today);
  // if today isn't logged yet, start counting from yesterday so a still-open day doesn't reset the streak
  if (!(logs[toKey(cursor)] > 0)) cursor = addDays(cursor, -1);
  while (logs[toKey(cursor)] > 0) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // longest streak across all recorded dates
  const loggedDates = Object.keys(logs).filter(k => logs[k] > 0).sort();
  let longest = 0, run = 0, prev = null;
  loggedDates.forEach(k => {
    const d = new Date(k + 'T00:00:00');
    if (prev && addDays(prev, 1).getTime() === d.getTime()) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  });

  const total = loggedDates.length;

  let loggedLast30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (logs[toKey(d)] > 0) loggedLast30++;
  }
  const rate = Math.round((loggedLast30 / 30) * 100);

  document.getElementById('statCurrent').textContent = current;
  document.getElementById('statBest').textContent = longest;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statRate').textContent = rate + '%';
}

function renderAll() {
  renderHabitTabs();
  renderDayLabels();
  renderGrid();
  renderStats();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- Modal ---------- */
const modal = document.getElementById('habitModal');
const nameInput = document.getElementById('habitNameInput');
const colorOptionsWrap = document.getElementById('colorOptions');
let selectedColor = COLORS[0].hex;

function buildColorSwatches() {
  colorOptionsWrap.innerHTML = '';
  COLORS.forEach(c => {
    const el = document.createElement('div');
    el.className = 'color-swatch';
    el.style.background = c.hex;
    el.dataset.hex = c.hex;
    el.addEventListener('click', () => {
      selectedColor = c.hex;
      [...colorOptionsWrap.children].forEach(ch => ch.classList.remove('selected'));
      el.classList.add('selected');
    });
    colorOptionsWrap.appendChild(el);
  });
}
buildColorSwatches();

function openHabitModal(habitId) {
  editingHabitId = habitId || null;
  const habit = habitId ? state.habits.find(h => h.id === habitId) : null;
  document.getElementById('modalTitle').textContent = habit ? 'Edit habit' : 'New habit';
  nameInput.value = habit ? habit.name : '';
  selectedColor = habit ? habit.color : COLORS[state.habits.length % COLORS.length].hex;
  [...colorOptionsWrap.children].forEach(ch => ch.classList.toggle('selected', ch.dataset.hex === selectedColor));
  document.getElementById('deleteHabitBtn').classList.toggle('hidden', !habit || state.habits.length <= 1);
  modal.classList.remove('hidden');
  nameInput.focus();
}
function closeHabitModal() {
  modal.classList.add('hidden');
  editingHabitId = null;
}

document.getElementById('addHabitBtn').addEventListener('click', () => openHabitModal(null));
document.getElementById('cancelHabitBtn').addEventListener('click', closeHabitModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeHabitModal(); });

document.getElementById('saveHabitBtn').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  if (editingHabitId) {
    const habit = state.habits.find(h => h.id === editingHabitId);
    habit.name = name;
    habit.color = selectedColor;
  } else {
    const habit = { id: uid(), name, color: selectedColor };
    state.habits.push(habit);
    state.logs[habit.id] = {};
    state.activeHabitId = habit.id;
  }
  saveState();
  closeHabitModal();
  renderAll();
});

document.getElementById('deleteHabitBtn').addEventListener('click', () => {
  if (!editingHabitId) return;
  if (!confirm('Delete this habit and all its history? This can\'t be undone.')) return;
  state.habits = state.habits.filter(h => h.id !== editingHabitId);
  delete state.logs[editingHabitId];
  if (state.activeHabitId === editingHabitId) {
    state.activeHabitId = state.habits[0] ? state.habits[0].id : null;
  }
  saveState();
  closeHabitModal();
  renderAll();
});

/* ---------- PNG export ---------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const habit = activeHabit();
  const logs = state.logs[habit.id] || {};
  const { weeks, today } = buildDateGrid();

  const cell = 12, gap = 3, leftPad = 34, topPad = 46, rightPad = 20, bottomPad = 20;
  const w = leftPad + WEEKS * (cell + gap) + rightPad;
  const h = topPad + 7 * (cell + gap) + bottomPad;

  const canvas = document.getElementById('exportCanvas');
  canvas.width = w * 2; // 2x for crisper export
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#e6edf3';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillText(`${habit.name} — habit heatmap`, leftPad, 22);

  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#8b949e';
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (first.getMonth() !== lastMonth && first.getDate() <= 7) {
      ctx.fillText(MONTH_NAMES[first.getMonth()], leftPad + wi * (cell + gap), topPad - 8);
      lastMonth = first.getMonth();
    }
  });

  weeks.forEach((week, wi) => {
    week.forEach((date, di) => {
      const key = toKey(date);
      const isFuture = date > today;
      const level = logs[key] || 0;
      ctx.fillStyle = isFuture ? '#0d1117' : levelColor(habit.color, level);
      const x = leftPad + wi * (cell + gap);
      const y = topPad + di * (cell + gap);
      roundRect(ctx, x, y, cell, cell, 3);
      ctx.fill();
    });
  });

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${habit.name.toLowerCase().replace(/\s+/g, '-')}-heatmap.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- Init ---------- */
if (!state.activeHabitId && state.habits[0]) state.activeHabitId = state.habits[0].id;
renderAll();
