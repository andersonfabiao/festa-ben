/* ============================================================
   Ben faz 5! — Toy Story party planner
   Dados locais (localStorage) + sincronização opcional via GitHub
   ============================================================ */

(() => {
  "use strict";

  /* ---------- Constantes ---------- */

  const STORAGE_KEY = "ben-toy-story-checklist-v1";
  const CLOUD_KEY = "ben-toy-story-cloud-v1";
  const COLLAPSE_KEY = "ben-toy-story-collapsed-v1";

  const STAGES = [
    { id: "planejamento", name: "Planejamento", icon: "📋", color: "#2f80ed" },
    { id: "local", name: "Local & Estrutura", icon: "🏠", color: "#0f8b8d" },
    { id: "decoracao", name: "Decoração Toy Story", icon: "🎈", color: "#f2a900" },
    { id: "convidados", name: "Convidados", icon: "💌", color: "#e8453c" },
    { id: "comida", name: "Comida & Bolo", icon: "🎂", color: "#e85d75" },
    { id: "ben", name: "Look do Ben", icon: "🤠", color: "#8d6e63" },
    { id: "lembrancinhas", name: "Lembrancinhas", icon: "🎁", color: "#59b94b" },
    { id: "atividades", name: "Atividades", icon: "🚀", color: "#7a5cf0" },
    { id: "dia", name: "No dia da festa", icon: "⭐", color: "#1f9d8f" },
  ];

  const STATUS = {
    todo: { label: "A fazer", color: "#5c6b82", bg: "#eef2f7" },
    doing: { label: "Em andamento", color: "#1d6fd6", bg: "#e4f0ff" },
    contracted: { label: "Contratado", color: "#6b46e5", bg: "#eee9ff" },
    done: { label: "Concluído", color: "#1d7c38", bg: "#e8f7ec" },
  };

  const GUEST_STATUS = {
    confirmed: { label: "Confirmado", color: "#1d7c38", bg: "#e8f7ec" },
    pending: { label: "Pendente", color: "#8a6400", bg: "#fff3cf" },
    declined: { label: "Não vai", color: "#b03a33", bg: "#ffe9e7" },
  };

  const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

  /* ---------- Utilidades ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = (n) => brl.format(Number(n) || 0);
  const num = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  };

  const pad2 = (n) => String(n).padStart(2, "0");
  const nowISO = () => new Date().toISOString();
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  };

  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);

  function parseMoney(value) {
    if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
    if (value == null) return 0;
    let s = String(value).trim().replace(/[R$\s]/g, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
  }

  function fmtDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    const [y, m, d] = iso.split("-");
    return d + "/" + m + "/" + y;
  }

  function longDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "data a definir";
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const text = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function dateMinus(iso, days) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() - days);
    return dt.toISOString().slice(0, 10);
  }

  function norm(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function safeUrl(url) {
    const u = String(url || "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff) || diff < 0) return "agora";
    if (diff < 60000) return "agora";
    const min = Math.floor(diff / 60000);
    if (min < 60) return "há " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "há " + h + " h";
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function b64decode(b64) {
    const bin = atob(String(b64 || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /* ---------- Dados de exemplo ---------- */

  function seedItems(partyDate) {
    const d = (n) => dateMinus(partyDate, n);
    const mk = (title, stage, opts) => {
      const o = opts || {};
      return {
        id: uid(),
        title,
        stage,
        status: o.status || "todo",
        cost: o.cost || 0,
        paid: o.paid || 0,
        supplier: o.supplier || "",
        due: o.due || "",
        link: "",
        notes: o.notes || "",
        createdAt: nowISO(),
      };
    };

    return [
      mk("Definir data, horário e local da festa", "planejamento", {
        status: "done", due: d(35), notes: "Sábado, 05/12, às 16h — confirmar com o buffet.",
      }),
      mk("Fechar o orçamento total da festa", "planejamento", {
        status: "doing", due: d(32), notes: "Estimar buffet, decoração, comida e lembrancinhas.",
      }),
      mk("Montar a lista de convidados", "planejamento", { status: "doing", due: d(30) }),
      mk("Criar e enviar o convite digital", "planejamento", {
        status: "todo", due: d(28), notes: "Tema Toy Story, com mapa do local e confirmação até 10 dias antes.",
      }),

      mk("Reservar buffet / salão", "local", {
        status: "contracted", cost: 2400, paid: 800, supplier: "Buffet Alegria", due: d(25),
        notes: "Salão 2 para 40 pessoas. Entrada de 50% na reserva.",
      }),
      mk("Confirmar mesas, cadeiras e toalhas", "local", { status: "todo", due: d(10) }),
      mk("Contratar recreador", "local", {
        status: "doing", cost: 450, due: d(14), supplier: "Tio Recreação",
        notes: "Pedir brincadeiras com tema de cowboy e espaço.",
      }),
      mk("Confirmar estacionamento e acesso", "local", { status: "todo", due: d(7) }),

      mk("Painel Toy Story (Woody + Buzz)", "decoracao", {
        status: "contracted", cost: 650, paid: 200, supplier: "Ateliê Festa & Cia", due: d(12),
        notes: "Painel 2,5 m x 2 m com nuvens do quarto do Andy.",
      }),
      mk("Balões azul, amarelo, vermelho e branco", "decoracao", { status: "todo", cost: 180, due: d(5) }),
      mk("Nuvens e estrelas para o teto", "decoracao", { status: "todo", cost: 90, due: d(5) }),
      mk("Mesa do bolo e suportes", "decoracao", { status: "doing", cost: 120, due: d(8) }),
      mk("Bolo temático 3D (Woody ou Buzz)", "decoracao", {
        status: "todo", cost: 380, due: d(6), supplier: "Doce Encanto",
        notes: "Bolo de 3 kg, recheio de brigadeiro e ninho. Confirmar arte 7 dias antes.",
      }),
      mk("Velas de 5 anos e descartáveis", "decoracao", { status: "todo", cost: 80, due: d(4) }),

      mk("Salgados (100 unidades)", "comida", { status: "todo", cost: 320, due: d(5) }),
      mk("Docinhos (100 unidades)", "comida", { status: "todo", cost: 260, due: d(5) }),
      mk("Bebidas, sucos e água", "comida", { status: "todo", cost: 180, due: d(4) }),
      mk("Lanche das crianças (mini pizza / hot dog)", "comida", { status: "todo", cost: 250, due: d(4) }),
      mk("Carrinho de pipoca", "comida", { status: "todo", cost: 250, due: d(7) }),

      mk("Fantasia do Ben (Woody ou Buzz)", "ben", {
        status: "doing", cost: 250, supplier: "Fantasia Kids", due: d(10),
        notes: "Provar antes para garantir o tamanho. Chapéu de cowboy incluso?",
      }),
      mk("Camiseta extra para troca", "ben", { status: "todo", cost: 60, due: d(3) }),
      mk("Corte de cabelo antes da festa", "ben", { status: "todo", cost: 80, due: d(2) }),

      mk("Enviar convites", "convidados", { status: "todo", due: d(28) }),
      mk("Confirmar presenças (RSVP)", "convidados", { status: "todo", due: d(10) }),
      mk("Lembrancinhas: saquinhos + brinquedos", "lembrancinhas", {
        status: "todo", cost: 400, due: d(12), notes: "Uma lembrancinha por criança confirmada.",
      }),
      mk("Etiquetas personalizadas", "lembrancinhas", { status: "todo", cost: 60, due: d(12) }),

      mk("Caça ao tesouro do Andy", "atividades", {
        status: "todo", cost: 80, due: d(7), notes: "Pistas com personagens e baú com guloseimas.",
      }),
      mk("Foto booth com adereços", "atividades", { status: "todo", cost: 150, due: d(7) }),
      mk("Playlist Toy Story", "atividades", { status: "todo", due: d(3) }),

      mk("Chegar 2h antes para montar", "dia", { status: "todo" }),
      mk("Conferir som, iluminação e foto booth", "dia", { status: "todo" }),
      mk("Pagar fornecedores restantes", "dia", {
        status: "todo", notes: "Conferir os valores pagos antes de sair de casa.",
      }),
      mk("Kit emergência (fita, tesoura, pilhas, agulha)", "dia", { status: "todo", cost: 70 }),
      mk("Celular / câmera carregados", "dia", { status: "todo" }),
    ];
  }

  function seedGuests() {
    const g = (name, type, status) => ({ id: uid(), name, type, status });
    return [
      g("Tia Ana", "adult", "confirmed"),
      g("Lucas", "child", "confirmed"),
      g("Sofia", "child", "pending"),
      g("Vô Carlos", "adult", "confirmed"),
    ];
  }

  function defaultMeta() {
    return {
      name: "Ben",
      age: 5,
      date: "2026-12-05",
      time: "16:00",
      location: "Buffet Alegria — Salão 2",
      budget: 7000,
      theme: "Toy Story",
    };
  }

  function defaultState() {
    const meta = defaultMeta();
    return {
      version: 1,
      meta,
      items: seedItems(meta.date),
      guests: seedGuests(),
      updatedAt: nowISO(),
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) return null;
    const base = defaultMeta();
    const meta = Object.assign(base, raw.meta && typeof raw.meta === "object" ? raw.meta : {});
    meta.name = String(meta.name || "Ben").slice(0, 40);
    meta.age = Math.min(99, Math.max(1, parseInt(meta.age, 10) || 5));
    meta.date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : base.date;
    meta.time = /^\d{2}:\d{2}$/.test(meta.time) ? meta.time : "16:00";
    meta.location = String(meta.location || "");
    meta.budget = parseMoney(meta.budget);
    meta.theme = String(meta.theme || "Toy Story");

    const items = raw.items
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        id: String(i.id || uid()),
        title: String(i.title || "Item sem título").slice(0, 200),
        stage: STAGES.some((s) => s.id === i.stage) ? i.stage : "planejamento",
        status: STATUS[i.status] ? i.status : "todo",
        cost: parseMoney(i.cost),
        paid: parseMoney(i.paid),
        supplier: String(i.supplier || "").slice(0, 120),
        due: /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : "",
        link: String(i.link || ""),
        notes: String(i.notes || "").slice(0, 1000),
        createdAt: i.createdAt || nowISO(),
      }));

    const guests = Array.isArray(raw.guests)
      ? raw.guests
          .filter((g) => g && typeof g === "object" && g.name)
          .map((g) => ({
            id: String(g.id || uid()),
            name: String(g.name).slice(0, 80),
            type: g.type === "adult" ? "adult" : "child",
            status: GUEST_STATUS[g.status] ? g.status : "pending",
          }))
      : [];

    return { version: 1, meta, items, guests, updatedAt: raw.updatedAt || nowISO() };
  }

  /* ---------- Estado ---------- */

  const hadLocal = !!localStorage.getItem(STORAGE_KEY);
  let state = normalizeState(loadLocal()) || defaultState();
  let cloud = loadCloudCfg();
  let collapsed = new Set(loadCollapsed());
  let dirty = false;
  let cloudPhase = "idle";
  let cloudError = "";
  let autoTimer = null;
  let savingCloud = false;
  let toastTimer = null;

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Não foi possível ler os dados locais.", e);
      return null;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Não foi possível salvar localmente.", e);
      toast("Não foi possível salvar neste navegador.", "err");
    }
  }

  function loadCloudCfg() {
    try {
      const raw = localStorage.getItem(CLOUD_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCloudCfg() {
    try {
      localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));
    } catch (e) {
      console.warn("Não foi possível salvar a configuração da nuvem.", e);
    }
  }

  function loadCollapsed() {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(collapsed)));
    } catch (e) {
      /* ignora */
    }
  }

  const hasCloud = () => !!(cloud.owner && cloud.repo && cloud.token);

  /* ---------- Resumos ---------- */

  function summary() {
    const items = state.items;
    const previsto = items.reduce((a, i) => a + num(i.cost), 0);
    const pago = items.reduce((a, i) => a + num(i.paid), 0);
    const committed = items.filter((i) => i.status === "contracted" || i.status === "done");
    const contratado = committed.reduce((a, i) => a + num(i.cost), 0);
    const aPagar = committed.reduce((a, i) => a + Math.max(num(i.cost) - num(i.paid), 0), 0);
    const budget = num(state.meta.budget);
    const done = items.filter((i) => i.status === "done").length;
    return {
      previsto,
      pago,
      contratado,
      aPagar,
      budget,
      done,
      total: items.length,
      saldo: budget - contratado,
      saldoPrevisto: budget - previsto,
      pct: items.length ? Math.round((done / items.length) * 100) : 0,
    };
  }

  /* ---------- Render: hero ---------- */

  function renderHero() {
    const meta = state.meta;
    const s = summary();

    $("#heroName").textContent = meta.name;
    $("#heroAge").textContent = meta.age;
    $("#badgeAge").textContent = meta.age;
    $("#footerName").textContent = meta.name;
    document.title = meta.name + " faz " + meta.age + "! · Checklist Toy Story";

    const chips = [];
    chips.push('<span class="chip">📅 ' + esc(longDate(meta.date)) + "</span>");
    if (meta.time) chips.push('<span class="chip">⏰ ' + esc(meta.time.replace(":", "h")) + "</span>");
    chips.push(
      '<span class="chip">📍 ' + esc(meta.location || "Local a definir") + "</span>"
    );
    chips.push('<span class="chip">🤠 ' + esc(meta.theme) + "</span>");
    $("#heroMeta").innerHTML = chips.join("");

    renderCountdown();

    $("#progressLabel").textContent =
      s.done + " de " + s.total + " itens concluídos";
    $("#progressPct").textContent = s.pct + "%";
    $("#progressFill").style.width = s.pct + "%";

    const stats = [
      { label: "Concluídos", value: s.done + "/" + s.total, cls: "" },
      { label: "Orçamento", value: money(s.budget), cls: "accent" },
      { label: "Já pago", value: money(s.pago), cls: "good" },
      {
        label: "A pagar",
        value: money(s.aPagar),
        cls: s.aPagar > 0 ? "" : "good",
      },
    ];
    $("#heroStats").innerHTML = stats
      .map(
        (st) =>
          '<div class="hero-stat ' + st.cls + '"><span class="label">' +
          st.label + '</span><span class="value">' + st.value + "</span></div>"
      )
      .join("");
  }

  function partyTarget() {
    const meta = state.meta;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) return null;
    const [y, m, d] = meta.date.split("-").map(Number);
    const [hh, mm] = (meta.time || "16:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function renderCountdown() {
    const el = $("#countdown");
    if (!el) return;
    const target = partyTarget();
    if (!target || Number.isNaN(target.getTime())) {
      el.innerHTML = "";
      return;
    }

    const now = new Date();
    const diff = target.getTime() - now.getTime();
    const sameDay =
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate();

    if (diff <= 0) {
      el.innerHTML = sameDay
        ? '<span class="cd-today">🎉 É hoje! Que a festa comece!</span>'
        : '<span class="cd-today">🎉 Festa realizada — boas memórias!</span>';
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    if (sameDay) {
      el.innerHTML =
        '<span class="cd-today">🎉 É hoje!</span>' +
        '<span class="cd-item"><b>' + hours + "</b><span>horas</span></span>" +
        '<span class="cd-item"><b>' + mins + "</b><span>min</span></span>";
      return;
    }

    el.innerHTML =
      '<span class="cd-item"><b>' + days + "</b><span>dias</span></span>" +
      '<span class="cd-item"><b>' + hours + "</b><span>horas</span></span>" +
      '<span class="cd-item"><b>' + mins + "</b><span>min</span></span>" +
      '<span class="muted" style="font-size:.8rem;font-weight:700">para a festa</span>';
  }

  /* ---------- Render: checklist ---------- */

  function getFilters() {
    return {
      q: $("#searchInput").value,
      stage: $("#stageFilter").value,
      status: $("#statusFilter").value,
      pending: $("#pendingOnly").checked,
    };
  }

  function itemMatches(item, f) {
    if (f.stage && item.stage !== f.stage) return false;
    if (f.status && item.status !== f.status) return false;
    if (f.pending && item.status === "done") return false;
    if (f.q) {
      const hay = norm(
        [item.title, item.supplier, item.notes, stageById(item.stage).name].join(" ")
      );
      if (!hay.includes(norm(f.q))) return false;
    }
    return true;
  }

  function statusOptions(selected) {
    return Object.keys(STATUS)
      .map(
        (key) =>
          '<option value="' + key + '"' + (key === selected ? " selected" : "") + ">" +
          STATUS[key].label + "</option>"
      )
      .join("");
  }

  function itemHTML(item) {
    const st = STATUS[item.status] || STATUS.todo;
    const isDone = item.status === "done";
    const overdue = item.due && item.due < todayISO() && !isDone;
    const fullyPaid = num(item.cost) > 0 && num(item.paid) >= num(item.cost);
    const link = safeUrl(item.link);

    const metaBits = [];
    if (item.supplier) metaBits.push("<span>🏷️ " + esc(item.supplier) + "</span>");
    if (item.due) {
      metaBits.push(
        '<span class="' + (overdue ? "overdue" : "") + '">' +
          (overdue ? "⚠️ venceu em " : "📅 ") + fmtDate(item.due) + "</span>"
      );
    }
    if (link) {
      metaBits.push(
        '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Abrir link ↗</a>'
      );
    }

    return (
      '<article class="item' + (isDone ? " is-done" : "") + '">' +
        '<input class="item-check" type="checkbox"' + (isDone ? " checked" : "") +
          ' data-check="' + esc(item.id) + '" aria-label="Marcar ' + esc(item.title) + ' como concluído" />' +
        '<div class="item-main">' +
          '<div class="item-title-row">' +
            "<h3>" + esc(item.title) + "</h3>" +
            (fullyPaid ? '<span class="pill">✓ Pago</span>' : "") +
          "</div>" +
          (metaBits.length ? '<div class="item-meta">' + metaBits.join("") + "</div>" : "") +
          (item.notes ? '<p class="item-notes">' + esc(item.notes) + "</p>" : "") +
        "</div>" +
        '<div class="item-side">' +
          '<div class="item-money">' +
            (num(item.cost) > 0
              ? "<strong>" + money(item.cost) + "</strong>"
              : '<span class="muted">sem custo</span>') +
            (num(item.paid) > 0 ? "<span>pago " + money(item.paid) + "</span>" : "") +
          "</div>" +
          '<select class="status-select" data-status="' + esc(item.id) +
            '" style="--sc:' + st.color + ";--sb:" + st.bg + '" aria-label="Status do item">' +
            statusOptions(item.status) +
          "</select>" +
        "</div>" +
        '<button class="icon-btn" type="button" data-edit="' + esc(item.id) +
          '" aria-label="Editar ' + esc(item.title) + '">✏️</button>' +
      "</article>"
    );
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const ad = a.status === "done" ? 1 : 0;
      const bd = b.status === "done" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return 0;
    });
  }

  function renderChecklist() {
    const wrap = $("#checklist");
    if (!wrap) return;
    const f = getFilters();
    const filtered = state.items.filter((i) => itemMatches(i, f));

    if (!state.items.length) {
      wrap.innerHTML =
        '<div class="empty"><span class="emoji">🤠</span><h3>Vamos começar a festa?</h3>' +
        "<p>Adicione o primeiro item do checklist do " + esc(state.meta.name) + ".</p>" +
        '<button class="btn btn-primary" type="button" data-add-first>＋ Criar primeiro item</button></div>';
      return;
    }

    if (!filtered.length) {
      wrap.innerHTML =
        '<div class="empty"><span class="emoji">🔍</span><h3>Nada por aqui</h3>' +
        "<p>Nenhum item combina com os filtros escolhidos.</p>" +
        '<button class="btn btn-ghost" type="button" data-clear-filters>Limpar filtros</button></div>';
      return;
    }

    const html = STAGES.map((stage) => {
      const items = filtered.filter((i) => i.stage === stage.id);
      if (!items.length) return "";
      const sorted = sortItems(items);
      const total = items.length;
      const done = items.filter((i) => i.status === "done").length;
      const subtotal = items.reduce((a, i) => a + num(i.cost), 0);
      const pct = total ? Math.round((done / total) * 100) : 0;
      const isCollapsed = collapsed.has(stage.id);
      const tint = stage.color + "16";

      return (
        '<section class="stage-group' + (isCollapsed ? " is-collapsed" : "") +
          '" style="--stage:' + stage.color + ";--tint:" + tint + '">' +
          '<button class="stage-head" type="button" data-toggle-stage="' + stage.id + '" aria-expanded="' +
            (!isCollapsed) + '">' +
            '<span class="stage-icon" style="background:' + stage.color + '22;color:' + stage.color + '">' +
              stage.icon + "</span>" +
            '<span class="stage-title"><h2>' + stage.name + "</h2>" +
              '<span class="stage-sub">' + done + "/" + total + " concluídos" +
              (subtotal ? " · " + money(subtotal) : "") + "</span></span>" +
            '<span class="stage-progress"><div style="width:' + pct + "%;background:" + stage.color + '"></div></span>' +
            '<span class="stage-chevron">⌄</span>' +
          "</button>" +
          '<div class="stage-body">' + sorted.map(itemHTML).join("") + "</div>" +
        "</section>"
      );
    }).join("");

    wrap.innerHTML = html;
  }

  /* ---------- Render: orçamento ---------- */

  function renderBudget() {
    const s = summary();

    const budgetInput = $("#budgetInput");
    if (budgetInput && document.activeElement !== budgetInput) {
      budgetInput.value = s.budget || "";
    }

    const cards = [
      {
        label: "Orçamento total",
        value: money(s.budget),
        note: "definido nos ajustes",
        cls: "highlight",
      },
      {
        label: "Previsto",
        value: money(s.previsto),
        note: s.budget
          ? Math.round((s.previsto / s.budget) * 100) + "% do orçamento"
          : "soma de todos os itens",
        cls: "",
      },
      {
        label: "Contratado",
        value: money(s.contratado),
        note: state.items.filter((i) => i.status === "contracted" || i.status === "done").length + " itens",
        cls: "",
      },
      {
        label: "Pago",
        value: money(s.pago),
        note: s.contratado ? Math.round((s.pago / s.contratado) * 100) + "% do contratado" : "nenhum pagamento",
        cls: "good",
      },
      {
        label: "A pagar",
        value: money(s.aPagar),
        note: "contratado − pago",
        cls: s.aPagar > 0 ? "warn" : "good",
      },
      {
        label: "Saldo",
        value: money(s.saldo),
        note: s.saldo >= 0 ? "disponível no orçamento" : "acima do orçamento",
        cls: s.saldo >= 0 ? "good" : "bad",
      },
    ];

    $("#budgetCards").innerHTML = cards
      .map(
        (c) =>
          '<div class="stat-card ' + c.cls + '"><span class="label">' + c.label +
          '</span><span class="value">' + c.value + '</span><span class="note">' + c.note + "</span></div>"
      )
      .join("");

    renderBreakdown();
    renderBudgetTable();
  }

  function renderBreakdown() {
    const rows = STAGES.map((stage) => {
      const items = state.items.filter((i) => i.stage === stage.id);
      const previsto = items.reduce((a, i) => a + num(i.cost), 0);
      const pago = items.reduce((a, i) => a + num(i.paid), 0);
      return { stage, previsto, pago };
    }).filter((r) => r.previsto > 0 || r.pago > 0);

    const wrap = $("#stageBreakdown");
    if (!rows.length) {
      wrap.innerHTML =
        '<p class="muted" style="margin:0;font-size:.88rem">Ainda não há valores cadastrados. ' +
        "Abra um item do checklist e informe o valor previsto.</p>";
      return;
    }

    const max = Math.max.apply(null, rows.map((r) => r.previsto).concat([1]));
    wrap.innerHTML = rows
      .map((r) => {
        const wPrev = Math.min(100, Math.round((r.previsto / max) * 100));
        const wPaid = Math.min(100, Math.round((r.pago / max) * 100));
        return (
          '<div class="bd-row">' +
            '<div class="bd-label"><span class="bd-icon">' + r.stage.icon +
              '</span><span class="bd-name">' + r.stage.name + "</span></div>" +
            '<div class="bd-track"><div class="bd-fill" style="width:' + wPrev + '%"></div>' +
              (r.pago > 0 ? '<div class="bd-paid" style="width:' + wPaid + '%"></div>' : "") +
            "</div>" +
            '<div class="bd-values"><strong>' + money(r.previsto) + "</strong>" +
              (r.pago > 0 ? "<span>pago " + money(r.pago) + "</span>" : "") +
            "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderBudgetTable() {
    const body = $("#budgetTableBody");
    if (!body) return;

    const order = {};
    STAGES.forEach((s, idx) => { order[s.id] = idx; });
    const items = state.items.slice().sort((a, b) => {
      const diff = (order[a.stage] || 0) - (order[b.stage] || 0);
      if (diff) return diff;
      return a.title.localeCompare(b.title, "pt-BR");
    });

    $("#budgetTableCount").textContent =
      items.length + (items.length === 1 ? " item" : " itens") +
      " · " + state.items.filter((i) => i.status === "done").length + " concluídos";

    if (!items.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="muted" style="text-align:center;padding:26px">' +
        "Nenhum item cadastrado ainda.</td></tr>";
      return;
    }

    body.innerHTML = items
      .map((item) => {
        const stage = stageById(item.stage);
        const st = STATUS[item.status] || STATUS.todo;
        const committed = item.status === "contracted" || item.status === "done";
        const falta = committed ? Math.max(0, num(item.cost) - num(item.paid)) : 0;
        return (
          '<tr data-edit="' + esc(item.id) + '" tabindex="0">' +
            '<td><span class="cell-title' + (item.status === "done" ? " done" : "") + '">' +
              esc(item.title) + "</span></td>" +
            '<td class="hide-sm"><span class="mini-stage" style="color:' + stage.color + '">' +
              stage.icon + " " + stage.name + "</span></td>" +
            '<td><span class="status-cell"><span class="status-dot" style="background:' + st.color +
              '"></span>' + st.label + "</span></td>" +
            '<td class="num">' + (num(item.cost) ? money(item.cost) : "—") + "</td>" +
            '<td class="num' + (num(item.paid) ? " paid" : "") + '">' +
              (num(item.paid) ? money(item.paid) : "—") + "</td>" +
            '<td class="num' + (falta ? " due" : "") + '">' +
              (falta ? money(falta) : "—") + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------- Render: convidados ---------- */

  function guestStatusOptions(selected) {
    return Object.keys(GUEST_STATUS)
      .map(
        (key) =>
          '<option value="' + key + '"' + (key === selected ? " selected" : "") + ">" +
          GUEST_STATUS[key].label + "</option>"
      )
      .join("");
  }

  function renderGuests() {
    const guests = state.guests;
    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    const children = guests.filter((g) => g.type === "child").length;
    const adults = guests.filter((g) => g.type === "adult").length;

    $("#guestStats").innerHTML = [
      { label: "Na lista", value: guests.length, note: "convidados" },
      { label: "Confirmados", value: confirmed, note: guests.length ? Math.round((confirmed / guests.length) * 100) + "% da lista" : "—", cls: "good" },
      { label: "Crianças", value: children, note: "na lista" },
      { label: "Adultos", value: adults, note: "na lista" },
    ]
      .map(
        (c) =>
          '<div class="stat-card ' + (c.cls || "") + '"><span class="label">' + c.label +
          '</span><span class="value">' + c.value + '</span><span class="note">' + c.note + "</span></div>"
      )
      .join("");

    const list = $("#guestList");
    if (!guests.length) {
      list.innerHTML =
        '<div class="empty"><span class="emoji">🎟️</span><h3>Lista vazia</h3>' +
        "<p>Adicione os convidados para acompanhar as confirmações.</p></div>";
      return;
    }

    const sorted = guests.slice().sort((a, b) => {
      const rank = { confirmed: 0, pending: 1, declined: 2 };
      return (rank[a.status] || 1) - (rank[b.status] || 1);
    });

    list.innerHTML = sorted
      .map((g) => {
        const gs = GUEST_STATUS[g.status] || GUEST_STATUS.pending;
        return (
          '<div class="guest-row">' +
            '<div class="guest-avatar ' + g.type + '">' + esc(initials(g.name)) + "</div>" +
            '<div class="guest-main"><div class="guest-name">' + esc(g.name) + "</div>" +
              '<div class="guest-type">' + (g.type === "child" ? "Criança" : "Adulto") +
              " · " + gs.label + "</div></div>" +
            '<select class="status-select" data-guest-status="' + esc(g.id) +
              '" style="--sc:' + gs.color + ";--sb:" + gs.bg + '" aria-label="Confirmação de ' +
              esc(g.name) + '">' + guestStatusOptions(g.status) + "</select>" +
            '<button class="icon-btn" type="button" data-guest-del="' + esc(g.id) +
              '" aria-label="Remover ' + esc(g.name) + '">🗑</button>' +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------- Render: nuvem ---------- */

  function renderCloudBar() {
    const dot = $("#cloudDot");
    const text = $("#cloudText");
    const saveBtn = $("#saveCloudBtn");
    const pullBtn = $("#pullBtn");
    if (!dot || !text) return;

    pullBtn.hidden = !hasCloud();
    saveBtn.textContent = hasCloud() ? "☁️ Salvar na nuvem" : "☁️ Ativar nuvem";
    text.removeAttribute("title");

    if (!hasCloud()) {
      dot.className = "dot";
      text.textContent = "Salvo neste dispositivo";
      return;
    }

    if (cloudPhase === "syncing") {
      dot.className = "dot sync";
      text.textContent = "Sincronizando com o GitHub…";
      return;
    }

    if (cloudPhase === "error") {
      dot.className = "dot err";
      text.textContent = "Erro ao sincronizar — tente salvar de novo";
      if (cloudError) text.title = cloudError;
      return;
    }

    if (!cloud.verified) {
      dot.className = "dot dirty";
      text.textContent = "Nuvem conectada — salve ou baixe os dados para começar";
      return;
    }

    if (dirty) {
      dot.className = "dot dirty";
      text.textContent = "Alterações não salvas na nuvem";
      return;
    }

    dot.className = "dot ok";
    text.textContent = cloud.lastSync
      ? "Sincronizado com o GitHub · " + timeAgo(cloud.lastSync)
      : "Conectado ao GitHub";
  }

  function setCloudPhase(phase, error) {
    cloudPhase = phase;
    cloudError = error || "";
    renderCloudBar();
  }

  function setConfigState(text) {
    const el = $("#cloudConfigState");
    if (el) el.textContent = text;
  }

  /* ---------- Render geral ---------- */

  function renderAll() {
    renderHero();
    renderChecklist();
    renderBudget();
    renderGuests();
    renderCloudBar();
  }

  /* ---------- Alterações / persistência ---------- */

  function touch(options) {
    const opts = options || {};
    state.updatedAt = nowISO();
    saveLocal();
    dirty = true;

    if (opts.cloud === false) {
      renderCloudBar();
      return;
    }

    if (hasCloud() && cloud.auto && cloud.verified) {
      cloudPhase = "dirty";
      renderCloudBar();
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => saveCloud({ silent: true }), 2500);
    } else {
      renderCloudBar();
    }
  }

  /* ---------- GitHub ---------- */

  function apiUrl() {
    const path = (cloud.path || "data.json")
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    return (
      "https://api.github.com/repos/" +
      encodeURIComponent(cloud.owner) +
      "/" +
      encodeURIComponent(cloud.repo) +
      "/contents/" +
      path
    );
  }

  async function gh(method, body) {
    const headers = {
      Authorization: "Bearer " + cloud.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (body) headers["Content-Type"] = "application/json";

    let url = apiUrl();
    if (method === "GET") {
      url += "?ref=" + encodeURIComponent(cloud.branch || "main");
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (res.status === 404) return { notFound: true };

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || "Erro " + res.status + " na API do GitHub");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function pullCloud(options) {
    const opts = options || {};
    if (!hasCloud()) {
      toast("Configure o GitHub nos Ajustes primeiro.", "warn");
      openSettings();
      return;
    }

    if (!opts.silent) {
      const ok = window.confirm(
        "Baixar os dados da nuvem?\n\nOs itens e convidados deste dispositivo serão substituídos pelo que está no GitHub."
      );
      if (!ok) return;
    }

    setCloudPhase("syncing");
    try {
      const data = await gh("GET");
      if (data.notFound) {
        setCloudPhase("idle");
        if (!opts.silent) {
          const send = window.confirm(
            "Ainda não existe arquivo na nuvem para este usuário, repositório e branch.\n\n" +
              "Se este aparelho tem os dados mais atuais, envie agora para criar o arquivo.\n\n" +
              "Se você já salvou de outro aparelho, cancele e confira se o token tem “Contents: Read and write” neste repositório."
          );
          if (send) {
            saveCloud({ fromSettings: opts.fromSettings });
            return;
          }
          toast("Nada foi baixado. Use “Salvar na nuvem” para criar o arquivo.", "warn");
        }
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(b64decode(data.content));
      } catch (e) {
        throw new Error("O arquivo do GitHub não é um JSON válido.");
      }

      const next = normalizeState(parsed);
      if (!next) throw new Error("O arquivo do GitHub não tem o formato esperado.");

      state = next;
      cloud.sha = data.sha;
      cloud.lastSync = nowISO();
      cloud.verified = true;
      saveCloudCfg();
      dirty = false;
      saveLocal();
      setCloudPhase("idle");
      renderAll();
      if (!opts.silent) toast("Dados carregados da nuvem ☁️", "ok");
    } catch (e) {
      setCloudPhase("error", e.message);
      if (!opts.silent) toast("Não foi possível baixar: " + e.message, "err");
    }
  }

  async function saveCloud(options) {
    const opts = options || {};
    if (!hasCloud()) {
      toast("Configure o GitHub nos Ajustes para usar a nuvem.", "warn");
      openSettings();
      return;
    }
    if (savingCloud) return;
    savingCloud = true;
    setCloudPhase("syncing");
    if (opts.fromSettings) setConfigState("Enviando os dados para o GitHub…");

    try {
      const head = await gh("GET");
      const sha = head.notFound ? null : head.sha;
      const content = b64encode(JSON.stringify(state, null, 2));

      const body = {
        message:
          "checklist: atualizar festa do " + state.meta.name + " — " +
          new Date().toLocaleString("pt-BR"),
        content,
        branch: cloud.branch || "main",
      };
      if (sha) body.sha = sha;

      const result = await gh("PUT", body);
      if (result && result.content && result.content.sha) {
        cloud.sha = result.content.sha;
      } else {
        cloud.sha = sha || "";
      }
      cloud.lastSync = nowISO();
      cloud.verified = true;
      saveCloudCfg();
      dirty = false;
      setCloudPhase("idle");
      if (opts.fromSettings) {
        setConfigState(
          sha
            ? "Enviado! O arquivo do GitHub foi atualizado."
            : "Enviado! O arquivo foi criado no GitHub."
        );
      }
      if (!opts.silent) {
        toast(sha ? "Checklist salvo no GitHub ☁️" : "Arquivo criado no GitHub ☁️", "ok");
      }
    } catch (e) {
      let msg = e.message || "erro desconhecido";
      if (e.status === 401) msg = "token inválido ou expirado.";
      if (e.status === 403) msg = "o token não tem permissão de escrita neste repositório.";
      if (e.status === 404) msg = "repositório, branch ou token sem acesso a este repositório.";
      if (e.status === 409 || e.status === 422) {
        msg = "conflito com uma versão mais nova no GitHub. Baixe da nuvem antes de salvar.";
      }
      setCloudPhase("error", msg);
      if (opts.fromSettings) setConfigState("Não foi possível enviar: " + msg);
      if (!opts.silent) toast("Erro ao salvar: " + msg, "err");
    } finally {
      savingCloud = false;
      renderCloudBar();
    }
  }

  /* ---------- Modais ---------- */

  let lastFocused = null;

  function openModal(el) {
    if (!el) return;
    lastFocused = document.activeElement;
    el.hidden = false;
    document.body.classList.add("no-scroll");
    setTimeout(() => {
      const first =
        el.querySelector("input:not([type=hidden]):not([type=checkbox]), select, textarea") ||
        el.querySelector("button");
      if (first) first.focus();
    }, 40);
  }

  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    if (!$$(".modal").some((m) => !m.hidden)) {
      document.body.classList.remove("no-scroll");
    }
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
      lastFocused = null;
    }
  }

  function closeAllModals() {
    $$(".modal").forEach((m) => { m.hidden = true; });
    document.body.classList.remove("no-scroll");
  }

  /* ---------- Item: abrir / salvar / excluir ---------- */

  function openItemModal(id) {
    const form = $("#itemForm");
    form.reset();
    $("#itemId").value = "";
    $("#itemModalTitle").textContent = "Novo item";
    $("#deleteItemBtn").hidden = true;

    if (id) {
      const item = state.items.find((i) => i.id === id);
      if (!item) return;
      $("#itemId").value = item.id;
      $("#itemTitle").value = item.title;
      $("#itemStage").value = item.stage;
      $("#itemStatus").value = item.status;
      $("#itemCost").value = item.cost ? String(item.cost).replace(".", ",") : "";
      $("#itemPaid").value = item.paid ? String(item.paid).replace(".", ",") : "";
      $("#itemDue").value = item.due || "";
      $("#itemSupplier").value = item.supplier || "";
      $("#itemLink").value = item.link || "";
      $("#itemNotes").value = item.notes || "";
      $("#itemModalTitle").textContent = "Editar item";
      $("#deleteItemBtn").hidden = false;
    } else {
      $("#itemStatus").value = "todo";
      const filterStage = $("#stageFilter").value;
      $("#itemStage").value = filterStage || "planejamento";
      $("#itemDue").value = "";
    }

    openModal($("#itemModal"));
  }

  function handleItemSubmit(event) {
    event.preventDefault();
    const title = $("#itemTitle").value.trim();
    if (!title) {
      $("#itemTitle").focus();
      return;
    }

    const data = {
      title,
      stage: $("#itemStage").value,
      status: $("#itemStatus").value,
      cost: parseMoney($("#itemCost").value),
      paid: parseMoney($("#itemPaid").value),
      supplier: $("#itemSupplier").value.trim(),
      due: $("#itemDue").value,
      link: $("#itemLink").value.trim(),
      notes: $("#itemNotes").value.trim(),
    };

    const id = $("#itemId").value;
    if (id) {
      const item = state.items.find((i) => i.id === id);
      if (item) Object.assign(item, data);
      toast("Item atualizado.", "ok");
    } else {
      state.items.push(Object.assign({ id: uid(), createdAt: nowISO() }, data));
      toast("Item adicionado ao checklist.", "ok");
    }

    touch();
    closeModal($("#itemModal"));
    renderAll();
  }

  function handleDeleteItem() {
    const id = $("#itemId").value;
    if (!id) return;
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    if (!window.confirm('Excluir o item "' + item.title + '"?')) return;
    state.items = state.items.filter((i) => i.id !== id);
    touch();
    closeModal($("#itemModal"));
    renderAll();
    toast("Item excluído.", "ok");
  }

  /* ---------- Configurações ---------- */

  function guessRepoFromHost() {
    const host = location.hostname || "";
    const match = host.match(/^([^.]+)\.github\.io$/i);
    if (!match) return null;
    const repo = (location.pathname.split("/").filter(Boolean)[0] || "").trim();
    if (!repo) return null;
    return { owner: match[1], repo };
  }

  function openSettings() {
    const meta = state.meta;
    const guess = guessRepoFromHost();
    $("#setName").value = meta.name;
    $("#setAge").value = meta.age;
    $("#setDate").value = meta.date;
    $("#setTime").value = meta.time;
    $("#setLocation").value = meta.location || "";
    $("#setBudget").value = meta.budget ? String(meta.budget).replace(".", ",") : "";
    $("#setOwner").value = cloud.owner || (guess ? guess.owner : "");
    $("#setRepo").value = cloud.repo || (guess ? guess.repo : "");
    $("#setBranch").value = cloud.branch || "main";
    $("#setPath").value = cloud.path || "data.json";
    $("#setToken").value = cloud.token || "";
    $("#setAuto").checked = !!cloud.auto;
    $("#cloudConfigState").textContent = "";
    openModal($("#settingsModal"));
  }

  function readCloudForm() {
    cloud.owner = $("#setOwner").value.trim();
    cloud.repo = $("#setRepo").value.trim();
    cloud.branch = $("#setBranch").value.trim() || "main";
    cloud.path = $("#setPath").value.trim() || "data.json";
    cloud.token = $("#setToken").value.trim();
    cloud.auto = $("#setAuto").checked;

    const identity = [cloud.owner, cloud.repo, cloud.branch, cloud.path, cloud.token].join("|");
    if (cloud._identity && cloud._identity !== identity) cloud.verified = false;
    cloud._identity = identity;

    if (!cloud.owner && !cloud.repo && !cloud.token) {
      cloud = {};
    }
    saveCloudCfg();
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    const wasCloud = hasCloud();

    const meta = state.meta;
    meta.name = $("#setName").value.trim() || "Ben";
    meta.age = Math.min(99, Math.max(1, parseInt($("#setAge").value, 10) || 5));
    meta.date = $("#setDate").value || meta.date;
    meta.time = $("#setTime").value || "16:00";
    meta.location = $("#setLocation").value.trim();
    meta.budget = parseMoney($("#setBudget").value);

    readCloudForm();

    const needsUpload = hasCloud() && !cloud.verified;

    touch();
    closeModal($("#settingsModal"));
    renderAll();

    if (needsUpload) {
      const send = window.confirm(
        "Ajustes salvos!\n\nAinda não há dados deste aparelho no GitHub.\n\n" +
          "OK = enviar agora e criar o arquivo (use se está começando).\n" +
          "Cancelar = não enviar (use “Baixar da nuvem” se o arquivo já existir)."
      );
      if (send) {
        saveCloud();
        return;
      }
      toast("Nuvem configurada. Envie ou baixe os dados quando quiser.", "warn");
    } else if (!wasCloud && hasCloud()) {
      toast("Nuvem conectada. Use “Baixar” ou “Salvar na nuvem” para começar.", "ok");
    } else {
      toast("Ajustes salvos.", "ok");
    }
  }

  async function testCloud() {
    readCloudForm();
    const status = $("#cloudConfigState");
    if (!hasCloud()) {
      status.textContent = "Preencha usuário, repositório e token.";
      return;
    }
    status.textContent = "Testando…";
    try {
      const data = await gh("GET");
      status.textContent = data.notFound
        ? "Conexão OK! O arquivo ainda não existe — clique em “Enviar para a nuvem” para criá-lo."
        : "Conexão OK! Arquivo encontrado no repositório.";
      renderCloudBar();
    } catch (e) {
      status.textContent = "Falhou: " + (e.message || "erro de conexão") + ".";
    }
  }

  /* ---------- Exportar / importar ---------- */

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = todayISO();
    a.href = url;
    a.download = "festa-" + norm(state.meta.name).replace(/\s+/g, "-") + "-" + date + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Backup exportado.", "ok");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = normalizeState(parsed);
        if (!next) throw new Error("formato inválido");
        const ok = window.confirm(
          "Importar este arquivo?\n\nOs dados atuais deste dispositivo serão substituídos."
        );
        if (!ok) return;
        state = next;
        touch();
        closeAllModals();
        renderAll();
        toast("Dados importados.", "ok");
      } catch (e) {
        toast("Arquivo inválido: " + e.message, "err");
      }
    };
    reader.onerror = () => toast("Não foi possível ler o arquivo.", "err");
    reader.readAsText(file);
  }

  /* ---------- Convite ---------- */

  async function copyInvite() {
    const m = state.meta;
    const text =
      "🎉 " + m.name + " faz " + m.age + " anos!\n" +
      "Tema: " + m.theme + " 🤠🚀\n" +
      "📅 " + longDate(m.date) + (m.time ? " às " + m.time.replace(":", "h") : "") + "\n" +
      "📍 " + (m.location || "Local a definir") + "\n\n" +
      "Confirme sua presença! 💙";

    try {
      await navigator.clipboard.writeText(text);
      toast("Convite copiado para a área de transferência.", "ok");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast("Convite copiado.", "ok");
      } catch (err) {
        toast("Não foi possível copiar automaticamente.", "err");
      }
      ta.remove();
    }
  }

  /* ---------- Toast ---------- */

  function toast(message, type) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = "toast" + (type ? " " + type : "");
    }, 3200);
  }

  /* ---------- Navegação ---------- */

  function showView(name) {
    const views = { checklist: "#view-checklist", budget: "#view-budget", guests: "#view-guests" };
    if (!views[name]) name = "checklist";

    $$(".tab").forEach((tab) => {
      const active = tab.dataset.view === name;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    Object.keys(views).forEach((key) => {
      const section = $(views[key]);
      if (section) section.hidden = key !== name;
    });

    if (name === "budget") renderBudget();
    if (name === "guests") renderGuests();

    try {
      const hash = name === "checklist" ? "" : "#" + name;
      history.replaceState(null, "", location.pathname + location.search + hash);
    } catch (e) {
      /* file:// pode bloquear replaceState */
    }
  }

  /* ---------- Eventos ---------- */

  function bindEvents() {
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => showView(tab.dataset.view));
    });

    $("#searchInput").addEventListener("input", renderChecklist);
    $("#stageFilter").addEventListener("change", renderChecklist);
    $("#statusFilter").addEventListener("change", renderChecklist);
    $("#pendingOnly").addEventListener("change", renderChecklist);
    $("#addItemBtn").addEventListener("click", () => openItemModal());
    $("#settingsBtn").addEventListener("click", openSettings);
    $("#heroEditBtn").addEventListener("click", openSettings);

    $("#saveCloudBtn").addEventListener("click", () => {
      if (!hasCloud()) openSettings();
      else saveCloud();
    });
    $("#pullBtn").addEventListener("click", () => pullCloud());

    $("#budgetInput").addEventListener("change", (e) => {
      state.meta.budget = parseMoney(e.target.value);
      touch();
      renderHero();
      renderBudget();
      renderCloudBar();
    });

    /* Checklist */
    $("#checklist").addEventListener("change", (event) => {
      const check = event.target.closest("[data-check]");
      if (check) {
        const item = state.items.find((i) => i.id === check.dataset.check);
        if (!item) return;
        if (check.checked) {
          item.status = "done";
        } else if (item.status === "done") {
          item.status = "todo";
        }
        touch();
        renderAll();
        return;
      }

      const select = event.target.closest("[data-status]");
      if (select) {
        const item = state.items.find((i) => i.id === select.dataset.status);
        if (!item) return;
        item.status = select.value;
        touch();
        renderAll();
      }
    });

    $("#checklist").addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-toggle-stage]");
      if (toggle) {
        const id = toggle.dataset.toggleStage;
        if (collapsed.has(id)) collapsed.delete(id);
        else collapsed.add(id);
        saveCollapsed();
        renderChecklist();
        return;
      }

      const edit = event.target.closest("[data-edit]");
      if (edit) {
        openItemModal(edit.dataset.edit);
        return;
      }

      if (event.target.closest("[data-add-first]")) {
        openItemModal();
        return;
      }

      if (event.target.closest("[data-clear-filters]")) {
        $("#searchInput").value = "";
        $("#stageFilter").value = "";
        $("#statusFilter").value = "";
        $("#pendingOnly").checked = false;
        renderChecklist();
      }
    });

    /* Orçamento */
    $("#budgetTableBody").addEventListener("click", (event) => {
      const row = event.target.closest("[data-edit]");
      if (row) openItemModal(row.dataset.edit);
    });
    $("#budgetTableBody").addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-edit]");
      if (row) {
        event.preventDefault();
        openItemModal(row.dataset.edit);
      }
    });

    /* Convidados */
    $("#guestForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#guestName").value.trim();
      if (!name) {
        $("#guestName").focus();
        return;
      }
      state.guests.push({
        id: uid(),
        name,
        type: $("#guestType").value === "adult" ? "adult" : "child",
        status: GUEST_STATUS[$("#guestStatus").value] ? $("#guestStatus").value : "pending",
      });
      $("#guestName").value = "";
      touch();
      renderGuests();
      renderHero();
      renderCloudBar();
      $("#guestName").focus();
      toast("Convidado adicionado.", "ok");
    });

    $("#guestList").addEventListener("change", (event) => {
      const select = event.target.closest("[data-guest-status]");
      if (!select) return;
      const guest = state.guests.find((g) => g.id === select.dataset.guestStatus);
      if (!guest) return;
      guest.status = select.value;
      touch();
      renderGuests();
      renderCloudBar();
    });

    $("#guestList").addEventListener("click", (event) => {
      const del = event.target.closest("[data-guest-del]");
      if (!del) return;
      const guest = state.guests.find((g) => g.id === del.dataset.guestDel);
      if (!guest) return;
      if (!window.confirm('Remover "' + guest.name + '" da lista?')) return;
      state.guests = state.guests.filter((g) => g.id !== guest.id);
      touch();
      renderGuests();
      renderCloudBar();
      toast("Convidado removido.", "ok");
    });

    $("#copyInviteBtn").addEventListener("click", copyInvite);

    /* Item modal */
    $("#itemForm").addEventListener("submit", handleItemSubmit);
    $("#deleteItemBtn").addEventListener("click", handleDeleteItem);

    /* Settings */
    $("#settingsForm").addEventListener("submit", handleSettingsSubmit);
    $("#testCloudBtn").addEventListener("click", testCloud);
    $("#pushCloudBtn").addEventListener("click", () => {
      readCloudForm();
      if (!hasCloud()) {
        setConfigState("Preencha usuário, repositório e token.");
        return;
      }
      saveCloud({ fromSettings: true });
    });
    $("#pullCloudBtn").addEventListener("click", () => {
      readCloudForm();
      if (!hasCloud()) {
        setConfigState("Preencha usuário, repositório e token.");
        return;
      }
      closeModal($("#settingsModal"));
      pullCloud();
    });

    $("#exportBtn").addEventListener("click", exportData);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importData(file);
      event.target.value = "";
    });

    $("#resetBtn").addEventListener("click", () => {
      if (!window.confirm("Restaurar o checklist de exemplo?\n\nOs itens atuais serão substituídos.")) return;
      state = defaultState();
      touch();
      closeAllModals();
      renderAll();
      toast("Checklist de exemplo restaurado.", "ok");
    });

    $("#clearBtn").addEventListener("click", () => {
      if (!window.confirm("Apagar todos os itens e convidados?\n\nOs ajustes da festa serão mantidos.")) return;
      state.items = [];
      state.guests = [];
      touch();
      closeAllModals();
      renderAll();
      toast("Itens e convidados apagados.", "ok");
    });

    /* Modais */
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close]");
      if (close) closeModal(close.closest(".modal"));
    });
    $$(".modal").forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const open = $$(".modal").find((m) => !m.hidden);
        if (open) closeModal(open);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (hasCloud()) saveCloud();
      }
    });

    window.addEventListener("hashchange", () => {
      showView((location.hash || "").replace("#", "") || "checklist");
    });

    window.addEventListener("beforeunload", (event) => {
      if (dirty && hasCloud()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  /* ---------- Init ---------- */

  function fillStageSelects() {
    const filter = $("#stageFilter");
    const itemSelect = $("#itemStage");
    filter.innerHTML =
      '<option value="">Todas as etapas</option>' +
      STAGES.map((s) => '<option value="' + s.id + '">' + s.icon + " " + s.name + "</option>").join("");
    itemSelect.innerHTML = STAGES.map(
      (s) => '<option value="' + s.id + '">' + s.icon + " " + s.name + "</option>"
    ).join("");
  }

  function init() {
    fillStageSelects();
    bindEvents();
    renderAll();

    const hash = (location.hash || "").replace("#", "");
    showView(hash === "budget" || hash === "guests" ? hash : "checklist");

    if (hasCloud() && !hadLocal) {
      pullCloud({ silent: true });
    }

    setInterval(renderCountdown, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
