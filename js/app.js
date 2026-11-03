/* Cultivar — planejamento semanal a partir de objetivos.
   Tudo roda no navegador; os dados ficam no localStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'cultivar.dados.v1';
  const BACKUP_KEY = 'cultivar.ultimoBackup';
  const SCHEMA = 1;
  const MAX_PRIORITIES = 3;

  // ---------- utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = (n) => String(n).padStart(2, '0');

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const dow = (iso) => (fromISO(iso).getDay() + 6) % 7; // 0 = segunda … 6 = domingo
  const weekStart = (iso) => addDays(iso, -dow(iso));
  const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const DAYS_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const DAYS_LONG = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
  const DAYS_TITLE = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const DAYS_PLURAL = ['às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados', 'aos domingos'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtLong = (iso) => { const d = fromISO(iso); return `${DAYS_LONG[dow(iso)]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
  const fmtShort = (iso) => { const d = fromISO(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
  const fmtDayShort = (iso) => `${DAYS_SHORT[dow(iso)]}, ${fmtShort(iso)}`;
  const fmtMinutes = (m) => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };
  function relativeDay(iso) {
    const t = todayISO();
    if (iso === t) return 'hoje';
    if (iso === addDays(t, 1)) return 'amanhã';
    if (iso === addDays(t, -1)) return 'ontem';
    return fmtDayShort(iso);
  }
  function weekLabel(ws) {
    const we = addDays(ws, 6);
    const a = fromISO(ws), b = fromISO(we);
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MONTHS[b.getMonth()]}`;
    return `${a.getDate()} de ${MONTHS[a.getMonth()]} a ${b.getDate()} de ${MONTHS[b.getMonth()]}`;
  }
  function normalizeLink(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return /^(https?|mailto):/i.test(s) ? s : '';
    return 'https://' + s;
  }
  const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };

  const COLORS = [
    { hex: '#7f9f86', name: 'Sálvia' },
    { hex: '#9b8fc4', name: 'Lavanda' },
    { hex: '#c4a65a', name: 'Mostarda suave' },
    { hex: '#c98e6f', name: 'Terracota' },
    { hex: '#7f9bb5', name: 'Azul névoa' },
    { hex: '#c08a9b', name: 'Rosa antigo' },
    { hex: '#8f9a6a', name: 'Oliva' },
    { hex: '#9a8f86', name: 'Areia' },
  ];

  const PHRASES = [
    'Um passo de cada vez já é caminho.',
    'Hoje não precisa ser perfeito, só presente.',
    'Cuide do essencial e deixe o resto respirar.',
    'Pequenas ações, feitas com carinho, transformam a semana.',
    'Você pode recomeçar a qualquer momento do dia.',
    'Escolha o que importa e siga com calma.',
    'Respire. Comece pelo que é mais leve.',
    'O que você cultiva hoje floresce com o tempo.',
    'Constância gentil vale mais que pressa.',
    'Faça o possível de hoje. Isso já basta.',
  ];

  const PERIODS = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };

  const ICONS = {
    check: 'M5 12.5l4.2 4.2L19 7',
    plus: 'M12 5v14M5 12h14',
    star: 'M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z',
    move: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 9h16M8 3v4M16 3v4M9 14.5h6M13 12.5l2 2-2 2',
    repeat: 'M17 3l3 3-3 3M4 11V10a4 4 0 0 1 4-4h12M7 21l-3-3 3-3M20 13v1a4 4 0 0 1-4 4H4',
    dot: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    note: 'M6 4h9l4 4v12H6zM14 4v5h5M9 13h7M9 16.5h5',
    trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    chevL: 'M15 5l-7 7 7 7',
    chevR: 'M9 5l7 7-7 7',
    close: 'M6 6l12 12M18 6L6 18',
    clock: 'M12 7.5V12l3 2M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z',
    inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    pause: 'M9 6v12M15 6v12',
    play: 'M8 5.5v13l10-6.5z',
    archive: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
    leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19c3-4 6-7 10-9',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

  // ---------- dados ----------
  function seed() {
    const now = new Date().toISOString();
    const start = weekStart(todayISO());
    const ALL = [0, 1, 2, 3, 4, 5, 6];
    const goal = (id, name, why, color) => ({ id, name, why, color, status: 'ativo', createdAt: now });
    const habit = (id, goalId, name, days, minutes) => ({ id, goalId, name, days, minutes, note: '', link: '', startDate: start, createdAt: now });
    return {
      schema: SCHEMA,
      createdAt: now,
      goals: [
        goal('obj-espiritualidade', 'Espiritualidade', 'Fortalecer minha conexão com Deus.', '#9b8fc4'),
        goal('obj-leitura', 'Leitura', 'Cultivar a leitura.', '#7f9f86'),
        goal('obj-atualizacao', 'Atualização profissional', 'Manter-me atualizada para tomar melhores decisões nos negócios.', '#c4a65a'),
      ],
      habits: [
        habit('hab-oracao', 'obj-espiritualidade', 'Oração', ALL, 30),
        habit('hab-leitura', 'obj-leitura', 'Leitura', ALL, 30),
        habit('hab-relatorio-mca', 'obj-atualizacao', 'Ler o relatório da Maria Clara Aromas', [0], 30),
        habit('hab-relatorio-cruzeiro', 'obj-atualizacao', 'Ler o relatório da Cruzeiro Manipulação', [1], 30),
      ],
      logs: {},
      tasks: [],
    };
  }

  function normalize(d) {
    const out = {
      schema: SCHEMA,
      createdAt: d.createdAt || new Date().toISOString(),
      goals: [], habits: [], logs: {}, tasks: [],
    };
    for (const g of d.goals || []) {
      if (!g || !g.id || !g.name) continue;
      out.goals.push({
        id: String(g.id), name: String(g.name), why: String(g.why || ''),
        color: /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : COLORS[0].hex,
        status: ['ativo', 'pausado', 'arquivado'].includes(g.status) ? g.status : 'ativo',
        createdAt: g.createdAt || out.createdAt,
      });
    }
    for (const h of d.habits || []) {
      if (!h || !h.id || !h.name) continue;
      const days = Array.isArray(h.days) ? [...new Set(h.days.map(Number).filter((n) => n >= 0 && n <= 6))].sort() : [];
      out.habits.push({
        id: String(h.id), goalId: h.goalId ? String(h.goalId) : '', name: String(h.name),
        days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        minutes: toInt(h.minutes), note: String(h.note || ''), link: String(h.link || ''),
        startDate: isISODate(h.startDate) ? h.startDate : '2000-01-01',
        createdAt: h.createdAt || out.createdAt,
      });
    }
    const logs = d.logs && typeof d.logs === 'object' ? d.logs : {};
    for (const hid of Object.keys(logs)) {
      const per = logs[hid];
      if (!per || typeof per !== 'object') continue;
      for (const iso of Object.keys(per)) {
        const l = per[iso];
        if (!isISODate(iso) || !l) continue;
        (out.logs[hid] ||= {})[iso] = { minutes: Math.max(0, parseInt(l.minutes, 10) || 0), done: !!l.done, note: String(l.note || '') };
      }
    }
    for (const t of d.tasks || []) {
      if (!t || !t.id || !t.title) continue;
      out.tasks.push({
        id: String(t.id), title: String(t.title),
        date: isISODate(t.date) ? t.date : null,
        period: ['manha', 'tarde', 'noite', 'horario'].includes(t.period) ? t.period : '',
        time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : '',
        duration: toInt(t.duration), goalId: t.goalId ? String(t.goalId) : '',
        priority: !!t.priority, note: String(t.note || ''), link: String(t.link || ''),
        done: !!t.done, doneAt: t.doneAt || null,
        order: Number.isFinite(t.order) ? t.order : 0,
        createdAt: t.createdAt || out.createdAt,
      });
    }
    return out;
  }

  function looksValid(d) {
    return d && typeof d === 'object' && Array.isArray(d.goals) && Array.isArray(d.habits) && Array.isArray(d.tasks);
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* armazenamento indisponível */ }
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (looksValid(d)) return normalize(d);
      } catch (e) { /* continua abaixo */ }
      try { localStorage.setItem(STORAGE_KEY + '.recuperacao', raw); } catch (e) { /* ignora */ }
    }
    const s = seed();
    persist(s);
    return s;
  }

  function persist(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  let state = load();

  function commit() {
    if (!persist(state)) toast('Não foi possível salvar neste navegador. Exporte um backup para não perder dados.');
    render();
  }

  // ---------- consultas ----------
  const goalById = (id) => state.goals.find((g) => g.id === id);
  const habitById = (id) => state.habits.find((h) => h.id === id);
  const taskById = (id) => state.tasks.find((t) => t.id === id);
  const goalColor = (id) => goalById(id)?.color || '#b9b2a6';

  function goalIsActive(goalId) {
    if (!goalId) return true;
    const g = goalById(goalId);
    return !g || g.status === 'ativo';
  }
  const habitsOn = (iso) => state.habits.filter((h) => h.days.includes(dow(iso)) && iso >= h.startDate && goalIsActive(h.goalId));
  const getLog = (hid, iso) => state.logs[hid]?.[iso] || null;
  function habitDone(h, iso) {
    const l = getLog(h.id, iso);
    if (!l) return false;
    return h.minutes ? l.minutes >= h.minutes : l.done;
  }
  const byOrder = (a, b) => (a.order - b.order) || a.createdAt.localeCompare(b.createdAt);
  const tasksOn = (date) => state.tasks.filter((t) => t.date === date).sort(byOrder);
  const priorityCount = (date, exceptId) => state.tasks.filter((t) => t.date === date && t.priority && !t.done && t.id !== exceptId).length;
  const nextOrder = (date) => state.tasks.filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.order), -1) + 1;

  function minutesOn(iso) {
    let m = 0;
    for (const t of tasksOn(iso)) if (t.duration) m += t.duration;
    for (const h of habitsOn(iso)) if (h.minutes) m += h.minutes;
    return m;
  }

  function habitWeek(h, ws) {
    let scheduled = 0, done = 0, minutes = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDays(ws, i);
      if (!h.days.includes(i) || iso < h.startDate) continue;
      scheduled++;
      if (habitDone(h, iso)) done++;
      minutes += getLog(h.id, iso)?.minutes || 0;
    }
    return { scheduled, done, minutes, target: (h.minutes || 0) * scheduled };
  }

  function scheduleText(h) {
    const d = h.days;
    let s;
    if (d.length === 7) s = 'todos os dias';
    else if (d.length === 5 && [0, 1, 2, 3, 4].every((x) => d.includes(x))) s = 'de segunda a sexta';
    else if (d.length === 2 && d.includes(5) && d.includes(6)) s = 'nos fins de semana';
    else if (d.length === 1) s = DAYS_PLURAL[d[0]];
    else s = d.map((x) => DAYS_SHORT[x]).join(', ');
    return h.minutes ? `${s} · ${h.minutes} min` : s;
  }
  const habitKind = (h) => (h.days.length === 1 ? 'Ação semanal' : 'Hábito');

  // ---------- mutações ----------
  function addTask(data) {
    const t = {
      id: uid(), title: data.title.trim(), date: data.date || null,
      period: data.period || '', time: data.time || '', duration: toInt(data.duration),
      goalId: data.goalId || '', priority: false, note: data.note || '', link: data.link || '',
      done: false, doneAt: null, order: nextOrder(data.date || null), createdAt: new Date().toISOString(),
    };
    if (data.priority) {
      if (t.date && priorityCount(t.date) >= MAX_PRIORITIES) toast('Este dia já tem três prioridades. A tarefa foi salva sem estrela.');
      else t.priority = true;
    }
    state.tasks.push(t);
    return t;
  }

  function moveTask(id, date, beforeId) {
    const t = taskById(id);
    if (!t) return;
    date = date || null;
    const changedDay = t.date !== date;
    t.date = date;
    if (changedDay && t.priority && date && priorityCount(date, t.id) >= MAX_PRIORITIES) {
      t.priority = false;
      toast('O novo dia já tinha três prioridades, então a estrela foi retirada.');
    }
    const list = tasksOn(date).filter((x) => x.id !== id);
    let idx = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
    if (idx < 0) idx = list.length;
    list.splice(idx, 0, t);
    list.forEach((x, i) => { x.order = i; });
  }

  function setLog(hid, iso, minutes, done, note) {
    const has = minutes > 0 || done || (note && note.trim());
    if (!has) {
      if (state.logs[hid]) {
        delete state.logs[hid][iso];
        if (!Object.keys(state.logs[hid]).length) delete state.logs[hid];
      }
      return;
    }
    (state.logs[hid] ||= {})[iso] = { minutes: Math.max(0, minutes | 0), done: !!done, note: (note || '').trim() };
  }

  // ---------- rotas ----------
  let weekAnchor = weekStart(todayISO());
  let lastRoute = null;
  let focusAfterRender = null;
  const view = $('#view');

  function route() {
    const r = (location.hash.replace(/^#\/?/, '') || 'hoje').split('?')[0];
    return ['hoje', 'semana', 'objetivos'].includes(r) ? r : 'hoje';
  }

  function render() {
    const r = route();
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.route === r) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.dataset.route = r;
    const scrollY = window.scrollY;
    view.innerHTML = r === 'semana' ? viewWeek() : r === 'objetivos' ? viewGoals() : viewToday();
    const titles = { hoje: 'Hoje', semana: 'Minha semana', objetivos: 'Meus objetivos' };
    document.title = `${titles[r]} · Cultivar`;
    if (r !== lastRoute) {
      window.scrollTo(0, 0);
      if (r === 'semana' && window.matchMedia('(max-width: 719px)').matches) {
        const card = view.querySelector('.day-card.is-today');
        if (card) card.scrollIntoView({ block: 'start' });
      }
    } else {
      window.scrollTo(0, scrollY);
    }
    lastRoute = r;
    if (focusAfterRender) {
      const el = view.querySelector(focusAfterRender);
      if (el) el.focus({ preventScroll: true });
      focusAfterRender = null;
    }
  }

  // ---------- componentes ----------
  function taskMeta(t, opts = {}) {
    const bits = [];
    if (opts.showDate) bits.push(`<span class="chip">${t.date ? esc(relativeDay(t.date)) : 'Depois'}</span>`);
    if (t.period === 'horario' && t.time) bits.push(`<span class="chip">${icon('clock')}${esc(t.time)}</span>`);
    else if (PERIODS[t.period]) bits.push(`<span class="chip">${esc(PERIODS[t.period])}</span>`);
    if (t.duration) bits.push(`<span class="chip">${fmtMinutes(t.duration)}</span>`);
    const g = goalById(t.goalId);
    if (g && !opts.hideGoal) bits.push(`<span class="chip goal-chip" style="--c:${g.color}"><i class="dot"></i>${esc(g.name)}</span>`);
    if (t.link) bits.push(`<span class="chip" title="Tem link">${icon('link')}</span>`);
    if (t.note && !opts.showNote) bits.push(`<span class="chip" title="Tem nota">${icon('note')}</span>`);
    return bits.length ? `<span class="meta">${bits.join('')}</span>` : '';
  }

  function taskRow(t, opts = {}) {
    const link = normalizeLink(t.link);
    return `
      <li class="task${t.done ? ' is-done' : ''}${t.priority ? ' is-priority' : ''}" data-id="${t.id}" style="--c:${goalColor(t.goalId)}">
        ${opts.draggable ? `<span class="handle" aria-hidden="true" title="Arraste para outro dia">${icon('grip')}</span>` : ''}
        <button class="check" type="button" data-action="toggle-task" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}: ${esc(t.title)}">${icon('check')}</button>
        <button class="task-main" type="button" data-action="edit-task" data-id="${t.id}" aria-label="Editar: ${esc(t.title)}">
          <span class="task-title">${esc(t.title)}</span>
          ${taskMeta(t, opts)}
          ${opts.showNote && t.note ? `<span class="task-note">${esc(t.note.length > 110 ? t.note.slice(0, 110) + '…' : t.note)}</span>` : ''}
        </button>
        <span class="task-actions">
          ${link && !opts.draggable ? `<a class="icon-btn sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link">${icon('link')}</a>` : ''}
          ${opts.noStar ? '' : `<button class="icon-btn sm star${t.priority ? ' on' : ''}" type="button" data-action="toggle-priority" data-id="${t.id}" aria-pressed="${t.priority}" title="${t.priority ? 'Tirar das prioridades' : 'Marcar como prioridade'}" aria-label="${t.priority ? 'Tirar das prioridades' : 'Marcar como prioridade'}">${icon('star')}</button>`}
          <button class="icon-btn sm" type="button" data-action="reschedule" data-id="${t.id}" title="Reagendar" aria-label="Reagendar: ${esc(t.title)}">${icon('move')}</button>
        </span>
      </li>`;
  }

  function quickAdd(date, placeholder, id) {
    return `
      <form class="quick-add" data-form="quick-add" data-date="${date || ''}" autocomplete="off">
        <span class="qa-icon">${icon('plus')}</span>
        <input id="${id}" name="title" type="text" maxlength="200" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" enterkeyhint="done">
        <button class="text-btn" type="button" data-action="quick-more" data-date="${date || ''}" title="Adicionar com mais detalhes">detalhes</button>
      </form>`;
  }

  // ---------- tela: Hoje ----------
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function habitRowToday(h, iso) {
    const done = habitDone(h, iso);
    const log = getLog(h.id, iso);
    const g = goalById(h.goalId);
    const m = log?.minutes || 0;
    const link = normalizeLink(h.link);
    let progress = '';
    if (h.minutes) {
      progress = `<span class="progress-text">${m} de ${h.minutes} min</span>
        <span class="bar" aria-hidden="true"><span style="width:${Math.min(100, Math.round((m / h.minutes) * 100))}%"></span></span>`;
    }
    return `
      <li class="habit${done ? ' is-done' : ''}" style="--c:${g?.color || '#b9b2a6'}">
        <button class="check round" type="button" data-action="habit-toggle" data-habit="${h.id}" data-date="${iso}" aria-pressed="${done}"
          aria-label="${done ? 'Desmarcar' : 'Concluir'}: ${esc(h.name)}">${icon('check')}</button>
        <button class="habit-main" type="button" data-action="habit-log" data-habit="${h.id}" data-date="${iso}" aria-label="Registrar ${esc(h.name)}">
          <span class="task-title">${esc(h.name)}</span>
          <span class="meta"><span class="chip kind-habit">${icon('repeat')}${esc(g ? g.name : habitKind(h))}</span>${progress}</span>
          ${log?.note ? `<span class="task-note">${esc(log.note)}</span>` : ''}
        </button>
        <span class="task-actions">
          ${link ? `<a class="icon-btn sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link">${icon('link')}</a>` : ''}
          ${h.minutes && !done ? `<button class="text-btn" type="button" data-action="habit-log" data-habit="${h.id}" data-date="${iso}">minutos</button>` : ''}
        </span>
      </li>`;
  }

  function viewToday() {
    const iso = todayISO();
    const d = fromISO(iso);
    const dayNum = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const phrase = PHRASES[dayNum % PHRASES.length];
    const habits = habitsOn(iso);
    const tasks = tasksOn(iso);
    const prio = tasks.filter((t) => t.priority);
    const others = tasks.filter((t) => !t.priority).sort((a, b) => (a.done - b.done) || byOrder(a, b));
    const open = state.tasks.filter((t) => t.date && t.date < iso && !t.done).sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
    const habitsDone = habits.filter((h) => habitDone(h, iso)).length;

    return `
      <section class="page page-narrow">
        <header class="page-head">
          <p class="eyebrow">${greeting()}</p>
          <h1 class="date-title">${esc(cap(fmtLong(iso)))}</h1>
          <p class="phrase">${esc(phrase)}</p>
        </header>

        ${quickAdd(iso, 'Nova tarefa para hoje (Enter para salvar)', 'qa-today')}

        <section class="block" aria-labelledby="h-habitos">
          <div class="block-head">
            <h2 id="h-habitos">Hábitos de hoje</h2>
            ${habits.length ? `<span class="count">${habitsDone} de ${habits.length}</span>` : ''}
          </div>
          ${habits.length
            ? `<ul class="list">${habits.map((h) => habitRowToday(h, iso)).join('')}</ul>`
            : `<p class="empty">Nenhum hábito previsto para hoje. Você pode criá-los em <a href="#/objetivos">Meus objetivos</a>.</p>`}
        </section>

        <section class="block" aria-labelledby="h-prioridades">
          <div class="block-head">
            <h2 id="h-prioridades">Prioridades</h2>
            <span class="count">${prio.filter((t) => !t.done).length ? `${prio.filter((t) => t.done).length} de ${prio.length}` : prio.length ? 'tudo feito' : `até ${MAX_PRIORITIES}`}</span>
          </div>
          ${prio.length
            ? `<ul class="list">${prio.map((t) => taskRow(t, { showNote: true })).join('')}</ul>`
            : `<p class="empty">Toque na estrela ${icon('star', 'inline')} de uma tarefa para escolher até três prioridades do dia.</p>`}
        </section>

        <section class="block secondary" aria-labelledby="h-outras">
          <div class="block-head"><h2 id="h-outras">Outras tarefas</h2>${others.length ? `<span class="count">${others.filter((t) => t.done).length} de ${others.length}</span>` : ''}</div>
          ${others.length
            ? `<ul class="list">${others.map((t) => taskRow(t, { showNote: true })).join('')}</ul>`
            : `<p class="empty">Nada mais por aqui.</p>`}
        </section>

        ${open.length ? `
        <details class="block open-tasks">
          <summary><span>Ficaram em aberto em dias anteriores</span><span class="count">${open.length}</span></summary>
          <p class="hint">Elas continuam registradas no dia original. Reagende só as que fizerem sentido.</p>
          <ul class="list">${open.map((t) => taskRow(t, { showDate: true, noStar: true })).join('')}</ul>
        </details>` : ''}
      </section>`;
  }

  // ---------- tela: Minha semana ----------
  function habitPill(h, iso) {
    const done = habitDone(h, iso);
    const log = getLog(h.id, iso);
    const partial = !done && log && log.minutes > 0;
    const status = done ? 'feito' : partial ? `${log.minutes} de ${h.minutes} min` : 'previsto';
    return `<button type="button" class="pill${done ? ' is-done' : ''}${partial ? ' is-partial' : ''}" style="--c:${goalColor(h.goalId)}"
      data-action="habit-log" data-habit="${h.id}" data-date="${iso}" title="${esc(h.name)} — ${status}" aria-label="${esc(h.name)}, ${status}">
      <i class="dot"></i><span class="pill-name">${esc(h.name)}</span>${done ? icon('check') : ''}</button>`;
  }

  function dayCard(iso) {
    const t = todayISO();
    const isToday = iso === t;
    const tasks = tasksOn(iso);
    const habits = habitsOn(iso);
    const mins = minutesOn(iso);
    const i = dow(iso);
    const inputId = `qa-${iso}`;
    return `
      <article class="day-card${isToday ? ' is-today' : ''}${iso < t ? ' is-past' : ''}" aria-label="${esc(cap(fmtLong(iso)))}">
        <header class="day-head">
          <div>
            <h2>${DAYS_TITLE[i]}${isToday ? ' <span class="badge">hoje</span>' : ''}</h2>
            <span class="day-date">${fmtShort(iso)}</span>
          </div>
          ${mins ? `<span class="mins" title="Soma das durações estimadas. Não representa tempo livre.">≈ ${fmtMinutes(mins)} estimados</span>` : ''}
        </header>
        ${habits.length ? `<div class="pills" aria-label="Hábitos do dia">${habits.map((h) => habitPill(h, iso)).join('')}</div>` : ''}
        <ul class="list drop" data-drop="${iso}">
          ${tasks.map((x) => taskRow(x, { draggable: true, hideGoal: true })).join('')}
        </ul>
        ${quickAdd(iso, 'Adicionar', inputId)}
      </article>`;
  }

  function viewWeek() {
    const ws = weekAnchor;
    const isCurrent = ws === weekStart(todayISO());
    const later = tasksOn(null);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return `
      <section class="page page-wide">
        <header class="page-head row-head">
          <div>
            <p class="eyebrow">${isCurrent ? 'Esta semana' : ws < weekStart(todayISO()) ? 'Semana passada' : 'Semana futura'}</p>
            <h1>${esc(cap(weekLabel(ws)))}</h1>
          </div>
          <div class="week-nav">
            <button class="icon-btn" type="button" data-action="week-prev" aria-label="Semana anterior" title="Semana anterior">${icon('chevL')}</button>
            <button class="btn ghost sm" type="button" data-action="week-today" ${isCurrent ? 'disabled' : ''}>Esta semana</button>
            <button class="icon-btn" type="button" data-action="week-next" aria-label="Próxima semana" title="Próxima semana">${icon('chevR')}</button>
          </div>
        </header>
        <p class="hint week-hint">Arraste as tarefas entre os dias ou use ${icon('move', 'inline')} para reagendar.</p>
        <div class="week-grid">
          ${days.map(dayCard).join('')}
          <article class="day-card later-card" aria-label="Depois — tarefas sem data">
            <header class="day-head">
              <div><h2>${icon('inbox', 'inline')} Depois</h2><span class="day-date">sem data definida</span></div>
            </header>
            <ul class="list drop" data-drop="later">
              ${later.map((x) => taskRow(x, { draggable: true, noStar: true, hideGoal: true })).join('')}
            </ul>
            ${later.length ? '' : '<p class="empty small">Guarde aqui o que ainda não tem dia.</p>'}
            ${quickAdd('', 'Guardar para depois', 'qa-later')}
          </article>
        </div>
      </section>`;
  }

  // ---------- tela: Meus objetivos ----------
  function goalCard(g, ws) {
    const habits = state.habits.filter((h) => h.goalId === g.id);
    const tasks = state.tasks.filter((t) => t.goalId === g.id);
    const pending = tasks.filter((t) => !t.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || byOrder(a, b));
    const doneTasks = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const weekTasks = tasks.filter((t) => t.date && t.date >= ws && t.date <= addDays(ws, 6));
    const paused = g.status === 'pausado';
    const archived = g.status === 'arquivado';

    const habitItems = habits.map((h) => {
      const w = habitWeek(h, ws);
      let prog = '';
      if (paused || archived) prog = '';
      else if (w.scheduled === 0) prog = '<span class="progress-text">começa na próxima semana</span>';
      else if (h.minutes) prog = `<span class="progress-text">${w.done} de ${w.scheduled} ${w.scheduled === 1 ? 'dia' : 'dias'} · ${w.minutes} de ${w.target} minutos</span>`;
      else prog = `<span class="progress-text">${w.done} de ${w.scheduled} ${w.scheduled === 1 ? 'dia' : 'dias'}</span>`;
      return `
        <li class="item kind-habit-row">
          <button type="button" class="item-main" data-action="edit-habit" data-id="${h.id}">
            <span class="kind-icon" title="Recorrente">${icon('repeat')}</span>
            <span class="item-text">
              <span class="item-title">${esc(h.name)}</span>
              <span class="item-sub">${esc(habitKind(h))} · ${esc(scheduleText(h))}${h.link ? ' · com link' : ''}${h.note ? ' · com nota' : ''}</span>
              ${prog}
            </span>
          </button>
        </li>`;
    }).join('');

    const taskItems = pending.map((t) => `
        <li class="item kind-task-row${t.done ? ' is-done' : ''}">
          <button type="button" class="item-main" data-action="edit-task" data-id="${t.id}">
            <span class="kind-icon" title="Tarefa pontual">${icon('dot')}</span>
            <span class="item-text">
              <span class="item-title">${esc(t.title)}</span>
              <span class="item-sub">${t.date ? esc(cap(relativeDay(t.date))) : 'Depois'}${t.duration ? ' · ' + fmtMinutes(t.duration) : ''}</span>
            </span>
          </button>
        </li>`).join('');

    return `
      <article class="goal-card${paused ? ' is-paused' : ''}${archived ? ' is-archived' : ''}" style="--c:${g.color}">
        <header class="goal-head">
          <div class="goal-title">
            <h2>${esc(g.name)}${paused ? ' <span class="badge muted">pausado</span>' : ''}</h2>
            ${g.why ? `<p class="why">${esc(g.why)}</p>` : ''}
          </div>
          <div class="goal-actions">
            ${archived ? `
              <button class="btn ghost sm" type="button" data-action="goal-status" data-id="${g.id}" data-status="ativo">${icon('play')}Restaurar</button>
              <button class="icon-btn sm" type="button" data-action="goal-delete" data-id="${g.id}" aria-label="Excluir objetivo" title="Excluir">${icon('trash')}</button>` : `
              <button class="icon-btn sm" type="button" data-action="edit-goal" data-id="${g.id}" aria-label="Editar objetivo" title="Editar">${icon('edit')}</button>
              <button class="icon-btn sm" type="button" data-action="goal-status" data-id="${g.id}" data-status="${paused ? 'ativo' : 'pausado'}" aria-label="${paused ? 'Retomar' : 'Pausar'} objetivo" title="${paused ? 'Retomar' : 'Pausar'}">${icon(paused ? 'play' : 'pause')}</button>
              <button class="icon-btn sm" type="button" data-action="goal-status" data-id="${g.id}" data-status="arquivado" aria-label="Arquivar objetivo" title="Arquivar">${icon('archive')}</button>`}
          </div>
        </header>
        ${paused ? '<p class="hint">Pausado: os hábitos deste objetivo não aparecem em Hoje nem na semana até você retomar.</p>' : ''}
        ${archived ? '' : `
        <div class="goal-section">
          <h3>Hábitos e ações recorrentes</h3>
          ${habits.length ? `<ul class="items">${habitItems}</ul>` : '<p class="empty small">Nenhum hábito ainda.</p>'}
        </div>
        <div class="goal-section">
          <h3>Tarefas pontuais${weekTasks.length ? ` <span class="count">${weekTasks.filter((t) => t.done).length} de ${weekTasks.length} nesta semana</span>` : ''}</h3>
          ${pending.length ? `<ul class="items">${taskItems}</ul>` : '<p class="empty small">Nenhuma tarefa em aberto.</p>'}
          ${doneTasks.length ? `<details class="done-list"><summary>${doneTasks.length} ${doneTasks.length === 1 ? 'concluída' : 'concluídas'}</summary>
            <ul class="items">${doneTasks.slice(0, 15).map((t) => `
              <li class="item is-done"><button type="button" class="item-main" data-action="edit-task" data-id="${t.id}">
                <span class="kind-icon">${icon('check')}</span><span class="item-text"><span class="item-title">${esc(t.title)}</span>
                <span class="item-sub">${t.date ? esc(fmtDayShort(t.date)) : 'sem data'}</span></span></button></li>`).join('')}
            </ul></details>` : ''}
        </div>
        <div class="goal-foot">
          <button class="btn ghost sm" type="button" data-action="new-habit" data-goal="${g.id}">${icon('repeat')}Hábito</button>
          <button class="btn ghost sm" type="button" data-action="new-task" data-goal="${g.id}">${icon('dot')}Tarefa</button>
        </div>`}
      </article>`;
  }

  function viewGoals() {
    const ws = weekStart(todayISO());
    const active = state.goals.filter((g) => g.status !== 'arquivado');
    const archived = state.goals.filter((g) => g.status === 'arquivado');
    const orphanHabits = state.habits.filter((h) => !h.goalId || !goalById(h.goalId));
    return `
      <section class="page page-narrow">
        <header class="page-head row-head">
          <div>
            <p class="eyebrow">O que você está cultivando</p>
            <h1>Meus objetivos</h1>
          </div>
          <button class="btn primary" type="button" data-action="new-goal">${icon('plus')}Novo objetivo</button>
        </header>
        <p class="legend">
          <span>${icon('repeat')} hábito ou ação recorrente</span>
          <span>${icon('dot')} tarefa pontual</span>
          <span class="muted">Progresso desta semana</span>
        </p>
        ${active.length ? active.map((g) => goalCard(g, ws)).join('') : '<p class="empty">Você ainda não tem objetivos. Que tal criar o primeiro?</p>'}
        ${orphanHabits.length ? `
          <article class="goal-card" style="--c:#b9b2a6">
            <header class="goal-head"><div class="goal-title"><h2>Hábitos sem objetivo</h2></div></header>
            <ul class="items">${orphanHabits.map((h) => `
              <li class="item"><button type="button" class="item-main" data-action="edit-habit" data-id="${h.id}">
                <span class="kind-icon">${icon('repeat')}</span><span class="item-text"><span class="item-title">${esc(h.name)}</span>
                <span class="item-sub">${esc(scheduleText(h))}</span></span></button></li>`).join('')}</ul>
          </article>` : ''}
        ${archived.length ? `
          <details class="archived">
            <summary>Arquivados <span class="count">${archived.length}</span></summary>
            ${archived.map((g) => goalCard(g, ws)).join('')}
          </details>` : ''}
      </section>`;
  }

  // ---------- folhas (diálogos) ----------
  const sheet = $('#sheet');
  function openSheet(html, focusSel) {
    sheet.innerHTML = html;
    if (!sheet.open) sheet.showModal();
    const f = focusSel ? sheet.querySelector(focusSel) : null;
    if (f) { f.focus(); if (f.select && f.value) f.select(); }
  }
  function closeSheet() { if (sheet.open) sheet.close(); }
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

  const sheetHead = (title, sub) => `
    <header class="sheet-head">
      <div><h2 id="sheet-title">${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>
      <button class="icon-btn" type="button" data-action="close-sheet" aria-label="Fechar">${icon('close')}</button>
    </header>`;

  function goalOptions(selected) {
    const list = state.goals.filter((g) => g.status !== 'arquivado' || g.id === selected);
    return `<option value="">Nenhum</option>` + list.map((g) => `<option value="${g.id}"${g.id === selected ? ' selected' : ''}>${esc(g.name)}${g.status === 'pausado' ? ' (pausado)' : ''}</option>`).join('');
  }

  function openTaskSheet(t, defaults = {}) {
    const isNew = !t;
    t = t || { title: defaults.title || '', date: defaults.date ?? todayISO(), period: '', time: '', duration: null, goalId: defaults.goalId || '', priority: false, note: '', link: '', done: false };
    const p = t.period || '';
    const radio = (val, label) => `<label class="seg"><input type="radio" name="period" value="${val}"${p === val ? ' checked' : ''}><span>${label}</span></label>`;
    openSheet(`
      <form class="sheet-body" data-form="task" data-id="${isNew ? '' : t.id}" autocomplete="off">
        ${sheetHead(isNew ? 'Nova tarefa' : 'Editar tarefa', isNew ? 'Só o título é obrigatório.' : '')}
        <label class="field"><span>Título</span>
          <input name="title" type="text" required maxlength="200" value="${esc(t.title)}" placeholder="O que você quer fazer?">
        </label>
        <div class="field-row">
          <label class="field"><span>Dia</span>
            <input name="date" type="date" value="${t.date || ''}">
            <small>Deixe vazio para guardar em “Depois”.</small>
          </label>
          <label class="field"><span>Duração estimada (min)</span>
            <input name="duration" type="number" min="1" max="1440" step="1" inputmode="numeric" value="${t.duration || ''}" placeholder="opcional">
          </label>
        </div>
        <fieldset class="field">
          <legend>Período ou horário</legend>
          <div class="segmented">
            ${radio('', 'Qualquer hora')}${radio('manha', 'Manhã')}${radio('tarde', 'Tarde')}${radio('noite', 'Noite')}${radio('horario', 'Horário')}
          </div>
          <input class="time-input" name="time" type="time" value="${esc(t.time)}" aria-label="Horário" ${p === 'horario' ? '' : 'hidden'}>
        </fieldset>
        <div class="field-row">
          <label class="field"><span>Objetivo relacionado</span>
            <select name="goalId">${goalOptions(t.goalId)}</select>
          </label>
          <label class="field check-field">
            <input name="priority" type="checkbox"${t.priority ? ' checked' : ''}>
            <span>${icon('star')} Prioridade do dia</span>
          </label>
        </div>
        <label class="field"><span>Link</span>
          <input name="link" type="text" inputmode="url" value="${esc(t.link)}" placeholder="https://… (opcional)">
        </label>
        <label class="field"><span>Nota</span>
          <textarea name="note" rows="3" maxlength="4000" placeholder="opcional">${esc(t.note)}</textarea>
        </label>
        <footer class="sheet-actions">
          ${isNew ? '' : `<button class="btn ghost danger-text" type="button" data-action="delete-task" data-id="${t.id}">${icon('trash')}Excluir</button>`}
          <span class="spacer"></span>
          ${isNew ? '' : `<button class="btn ghost" type="button" data-action="toggle-task" data-id="${t.id}" data-close="1">${t.done ? 'Reabrir' : 'Concluir'}</button>`}
          <button class="btn primary" type="submit">${isNew ? 'Adicionar' : 'Salvar'}</button>
        </footer>
      </form>`, 'input[name=title]');
  }

  function openRescheduleSheet(t) {
    const today = todayISO();
    const base = weekStart(t.date || (route() === 'semana' ? weekAnchor : today));
    const nextMon = addDays(weekStart(today), 7);
    const opt = (date, label, sub) => {
      const cur = (t.date || '') === (date || '');
      return `<button type="button" class="move-opt${cur ? ' is-current' : ''}" data-action="move-to" data-id="${t.id}" data-date="${date || ''}" ${cur ? 'aria-current="true"' : ''}>
        <span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
    };
    const days = Array.from({ length: 7 }, (_, i) => addDays(base, i));
    openSheet(`
      <div class="sheet-body">
        ${sheetHead('Reagendar', t.title)}
        <div class="move-grid">
          ${opt(today, 'Hoje', fmtDayShort(today))}
          ${opt(addDays(today, 1), 'Amanhã', fmtDayShort(addDays(today, 1)))}
          ${opt(nextMon, 'Próxima segunda', fmtShort(nextMon))}
          ${opt('', 'Depois', 'sem data')}
        </div>
        <p class="sheet-label">Semana de ${esc(weekLabel(base))}</p>
        <div class="move-days">
          ${days.map((d) => opt(d, DAYS_SHORT[dow(d)], String(fromISO(d).getDate()))).join('')}
        </div>
        <form class="move-custom" data-form="move-custom" data-id="${t.id}">
          <label class="field"><span>Outra data</span><input type="date" name="date" required value="${t.date || today}"></label>
          <button class="btn ghost" type="submit">Mover</button>
        </form>
      </div>`, '.sheet-head .icon-btn');
  }

  function openHabitLogSheet(h, iso) {
    const log = getLog(h.id, iso) || { minutes: 0, done: false, note: '' };
    const done = habitDone(h, iso);
    const link = normalizeLink(h.link);
    openSheet(`
      <form class="sheet-body" data-form="log" data-habit="${h.id}" data-date="${iso}" autocomplete="off">
        ${sheetHead(h.name, `${cap(fmtLong(iso))}${h.minutes ? ` · meta de ${h.minutes} min` : ''}`)}
        ${h.note || link ? `<div class="habit-info">
          ${h.note ? `<p>${esc(h.note)}</p>` : ''}
          ${link ? `<a class="btn ghost sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${icon('link')}Abrir link</a>` : ''}
        </div>` : ''}
        ${h.minutes ? `
          <button class="btn primary wide" type="button" data-action="log-complete">${icon('check')}${done ? 'Meta concluída' : `Concluir meta (${h.minutes} min)`}</button>
          <label class="field"><span>Minutos feitos neste dia</span>
            <input name="minutes" type="number" min="0" max="1440" step="1" inputmode="numeric" value="${log.minutes || ''}" placeholder="0">
          </label>
          <div class="chips-row" aria-label="Somar minutos">
            ${[5, 10, 15, 20].map((n) => `<button class="btn ghost sm" type="button" data-action="log-add" data-n="${n}">+${n}</button>`).join('')}
          </div>` : `
          <label class="field check-field big">
            <input name="done" type="checkbox"${log.done ? ' checked' : ''}>
            <span>Feito neste dia</span>
          </label>`}
        <label class="field"><span>Nota do dia</span>
          <textarea name="note" rows="2" maxlength="2000" placeholder="opcional">${esc(log.note)}</textarea>
        </label>
        <footer class="sheet-actions">
          <button class="btn ghost danger-text" type="button" data-action="log-clear">Desmarcar este dia</button>
          <span class="spacer"></span>
          <button class="btn primary" type="submit">Salvar</button>
        </footer>
        <p class="hint">Cada dia é registrado separadamente. Mudar aqui não altera os outros dias.</p>
      </form>`, h.minutes ? 'input[name=minutes]' : 'input[name=done]');
  }

  function openGoalSheet(g) {
    const isNew = !g;
    g = g || { name: '', why: '', color: COLORS[state.goals.length % COLORS.length].hex };
    openSheet(`
      <form class="sheet-body" data-form="goal" data-id="${isNew ? '' : g.id}" autocomplete="off">
        ${sheetHead(isNew ? 'Novo objetivo' : 'Editar objetivo')}
        <label class="field"><span>Nome</span>
          <input name="name" type="text" required maxlength="80" value="${esc(g.name)}" placeholder="Ex.: Saúde, Família, Estudos">
        </label>
        <label class="field"><span>Por que ele importa? <small>(opcional)</small></span>
          <textarea name="why" rows="2" maxlength="300" placeholder="Uma frase curta">${esc(g.why)}</textarea>
        </label>
        <fieldset class="field">
          <legend>Cor</legend>
          <div class="swatches">
            ${COLORS.map((c) => `<label class="swatch" title="${c.name}"><input type="radio" name="color" value="${c.hex}"${c.hex === g.color ? ' checked' : ''} aria-label="${c.name}"><span style="--c:${c.hex}"></span></label>`).join('')}
          </div>
        </fieldset>
        <footer class="sheet-actions">
          ${isNew ? '' : `<button class="btn ghost danger-text" type="button" data-action="goal-delete" data-id="${g.id}">${icon('trash')}Excluir</button>`}
          <span class="spacer"></span>
          <button class="btn primary" type="submit">${isNew ? 'Criar objetivo' : 'Salvar'}</button>
        </footer>
      </form>`, 'input[name=name]');
  }

  function openHabitSheet(h, goalId) {
    const isNew = !h;
    h = h || { name: '', goalId: goalId || '', days: [0, 1, 2, 3, 4, 5, 6], minutes: null, note: '', link: '' };
    openSheet(`
      <form class="sheet-body" data-form="habit" data-id="${isNew ? '' : h.id}" autocomplete="off">
        ${sheetHead(isNew ? 'Novo hábito' : 'Editar hábito', 'Hábitos se repetem nos dias escolhidos.')}
        <label class="field"><span>Nome</span>
          <input name="name" type="text" required maxlength="120" value="${esc(h.name)}" placeholder="Ex.: Caminhada">
        </label>
        <label class="field"><span>Objetivo</span>
          <select name="goalId">${goalOptions(h.goalId)}</select>
        </label>
        <fieldset class="field">
          <legend>Dias da semana</legend>
          <div class="days-toggle">
            ${DAYS_SHORT.map((d, i) => `<label class="day-toggle"><input type="checkbox" name="days" value="${i}"${h.days.includes(i) ? ' checked' : ''}><span>${d}</span></label>`).join('')}
          </div>
          <div class="chips-row">
            <button class="text-btn" type="button" data-action="days-set" data-days="0,1,2,3,4,5,6">todos os dias</button>
            <button class="text-btn" type="button" data-action="days-set" data-days="0,1,2,3,4">dias úteis</button>
            <button class="text-btn" type="button" data-action="days-set" data-days="5,6">fim de semana</button>
          </div>
        </fieldset>
        <label class="field"><span>Meta em minutos <small>(opcional)</small></span>
          <input name="minutes" type="number" min="1" max="1440" step="1" inputmode="numeric" value="${h.minutes || ''}" placeholder="Ex.: 30">
          <small>Com meta em minutos, você pode registrar tempo parcial em cada dia.</small>
        </label>
        <label class="field"><span>Link <small>(opcional)</small></span>
          <input name="link" type="text" inputmode="url" value="${esc(h.link)}" placeholder="https://…">
        </label>
        <label class="field"><span>Nota <small>(opcional)</small></span>
          <textarea name="note" rows="2" maxlength="2000">${esc(h.note)}</textarea>
        </label>
        <footer class="sheet-actions">
          ${isNew ? '' : `<button class="btn ghost danger-text" type="button" data-action="habit-delete" data-id="${h.id}">${icon('trash')}Excluir</button>`}
          <span class="spacer"></span>
          <button class="btn primary" type="submit">${isNew ? 'Criar hábito' : 'Salvar'}</button>
        </footer>
      </form>`, 'input[name=name]');
  }

  let installPrompt = null;
  function openSettingsSheet() {
    let last = null;
    try { last = localStorage.getItem(BACKUP_KEY); } catch (e) { /* ignora */ }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    openSheet(`
      <div class="sheet-body settings">
        ${sheetHead('Configurações')}
        <section class="settings-block">
          <h3>Onde ficam seus dados</h3>
          <p>Tudo o que você registra fica salvo <strong>apenas neste navegador, neste dispositivo</strong>. Não há conta, login nem nuvem.</p>
          <p>Os dados <strong>não sincronizam automaticamente</strong> entre dispositivos: o celular e o computador têm cada um os seus. Para levar seus dados de um para o outro, exporte o backup em um e importe no outro.</p>
          <p class="muted">Limpar os dados de navegação deste site apaga as informações. Exportar um backup de vez em quando é uma boa forma de se proteger.</p>
        </section>
        <section class="settings-block">
          <h3>Backup</h3>
          <div class="settings-actions">
            <button class="btn primary" type="button" data-action="export">${icon('download')}Exportar backup (JSON)</button>
            <button class="btn ghost" type="button" data-action="import">${icon('upload')}Importar backup</button>
          </div>
          <p class="muted small">${last ? `Último backup exportado em ${esc(new Date(last).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }))}.` : 'Nenhum backup exportado ainda neste navegador.'}
          Importar substitui todos os dados atuais pelos do arquivo.</p>
        </section>
        <section class="settings-block">
          <h3>Instalar como aplicativo</h3>
          ${standalone ? '<p>O Cultivar já está instalado e aberto como aplicativo.</p>'
            : installPrompt ? `<button class="btn ghost" type="button" data-action="install">${icon('download')}Instalar o Cultivar</button>`
            : '<p>No computador, use o ícone de instalar na barra de endereço (Chrome ou Edge). No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.</p>'}
        </section>
        <section class="settings-block">
          <h3>Recomeçar</h3>
          <p class="muted small">Apaga tudo deste navegador e volta para os objetivos e hábitos iniciais.</p>
          <button class="btn ghost danger-text" type="button" data-action="reset-all">${icon('trash')}Apagar todos os dados</button>
        </section>
      </div>`);
  }

  // ---------- confirmação e aviso ----------
  const confirmDlg = $('#confirm');
  function askConfirm(text, okLabel = 'Confirmar') {
    return new Promise((resolve) => {
      $('#confirm-text').textContent = text;
      $('#confirm-ok').textContent = okLabel;
      confirmDlg.returnValue = '';
      const done = () => { confirmDlg.removeEventListener('close', done); resolve(confirmDlg.returnValue === 'ok'); };
      confirmDlg.addEventListener('close', done);
      confirmDlg.showModal();
    });
  }

  const toastEl = $('#toast');
  let toastTimer = null;
  function toast(msg, action) {
    clearTimeout(toastTimer);
    // Um diálogo aberto fica por cima da página; o aviso precisa ir para dentro dele.
    const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
    if (toastEl.parentNode !== host) host.appendChild(toastEl);
    toastEl.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="text-btn">${esc(action.label)}</button>` : ''}`;
    toastEl.classList.add('show');
    if (action) toastEl.querySelector('button').onclick = () => { action.run(); hideToast(); };
    toastTimer = setTimeout(hideToast, action ? 6000 : 3500);
  }
  function hideToast() { toastEl.classList.remove('show'); }

  // ---------- ações ----------
  const actions = {
    'close-sheet': closeSheet,
    'open-settings': openSettingsSheet,

    'new-task': (el) => {
      const r = route();
      let date = todayISO();
      if (el.dataset.goal) date = null;
      else if (r === 'semana' && weekAnchor !== weekStart(todayISO())) date = weekAnchor;
      openTaskSheet(null, { date, goalId: el.dataset.goal || '' });
    },
    'quick-more': (el) => {
      const form = el.closest('form');
      const title = form.querySelector('input').value;
      form.querySelector('input').value = '';
      openTaskSheet(null, { title, date: el.dataset.date || null });
    },
    'edit-task': (el) => { const t = taskById(el.dataset.id); if (t) openTaskSheet(t); },
    'toggle-task': (el) => {
      const t = taskById(el.dataset.id);
      if (!t) return;
      t.done = !t.done;
      t.doneAt = t.done ? new Date().toISOString() : null;
      if (el.dataset.close) closeSheet();
      commit();
    },
    'toggle-priority': (el) => {
      const t = taskById(el.dataset.id);
      if (!t) return;
      if (!t.priority && t.date && priorityCount(t.date, t.id) >= MAX_PRIORITIES) {
        toast('Já há três prioridades neste dia. Tire a estrela de outra tarefa primeiro.');
        return;
      }
      t.priority = !t.priority;
      commit();
    },
    'reschedule': (el) => { const t = taskById(el.dataset.id); if (t) openRescheduleSheet(t); },
    'move-to': (el) => {
      const t = taskById(el.dataset.id);
      if (!t) return;
      const date = el.dataset.date || null;
      moveTask(t.id, date);
      closeSheet();
      commit();
      toast(date ? `Movida para ${relativeDay(date)}.` : 'Guardada em Depois.');
    },
    'delete-task': (el) => {
      const idx = state.tasks.findIndex((t) => t.id === el.dataset.id);
      if (idx < 0) return;
      const [removed] = state.tasks.splice(idx, 1);
      closeSheet();
      commit();
      toast('Tarefa excluída.', { label: 'Desfazer', run: () => { state.tasks.splice(idx, 0, removed); commit(); } });
    },

    'habit-toggle': (el) => {
      const h = habitById(el.dataset.habit);
      if (!h) return;
      const iso = el.dataset.date;
      const log = getLog(h.id, iso);
      if (habitDone(h, iso)) setLog(h.id, iso, 0, false, log?.note);
      else setLog(h.id, iso, h.minutes || 0, true, log?.note);
      commit();
    },
    'habit-log': (el) => {
      const h = habitById(el.dataset.habit);
      if (h) openHabitLogSheet(h, el.dataset.date);
    },
    'log-complete': (el) => {
      const form = el.closest('form');
      const h = habitById(form.dataset.habit);
      setLog(h.id, form.dataset.date, h.minutes, true, form.note.value);
      closeSheet();
      commit();
    },
    'log-add': (el) => {
      const input = el.closest('form').minutes;
      input.value = (parseInt(input.value, 10) || 0) + Number(el.dataset.n);
    },
    'log-clear': (el) => {
      const form = el.closest('form');
      setLog(form.dataset.habit, form.dataset.date, 0, false, '');
      closeSheet();
      commit();
    },

    'week-prev': () => { weekAnchor = addDays(weekAnchor, -7); render(); },
    'week-next': () => { weekAnchor = addDays(weekAnchor, 7); render(); },
    'week-today': () => { weekAnchor = weekStart(todayISO()); render(); },

    'new-goal': () => openGoalSheet(null),
    'edit-goal': (el) => { const g = goalById(el.dataset.id); if (g) openGoalSheet(g); },
    'goal-status': (el) => {
      const g = goalById(el.dataset.id);
      if (!g) return;
      g.status = el.dataset.status;
      commit();
      const msg = { ativo: 'Objetivo ativo novamente.', pausado: 'Objetivo pausado. Você pode retomar quando quiser.', arquivado: 'Objetivo arquivado. Ele fica guardado em “Arquivados”.' };
      toast(msg[g.status]);
    },
    'goal-delete': async (el) => {
      const g = goalById(el.dataset.id);
      if (!g) return;
      const nh = state.habits.filter((h) => h.goalId === g.id).length;
      const ok = await askConfirm(`Excluir “${g.name}”? ${nh ? `Os ${nh === 1 ? '1 hábito' : nh + ' hábitos'} dele e seus registros também serão excluídos. ` : ''}As tarefas continuam, sem objetivo.`, 'Excluir');
      if (!ok) return;
      for (const h of state.habits.filter((x) => x.goalId === g.id)) delete state.logs[h.id];
      state.habits = state.habits.filter((h) => h.goalId !== g.id);
      state.tasks.forEach((t) => { if (t.goalId === g.id) t.goalId = ''; });
      state.goals = state.goals.filter((x) => x.id !== g.id);
      closeSheet();
      commit();
      toast('Objetivo excluído.');
    },
    'new-habit': (el) => openHabitSheet(null, el.dataset.goal),
    'edit-habit': (el) => { const h = habitById(el.dataset.id); if (h) openHabitSheet(h); },
    'habit-delete': async (el) => {
      const h = habitById(el.dataset.id);
      if (!h) return;
      const ok = await askConfirm(`Excluir o hábito “${h.name}” e todos os registros dele?`, 'Excluir');
      if (!ok) return;
      state.habits = state.habits.filter((x) => x.id !== h.id);
      delete state.logs[h.id];
      closeSheet();
      commit();
      toast('Hábito excluído.');
    },
    'days-set': (el) => {
      const set = el.dataset.days.split(',');
      el.closest('form').querySelectorAll('input[name=days]').forEach((c) => { c.checked = set.includes(c.value); });
    },

    'export': exportBackup,
    'import': () => $('#import-file').click(),
    'install': async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      closeSheet();
    },
    'reset-all': async () => {
      const ok = await askConfirm('Apagar todos os objetivos, hábitos, registros e tarefas deste navegador? Isso não pode ser desfeito. Se quiser, exporte um backup antes.', 'Apagar tudo');
      if (!ok) return;
      state = seed();
      closeSheet();
      commit();
      toast('Tudo apagado. Os objetivos iniciais foram recriados.');
    },
  };

  document.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  }, true);

  // ---------- formulários ----------
  const forms = {
    'quick-add': (form) => {
      const input = form.querySelector('input[name=title]');
      const title = input.value.trim();
      if (!title) return;
      addTask({ title, date: form.dataset.date || null });
      focusAfterRender = '#' + CSS.escape(input.id);
      commit();
    },
    'task': (form) => {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) { f.title.focus(); return; }
      const period = form.querySelector('input[name=period]:checked')?.value || '';
      const data = {
        title, date: f.date.value || null, period, time: period === 'horario' ? f.time.value : '',
        duration: f.duration.value, goalId: f.goalId.value, priority: f.priority.checked,
        note: f.note.value.trim(), link: f.link.value.trim(),
      };
      if (period === 'horario' && !data.time) data.period = '';
      const id = form.dataset.id;
      if (!id) {
        addTask(data);
      } else {
        const t = taskById(id);
        if (!t) return;
        if (t.date !== data.date) moveTask(t.id, data.date);
        Object.assign(t, { title: data.title, period: data.period, time: data.time, duration: toInt(data.duration), goalId: data.goalId, note: data.note, link: data.link });
        if (data.priority && !t.priority && t.date && priorityCount(t.date, t.id) >= MAX_PRIORITIES) {
          toast('Este dia já tem três prioridades. A estrela não foi adicionada.');
        } else {
          t.priority = data.priority;
        }
      }
      closeSheet();
      commit();
    },
    'move-custom': (form) => {
      const date = form.elements.date.value;
      if (!date) return;
      moveTask(form.dataset.id, date);
      closeSheet();
      commit();
      toast(`Movida para ${relativeDay(date)}.`);
    },
    'log': (form) => {
      const h = habitById(form.dataset.habit);
      if (!h) return;
      const note = form.elements.note.value;
      if (h.minutes) {
        const m = Math.min(1440, Math.max(0, parseInt(form.elements.minutes.value, 10) || 0));
        setLog(h.id, form.dataset.date, m, m >= h.minutes, note);
      } else {
        setLog(h.id, form.dataset.date, 0, form.elements.done.checked, note);
      }
      closeSheet();
      commit();
    },
    'goal': (form) => {
      const f = form.elements;
      const name = f.name.value.trim();
      if (!name) return;
      const color = form.querySelector('input[name=color]:checked')?.value || COLORS[0].hex;
      const id = form.dataset.id;
      if (id) Object.assign(goalById(id), { name, why: f.why.value.trim(), color });
      else state.goals.push({ id: uid(), name, why: f.why.value.trim(), color, status: 'ativo', createdAt: new Date().toISOString() });
      closeSheet();
      commit();
    },
    'habit': (form) => {
      const f = form.elements;
      const name = f.name.value.trim();
      if (!name) return;
      const days = [...form.querySelectorAll('input[name=days]:checked')].map((c) => Number(c.value));
      if (!days.length) { toast('Escolha pelo menos um dia da semana.'); return; }
      const data = { name, goalId: f.goalId.value, days, minutes: toInt(f.minutes.value), note: f.note.value.trim(), link: f.link.value.trim() };
      const id = form.dataset.id;
      if (id) Object.assign(habitById(id), data);
      else state.habits.push({ id: uid(), ...data, startDate: weekStart(todayISO()), createdAt: new Date().toISOString() });
      closeSheet();
      commit();
    },
  };

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    forms[form.dataset.form]?.(form);
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'period') {
      const time = e.target.closest('form').querySelector('.time-input');
      time.hidden = e.target.value !== 'horario';
      if (!time.hidden) time.focus();
    }
  });

  // ---------- backup ----------
  function exportBackup() {
    const payload = { app: 'Cultivar', formato: 1, exportadoEm: new Date().toISOString(), dados: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cultivar-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch (e) { /* ignora */ }
    if (sheet.open) openSettingsSheet();
    toast('Backup exportado.');
  }

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch (err) { toast('Não foi possível ler este arquivo. Ele precisa ser um backup .json do Cultivar.'); return; }
    const data = parsed && parsed.dados ? parsed.dados : parsed;
    if (!looksValid(data)) { toast('Este arquivo não parece ser um backup do Cultivar.'); return; }
    const n = normalize(data);
    const ok = await askConfirm(`Importar este backup? Ele tem ${n.goals.length} objetivo(s), ${n.habits.length} hábito(s) e ${n.tasks.length} tarefa(s). Os dados atuais deste navegador serão substituídos.`, 'Importar');
    if (!ok) return;
    state = n;
    closeSheet();
    commit();
    toast('Backup importado.');
  });

  // ---------- arrastar e soltar ----------
  let drag = null;
  let suppressClick = false;

  // O clique que o navegador gera ao soltar um arraste é descartado; qualquer nova interação libera.
  document.addEventListener('keydown', () => { suppressClick = false; }, true);
  document.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    if (route() !== 'semana' || e.button !== 0) return;
    const row = e.target.closest('.drop .task');
    if (!row) return;
    const onHandle = !!e.target.closest('.handle');
    if (!onHandle && (e.pointerType !== 'mouse' || e.target.closest('a, input, .check, .task-actions'))) return;
    drag = { id: row.dataset.id, row, x: e.clientX, y: e.clientY, active: false, ghost: null, target: null, before: null, offX: 0, offY: 0 };
  });

  function placeMarker(zone, y) {
    let marker = $('.drop-marker');
    if (!marker) { marker = document.createElement('li'); marker.className = 'drop-marker'; marker.setAttribute('aria-hidden', 'true'); }
    const rows = [...zone.querySelectorAll('.task')].filter((r) => r !== drag.row);
    let before = null;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (y < b.top + b.height / 2) { before = r; break; }
    }
    if (before) zone.insertBefore(marker, before); else zone.appendChild(marker);
    drag.before = before ? before.dataset.id : null;
  }

  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.active = true;
      const b = drag.row.getBoundingClientRect();
      drag.offX = drag.x - b.left; drag.offY = drag.y - b.top;
      const g = drag.row.cloneNode(true);
      g.classList.add('drag-ghost');
      g.style.width = b.width + 'px';
      document.body.appendChild(g);
      drag.ghost = g;
      drag.row.classList.add('is-dragging');
      document.body.classList.add('dragging');
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.offX}px, ${e.clientY - drag.offY}px)`;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const card = under && under.closest('.day-card');
    const zone = card && card.querySelector('.drop');
    document.querySelectorAll('.day-card.drop-over').forEach((c) => { if (c !== card) c.classList.remove('drop-over'); });
    if (zone) { card.classList.add('drop-over'); drag.target = zone; placeMarker(zone, e.clientY); }
    else { drag.target = null; $('.drop-marker')?.remove(); }
    const edge = 70;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }, { passive: false });

  function endDrag(cancel) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    suppressClick = true;
    d.ghost.remove();
    $('.drop-marker')?.remove();
    document.body.classList.remove('dragging');
    document.querySelectorAll('.drop-over').forEach((c) => c.classList.remove('drop-over'));
    d.row.classList.remove('is-dragging');
    if (cancel || !d.target) return;
    const raw = d.target.dataset.drop;
    const date = raw === 'later' ? null : raw;
    const before = d.before;
    const t = taskById(d.id);
    const changed = t && t.date !== date;
    moveTask(d.id, date, before);
    commit();
    if (changed) toast(date ? `Movida para ${relativeDay(date)}.` : 'Guardada em Depois.');
  }
  document.addEventListener('pointerup', () => endDrag(false));
  document.addEventListener('pointercancel', () => endDrag(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) endDrag(true); });

  // ---------- inicialização ----------
  window.addEventListener('hashchange', render);
  let lastDay = todayISO();
  function checkDayChange() {
    const t = todayISO();
    if (t !== lastDay) {
      if (weekAnchor === weekStart(lastDay)) weekAnchor = weekStart(t);
      lastDay = t;
      if (!sheet.open) render();
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayChange(); });
  setInterval(checkDayChange, 60 * 1000);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { state = load(); if (!sheet.open) render(); }
  });

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast('Cultivar instalado.'); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  render();
})();
