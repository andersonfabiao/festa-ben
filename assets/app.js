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

  function normalizePhone(value) {
    return String(value == null ? "" : value)
      .replace(/[^\d+()\-\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function waLink(value) {
    const digits = phoneDigits(value);
    if (!digits) return "";
    return "https://wa.me/" + (digits.length <= 11 ? "55" + digits : digits);
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
    const g = (name, type, status) => ({
      id: guestKey(name, type),
      name,
      type,
      status,
      phone: "",
      notes: "",
      guardians: [],
      rsvpAt: "",
      rsvpMessage: "",
      rsvpSource: "",
    });
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
      rsvpUrl: "",
      mapsUrl: "",
      inviteMode: "search",
      maxAdults: 50,
      maxChildren: 25,
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

  function makeGuestRecord(raw, usedIds) {
    const g = raw && typeof raw === "object" ? raw : {};
    const name = cleanGuestName(g.name || g.nome || "").slice(0, 80);
    if (!name) return null;
    const type = g.type === "adult" ? "adult" : g.type === "child" ? "child" : "adult";
    const used = usedIds || new Set();

    let id = String(g.id || "").trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) id = guestKey(name, type);
    const base = id;
    let n = 2;
    while (used.has(id)) {
      id = base + "-" + n;
      n++;
    }
    used.add(id);

    const rsvpAt =
      typeof g.rsvpAt === "string" && !isNaN(Date.parse(g.rsvpAt)) ? g.rsvpAt : "";
    const status = GUEST_STATUS[g.status] ? g.status : "pending";

    return {
      id,
      name,
      type,
      status,
      phone: normalizePhone(g.phone || g.whatsapp || g.tel),
      notes: String(g.notes || g.observacoes || "").slice(0, 500),
      guardians: Array.isArray(g.guardians) ? g.guardians.map(String) : [],
      rsvpAt,
      rsvpMessage: String(g.rsvpMessage || "").slice(0, 280),
      rsvpSource:
        rsvpAt && (g.rsvpSource === "owner" || g.rsvpSource === "guest")
          ? g.rsvpSource
          : rsvpAt
            ? "guest"
            : "",
    };
  }

  function normalizeGuestList(rawGuests) {
    const usedIds = new Set();
    const guests = (Array.isArray(rawGuests) ? rawGuests : [])
      .map((g) => makeGuestRecord(g, usedIds))
      .filter(Boolean);

    const adultIds = new Set(guests.filter((g) => g.type === "adult").map((g) => g.id));
    guests.forEach((g) => {
      if (g.type !== "child") {
        g.guardians = [];
        return;
      }
      g.guardians = Array.from(new Set(g.guardians)).filter(
        (id) => id !== g.id && adultIds.has(id)
      );
    });
    return guests;
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
    meta.rsvpUrl = safeUrl(meta.rsvpUrl);
    meta.mapsUrl = safeUrl(meta.mapsUrl);
    meta.inviteMode = meta.inviteMode === "links" ? "links" : "search";
    meta.maxAdults = Math.min(999, Math.max(1, parseInt(meta.maxAdults, 10) || 50));
    meta.maxChildren = Math.min(999, Math.max(1, parseInt(meta.maxChildren, 10) || 25));

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

    const guests = normalizeGuestList(raw.guests);

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
  let activeView = "checklist";

  const GUEST_VIEW_KEY = "ben-guest-view-v1";
  const HIDE_VALUES_KEY = "ben-hide-values-v1";
  const GUEST_FILTERS = ["all", "adult", "child", "confirmed", "pending", "declined"];
  let guestFilter = "all";
  let guestQuery = "";
  let valuesHidden = false;

  function loadGuestView() {
    try {
      const raw = JSON.parse(localStorage.getItem(GUEST_VIEW_KEY) || "{}");
      guestFilter = GUEST_FILTERS.includes(raw.filter) ? raw.filter : "all";
    } catch (e) {
      guestFilter = "all";
    }
  }

  function saveGuestView() {
    try {
      localStorage.setItem(GUEST_VIEW_KEY, JSON.stringify({ filter: guestFilter }));
    } catch (e) {
      /* ignora */
    }
  }

  function loadHiddenValues() {
    try {
      valuesHidden = localStorage.getItem(HIDE_VALUES_KEY) === "1";
    } catch (e) {
      valuesHidden = false;
    }
  }

  function applyValuesHidden() {
    document.body.classList.toggle("hide-values", valuesHidden);
    const btn = $("#toggleValuesBtn");
    if (!btn) return;
    btn.textContent = valuesHidden ? "🙈 Valores" : "👁️ Valores";
    btn.setAttribute("aria-pressed", valuesHidden ? "true" : "false");
    btn.title = valuesHidden ? "Mostrar valores" : "Ocultar valores";
  }

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

    const map = mapsLink();
    const place = meta.location || (map ? "Ver no mapa" : "Local a definir");
    chips.push(
      map
        ? '<a class="chip chip-link" href="' + esc(map) +
          '" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps">📍 ' +
          esc(place) + " ↗</a>"
        : '<span class="chip">📍 ' + esc(place) + "</span>"
    );
    chips.push('<span class="chip">🤠 ' + esc(meta.theme) + "</span>");
    $("#heroMeta").innerHTML = chips.join("");

    renderCountdown();

    $("#progressLabel").textContent =
      s.done + " de " + s.total + " itens concluídos";
    $("#progressPct").textContent = s.pct + "%";
    $("#progressFill").style.width = s.pct + "%";

    if (activeView === "guests") {
      const guests = state.guests;
      const confirmed = guests.filter((g) => g.status === "confirmed").length;
      const children = guests.filter((g) => g.type === "child").length;
      const adults = guests.filter((g) => g.type === "adult").length;
      const stats = [
        { label: "Na lista", value: guests.length, cls: "" },
        { label: "Confirmados", value: confirmed, cls: "good" },
        { label: "Crianças", value: children, cls: "" },
        { label: "Adultos", value: adults, cls: "" },
      ];
      $("#heroStats").innerHTML = stats
        .map(
          (st) =>
            '<div class="hero-stat ' + st.cls + '"><span class="label">' +
            st.label + '</span><span class="value">' + st.value + "</span></div>"
        )
        .join("");
      return;
    }

    const stats = [
      { label: "Concluídos", value: s.done + "/" + s.total, cls: "" },
      { label: "Orçamento", value: money(s.budget), cls: "accent", money: true },
      { label: "Já pago", value: money(s.pago), cls: "good", money: true },
      {
        label: "A pagar",
        value: money(s.aPagar),
        cls: s.aPagar > 0 ? "" : "good",
        money: true,
      },
    ];
    $("#heroStats").innerHTML = stats
      .map(
        (st) =>
          '<div class="hero-stat ' + st.cls + '"><span class="label">' +
          st.label + '</span><span class="value' + (st.money ? " money" : "") + '">' +
          st.value + "</span></div>"
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
              ? '<strong class="money">' + money(item.cost) + "</strong>"
              : '<span class="muted">sem custo</span>') +
            (num(item.paid) > 0 ? '<span class="money">pago ' + money(item.paid) + "</span>" : "") +
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
              (subtotal ? ' · <span class="money">' + money(subtotal) + "</span>" : "") + "</span></span>" +
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
          '</span><span class="value money">' + c.value + '</span><span class="note">' + c.note + "</span></div>"
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
            '<div class="bd-values money"><strong>' + money(r.previsto) + "</strong>" +
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
            '<td class="num' + (num(item.cost) ? " money" : "") + '">' + (num(item.cost) ? money(item.cost) : "—") + "</td>" +
            '<td class="num' + (num(item.paid) ? " paid money" : "") + '">' +
              (num(item.paid) ? money(item.paid) : "—") + "</td>" +
            '<td class="num' + (falta ? " due money" : "") + '">' +
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

  function guestRowHtml(g) {
    const guests = state.guests;
    const gs = GUEST_STATUS[g.status] || GUEST_STATUS.pending;
    const link = guestInviteUrl(g);
    const rsvpNote = g.rsvpAt
      ? '<div class="guest-rsvp-time">' +
        (g.rsvpSource === "owner" ? "Atualizado " : "Respondeu ") +
        esc(timeAgo(g.rsvpAt)) + "</div>"
      : "";
    const rsvpMsg = g.rsvpMessage
      ? '<div class="guest-rsvp-msg">“' + esc(g.rsvpMessage) + "”</div>"
      : "";
    const phone = g.phone
      ? '<div class="guest-contact">📱 ' + esc(g.phone) +
        (waLink(g.phone)
          ? ' · <a href="' + esc(waLink(g.phone)) +
            '" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>'
          : "") +
        "</div>"
      : "";
    const notes = g.notes ? '<div class="guest-notes">' + esc(g.notes) + "</div>" : "";

    const guardians =
      g.type === "child"
        ? guests.filter((a) => a.type === "adult" && g.guardians.includes(a.id))
        : [];
    const kids =
      g.type === "adult"
        ? guests.filter((c) => c.type === "child" && c.guardians.includes(g.id))
        : [];
    const guardianLine = guardians.length
      ? '<div class="guest-links">👨‍👩‍👧 ' +
        (guardians.length > 1 ? "Responsáveis: " : "Responsável: ") +
        guardians.map((a) => esc(a.name)).join(", ") + "</div>"
      : "";
    const kidsLine = kids.length
      ? '<div class="guest-links">🧒 Crianças: ' +
        kids.map((c) => esc(c.name)).join(", ") + "</div>"
      : "";

    return (
      '<div class="guest-row">' +
        '<div class="guest-avatar ' + g.type + '">' + esc(initials(g.name)) + "</div>" +
        '<div class="guest-main"><div class="guest-name">' + esc(g.name) + "</div>" +
          '<div class="guest-type">' + (g.type === "child" ? "Criança" : "Adulto") +
          " · " + gs.label + "</div>" + phone + notes + guardianLine + kidsLine +
          rsvpNote + rsvpMsg + "</div>" +
        '<select class="status-select" data-guest-status="' + esc(g.id) +
          '" style="--sc:' + gs.color + ";--sb:" + gs.bg + '" aria-label="Confirmação de ' +
          esc(g.name) + '">' + guestStatusOptions(g.status) + "</select>" +
        '<button class="icon-btn" type="button" data-guest-edit="' + esc(g.id) +
          '" aria-label="Editar ' + esc(g.name) + '" title="Editar convidado">✏️</button>' +
        '<button class="icon-btn" type="button" data-guest-link="' + esc(g.id) +
          '" data-link="' + esc(link) +
          '" aria-label="Copiar link do convite de ' + esc(g.name) +
          '" title="Copiar link do convite">🔗</button>' +
        '<button class="icon-btn" type="button" data-guest-del="' + esc(g.id) +
          '" aria-label="Remover ' + esc(g.name) + '">🗑</button>' +
      "</div>"
    );
  }

  function renderGuestLimits() {
    const wrap = $("#guestLimits");
    if (!wrap) return;
    const meta = state.meta;
    const adults = state.guests.filter((g) => g.type === "adult").length;
    const children = state.guests.filter((g) => g.type === "child").length;

    const rows = [
      { icon: "🧑", label: "Adultos", count: adults, max: meta.maxAdults },
      { icon: "🧒", label: "Crianças", count: children, max: meta.maxChildren },
    ];

    wrap.innerHTML = rows
      .map((row) => {
        const pct = row.max > 0 ? Math.round((row.count / row.max) * 100) : 0;
        const fill = Math.max(0, Math.min(100, pct));
        const over = row.count > row.max;
        const full = row.count >= row.max;
        const status = over
          ? "limite ultrapassado"
          : full
          ? "limite atingido"
          : "dentro do limite";
        return (
          '<div class="limit-row' + (over ? " is-over" : full ? " is-full" : "") + '">' +
            '<span class="limit-label">' + row.icon + " " + row.label + "</span>" +
            '<span class="limit-count">' + row.count + "/" + row.max + "</span>" +
            '<span class="limit-track" role="img" aria-label="' +
              esc(row.label + ": " + row.count + " de " + row.max + ", " + pct + "%, " + status) + '">' +
              '<span class="limit-fill"></span>' +
              '<span class="limit-rest" style="width:' + (100 - fill) + '%"></span>' +
            "</span>" +
            '<span class="limit-pct">' + pct + "%</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderGuests() {
    const guests = state.guests;
    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    const pending = guests.filter((g) => g.status === "pending").length;
    const declined = guests.filter((g) => g.status === "declined").length;
    const children = guests.filter((g) => g.type === "child").length;
    const adults = guests.filter((g) => g.type === "adult").length;
    const meta = state.meta;

    $("#guestStats").innerHTML = [
      { label: "Na lista", value: guests.length, note: "convidados" },
      { label: "Confirmados", value: confirmed, note: guests.length ? Math.round((confirmed / guests.length) * 100) + "% da lista" : "—", cls: "good" },
      { label: "Crianças", value: children, note: "de " + meta.maxChildren },
      { label: "Adultos", value: adults, note: "de " + meta.maxAdults },
    ]
      .map(
        (c) =>
          '<div class="stat-card ' + (c.cls || "") + '"><span class="label">' + c.label +
          '</span><span class="value">' + c.value + '</span><span class="note">' + c.note + "</span></div>"
      )
      .join("");

    renderGuestLimits();

    const counts = {
      all: guests.length,
      adult: adults,
      child: children,
      confirmed,
      pending,
      declined,
    };
    const labels = {
      all: "Todos",
      adult: "Adultos",
      child: "Crianças",
      confirmed: "Confirmados",
      pending: "Pendentes",
      declined: "Não vão",
    };
    $$("[data-guest-filter]").forEach((btn) => {
      const key = btn.dataset.guestFilter;
      if (!(key in counts)) return;
      btn.innerHTML = labels[key] + ' <span class="filter-count">' + counts[key] + "</span>";
      const on = key === guestFilter;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const list = $("#guestList");
    if (!guests.length) {
      list.innerHTML =
        '<div class="empty"><span class="emoji">🎟️</span><h3>Lista vazia</h3>' +
        "<p>Adicione os convidados para acompanhar as confirmações.</p></div>";
      return;
    }

    const q = norm(guestQuery);
    const visible = guests.filter((g) => {
      if (guestFilter === "adult" || guestFilter === "child") {
        if (g.type !== guestFilter) return false;
      } else if (guestFilter !== "all") {
        if (g.status !== guestFilter) return false;
      }
      if (q && !norm(g.name).includes(q)) return false;
      return true;
    });

    if (!visible.length) {
      list.innerHTML =
        '<div class="empty"><span class="emoji">🔎</span><h3>Nenhum convidado encontrado</h3>' +
        "<p>" +
        (q
          ? "Nenhum nome combina com “" + esc(guestQuery.trim()) + "” nesse filtro."
          : "Nenhum convidado nesse filtro.") +
        " Troque o filtro ou limpe a busca.</p></div>";
      return;
    }

    const byName = (a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

    const groups = [
      {
        id: "adult",
        title: "Adultos",
        icon: "🧑",
        items: visible.filter((g) => g.type === "adult").sort(byName),
      },
      {
        id: "child",
        title: "Crianças",
        icon: "🧒",
        items: visible.filter((g) => g.type === "child").sort(byName),
      },
    ].filter((group) => group.items.length);

    list.innerHTML = groups
      .map(
        (group) =>
          '<div class="guest-group">' +
            '<h3 class="guest-group-title">' + group.icon + " " + group.title +
              ' <span class="guest-group-count">' + group.items.length + "</span></h3>" +
            group.items.map(guestRowHtml).join("") +
          "</div>"
      )
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

  function mergeRsvpsFrom(remote) {
    if (!remote || !Array.isArray(remote.guests)) return 0;
    const byId = new Map(remote.guests.map((g) => [g.id, g]));
    let changed = 0;
    state.guests.forEach((g) => {
      const r = byId.get(g.id);
      if (!r || !r.rsvpAt) return;
      const localAt = Date.parse(g.rsvpAt || "") || 0;
      const remoteAt = Date.parse(r.rsvpAt) || 0;
      if (remoteAt <= localAt) return;
      g.status = r.status;
      g.rsvpAt = r.rsvpAt;
      g.rsvpMessage = r.rsvpMessage || "";
      g.rsvpSource = r.rsvpSource || "guest";
      changed++;
    });
    return changed;
  }

  async function refreshGuestResponses(options) {
    const opts = options || {};
    const stateEl = $("#guestSyncState");
    if (!hasCloud() || !cloud.verified) {
      if (opts.manual) {
        if (stateEl) stateEl.textContent = "Configure a nuvem para atualizar as respostas.";
        toast("Configure a nuvem nos Ajustes para buscar respostas.", "warn");
      }
      return;
    }
    if (savingCloud) return;

    if (stateEl) stateEl.textContent = "Buscando respostas…";
    try {
      const data = await gh("GET");
      if (data.notFound) {
        if (stateEl) stateEl.textContent = "";
        if (opts.manual) toast("Ainda não há dados na nuvem.", "warn");
        return;
      }

      const remote = normalizeState(JSON.parse(b64decode(data.content)));
      if (!remote) throw new Error("formato inesperado");

      const changed = mergeRsvpsFrom(remote);
      if (changed) {
        saveLocal();
        renderGuests();
        renderHero();
        cloud.lastSync = nowISO();
        saveCloudCfg();
        renderCloudBar();
      }

      if (stateEl) {
        stateEl.textContent = changed
          ? changed + (changed === 1 ? " resposta atualizada agora." : " respostas atualizadas agora.")
          : "Nenhuma resposta nova.";
      }
      if (opts.manual) {
        toast(changed ? changed + " resposta(s) atualizada(s)." : "Nenhuma resposta nova.", "ok");
      }
    } catch (e) {
      if (stateEl) stateEl.textContent = "Não foi possível atualizar: " + (e.message || "erro");
      if (opts.manual) toast("Não foi possível atualizar: " + (e.message || "erro"), "err");
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

      // Preserva respostas de presença que chegaram pelo convite depois da última cópia local.
      let mergedRsvps = 0;
      if (!head.notFound && head.content) {
        try {
          const remote = normalizeState(JSON.parse(b64decode(head.content)));
          if (remote) mergedRsvps = mergeRsvpsFrom(remote);
        } catch (e) {
          /* arquivo remoto inválido: mantém os dados locais */
        }
      }

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
      if (mergedRsvps) {
        saveLocal();
        renderGuests();
        renderHero();
      }
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

  /* ---------- Convidado: editar / excluir ---------- */

  function guestById(id) {
    return state.guests.find((g) => g.id === id) || null;
  }

  function relationItem(kind, id, name, detail, checked) {
    return (
      '<label class="relation-item">' +
        '<input type="checkbox" data-' + kind + '-id="' + esc(id) + '"' +
          (checked ? " checked" : "") + " />" +
        '<span class="relation-name">' + esc(name) + "</span>" +
        (detail ? '<span class="relation-detail">' + esc(detail) + "</span>" : "") +
      "</label>"
    );
  }

  function renderGuestRelations(guest) {
    const isChild = guest.type === "child";
    const guardiansField = $("#guestGuardiansField");
    const childrenField = $("#guestChildrenField");
    guardiansField.hidden = !isChild;
    childrenField.hidden = isChild;

    if (isChild) {
      const adults = state.guests
        .filter((g) => g.type === "adult" && g.id !== guest.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      $("#guestGuardiansList").innerHTML = adults.length
        ? adults
            .map((a) =>
              relationItem(
                "guardian",
                a.id,
                a.name,
                a.phone || "",
                guest.guardians.includes(a.id)
              )
            )
            .join("")
        : '<p class="hint">Nenhum adulto na lista ainda. Adicione os adultos primeiro para vinculá-los.</p>';
      return;
    }

    const children = state.guests
      .filter((g) => g.type === "child" && g.id !== guest.id)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    $("#guestChildrenList").innerHTML = children.length
      ? children
          .map((c) =>
            relationItem(
              "child",
              c.id,
              c.name,
              c.guardians.includes(guest.id) ? "já vinculada" : "",
              c.guardians.includes(guest.id)
            )
          )
          .join("")
      : '<p class="hint">Nenhuma criança na lista ainda. Adicione as crianças primeiro para vinculá-las.</p>';
  }

  function openGuestModal(id) {
    const guest = id ? guestById(id) : null;
    if (id && !guest) return;

    const draft = guest || {
      id: "",
      name: "",
      type: "adult",
      status: "pending",
      phone: "",
      notes: "",
      guardians: [],
    };

    $("#guestEditId").value = guest ? guest.id : "";
    $("#guestEditName").value = draft.name;
    $("#guestEditType").value = draft.type;
    $("#guestEditStatus").value = draft.status;
    $("#guestEditPhone").value = draft.phone || "";
    $("#guestEditNotes").value = draft.notes || "";
    $("#guestEditLink").value = guest ? guestInviteUrl(guest) : "";
    $("#guestEditLinkField").hidden = !guest;
    $("#guestEditDelete").hidden = !guest;
    $("#guestModalTitle").textContent = guest ? "Editar convidado" : "Novo convidado";
    $("#guestEditSubmit").textContent = guest ? "Salvar convidado" : "Adicionar convidado";

    renderGuestRelations(draft);
    openModal($("#guestModal"));
  }

  function handleGuestEditSubmit(event) {
    event.preventDefault();
    const existing = guestById($("#guestEditId").value);
    const isNew = !existing;

    const name = cleanGuestName($("#guestEditName").value).slice(0, 80);
    if (!name) {
      $("#guestEditName").focus();
      return;
    }
    const type = $("#guestEditType").value === "adult" ? "adult" : "child";
    const status = GUEST_STATUS[$("#guestEditStatus").value]
      ? $("#guestEditStatus").value
      : "pending";

    let guest = existing;
    if (!guest) {
      const usedIds = new Set(state.guests.map((g) => g.id));
      guest = makeGuestRecord({ name, type, status }, usedIds);
      if (!guest) return;
      state.guests.push(guest);
    } else if (type !== guest.type) {
      state.guests.forEach((g) => {
        if (g.type === "child" && Array.isArray(g.guardians)) {
          g.guardians = g.guardians.filter((id) => id !== guest.id);
        }
      });
    }

    guest.name = name;
    guest.type = type;
    guest.status = status;
    guest.phone = normalizePhone($("#guestEditPhone").value);
    guest.notes = String($("#guestEditNotes").value || "").trim().slice(0, 500);

    if (type === "child") {
      const selected = $$("#guestGuardiansList [data-guardian-id]:checked").map(
        (el) => el.dataset.guardianId
      );
      guest.guardians = Array.from(new Set(selected)).filter((id) => {
        const adult = guestById(id);
        return adult && adult.type === "adult" && adult.id !== guest.id;
      });
    } else {
      guest.guardians = [];
      const selected = new Set(
        $$("#guestChildrenList [data-child-id]:checked").map((el) => el.dataset.childId)
      );
      state.guests.forEach((child) => {
        if (child.type !== "child") return;
        const has = child.guardians.includes(guest.id);
        const want = selected.has(child.id);
        if (want && !has) child.guardians.push(guest.id);
        if (!want && has) child.guardians = child.guardians.filter((id) => id !== guest.id);
      });
    }

    touch();
    closeModal($("#guestModal"));
    renderGuests();
    renderHero();
    renderCloudBar();

    if (isNew) {
      const max = type === "adult" ? state.meta.maxAdults : state.meta.maxChildren;
      const count = state.guests.filter((g) => g.type === type).length;
      if (count > max) {
        toast(
          "Convidado adicionado, mas o limite de " +
            (type === "adult" ? "adultos" : "crianças") +
            " foi ultrapassado (" + count + "/" + max + ").",
          "err"
        );
        return;
      }
      toast("Convidado adicionado.", "ok");
      return;
    }

    toast("Convidado atualizado.", "ok");
  }

  function deleteGuest(id) {
    const guest = guestById(id);
    if (!guest) return;
    if (!window.confirm('Remover "' + guest.name + '" da lista?')) return;

    state.guests = state.guests.filter((g) => g.id !== guest.id);
    state.guests.forEach((g) => {
      if (g.type === "child" && Array.isArray(g.guardians)) {
        g.guardians = g.guardians.filter((x) => x !== guest.id);
      }
    });

    touch();
    closeModal($("#guestModal"));
    renderGuests();
    renderHero();
    renderCloudBar();
    toast("Convidado removido.", "ok");
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
    $("#setMapsUrl").value = meta.mapsUrl || "";
    $("#setBudget").value = meta.budget ? String(meta.budget).replace(".", ",") : "";
    $("#setMaxAdults").value = meta.maxAdults;
    $("#setMaxChildren").value = meta.maxChildren;
    $("#setOwner").value = cloud.owner || (guess ? guess.owner : "");
    $("#setRepo").value = cloud.repo || (guess ? guess.repo : "");
    $("#setBranch").value = cloud.branch || "main";
    $("#setPath").value = cloud.path || "data.json";
    $("#setToken").value = cloud.token || "";
    $("#setAuto").checked = !!cloud.auto;
    $("#setInviteLink").value = invitePageUrl();
    $("#setRsvpUrl").value = meta.rsvpUrl || "";
    $("#setInviteMode").value = meta.inviteMode === "links" ? "links" : "search";

    const help = $("#rsvpHelpLink");
    if (help) {
      const owner = cloud.owner || (guess ? guess.owner : "");
      const repo = cloud.repo || (guess ? guess.repo : "");
      const branch = cloud.branch || "main";
      help.href =
        owner && repo
          ? "https://github.com/" + owner + "/" + repo + "/blob/" + branch + "/apps-script/README.md"
          : "https://github.com/andersonfabiao/festa-ben/blob/main/apps-script/README.md";
    }

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
    meta.mapsUrl = safeUrl($("#setMapsUrl").value.trim());
    meta.budget = parseMoney($("#setBudget").value);
    meta.maxAdults = Math.min(999, Math.max(1, parseInt($("#setMaxAdults").value, 10) || 50));
    meta.maxChildren = Math.min(999, Math.max(1, parseInt($("#setMaxChildren").value, 10) || 25));
    const rsvpValue = $("#setRsvpUrl").value.trim();
    meta.rsvpUrl = safeUrl(rsvpValue);
    if (rsvpValue && !meta.rsvpUrl) {
      toast("A URL do Apps Script precisa começar com https://.", "warn");
    }
    meta.inviteMode = $("#setInviteMode").value === "links" ? "links" : "search";

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

  function invitePageUrl() {
    try {
      const url = new URL("convite.html", location.href);
      url.search = "";
      url.hash = "";
      return url.href;
    } catch (e) {
      return "convite.html";
    }
  }

  function guestInviteUrl(guest) {
    const key = guest && guest.id ? String(guest.id) : guestKey(guest.name, guest.type);
    return invitePageUrl() + "?convite=" + encodeURIComponent(key);
  }

  function mapsLink() {
    const custom = safeUrl(state.meta.mapsUrl);
    if (custom) return custom;
    const query = String(state.meta.location || "").trim();
    if (!query) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  async function copyInvite() {
    const m = state.meta;
    const map = mapsLink();
    const text =
      "🎉 " + m.name + " faz " + m.age + " anos!\n" +
      "Tema: " + m.theme + " 🤠🚀\n" +
      "📅 " + longDate(m.date) + (m.time ? " às " + m.time.replace(":", "h") : "") + "\n" +
      "📍 " + (m.location || "Local a definir") + "\n" +
      (map ? "🗺️ Mapa: " + map + "\n" : "") +
      "\nConfirme sua presença: " + invitePageUrl();

    const ok = await copyText(text);
    toast(ok ? "Convite com o link copiado." : "Não foi possível copiar automaticamente.", ok ? "ok" : "err");
  }

  async function copyInviteLink() {
    const ok = await copyText(invitePageUrl());
    toast(ok ? "Link do convite copiado." : "Não foi possível copiar automaticamente.", ok ? "ok" : "err");
  }

  /* ---------- Importar convidados ---------- */

  let pendingGuestImport = null;

  function cleanGuestName(value) {
    return String(value == null ? "" : value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*\*+\s*$/, "")
      .trim();
  }

  function parseGuestType(value, fallback) {
    const v = norm(value);
    if (/crian|child|kid|infant|filh/.test(v)) return "child";
    if (/adult|respons|pai|mae|mãe/.test(v)) return "adult";
    return fallback;
  }

  function parseGuestStatus(value) {
    const v = norm(value);
    if (/confirm|present|^sim\b|vai\b/.test(v)) return "confirmed";
    if (/nao vai|^nao\b|declin|recus|^no\b/.test(v)) return "declined";
    return "pending";
  }

  function parseGuestText(text) {
    const raw = String(text == null ? "" : text);
    const trimmed = raw.trim();
    if (!trimmed) return { guests: [], duplicates: 0 };

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const data = JSON.parse(trimmed);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.guests)
            ? data.guests
            : [];
        const guests = list
          .map((g) => {
            if (typeof g === "string") {
              return { name: cleanGuestName(g), type: "adult", status: "pending" };
            }
            const o = g && typeof g === "object" ? g : {};
            return {
              id: o.id ? String(o.id).slice(0, 40) : "",
              name: cleanGuestName(o.name || o.nome),
              type: parseGuestType(o.type || o.tipo, "adult"),
              status: parseGuestStatus(o.status || o.confirmacao),
              phone: o.phone || o.whatsapp || o.tel || "",
              notes: o.notes || o.observacoes || "",
              guardians: Array.isArray(o.guardians) ? o.guardians.map(String) : [],
              rsvpAt: o.rsvpAt || "",
              rsvpMessage: o.rsvpMessage || "",
              rsvpSource: o.rsvpSource || "",
            };
          })
          .filter((g) => g.name);
        return dedupeGuestList(guests);
      } catch (e) {
        return { guests: [], duplicates: 0, invalid: true };
      }
    }

    const out = [];
    let current = "adult";

    for (const rawLine of raw.split(/\r?\n/)) {
      const line = cleanGuestName(rawLine);
      if (!line) continue;

      if (/^(lista\s+de\s+)?adultos?\b/i.test(line)) {
        current = "adult";
        continue;
      }
      if (/^crian[cç]as?\b/i.test(line)) {
        current = "child";
        continue;
      }

      const cells = line.split(/\s*[;\t]\s*/).filter((c) => c !== "");
      if (cells.length > 1) {
        const name = cleanGuestName(cells[0]);
        if (!name || /^(nome|name|convidado)$/i.test(name)) continue;
        const type = parseGuestType(cells[1], current);
        out.push({ name, type, status: parseGuestStatus(cells[2] || "") });
        continue;
      }

      const numbered = line.match(/^\d+\s*[.)\]]?\s+(.*)$/);
      const name = cleanGuestName(numbered ? numbered[1] : line);
      if (!name) continue;
      if (/^(nome|convidados?|lista)\b/i.test(name) && name.split(" ").length <= 3) continue;

      out.push({ name, type: current, status: "pending" });
    }

    return dedupeGuestList(out);
  }

  function dedupeGuestList(list) {
    const seen = new Set();
    const guests = [];
    let duplicates = 0;
    for (const g of list) {
      const key = norm(g.name) + "|" + g.type;
      if (!key) continue;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      guests.push(g);
    }
    return { guests, duplicates };
  }

  function handleGuestImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showGuestImportPreview(String(reader.result || ""), "no arquivo");
    reader.onerror = () => toast("Não foi possível ler o arquivo.", "err");
    reader.readAsText(file);
  }

  async function importBundledGuests() {
    try {
      const response = await fetch("convidados.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      showGuestImportPreview(await response.text(), "na lista do Ben");
    } catch (e) {
      toast("Não consegui abrir a lista do Ben. Use “Importar lista” e escolha o arquivo.", "err");
    }
  }

  function showGuestImportPreview(text, sourceLabel) {
    const parsed = parseGuestText(text);
    if (parsed.invalid) {
      toast("O JSON do arquivo não é válido.", "err");
      return;
    }
    if (!parsed.guests.length) {
      toast("Não encontrei nomes no arquivo. Use uma lista com um nome por linha.", "err");
      return;
    }

    pendingGuestImport = parsed.guests;

    const adults = parsed.guests.filter((g) => g.type === "adult").length;
    const kids = parsed.guests.filter((g) => g.type === "child").length;
    $("#guestImportSummary").textContent =
      parsed.guests.length +
      " nome(s) " + sourceLabel + ": " +
      adults + " adulto(s) e " + kids + " criança(s).";

    const preview = parsed.guests.slice(0, 8);
    let previewHtml = preview
      .map(
        (g) =>
          "<li>" + esc(g.name) +
          '<span class="muted">' + (g.type === "child" ? "criança" : "adulto") + "</span></li>"
      )
      .join("");
    if (parsed.guests.length > preview.length) {
      previewHtml += '<li class="muted">… e mais ' + (parsed.guests.length - preview.length) + "</li>";
    }
    $("#guestImportPreview").innerHTML = previewHtml;

    const existing = new Set(state.guests.map((g) => norm(g.name) + "|" + g.type));
    const repeated = parsed.guests.filter((g) => existing.has(norm(g.name) + "|" + g.type)).length;
    const dupesEl = $("#guestImportDupes");
    const notes = [];
    if (repeated) {
      notes.push(
        repeated + " nome(s) já estão na lista e serão ignorados se você escolher “Adicionar”."
      );
    }
    if (parsed.duplicates) {
      notes.push(parsed.duplicates + " repetido(s) dentro do próprio arquivo foram ignorados.");
    }
    if (notes.length) {
      dupesEl.hidden = false;
      dupesEl.textContent = notes.join(" ");
    } else {
      dupesEl.hidden = true;
      dupesEl.textContent = "";
    }

    $("input[name=importMode][value=merge]").checked = true;
    openModal($("#guestImportModal"));
  }

  function confirmGuestImport() {
    const list = pendingGuestImport;
    if (!list || !list.length) return;
    const mode = ($("input[name=importMode]:checked") || {}).value || "merge";

    let added = 0;
    let skipped = 0;

    if (mode === "replace") {
      state.guests = normalizeGuestList(list);
      added = state.guests.length;
    } else {
      const existing = new Set(state.guests.map((g) => norm(g.name) + "|" + g.type));
      const usedIds = new Set(state.guests.map((g) => g.id));
      list.forEach((g) => {
        const key = norm(g.name) + "|" + g.type;
        if (existing.has(key)) {
          skipped++;
          return;
        }
        const record = makeGuestRecord(g, usedIds);
        if (!record) return;
        existing.add(key);
        state.guests.push(record);
        added++;
      });
      state.guests = normalizeGuestList(state.guests);
    }

    pendingGuestImport = null;
    touch();
    closeModal($("#guestImportModal"));
    renderGuests();
    renderHero();
    renderCloudBar();

    let msg = added + (added === 1 ? " convidado importado" : " convidados importados");
    if (skipped) msg += " · " + skipped + " repetido(s) ignorado(s)";
    toast(msg + ".", "ok");
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
    activeView = name;

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
    if (name === "guests") {
      renderGuests();
      refreshGuestResponses();
    }
    renderHero();

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
    $("#settingsGuestsBtn").addEventListener("click", openSettings);

    $("#toggleValuesBtn").addEventListener("click", () => {
      valuesHidden = !valuesHidden;
      try {
        localStorage.setItem(HIDE_VALUES_KEY, valuesHidden ? "1" : "0");
      } catch (e) {
        /* ignora */
      }
      applyValuesHidden();
      renderHero();
      renderBudget();
    });

    $("#saveCloudGuestsBtn").addEventListener("click", () => {
      if (!hasCloud()) openSettings();
      else saveCloud();
    });

    $$("[data-guest-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        guestFilter = GUEST_FILTERS.includes(btn.dataset.guestFilter)
          ? btn.dataset.guestFilter
          : "all";
        saveGuestView();
        renderGuests();
      });
    });

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
    $("#guestSearch").addEventListener("input", (event) => {
      guestQuery = event.target.value;
      renderGuests();
    });

    $("#addGuestBtn").addEventListener("click", () => openGuestModal());

    $("#guestList").addEventListener("change", (event) => {
      const select = event.target.closest("[data-guest-status]");
      if (!select) return;
      const guest = state.guests.find((g) => g.id === select.dataset.guestStatus);
      if (!guest) return;
      guest.status = select.value;
      guest.rsvpAt = nowISO();
      guest.rsvpSource = "owner";
      touch();
      renderGuests();
      renderCloudBar();
    });

    $("#guestList").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-guest-edit]");
      if (edit) {
        openGuestModal(edit.dataset.guestEdit);
        return;
      }

      const link = event.target.closest("[data-guest-link]");
      if (link) {
        const guest = state.guests.find((g) => g.id === link.dataset.guestLink);
        copyText(link.dataset.link).then((ok) => {
          toast(
            ok
              ? "Link do convite de " + (guest ? guest.name : "convidado") + " copiado."
              : "Não foi possível copiar automaticamente.",
            ok ? "ok" : "err"
          );
        });
        return;
      }

      const del = event.target.closest("[data-guest-del]");
      if (del) deleteGuest(del.dataset.guestDel);
    });

    /* Modal de convidado */
    $("#guestEditForm").addEventListener("submit", handleGuestEditSubmit);
    $("#guestEditType").addEventListener("change", () => {
      const id = $("#guestEditId").value;
      const guest = guestById(id);
      renderGuestRelations({
        id,
        type: $("#guestEditType").value === "adult" ? "adult" : "child",
        guardians: guest ? guest.guardians || [] : [],
      });
    });
    $("#guestEditCopyLink").addEventListener("click", () => {
      copyText($("#guestEditLink").value).then((ok) => {
        toast(ok ? "Link do convite copiado." : "Não foi possível copiar automaticamente.", ok ? "ok" : "err");
      });
    });
    $("#guestEditDelete").addEventListener("click", () => {
      deleteGuest($("#guestEditId").value);
    });

    $("#copyInviteBtn").addEventListener("click", copyInvite);
    $("#copyInviteLinkBtn").addEventListener("click", copyInviteLink);
    $("#copyInviteLinkBtn2").addEventListener("click", copyInviteLink);
    $("#refreshGuestsBtn").addEventListener("click", () => refreshGuestResponses({ manual: true }));
    $("#importBundledGuestsBtn").addEventListener("click", importBundledGuests);
    $("#importGuestsBtn").addEventListener("click", () => $("#guestImportFile").click());
    $("#guestImportFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleGuestImportFile(file);
      event.target.value = "";
    });
    $("#guestImportConfirm").addEventListener("click", confirmGuestImport);

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
    loadGuestView();
    loadHiddenValues();
    applyValuesHidden();
    fillStageSelects();
    bindEvents();
    renderAll();

    const hash = (location.hash || "").replace("#", "");
    showView(hash === "budget" || hash === "guests" ? hash : "checklist");

    if (hasCloud() && !hadLocal) {
      pullCloud({ silent: true });
    } else if (hasCloud() && cloud.verified) {
      refreshGuestResponses();
    }

    setInterval(renderCountdown, 60000);
    setInterval(() => {
      const guestsView = $("#view-guests");
      if (!document.hidden && guestsView && !guestsView.hidden) refreshGuestResponses();
    }, 60000);
    document.addEventListener("visibilitychange", () => {
      const guestsView = $("#view-guests");
      if (!document.hidden && guestsView && !guestsView.hidden) refreshGuestResponses();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
