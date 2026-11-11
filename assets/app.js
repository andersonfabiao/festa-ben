/* ============================================================
   Ben faz 5! — Toy Story party planner
   Dados locais (localStorage) + sincronização opcional via GitHub
   ============================================================ */

(() => {
  "use strict";

  /* ---------- Constantes ---------- */

  const STORAGE_KEY = "ben-toy-story-checklist-v1";
  const CLOUD_KEY = "ben-toy-story-cloud-v1";
  const COLLAPSE_KEY = "ben-toy-story-collapsed-v2";
  const BACKUP_KEY = "ben-toy-story-backups-v1";

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

  const PARTY_LOCATION = "Enjoy Kids, Liv Mall Shopping — Av. Gov. Flávio Ribeiro Coutinho, 500 - Jardim Oceania, João Pessoa - PB, 58037-005";
  const LEGACY_RSVP_URL = "https://script.google.com/macros/s/AKfycbwAlOwqZ9z6TxtMI0XSdKg0Y4YLml9tZxptpYoGkTu3vLloHOBrQtehW-WL3qcCrPeX/exec";
  const CURRENT_RSVP_URL = "https://script.google.com/macros/s/AKfycbw3NwS0-EGoW-qc3NgewX0P1d-iEWGReQN9bOhCrampwYTRN8eh8Kkj6ZrxyHDFzRtd/exec";

  function stageList() {
    const names = state && state.meta && state.meta.stageNames ? state.meta.stageNames : {};
    return STAGES.map((stage) => ({
      ...stage,
      name: String(names[stage.id] || stage.name),
    }));
  }

  const stageById = (id) => stageList().find((s) => s.id === id) || stageList()[0];

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

  const THREE_DIGIT_CALLING_CODES = new Set([
    "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
    "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "248", "249",
    "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269",
    "290", "291", "297", "298", "299", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "383", "385", "386", "387", "389",
    "420", "421", "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
    "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692",
    "850", "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992", "993", "994", "995", "996", "998"
  ]);

  function internationalPhoneDigits(value) {
    const raw = String(value == null ? "" : value).trim();
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (!digits) return "";
    const explicitInternational = /^\s*(?:\+|00)/.test(raw);
    if (!explicitInternational && (digits.length === 10 || digits.length === 11)) digits = "55" + digits;
    return digits.slice(0, 15);
  }

  function nationalPhoneGroups(digits) {
    if (!digits) return [];
    if (digits.length <= 4) return [digits];
    if (digits.length === 8) return [digits.slice(0, 4), digits.slice(4)];
    if (digits.length === 9) return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
    if (digits.length === 10) return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
    const groups = [];
    let cursor = 0;
    while (digits.length - cursor > 4) {
      groups.push(digits.slice(cursor, cursor + 3));
      cursor += 3;
    }
    groups.push(digits.slice(cursor));
    return groups;
  }

  function formatPhoneLocal(value) {
    const digits = String(value == null ? "" : value).replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length <= 2) return digits;
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (rest.length <= 4) return ddd + " " + rest;
    const cut = rest.length > 8 ? 5 : 4;
    return ddd + " " + rest.slice(0, cut) + "-" + rest.slice(cut);
  }

  function formatPhoneBR(value) {
    const raw = String(value == null ? "" : value).trim();
    const explicitInternational = /^\s*(?:\+|00)/.test(raw);
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (!digits) return "";

    // Número brasileiro ainda incompleto: formata como local para não virar
    // "+55 83 99" a cada tecla digitada no campo.
    if (!explicitInternational && digits.length < 10) return formatPhoneLocal(digits);

    if (!explicitInternational && (digits.length === 10 || digits.length === 11)) {
      digits = "55" + digits;
    }
    digits = digits.slice(0, 15);

    if (digits.startsWith("55")) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      const cut = number.length > 8 ? 5 : 4;
      return "+55" + (ddd ? " " + ddd : "") +
        (number ? " " + number.slice(0, cut) + (number.length > cut ? "-" + number.slice(cut) : "") : "");
    }

    const codeLength = digits.startsWith("1") || digits.startsWith("7")
      ? 1
      : THREE_DIGIT_CALLING_CODES.has(digits.slice(0, 3)) ? 3 : 2;
    const code = digits.slice(0, codeLength);
    const national = digits.slice(codeLength);
    return "+" + code + (national ? " " + nationalPhoneGroups(national).join(" ") : "");
  }

  function normalizePhone(value) {
    const cleaned = String(value == null ? "" : value)
      .replace(/[^\d+()\-\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "";
    if (!cleaned.replace(/\D/g, "")) return "";
    return formatPhoneBR(cleaned).slice(0, 40);
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isValidPhone(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw.replace(/\D/g, "")) return true;
    const explicitInternational = /^\s*(?:\+|00)/.test(raw);
    const digits = internationalPhoneDigits(raw);
    if (!digits) return true;
    if (explicitInternational) return digits.length >= 8 && digits.length <= 15;
    const local = raw.replace(/\D/g, "");
    return local.length === 10 || local.length === 11 ||
      ((local.length === 12 || local.length === 13) && local.startsWith("55"));
  }

  function waLink(value) {
    const digits = internationalPhoneDigits(value);
    if (!digits) return "";
    return "https://wa.me/" + digits;
  }

  function instagramHandle(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0]
      .replace(/[^A-Za-z0-9._]/g, "")
      .slice(0, 30);
  }

  function whatsappIconSvg() {
    return '<svg aria-hidden="true" viewBox="0 0 32 32" focusable="false"><path fill="currentColor" d="M16 3a12.7 12.7 0 0 0-11 19l-1.5 5.5L9.2 26A12.8 12.8 0 1 0 16 3Zm6.8 18.1c-.3.9-1.8 1.7-2.5 1.8-.7.1-1.6.2-5.2-1.3-4.4-1.9-7.2-6.4-7.4-6.7-.2-.3-1.8-2.4-1.8-4.6s1.1-3.2 1.5-3.7c.4-.4.9-.5 1.2-.5h.9c.3 0 .6 0 .8.7l1.2 2.9c.1.2.1.5 0 .7l-.5.8-.7.8c-.2.2-.4.5-.2.9.2.4 1.1 1.8 2.4 2.9 1.7 1.5 3.1 2 3.5 2.2.4.2.7.2.9-.1l1.3-1.6c.3-.4.6-.3 1-.2l2.7 1.3c.4.2.7.3.8.5.2.2.2 1 .1 1.9Z"/></svg>';
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
      inviteSentAt: "",
      reminderSentAt: "",
    });
    return [
      g("Tia Ana", "adult", "confirmed"),
      g("Lucas", "child", "confirmed"),
      g("Sofia", "child", "pending"),
      g("Vô Carlos", "adult", "confirmed"),
    ];
  }

  const INVITE_COPY_DEFAULTS = {
    openingEyebrow: "Uma mensagem especial chegou para você",
    openingTitle: "Prepare-se para uma",
    openingHighlight: "grande aventura!",
    startLabel: "Abrir convite",
    openingSoundHint: "Ative o som para entrar na brincadeira",
    buzzSoundHint: "Toque para ativar o som e entrar na brincadeira!",
    missionText: "Você foi escolhido para esta missão!",
    message: "Venha brincar, sorrir e viver uma aventura inesquecível com a gente.",
    calendarHint: "adicionar à agenda",
    timeLabel: "Hora da missão",
    mapHint: "abrir mapa ↗",
    giftTitle: "Diquinha de presente",
    giftLoveLabel: "Ele vai amar",
    giftLoveValue: "Tudo do universo Toy Story ou bloquinhos de montar estilo Lego",
    deadlinePrefix: "Confirme sua presença até",
    deadlineSuffix: "💫",
    confirmLabel: "Confirmar presença",
    confirmNote: "Clique no botão para encontrar seu nome e responder.",
    voiceCueTitle: "Um recado do Ben",
    voiceCueHint: "Escute só um pouquinho…",
    voiceCueTapHint: "Toque para ouvir o Ben",
    rsvpEyebrow: "Confirmação de presença",
    rsvpSubtitle: "Que bom ter você por aqui. Encontre seu nome para responder.",
    rsvpPickerSubtitle: "Encontre seu nome para confirmar a presença.",
    rsvpGreeting: "Confirme sua presença.",
    rsvpLinksMessage: "Abra o link pessoal que você recebeu.",
    rsvpTitle: "Vamos confirmar?",
    rsvpIntro: "Sua resposta ajuda a gente a preparar tudo com carinho.",
    rsvpDeadlinePrefix: "Prazo para confirmar:",
  };

  const INVITE_FIELD_IDS = {
    openingEyebrow: "invOpeningEyebrow",
    openingTitle: "invOpeningTitle",
    openingHighlight: "invOpeningHighlight",
    startLabel: "invStartLabel",
    openingSoundHint: "invOpeningSoundHint",
    buzzSoundHint: "invBuzzSoundHint",
    missionText: "invMissionText",
    message: "invMessage",
    calendarHint: "invCalendarHint",
    timeLabel: "invTimeLabel",
    mapHint: "invMapHint",
    giftTitle: "invGiftTitle",
    giftLoveLabel: "invGiftLoveLabel",
    giftLoveValue: "invGiftLoveValue",
    deadlinePrefix: "invDeadlinePrefix",
    deadlineSuffix: "invDeadlineSuffix",
    confirmLabel: "invConfirmLabel",
    confirmNote: "invConfirmNote",
    voiceCueTitle: "invVoiceCueTitle",
    voiceCueHint: "invVoiceCueHint",
    voiceCueTapHint: "invVoiceCueTapHint",
    rsvpEyebrow: "invRsvpEyebrow",
    rsvpSubtitle: "invRsvpSubtitle",
    rsvpPickerSubtitle: "invRsvpPickerSubtitle",
    rsvpGreeting: "invRsvpGreeting",
    rsvpLinksMessage: "invRsvpLinksMessage",
    rsvpTitle: "invRsvpTitle",
    rsvpIntro: "invRsvpIntro",
    rsvpDeadlinePrefix: "invRsvpDeadlinePrefix",
  };

  function defaultInviteCopy() {
    return Object.assign({}, INVITE_COPY_DEFAULTS);
  }

  function defaultGiftSuggestions() {
    return ["Roupa: 6 anos", "Calçado: 27"];
  }

  function defaultMeta() {
    return {
      name: "Ben",
      age: 5,
      date: "2027-01-09",
      rsvpDeadline: "2026-12-29",
      time: "18:00",
      location: PARTY_LOCATION,
      budget: 7000,
      theme: "Toy Story",
      rsvpUrl: "",
      mapsUrl: "",
      fatherPhone: "",
      motherPhone: "",
      inviteMode: "search",
      giftSuggestions: defaultGiftSuggestions(),
      invite: defaultInviteCopy(),
      maxAdults: 50,
      maxChildren: 25,
      stageNames: {},
    };
  }

  function defaultState() {
    const meta = defaultMeta();
    return {
      version: 1,
      meta,
      items: seedItems(meta.date),
      guests: seedGuests(),
      activity: [],
      deletedGuestIds: [],
      updatedAt: nowISO(),
    };
  }

  function emptyState() {
    return {
      version: 1,
      meta: defaultMeta(),
      items: [],
      guests: [],
      activity: [],
      deletedGuestIds: [],
      updatedAt: nowISO(),
    };
  }

  function deletedGuestSet() {
    if (!Array.isArray(state.deletedGuestIds)) state.deletedGuestIds = [];
    return new Set(state.deletedGuestIds);
  }

  function markGuestDeleted(id) {
    const key = String(id || "").trim();
    if (!key) return;
    if (!Array.isArray(state.deletedGuestIds)) state.deletedGuestIds = [];
    if (!state.deletedGuestIds.includes(key)) state.deletedGuestIds.push(key);
    if (state.deletedGuestIds.length > 1000) {
      state.deletedGuestIds = state.deletedGuestIds.slice(-1000);
    }
  }

  function reviveGuest(id) {
    const key = String(id || "").trim();
    if (!key || !Array.isArray(state.deletedGuestIds)) return;
    state.deletedGuestIds = state.deletedGuestIds.filter((item) => item !== key);
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
      relation: String(g.relation || g.parentesco || g.relationship || "").trim().slice(0, 32),
      notes: String(g.notes || g.observacoes || "").slice(0, 500),
      guardians: Array.isArray(g.guardians) ? g.guardians.map(String) : [],
      rsvpAt,
      rsvpMessage: String(g.rsvpMessage || "").slice(0, 280),
      inviteSentAt:
        typeof g.inviteSentAt === "string" && !isNaN(Date.parse(g.inviteSentAt))
          ? g.inviteSentAt
          : "",
      reminderSentAt:
        typeof g.reminderSentAt === "string" && !isNaN(Date.parse(g.reminderSentAt))
          ? g.reminderSentAt
          : "",
      rsvpSource:
        rsvpAt && (g.rsvpSource === "owner" || g.rsvpSource === "guest")
          ? g.rsvpSource
          : rsvpAt
            ? "guest"
            : "",
      unlisted: g.unlisted === true,
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
    meta.rsvpDeadline = /^\d{4}-\d{2}-\d{2}$/.test(meta.rsvpDeadline) ? meta.rsvpDeadline : base.rsvpDeadline;
    meta.time = /^\d{2}:\d{2}$/.test(meta.time) ? meta.time : "18:00";
    meta.location = String(meta.location || "");
    if (["enjoy livmall", "buffet alegria — salão 2"].includes(meta.location.trim().toLowerCase())) {
      meta.location = PARTY_LOCATION;
    }
    meta.budget = parseMoney(meta.budget);
    meta.theme = String(meta.theme || "Toy Story");
    meta.rsvpUrl = safeUrl(meta.rsvpUrl);
    if (meta.rsvpUrl === LEGACY_RSVP_URL) meta.rsvpUrl = CURRENT_RSVP_URL;
    meta.mapsUrl = safeUrl(meta.mapsUrl);
    meta.fatherPhone = normalizePhone(meta.fatherPhone);
    meta.motherPhone = normalizePhone(meta.motherPhone);
    meta.inviteMode = meta.inviteMode === "links" ? "links" : "search";
    const rawInvite = meta.invite && typeof meta.invite === "object" ? meta.invite : {};
    meta.invite = {};
    Object.keys(INVITE_COPY_DEFAULTS).forEach((key) => {
      const value = String(rawInvite[key] == null ? "" : rawInvite[key]).trim().slice(0, 400);
      meta.invite[key] = value || INVITE_COPY_DEFAULTS[key];
    });
    const rawGifts = Array.isArray(meta.giftSuggestions) ? meta.giftSuggestions : defaultGiftSuggestions();
    meta.giftSuggestions = rawGifts
      .map((item) => {
        if (item && typeof item === "object") {
          return [item.label, item.value].filter(Boolean).join(": ");
        }
        return String(item == null ? "" : item);
      })
      .map((item) => item.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 6);
    if (!meta.giftSuggestions.length) meta.giftSuggestions = defaultGiftSuggestions();
    meta.maxAdults = Math.min(999, Math.max(1, parseInt(meta.maxAdults, 10) || 50));
    meta.maxChildren = Math.min(999, Math.max(1, parseInt(meta.maxChildren, 10) || 25));
    const rawStageNames = meta.stageNames && typeof meta.stageNames === "object" ? meta.stageNames : {};
    meta.stageNames = {};
    STAGES.forEach((stage) => {
      const custom = String(rawStageNames[stage.id] || "").trim().slice(0, 48);
      if (custom && custom !== stage.name) meta.stageNames[stage.id] = custom;
    });

    const items = raw.items
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        id: String(i.id || uid()),
        title: String(i.title || "Item sem título").slice(0, 200),
        stage: STAGES.some((s) => s.id === i.stage) ? i.stage : "planejamento",
        status: STATUS[i.status] ? i.status : "todo",
        quantity: Math.max(0.01, Number(i.quantity) || 1),
        unit: ["un.", "pacote", "caixa", "cento", "pessoa", "kg", "litro"].includes(i.unit) ? i.unit : "un.",
        unitPrice: parseMoney(i.unitPrice) || (parseMoney(i.cost) / Math.max(0.01, Number(i.quantity) || 1)),
        cost: parseMoney(i.cost),
        paid: parseMoney(i.paid),
        payments: (Array.isArray(i.payments) ? i.payments : (parseMoney(i.paid) ? [{ id: "legacy-" + String(i.id || "item"), amount: parseMoney(i.paid), date: "", method: "", note: "Pagamento anterior", paid: true }] : []))
          .filter((payment) => payment && typeof payment === "object" && parseMoney(payment.amount) > 0)
          .map((payment) => ({
            id: String(payment.id || uid()),
            amount: parseMoney(payment.amount),
            date: /^\d{4}-\d{2}-\d{2}$/.test(payment.date) ? payment.date : "",
            method: String(payment.method === "Cartão" ? "Cartão de crédito" : (payment.method || "")).slice(0, 40),
            note: String(payment.note || "").slice(0, 120),
            receiptUrl: safeUrl(payment.receiptUrl || ""),
            installmentNumber: Math.max(0, parseInt(payment.installmentNumber, 10) || 0),
            installmentCount: Math.max(0, parseInt(payment.installmentCount, 10) || 0),
            paid: typeof payment.paid === "boolean"
              ? payment.paid
              : (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date) || payment.date <= todayISO()),
          })),
        supplier: String(i.supplier || "").slice(0, 120),
        supplierPhone: normalizePhone(i.supplierPhone || ""),
        supplierInstagram: instagramHandle(i.supplierInstagram || ""),
        shipping: parseMoney(i.shipping),
        surcharge: parseMoney(i.surcharge),
        discount: parseMoney(i.discount),
        orderNumber: String(i.orderNumber || "").slice(0, 80),
        deliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(i.deliveryDate) ? i.deliveryDate : "",
        deliveryStatus: ["ordered", "production", "shipped", "delivered"].includes(i.deliveryStatus) ? i.deliveryStatus : "",
        due: /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : "",
        link: String(i.link || ""),
        notes: String(i.notes || "").slice(0, 1000),
        subtasks: (Array.isArray(i.subtasks) ? i.subtasks : [])
          .filter((subtask) => subtask && typeof subtask === "object" && String(subtask.title || "").trim())
          .map((subtask) => {
            const quantity = Math.max(0.01, Number(subtask.quantity) || 1);
            const unitPrice = parseMoney(subtask.unitPrice) || (parseMoney(subtask.cost) / quantity);
            return {
              id: String(subtask.id || uid()),
              title: String(subtask.title).trim().slice(0, 160),
              done: subtask.done === true,
              quantity,
              unit: ["un.", "pacote", "caixa", "cento", "pessoa", "kg", "litro"].includes(subtask.unit) ? subtask.unit : "un.",
              unitPrice,
              cost: Math.round(quantity * unitPrice * 100) / 100,
            };
          }),
        createdAt: i.createdAt || nowISO(),
      }))
      .map((item) => {
        const composedCost = item.subtasks.reduce((sum, subtask) => sum + num(subtask.cost), 0);
        if (composedCost > 0) {
          item.cost = Math.max(0, Math.round((composedCost + item.shipping + item.surcharge - item.discount) * 100) / 100);
          item.unitPrice = 0;
        } else if (item.shipping || item.surcharge || item.discount) {
          const baseCost = Math.max(0, Number(item.quantity) * num(item.unitPrice));
          item.cost = Math.max(0, Math.round((baseCost + item.shipping + item.surcharge - item.discount) * 100) / 100);
        }
        if (item.payments.length) {
          item.paid = Math.round(item.payments.reduce((sum, payment) => sum + (payment.paid ? payment.amount : 0), 0) * 100) / 100;
        }
        return item;
      });

    const deletedGuestIds = Array.isArray(raw.deletedGuestIds)
      ? Array.from(
          new Set(
            raw.deletedGuestIds
              .map((id) => String(id || "").trim())
              .filter((id) => /^[A-Za-z0-9_-]{1,40}$/.test(id))
          )
        ).slice(-1000)
      : [];
    const deletedGuestSet = new Set(deletedGuestIds);
    const guests = normalizeGuestList(raw.guests).filter((guest) => !deletedGuestSet.has(guest.id));

    const activity = (Array.isArray(raw.activity) ? raw.activity : []).filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry.id || uid()),
        type: String(entry.type || "update").slice(0, 24),
        text: String(entry.text || "").slice(0, 180),
        at: typeof entry.at === "string" && !isNaN(Date.parse(entry.at)) ? entry.at : nowISO(),
      })).filter((entry) => entry.text).slice(-40);

    return { version: 1, meta, items, guests, activity, deletedGuestIds, updatedAt: raw.updatedAt || nowISO() };
  }

  /* ---------- Estado ---------- */

  const hadLocal = !!localStorage.getItem(STORAGE_KEY);
  let state = normalizeState(loadLocal()) || emptyState();
  let cloud = loadCloudCfg();
  let collapsed = new Set(loadCollapsed());
  let dirty = false;
  let cloudPhase = "idle";
  let cloudError = "";
  let autoTimer = null;
  let savingCloud = false;
  let cloudQueued = false;
  let toastTimer = null;
  let activeView = "checklist";

  const GUEST_VIEW_KEY = "ben-guest-view-v1";
  const GUEST_GROUPS_KEY = "ben-guest-groups-v2";
  const HIDE_VALUES_KEY = "ben-hide-values-v1";
  const GUEST_FILTERS = ["all", "parents", "adult", "child", "sent", "unsent", "no_phone", "needs_reminder", "confirmed", "pending", "declined"];
  let guestFilter = "all";
  let guestQuery = "";
  let selectedGuestIds = new Set();
  let editingPayments = [];
  let editingSubtasks = [];
  let checklistAlertFilter = "";
  let bulkInviteQueue = [];
  let bulkInviteIndex = 0;
  let valuesHidden = false;
  let collapsedGuestGroups = new Set(loadGuestGroupsCollapsed());

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

  function loadGuestGroupsCollapsed() {
    try {
      const saved = localStorage.getItem(GUEST_GROUPS_KEY);
      if (!saved) return ["parents", "adult", "child"];
      const arr = JSON.parse(saved);
      return Array.isArray(arr) ? arr.filter((id) => id === "parents" || id === "adult" || id === "child") : ["parents", "adult", "child"];
    } catch (e) {
      return ["parents", "adult", "child"];
    }
  }

  function saveGuestGroupsCollapsed() {
    try {
      localStorage.setItem(GUEST_GROUPS_KEY, JSON.stringify(Array.from(collapsedGuestGroups)));
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
    btn.textContent = valuesHidden ? "👁️ Mostrar valores" : "🙈 Ocultar valores";
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

  function loadAutomaticBackups() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.state).slice(0, 5) : [];
    } catch (e) {
      return [];
    }
  }

  function createAutomaticBackup(reason) {
    if (!state || (!state.items.length && !state.guests.length)) return null;
    const entry = {
      id: uid(),
      at: nowISO(),
      reason: String(reason || "alteração importante").slice(0, 80),
      state: JSON.parse(JSON.stringify(state)),
    };
    try {
      const backups = [entry, ...loadAutomaticBackups()].slice(0, 5);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      renderBackupState();
      return entry;
    } catch (e) {
      console.warn("Não foi possível criar a cópia automática.", e);
      return null;
    }
  }

  function renderBackupState(message) {
    const el = $("#backupState");
    if (!el) return;
    const latest = loadAutomaticBackups()[0];
    const restore = $("#restoreAutoBackupBtn");
    if (restore) {
      restore.disabled = false;
      restore.title = latest ? "Ver e restaurar cópias deste navegador" : "Abrir o histórico e criar a primeira cópia";
    }
    if (message) {
      el.textContent = message;
      return;
    }
    if (!latest) {
      el.textContent = "Nenhuma cópia automática ainda. Ela será criada antes de carregar, importar ou apagar dados.";
      return;
    }
    const date = new Date(latest.at);
    const when = isNaN(date.getTime())
      ? "data desconhecida"
      : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    el.textContent = "Última cópia automática: " + when + " · " + latest.reason + ". Até 5 versões ficam neste navegador.";
  }

  function verifyRecovery() {
    try {
      const copy = normalizeState(JSON.parse(JSON.stringify(state)));
      if (!copy) throw new Error("estrutura inválida");
      if (copy.items.length !== state.items.length || copy.guests.length !== state.guests.length) {
        throw new Error("a contagem dos dados não corresponde");
      }
      const subitems = copy.items.reduce((sum, item) => sum + (item.subtasks || []).length, 0);
      const message =
        "Recuperação verificada: " + copy.items.length + " itens, " + subitems +
        " subitens e " + copy.guests.length + " convidados íntegros.";
      renderBackupState(message);
      toast("Backup validado com sucesso.", "ok");
    } catch (e) {
      renderBackupState("Falha na verificação: " + e.message + ". Baixe um backup e tente novamente.");
      toast("Não foi possível validar a recuperação.", "err");
    }
  }

  function backupEntrySummary(entry) {
    const copy = normalizeState(entry && entry.state);
    if (!copy) return null;
    const subitems = copy.items.reduce((sum, item) => sum + (item.subtasks || []).length, 0);
    return { items: copy.items.length, guests: copy.guests.length, subitems };
  }

  function renderBackupHistory() {
    const list = $("#backupHistoryList");
    const clearButton = $("#clearBackupHistoryBtn");
    if (!list) return;
    const backups = loadAutomaticBackups();
    if (clearButton) clearButton.disabled = !backups.length;
    list.innerHTML = backups.length
      ? backups.map((entry, index) => {
          const date = new Date(entry.at);
          const when = isNaN(date.getTime()) ? "Data desconhecida" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
          const summary = backupEntrySummary(entry);
          return '<article class="backup-history-item">' +
            '<span class="backup-history-index" aria-hidden="true">' + (index + 1) + '</span>' +
            '<div><strong>' + esc(entry.reason || "Cópia automática") + '</strong><small>' + esc(when) + '</small>' +
            (summary ? '<p>' + summary.items + ' itens · ' + summary.subitems + ' subitens · ' + summary.guests + ' convidados</p>' : '<p>Cópia inválida</p>') + '</div>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-restore-backup="' + esc(entry.id) + '"' + (summary ? "" : " disabled") + '>Restaurar</button>' +
          '</article>';
        }).join("")
      : '<div class="activity-empty">Nenhuma cópia automática foi criada neste dispositivo.</div>';
  }

  function openBackupHistory() {
    renderBackupHistory();
    openModal($("#backupHistoryModal"));
  }

  function createManualAutomaticBackup() {
    const entry = createAutomaticBackup("cópia criada manualmente");
    if (!entry) {
      toast("Adicione itens ou convidados antes de criar uma cópia.", "warn");
      return;
    }
    renderBackupHistory();
    renderBackupState();
    toast("Cópia criada neste dispositivo.", "ok");
  }

  function restoreAutomaticBackup(id) {
    const latest = loadAutomaticBackups().find((entry) => entry.id === id);
    if (!latest) {
      toast("Ainda não existe cópia automática neste navegador.", "warn");
      renderBackupState();
      return;
    }
    const next = normalizeState(latest.state);
    if (!next) {
      toast("A cópia automática está inválida.", "err");
      return;
    }
    const date = new Date(latest.at);
    const when = isNaN(date.getTime()) ? "data desconhecida" : date.toLocaleString("pt-BR");
    if (!window.confirm("Restaurar a cópia de " + when + "?\n\nO estado atual será preservado em uma nova cópia antes da restauração.")) return;
    createAutomaticBackup("antes de restaurar uma cópia automática");
    state = next;
    addActivity("update", "Cópia automática restaurada neste dispositivo");
    touch({ cloud: false });
    closeAllModals();
    renderAll();
    toast("Cópia restaurada localmente. Revise e salve na nuvem quando estiver pronto.", "ok");
  }

  function clearAutomaticBackups() {
    const backups = loadAutomaticBackups();
    if (!backups.length) return;
    if (!window.confirm("Apagar todas as cópias automáticas deste dispositivo?\n\nO checklist atual e a versão da nuvem não serão alterados.")) return;
    localStorage.removeItem(BACKUP_KEY);
    renderBackupHistory();
    renderBackupState("Cópias automáticas removidas. O checklist atual foi preservado.");
    toast("Histórico de cópias limpo.", "ok");
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

  function addActivity(type, text) {
    if (!Array.isArray(state.activity)) state.activity = [];
    state.activity.push({ id: uid(), type: type || "update", text: String(text || "").slice(0, 180), at: nowISO() });
    state.activity = state.activity.slice(-40);
  }

  function renderActivity() {
    const el = $("#activityLog");
    if (!el) return;
    const icons = { invite: "✉️", reminder: "🔔", rsvp: "✅", guest: "👤", cloud: "☁️", update: "✏️" };
    const allEntries = Array.isArray(state.activity) ? state.activity : [];
    const entries = allEntries.slice(-30).reverse();
    const today = new Date().toLocaleDateString("sv-SE");
    const todayCount = allEntries.filter((entry) => new Date(entry.at).toLocaleDateString("sv-SE") === today).length;
    const clearToday = $("#clearTodayActivityBtn");
    const clearAll = $("#clearAllActivityBtn");
    if (clearToday) clearToday.disabled = !todayCount;
    if (clearAll) clearAll.disabled = !allEntries.length;
    el.innerHTML = entries.length
      ? entries.map((entry) => '<div class="activity-item"><span aria-hidden="true">' + (icons[entry.type] || icons.update) +
        '</span><div><strong>' + esc(entry.text) + '</strong><small>' + esc(timeAgo(entry.at)) + "</small></div></div>").join("")
      : '<div class="activity-empty">As próximas alterações importantes aparecerão aqui.</div>';
  }

  function renderDayMode() {
    const statsEl = $("#dayStats");
    if (!statsEl) return;
    const guests = countableGuests(state.guests);
    const confirmed = guests.filter((guest) => guest.status === "confirmed").length;
    const pendingGuests = guests.filter((guest) => guest.status === "pending").length;
    const dayItems = state.items.filter((item) => item.stage === "dia");
    const pendingDayItems = dayItems.filter((item) => item.status !== "done");
    const committed = state.items.filter((item) => item.status === "contracted" || item.status === "done");
    const outstanding = committed.reduce((sum, item) => sum + Math.max(num(item.cost) - num(item.paid), 0), 0);
    const s = summary();

    statsEl.innerHTML = [
      { label: "Confirmados", value: confirmed, note: "de " + guests.length + " convidados", cls: "good" },
      { label: "Tarefas do dia", value: pendingDayItems.length, note: "pendentes de " + dayItems.length, cls: pendingDayItems.length ? "" : "good" },
      { label: "A pagar", value: money(outstanding), note: "em itens contratados", cls: outstanding ? "" : "good" },
      { label: "Respostas", value: pendingGuests, note: "ainda pendentes", cls: pendingGuests ? "" : "good" },
    ].map((card) => '<div class="stat-card ' + card.cls + '"><span class="label">' + card.label +
      '</span><span class="value">' + card.value + '</span><span class="note">' + card.note + '</span></div>').join("");

    const today = todayISO();
    const overdue = state.items.filter((item) => item.status !== "done" && item.due && item.due < today).length;
    const alerts = [];
    if (overdue) alerts.push({ icon: "⚠️", title: overdue + (overdue === 1 ? " item atrasado" : " itens atrasados"), detail: "Revise os prazos do checklist.", view: "checklist", tone: "danger" });
    if (pendingGuests) alerts.push({ icon: "⏳", title: pendingGuests + (pendingGuests === 1 ? " confirmação pendente" : " confirmações pendentes"), detail: "Confira quem ainda não respondeu.", view: "guests", tone: "warn" });
    if (s.saldoPrevisto < 0) alerts.push({ icon: "💸", title: "Previsão acima do orçamento", detail: "Excesso estimado de " + money(Math.abs(s.saldoPrevisto)) + ".", view: "budget", tone: "danger" });
    if (outstanding) alerts.push({ icon: "💳", title: money(outstanding) + " ainda a pagar", detail: "Veja fornecedores e pagamentos pendentes.", view: "budget", tone: "warn" });
    $("#dayAlerts").innerHTML = alerts.length
      ? alerts.map((alert) => '<button class="day-alert is-' + alert.tone + '" type="button" data-day-view="' + alert.view + '"><span aria-hidden="true">' + alert.icon +
        '</span><span><strong>' + esc(alert.title) + '</strong><small>' + esc(alert.detail) + '</small></span><b aria-hidden="true">→</b></button>').join("")
      : '<div class="day-empty"><span aria-hidden="true">✅</span><strong>Nenhuma urgência agora</strong><small>O planejamento está em dia.</small></div>';

    $("#dayTasks").innerHTML = dayItems.length
      ? dayItems.slice().sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.title.localeCompare(b.title, "pt-BR")).map((item) =>
        '<div class="day-task' + (item.status === "done" ? " is-done" : "") + '"><label><input type="checkbox" data-day-item-status="' + esc(item.id) + '"' +
        (item.status === "done" ? " checked" : "") + '><span><strong>' + esc(item.title) + '</strong><small>' +
        esc([item.due ? fmtDate(item.due) : "", item.notes || ""].filter(Boolean).join(" · ") || "Tarefa do dia") +
        '</small></span></label><button class="icon-btn" type="button" data-day-item-edit="' + esc(item.id) + '" aria-label="Editar ' + esc(item.title) + '">✏️</button></div>'
      ).join("")
      : '<div class="day-empty"><span aria-hidden="true">⭐</span><strong>Nenhuma tarefa do dia cadastrada</strong><small>Use “Tarefa do dia” para montar esta lista.</small></div>';

    const contacts = [];
    if (state.meta.fatherPhone) contacts.push({ icon: "👨", label: "Papai", href: waLink(state.meta.fatherPhone), detail: formatPhoneBR(state.meta.fatherPhone) });
    if (state.meta.motherPhone) contacts.push({ icon: "👩", label: "Mamãe", href: waLink(state.meta.motherPhone), detail: formatPhoneBR(state.meta.motherPhone) });
    const map = mapsLink();
    if (map) contacts.push({ icon: "📍", label: "Abrir localização", href: map, detail: state.meta.location || "Local da festa" });
    $("#dayContacts").innerHTML = contacts.length
      ? contacts.map((contact) => '<a class="day-contact" href="' + esc(contact.href) + '" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">' + contact.icon +
        '</span><span><strong>' + esc(contact.label) + '</strong><small>' + esc(contact.detail) + '</small></span><b aria-hidden="true">↗</b></a>').join("")
      : '<div class="day-empty"><span aria-hidden="true">📇</span><strong>Contatos ainda não configurados</strong><small>Preencha os telefones e o mapa em Editar festa.</small></div>';

    const suppliers = committed.filter((item) => item.supplier && num(item.cost) > num(item.paid));
    $("#daySuppliers").innerHTML = suppliers.length
      ? suppliers.sort((a, b) => (num(b.cost) - num(b.paid)) - (num(a.cost) - num(a.paid))).map((item) =>
        '<button class="day-supplier" type="button" data-day-item-edit="' + esc(item.id) + '"><span><strong>' + esc(item.supplier) + '</strong><small>' + esc(item.title) +
        '</small></span><b>' + money(Math.max(num(item.cost) - num(item.paid), 0)) + '</b></button>').join("")
      : '<div class="day-empty"><span aria-hidden="true">🤝</span><strong>Nenhum saldo de fornecedor</strong><small>Os contratados estão pagos ou ainda não foram informados.</small></div>';
  }

  function clearActivity(scope) {
    const activity = Array.isArray(state.activity) ? state.activity : [];
    const today = new Date().toLocaleDateString("sv-SE");
    const removeToday = scope === "today";
    const count = removeToday
      ? activity.filter((entry) => new Date(entry.at).toLocaleDateString("sv-SE") === today).length
      : activity.length;
    if (!count) return;
    const message = removeToday
      ? "Apagar as " + count + (count === 1 ? " atividade registrada hoje?" : " atividades registradas hoje?") + "\n\nOs registros anteriores serão mantidos."
      : "Apagar todo o histórico de atividades?\n\nEsta ação removerá " + count + (count === 1 ? " registro." : " registros.");
    if (!window.confirm(message)) return;
    state.activity = removeToday
      ? activity.filter((entry) => new Date(entry.at).toLocaleDateString("sv-SE") !== today)
      : [];
    touch();
    renderActivity();
    renderCloudBar();
    toast(removeToday ? "Atividades de hoje apagadas." : "Histórico de atividades apagado.", "neutral");
  }

  function renderHero() {
    const meta = state.meta;
    const s = summary();

    const heroName = $("#heroName");
    heroName.setAttribute("aria-label", meta.name);
    heroName.innerHTML = Array.from(meta.name).map((letter, index) =>
      '<span class="hero-name-block block-' + (index % 3) + '" aria-hidden="true">' +
        esc(letter) +
      "</span>"
    ).join("");
    $("#heroAge").textContent = meta.age;
    $("#footerName").textContent = meta.name;
    document.title = meta.name + " faz " + meta.age + "! · Checklist Toy Story";

    const chips = [];
    chips.push('<span class="chip">📅 ' + esc(longDate(meta.date)) + "</span>");
    if (meta.time) chips.push('<span class="chip">⏰ ' + esc(meta.time.replace(":", "h")) + "</span>");

    const map = mapsLink();
    const fullPlace = meta.location || (map ? "Ver no mapa" : "Local a definir");
    const place = String(fullPlace).split(/\s+—\s+/)[0].replace(/\s*,\s*/, " — ");
    chips.push(
      map
        ? '<a class="chip chip-link" href="' + esc(map) +
          '" target="_blank" rel="noopener noreferrer" title="' + esc(fullPlace) + ' · abrir no Google Maps">📍 ' +
          esc(place) + " ↗</a>"
        : '<span class="chip">📍 ' + esc(place) + "</span>"
    );
    $("#heroMeta").innerHTML = chips.join("");

    renderCountdown();

    $("#progressLabel").textContent =
      s.done + " de " + s.total + " itens concluídos";
    $("#progressPct").textContent = s.pct + "%";
    $("#progressFill").style.width = s.pct + "%";
    const checklistStats = [
      { label: "Concluídos", value: s.done, count: s.done, cls: "good" },
      { label: "Em andamento", value: state.items.filter((item) => item.status === "doing").length, count: state.items.filter((item) => item.status === "doing").length, cls: "" },
      { label: "Contratados", value: state.items.filter((item) => item.status === "contracted").length, count: state.items.filter((item) => item.status === "contracted").length, cls: "" },
      { label: "A fazer", value: state.items.filter((item) => item.status === "todo").length, count: state.items.filter((item) => item.status === "todo").length, cls: "" },
    ];
    const statusKeys = ["done", "doing", "contracted", "todo"];
    const currentStatus = $("#statusFilter") ? $("#statusFilter").value : "";
    $("#checklistStats").innerHTML = checklistStats.map((st, index) =>
      '<button class="checklist-status-chip ' + st.cls + (currentStatus === statusKeys[index] ? " is-active" : "") +
      '" type="button" data-status-chip="' + statusKeys[index] + '"><span>' + esc(st.label) +
      '</span><b>' + st.value + "</b></button>"
    ).join("");
    renderActivity();
  }

  function partyTarget() {
    const meta = state.meta;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) return null;
    const [y, m, d] = meta.date.split("-").map(Number);
    const [hh, mm] = (meta.time || "18:00").split(":").map(Number);
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
    if (checklistAlertFilter === "overdue" && !(item.due && item.due < todayISO() && item.status !== "done")) return false;
    if (checklistAlertFilter === "today" && !(item.due === todayISO() && item.status !== "done")) return false;
    if (checklistAlertFilter === "soon") {
      const limit = new Date();
      limit.setDate(limit.getDate() + 7);
      const limitISO = limit.toLocaleDateString("sv-SE");
      if (!(item.due && item.due > todayISO() && item.due <= limitISO && item.status !== "done")) return false;
    }
    if (checklistAlertFilter === "balance" && !(num(item.cost) > num(item.paid))) return false;
    if (f.q) {
      const hay = norm(
        [item.title, item.supplier, item.supplierPhone, item.supplierInstagram, item.notes, stageById(item.stage).name].join(" ")
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
    const subtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
    const completedSubtasks = subtasks.filter((subtask) => subtask.done).length;
    const subtaskHtml = subtasks.length
      ? '<div class="item-subtasks"><span class="subtask-progress">' + completedSubtasks + "/" + subtasks.length + ' subitens concluídos</span>' +
        subtasks.map((subtask) => '<label class="item-subtask' + (subtask.done ? " is-done" : "") + '">' +
          '<input type="checkbox" data-subtask-check="' + esc(item.id) + '" data-subtask-id="' + esc(subtask.id) + '"' + (subtask.done ? " checked" : "") +
          ' aria-label="Marcar subitem ' + esc(subtask.title) + '"><span>' + esc(subtask.title) +
          (num(subtask.cost) ? '<small>' + esc(String(subtask.quantity || 1).replace(".", ",")) + " " + esc(subtask.unit || "un.") + " × " + money(subtask.unitPrice) + " = " + money(subtask.cost) + "</small>" : "") +
          "</span></label>").join("") + "</div>"
      : "";

    const metaBits = [];
    if (item.supplier) metaBits.push("<span>🏷️ " + esc(item.supplier) + "</span>");
    if (item.supplierPhone) {
      metaBits.push('<a href="' + esc(waLink(item.supplierPhone)) + '" target="_blank" rel="noopener noreferrer" title="Conversar com o fornecedor no WhatsApp">💬 ' + esc(formatPhoneBR(item.supplierPhone)) + "</a>");
    }
    if (item.supplierInstagram) {
      metaBits.push('<a href="https://www.instagram.com/' + esc(item.supplierInstagram) + '/" target="_blank" rel="noopener noreferrer" title="Abrir Instagram do fornecedor">📷 @' + esc(item.supplierInstagram) + "</a>");
    }
    if (item.orderNumber) metaBits.push("<span>🧾 " + esc(item.orderNumber) + "</span>");
    const deliveryLabels = { ordered: "Pedido realizado", production: "Em produção", shipped: "Enviado", delivered: "Entregue" };
    if (item.deliveryStatus || item.deliveryDate) {
      metaBits.push("<span>📦 " + esc(deliveryLabels[item.deliveryStatus] || "Entrega") + (item.deliveryDate ? " · " + fmtDate(item.deliveryDate) : "") + "</span>");
    }
    const payments = Array.isArray(item.payments) ? item.payments : [];
    const installments = payments.filter((payment) => payment.method === "Cartão de crédito" && payment.installmentCount > 1);
    const ordinaryPayments = payments.filter((payment) => !installments.includes(payment));
    if (installments.length) {
      const paidInstallments = installments.filter((payment) => payment.paid).length;
      const nextInstallment = installments.filter((payment) => !payment.paid && payment.date).sort((a, b) => a.date.localeCompare(b.date))[0];
      metaBits.push("<span>💳 " + paidInstallments + "/" + installments.length + " parcelas do cartão pagas" + (nextInstallment ? " · próxima " + fmtDate(nextInstallment.date) : "") + "</span>");
    }
    if (ordinaryPayments.length) {
      const paidOrdinary = ordinaryPayments.filter((payment) => payment.paid).length;
      metaBits.push("<span>💰 " + paidOrdinary + "/" + ordinaryPayments.length + " pagamentos realizados</span>");
    }
    const receipts = payments.filter((payment) => safeUrl(payment.receiptUrl));
    receipts.forEach((payment, index) => metaBits.push('<a href="' + esc(safeUrl(payment.receiptUrl)) + '" target="_blank" rel="noopener noreferrer">📎 Comprovante ' + (receipts.length > 1 ? index + 1 : "") + " ↗</a>"));
    const quantity = Math.max(0.01, Number(item.quantity) || 1);
    const unitPrice = num(item.unitPrice) || (num(item.cost) / quantity);
    const composedSubtasks = subtasks.filter((subtask) => num(subtask.cost) > 0);
    if (composedSubtasks.length) {
      metaBits.push("<span>🧾 " + composedSubtasks.length + " subitens = " + money(composedSubtasks.reduce((sum, subtask) => sum + num(subtask.cost), 0)) + "</span>");
    } else if (quantity !== 1 || unitPrice > 0) {
      metaBits.push("<span>📦 " + esc(String(quantity).replace(".", ",")) + " " + esc(item.unit || "un.") + " × " + money(unitPrice) + "</span>");
    }
    if (num(item.shipping) || num(item.surcharge) || num(item.discount)) {
      metaBits.push("<span>🧮" + (num(item.shipping) ? " frete " + money(item.shipping) : "") + (num(item.surcharge) ? " · acréscimo " + money(item.surcharge) : "") + (num(item.discount) ? " · desconto −" + money(item.discount) : "") + "</span>");
    }
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
          subtaskHtml +
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
        '<div class="item-actions">' +
          '<button class="icon-btn" type="button" data-duplicate="' + esc(item.id) +
            '" aria-label="Duplicar ' + esc(item.title) + '" title="Duplicar item">⧉</button>' +
          '<button class="icon-btn" type="button" data-edit="' + esc(item.id) +
            '" aria-label="Editar ' + esc(item.title) + '" title="Editar item">✏️</button>' +
        '</div>' +
      "</article>"
    );
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const mode = ($("#sortItems") && $("#sortItems").value) || "due";
      if (mode === "name") return a.title.localeCompare(b.title, "pt-BR");
      if (mode === "cost") return num(b.cost) - num(a.cost) || a.title.localeCompare(b.title, "pt-BR");
      if (mode === "status") {
        const order = { doing: 0, todo: 1, contracted: 2, done: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.title.localeCompare(b.title, "pt-BR");
      }
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
    const today = todayISO();
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 7);
    const soonISO = soonDate.toLocaleDateString("sv-SE");
    const stats = $("#checklistStats");
    const progressCard = document.querySelector(".checklist-progress-card");
    const toolbar = document.querySelector(".checklist-toolbar");
    const isEmpty = state.items.length === 0;
    if (stats) stats.hidden = isEmpty;
    if (progressCard) progressCard.hidden = isEmpty;
    if (toolbar) toolbar.classList.toggle("is-empty", isEmpty);

    const alerts = [
      { id: "overdue", icon: "⚠️", label: "Atrasados", count: state.items.filter((item) => item.due && item.due < today && item.status !== "done").length },
      { id: "today", icon: "📅", label: "Vencem hoje", count: state.items.filter((item) => item.due === today && item.status !== "done").length },
      { id: "soon", icon: "⏰", label: "Próximos 7 dias", count: state.items.filter((item) => item.due && item.due > today && item.due <= soonISO && item.status !== "done").length },
      { id: "balance", icon: "💳", label: "Com saldo", count: state.items.filter((item) => num(item.cost) > num(item.paid)).length },
    ];
    const alertWrap = $("#checklistAlerts");
    const visibleAlerts = alerts.filter((alert) => alert.count > 0 || checklistAlertFilter === alert.id);
    if (alertWrap) {
      alertWrap.hidden = isEmpty || !visibleAlerts.length;
      alertWrap.innerHTML = visibleAlerts.map((alert) => '<button class="checklist-alert' + (checklistAlertFilter === alert.id ? " is-active" : "") + ' has-items" type="button" data-check-alert="' + alert.id + '"><span aria-hidden="true">' + alert.icon + '</span><b>' + alert.count + '</b><small>' + alert.label + "</small></button>").join("");
    }

    if (isEmpty) {
      wrap.innerHTML =
        '<section class="checklist-welcome"><span class="checklist-welcome-icon" aria-hidden="true">⭐</span>' +
        '<div><h3>Seu checklist está vazio</h3><p>Comece com o modelo completo da festa ou adicione somente o que precisa.</p></div>' +
        '<div class="checklist-welcome-actions">' +
          '<button class="btn btn-primary" type="button" data-use-checklist-template>Usar modelo de festa infantil</button>' +
          '<button class="btn btn-ghost" type="button" data-empty-add-item><span aria-hidden="true">＋</span> Novo item</button>' +
          '<button class="btn btn-ghost" type="button" data-empty-import>📥 Importar CSV</button>' +
        "</div></section>";
      return;
    }

    if (!filtered.length && (f.q || f.status || f.pending || checklistAlertFilter)) {
      wrap.innerHTML =
        '<div class="empty"><span class="emoji">🔍</span><h3>Nada por aqui</h3>' +
        "<p>Nenhum item combina com os filtros escolhidos.</p>" +
        '<button class="btn btn-ghost" type="button" data-clear-filters>Limpar filtros</button></div>';
      return;
    }

    const html = stageList().map((stage) => {
      const items = filtered.filter((i) => i.stage === stage.id);
      const showEmptyStage = !f.q && !f.status && !f.pending && !checklistAlertFilter && (!f.stage || f.stage === stage.id);
      if (!items.length && !showEmptyStage) return "";
      const sorted = sortItems(items);
      const total = items.length;
      const done = items.filter((i) => i.status === "done").length;
      const subtotal = items.reduce((a, i) => a + num(i.cost), 0);
      const pct = total ? Math.round((done / total) * 100) : 0;
      const isCollapsed = !items.length || collapsed.has(stage.id);
      const tint = stage.color + "16";

      return (
        '<section class="stage-group' + (isCollapsed ? " is-collapsed" : "") +
          '" style="--stage:' + stage.color + ";--tint:" + tint + '">' +
          '<button class="stage-head" type="button" data-toggle-stage="' + stage.id + '" aria-expanded="' +
            (!isCollapsed) + '">' +
            '<span class="stage-icon" style="background:' + stage.color + '22;color:' + stage.color + '">' +
              stage.icon + "</span>" +
            '<span class="stage-title"><h2>' + esc(stage.name) + "</h2>" +
              '<span class="stage-sub">' + (total
                ? done + "/" + total + " concluídos · " + (total - done) + " pendentes" +
                  (subtotal ? ' · <span class="money">' + money(subtotal) + "</span>" : "")
                : "Sem itens · abra para adicionar") + "</span></span>" +
            '<span class="stage-progress"><div style="width:' + pct + "%;background:" + stage.color + '"></div></span>' +
            '<span class="stage-chevron">⌄</span>' +
          "</button>" +
          '<div class="stage-body"><div class="stage-add-row"><button class="btn btn-ghost btn-sm" type="button" data-add-stage="' + stage.id + '">＋ Adicionar em ' + esc(stage.name) + "</button></div>" +
            sorted.map(itemHTML).join("") + "</div>" +
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

    const budgetBase = Math.max(1, s.budget || s.previsto || s.contratado || s.pago);
    const budgetOverview = $("#budgetOverview");
    if (budgetOverview) {
      const rows = [
        { label: "Previsto", value: s.previsto, cls: "planned" },
        { label: "Contratado", value: s.contratado, cls: "committed" },
        { label: "Pago", value: s.pago, cls: "paid" },
      ];
      budgetOverview.classList.toggle("is-over", !!s.budget && s.previsto > s.budget);
      budgetOverview.innerHTML = '<div class="budget-overview-head"><div><span>Orçamento disponível</span><strong class="money">' + money(s.budget) +
        '</strong></div><small>' + (s.budget && s.previsto > s.budget ? "⚠ Previsão acima do orçamento" : "Acompanhe cada etapa do valor planejado") + "</small></div>" +
        '<div class="budget-overview-bars">' + rows.map((row) => {
          const pct = Math.max(0, Math.min(100, Math.round(row.value / budgetBase * 100)));
          return '<div class="budget-overview-row"><span>' + row.label + '</span><div><i class="' + row.cls + '" style="width:' + pct + '%"></i></div><b class="money">' + money(row.value) + "</b></div>";
        }).join("") + "</div>";
    }

    const cards = [
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

  function exportPartyPdf() {
    const report = window.open("", "_blank");
    if (!report) {
      toast("O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.", "warn");
      return;
    }

    const s = summary();
    const meta = state.meta;
    const guests = countableGuests(state.guests).slice();
    const adultGuests = guests
      .filter((g) => g.type === "adult")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    const childGuests = guests
      .filter((g) => g.type === "child")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    const items = state.items
      .slice()
      .sort((a, b) => stageById(a.stage).name.localeCompare(stageById(b.stage).name, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));

    const guestRows = (list) => list.length
      ? list.map((g) => {
          const linked = g.type === "child"
            ? guests.filter((a) => a.type === "adult" && g.guardians.includes(a.id)).map((a) => a.name)
            : [];
          const detail = linked.length ? '<small>Responsável: ' + esc(linked.join(", ")) + "</small>" : "";
          return '<tr><td>' + esc(g.name) + detail + '</td><td>' + esc((GUEST_STATUS[g.status] || GUEST_STATUS.pending).label) + "</td></tr>";
        }).join("")
      : '<tr><td colspan="2">Nenhum convidado nesta categoria.</td></tr>';

    const itemRows = items.length
      ? items.map((item) => {
          const stage = stageById(item.stage);
          const status = STATUS[item.status] || STATUS.todo;
          const due = item.due ? longDate(item.due) : "—";
          const quantity = Math.max(0.01, Number(item.quantity) || 1);
          const unitPrice = num(item.unitPrice) || (num(item.cost) / quantity);
          const subtasks = Array.isArray(item.subtasks) && item.subtasks.length
            ? '<small>' + item.subtasks.map((subtask) => (subtask.done ? "✓ " : "□ ") + esc(subtask.title)).join("<br>") + "</small>"
            : "";
          return '<tr><td>' + esc(item.title) + subtasks + '</td><td>' + esc(stage.name) +
            '</td><td>' + esc(status.label) + '</td><td>' + esc(String(quantity).replace(".", ",") + " " + (item.unit || "un.")) + '</td><td>' + money(unitPrice) + '</td><td>' + money(item.cost) +
            '</td><td>' + money(item.paid) + '</td><td>' + due + '</td></tr>';
        }).join("")
      : '<tr><td colspan="8">Nenhum item no checklist.</td></tr>';

    const breakdownRows = stageList().map((stage) => {
      const stageItems = state.items.filter((item) => item.stage === stage.id);
      const planned = stageItems.reduce((sum, item) => sum + num(item.cost), 0);
      const paid = stageItems.reduce((sum, item) => sum + num(item.paid), 0);
      return { stage, planned, paid };
    }).filter((row) => row.planned || row.paid)
      .map((row) => '<tr><td>' + esc(row.stage.name) + '</td><td>' + money(row.planned) + '</td><td>' + money(row.paid) + '</td></tr>')
      .join("") || '<tr><td colspan="3">Ainda não há valores lançados.</td></tr>';

    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    const pending = guests.filter((g) => g.status === "pending").length;
    const declined = guests.filter((g) => g.status === "declined").length;
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());
    const map = mapsLink();

    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Resumo da festa · ' + esc(meta.name) + '</title><style>' +
      '*,*::before,*::after{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#20304b;max-width:1000px;margin:32px auto;padding:0 24px;line-height:1.45}' +
      'h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:28px 0 10px;border-bottom:2px solid #dce7f2;padding-bottom:6px}p{margin:4px 0}.muted{color:#68788e}.event,.summary{padding:16px;border:1px solid #dce7f2;border-radius:10px;background:#f7fbff}' +
      '.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.metric{padding:10px;border:1px solid #dce7f2;border-radius:8px}.metric b{display:block;font-size:16px;margin-top:4px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #dce3eb;vertical-align:top}th{background:#f0f5fa}td small{display:block;color:#68788e;margin-top:3px}.guest-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}' +
      '@media print{body{margin:0 auto;padding:0;max-width:none}.event,.summary,.metric{background:#fff}h2{break-after:avoid}tr{break-inside:avoid}.no-print{display:none}}@page{size:A4;margin:14mm}' +
      '</style></head><body>' +
      '<h1>' + esc(meta.name) + ' faz ' + esc(meta.age) + ' anos!</h1><p class="muted">Resumo da festa · gerado em ' + generatedAt + '</p>' +
      '<section class="event"><strong>Data:</strong> ' + esc(longDate(meta.date)) + (meta.time ? ' às ' + esc(meta.time.replace(":", "h")) : "") +
      '<br><strong>Local:</strong> ' + esc(meta.location || "A definir") +
      (map ? '<br><strong>Mapa:</strong> ' + esc(map) : "") +
      '<br><strong>Tema:</strong> ' + esc(meta.theme) + '</section>' +
      '<section class="summary"><strong>Resumo financeiro</strong><div class="metrics">' +
      '<div class="metric">Orçamento<b>' + money(s.budget) + '</b></div><div class="metric">Previsto<b>' + money(s.previsto) +
      '</b></div><div class="metric">Contratado<b>' + money(s.contratado) + '</b></div><div class="metric">Pago<b>' + money(s.pago) +
      '</b></div><div class="metric">A pagar<b>' + money(s.aPagar) + '</b></div><div class="metric">Saldo<b>' + money(s.saldo) + '</b></div></div></section>' +
      '<h2>Gastos por etapa</h2><table><thead><tr><th>Etapa</th><th>Previsto</th><th>Pago</th></tr></thead><tbody>' + breakdownRows + '</tbody></table>' +
      '<h2>Checklist e orçamento</h2><table><thead><tr><th>Item</th><th>Etapa</th><th>Status</th><th>Qtd.</th><th>Unitário</th><th>Previsto</th><th>Pago</th><th>Vencimento</th></tr></thead><tbody>' + itemRows + '</tbody></table>' +
      '<h2>Convidados (' + guests.length + ')</h2><p class="muted">' + confirmed + ' confirmados · ' + pending + ' pendentes · ' + declined + ' não vão</p>' +
      '<div class="guest-grid"><section><h3>Adultos (' + adultGuests.length + ')</h3><table><thead><tr><th>Nome</th><th>Status</th></tr></thead><tbody>' + guestRows(adultGuests) + '</tbody></table></section>' +
      '<section><h3>Crianças (' + childGuests.length + ')</h3><table><thead><tr><th>Nome</th><th>Status</th></tr></thead><tbody>' + guestRows(childGuests) + '</tbody></table></section></div>' +
      '<p class="muted no-print" style="margin-top:24px">Na janela de impressão, escolha “Salvar como PDF”.</p>' +
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script></body></html>';

    report.document.open();
    report.document.write(html);
    report.document.close();
    report.focus();
  }

  function exportChecklistPdf() {
    const report = window.open("", "_blank");
    if (!report) {
      toast("O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.", "warn");
      return;
    }

    const meta = state.meta;
    const s = summary();
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
    const stageSections = stageList().map((stage) => {
      const items = state.items.filter((item) => item.stage === stage.id).sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return a.title.localeCompare(b.title, "pt-BR");
      });
      if (!items.length) return "";
      const planned = items.reduce((sum, item) => sum + num(item.cost), 0);
      const paid = items.reduce((sum, item) => sum + num(item.paid), 0);
      const rows = items.map((item) => {
        const status = STATUS[item.status] || STATUS.todo;
        const quantity = Math.max(0.01, Number(item.quantity) || 1);
        const detail = [
          item.supplier ? "Fornecedor: " + item.supplier : "",
          item.supplierPhone ? "Telefone: " + formatPhoneBR(item.supplierPhone) : "",
          item.supplierInstagram ? "Instagram: @" + item.supplierInstagram : "",
          item.orderNumber ? "Pedido/contrato: " + item.orderNumber : "",
          item.deliveryDate ? "Entrega: " + fmtDate(item.deliveryDate) : "",
          num(item.shipping) ? "Frete: " + money(item.shipping) : "",
          num(item.surcharge) ? "Acréscimo: " + money(item.surcharge) : "",
          num(item.discount) ? "Desconto: " + money(item.discount) : "",
          Array.isArray(item.payments) && item.payments.length
            ? item.payments.filter((payment) => payment.paid).length + "/" + item.payments.length + " pagamentos quitados"
            : "",
          item.notes || "",
        ].filter(Boolean).join(" · ");
        const subtasks = Array.isArray(item.subtasks) && item.subtasks.length
          ? '<ul class="subtasks">' + item.subtasks.map((subtask) => '<li>' + (subtask.done ? "☑" : "☐") + " " + esc(subtask.title) + (num(subtask.cost) ? " — " + esc(String(subtask.quantity || 1).replace(".", ",")) + " " + esc(subtask.unit || "un.") + " × " + money(subtask.unitPrice) + " = " + money(subtask.cost) : "") + "</li>").join("") + "</ul>"
          : "";
        return '<tr class="' + (item.status === "done" ? "done" : "") + '">' +
          '<td class="check">' + (item.status === "done" ? "✓" : "□") + '</td>' +
          '<td><strong>' + esc(item.title) + '</strong>' + (detail ? '<small>' + esc(detail) + '</small>' : "") + subtasks + '</td>' +
          '<td>' + esc(status.label) + '</td>' +
          '<td>' + esc(String(quantity).replace(".", ",") + " " + (item.unit || "un.")) + '</td>' +
          '<td>' + (item.due ? esc(fmtDate(item.due)) : "—") + '</td>' +
          '<td class="num">' + (num(item.cost) ? money(item.cost) : "—") + '</td>' +
          '<td class="num">' + (num(item.paid) ? money(item.paid) : "—") + '</td></tr>';
      }).join("");
      return '<section><div class="stage-head"><h2>' + stage.icon + " " + esc(stage.name) + '</h2><span>' +
        items.filter((item) => item.status === "done").length + "/" + items.length + " concluídos · " + money(planned) + " previsto · " + money(paid) +
        '</span></div><table><thead><tr><th></th><th>Item</th><th>Status</th><th>Qtd.</th><th>Prazo</th><th class="num">Previsto</th><th class="num">Pago</th></tr></thead><tbody>' + rows + "</tbody></table></section>";
    }).join("");

    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Checklist da festa · ' + esc(meta.name) + '</title><style>' +
      '*,*::before,*::after{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#20304b;max-width:1050px;margin:28px auto;padding:0 22px;line-height:1.4}' +
      'header{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding-bottom:13px;border-bottom:3px solid #ffd447}h1{margin:0;color:#123a66;font-size:27px}header p{margin:3px 0 0;color:#68788e}.totals{text-align:right;font-size:11px}.totals b{display:block;color:#123a66;font-size:15px}' +
      'section{margin-top:20px;break-inside:avoid-page}.stage-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:2px solid #d8e7f3}.stage-head h2{margin:0 0 5px;color:#123a66;font-size:17px}.stage-head span{color:#68788e;font-size:10px;font-weight:bold}' +
      'table{width:100%;border-collapse:collapse}th,td{padding:6px 7px;border-bottom:1px solid #dfe7ef;text-align:left;vertical-align:top}th{color:#52627a;background:#f1f6fa;font-size:9px;text-transform:uppercase;letter-spacing:.05em}td.check{width:25px;color:#188647;font-size:16px;font-weight:bold}td.num,th.num{text-align:right;white-space:nowrap}td small{display:block;margin-top:2px;color:#68788e;font-size:9px}.subtasks{display:grid;gap:2px;margin:5px 0 0;padding:5px 8px;list-style:none;border-left:2px solid #b8cee2;color:#38536f;font-size:9px}.done td strong{text-decoration:line-through;color:#637287}' +
      '.note{margin-top:20px;color:#68788e;font-size:10px}.no-print{margin-top:20px;padding:10px;border-radius:8px;background:#eef6fd;color:#315a7e}' +
      '@media print{body{max-width:none;margin:0;padding:0}.no-print{display:none}section{break-inside:auto}.stage-head{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}}@page{size:A4 landscape;margin:10mm}' +
      '</style></head><body><header><div><h1>Checklist da festa do ' + esc(meta.name) + '</h1><p>' + esc(longDate(meta.date)) + (meta.time ? " · " + esc(meta.time.replace(":", "h")) : "") + " · " + esc(meta.location || "Local a definir") +
      '</p><p>Gerado em ' + esc(generatedAt) + '</p></div><div class="totals"><b>' + s.done + "/" + s.total + " concluídos</b><span>Previsto: " + money(s.previsto) + " · Pago: " + money(s.pago) +
      '</span></div></header>' + stageSections + '<p class="note">□ Use os quadrados para conferência manual durante a organização e no dia da festa.</p>' +
      '<p class="no-print">Na janela de impressão, escolha “Salvar como PDF” ou selecione sua impressora.</p>' +
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script></body></html>';

    report.document.open();
    report.document.write(html);
    report.document.close();
    report.focus();
  }

  function exportConfirmedPdf() {
    const report = window.open("", "_blank");
    if (!report) {
      toast("O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.", "warn");
      return;
    }

    const meta = state.meta;
    const guests = countableGuests(state.guests);
    const confirmed = guests
      .filter((g) => g.status === "confirmed")
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "adult" ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
    const adults = confirmed.filter((g) => g.type === "adult");
    const children = confirmed.filter((g) => g.type === "child");
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());
    const map = mapsLink();
    const phones = [
      { label: "Papai", phone: meta.fatherPhone },
      { label: "Mamãe", phone: meta.motherPhone },
    ].filter((item) => phoneDigits(item.phone));
    const phoneList = phones.length
      ? phones.map((item) => esc(item.label) + ": " + esc(formatPhoneBR(item.phone) || item.phone)).join(" · ")
      : "Não informado";
    const guestRows = confirmed.length
      ? confirmed.map((g, index) =>
          '<tr><td class="num">' + (index + 1) + '</td><td>' + esc(displayGuestName(g)) +
          '</td><td>' + (g.type === "child" ? "Criança" : "Adulto") + "</td></tr>"
        ).join("")
      : '<tr><td colspan="3" class="empty-row">Nenhum convidado confirmado até agora.</td></tr>';

    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Confirmados · ' + esc(meta.name) + ' faz ' + esc(meta.age) + '</title><style>' +
      '*,*::before,*::after{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#20304b;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.45}' +
      'h1{font-size:27px;margin:0 0 2px;color:#123a66}h2{font-size:17px;margin:22px 0 9px;color:#123a66;border-bottom:2px solid #dce7f2;padding-bottom:5px}' +
      'p{margin:3px 0}.muted{color:#68788e;font-size:12px}.badge{display:inline-block;margin-bottom:8px;padding:4px 10px;border-radius:999px;background:#fff0b7;color:#765400;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase}' +
      '.event{padding:15px 17px;border:1px solid #dce7f2;border-radius:12px;background:#f7fbff}.event div{margin:3px 0}.event b{display:inline-block;min-width:74px;color:#38536f}' +
      '.counts{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.count{flex:1 1 120px;padding:10px 12px;border:1px solid #dce7f2;border-radius:10px;background:#fff}.count span{display:block;font-size:11px;color:#68788e;text-transform:uppercase;letter-spacing:.07em}.count b{display:block;font-size:20px;margin-top:2px;color:#123a66}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px 9px;border-bottom:1px solid #dce3eb}th{background:#f0f5fa;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#52627a}' +
      'td.num{width:34px;color:#8a9bb2}td.empty-row{text-align:center;color:#68788e;padding:22px}' +
      '.contact{margin-top:16px;padding:12px 15px;border-radius:10px;background:#f5fbff;font-size:12px;color:#1d557c}' +
      '@media print{body{margin:0 auto;padding:0;max-width:none}.event,.count,.contact{background:#fff}h2{break-after:avoid}tr{break-inside:avoid}.no-print{display:none}}@page{size:A4;margin:15mm}' +
      '</style></head><body>' +
      '<span class="badge">Lista de confirmados</span>' +
      '<h1>' + esc(meta.name) + ' faz ' + esc(meta.age) + ' anos!</h1>' +
      '<p class="muted">Gerado em ' + generatedAt + '</p>' +
      '<section class="event">' +
        '<div><b>Data:</b> ' + esc(longDate(meta.date)) + (meta.time ? ' às ' + esc(meta.time.replace(":", "h")) : "") + '</div>' +
        '<div><b>Local:</b> ' + esc(meta.location || "A definir") + '</div>' +
        (map ? '<div><b>Mapa:</b> ' + esc(map) + '</div>' : "") +
        '<div><b>Tema:</b> ' + esc(meta.theme) + '</div>' +
      '</section>' +
      '<div class="counts">' +
        '<div class="count"><span>Confirmados</span><b>' + confirmed.length + '</b></div>' +
        '<div class="count"><span>Adultos</span><b>' + adults.length + '</b></div>' +
        '<div class="count"><span>Crianças</span><b>' + children.length + '</b></div>' +
      '</div>' +
      '<h2>Confirmados</h2>' +
      '<table><thead><tr><th>#</th><th>Nome</th><th>Tipo</th></tr></thead><tbody>' + guestRows + '</tbody></table>' +
      '<div class="contact"><strong>Se precisar de ajuda, fale com:</strong><br>' + phoneList + '</div>' +
      '<p class="muted no-print" style="margin-top:22px">Na janela de impressão, escolha “Salvar como PDF”.</p>' +
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script></body></html>';

    report.document.open();
    report.document.write(html);
    report.document.close();
    report.focus();
  }

  function renderBreakdown() {
    const rows = stageList().map((stage) => {
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
              '</span><span class="bd-name">' + esc(r.stage.name) + "</span></div>" +
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
        '<tr><td colspan="8" class="muted" style="text-align:center;padding:26px">' +
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
              stage.icon + " " + esc(stage.name) + "</span></td>" +
            '<td><span class="status-cell"><span class="status-dot" style="background:' + st.color +
              '"></span>' + st.label + "</span></td>" +
            '<td class="num hide-sm">' + esc(String(Math.max(0.01, Number(item.quantity) || 1)).replace(".", ",") + " " + (item.unit || "un.")) + '</td>' +
            '<td class="num hide-sm money">' + money(num(item.unitPrice) || (num(item.cost) / Math.max(0.01, Number(item.quantity) || 1))) + '</td>' +
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

  function isHostGuest(guest) {
    const relation = norm(guest && guest.relation);
    return relation === "pai" || relation === "mae" || relation === "papai" || relation === "mamae";
  }

  function countableGuests(list) {
    return (Array.isArray(list) ? list : []).filter((guest) => !isHostGuest(guest));
  }

  function displayGuestName(guest) {
    const relation = String(guest.relation || "").trim();
    const name = String(guest.name || "").trim();
    if (relation && norm(name).startsWith(norm(relation) + " ")) return name;
    return [relation, name].filter(Boolean).join(" ");
  }

  function guestMatchesActiveFilter(g) {
    if (guestFilter === "parents" && !isHostGuest(g)) return false;
    if (guestFilter === "adult" && (g.type !== "adult" || isHostGuest(g))) return false;
    if (guestFilter === "child" && g.type !== "child") return false;
    if (guestFilter === "sent" && (isHostGuest(g) || !phoneDigits(g.phone) || !g.inviteSentAt)) return false;
    if (guestFilter === "unsent" && (isHostGuest(g) || !phoneDigits(g.phone) || g.inviteSentAt)) return false;
    if (guestFilter === "no_phone" && (isHostGuest(g) || phoneDigits(g.phone))) return false;
    if (guestFilter === "needs_reminder" && (isHostGuest(g) || g.status !== "pending" || !phoneDigits(g.phone) || !g.inviteSentAt || g.reminderSentAt)) return false;
    if (!["all", "parents", "adult", "child", "sent", "unsent", "no_phone", "needs_reminder"].includes(guestFilter) && (isHostGuest(g) || g.status !== guestFilter)) return false;
    const q = norm(guestQuery);
    return !q || norm(displayGuestName(g)).includes(q);
  }

  function selectableGuest(g) {
    return !isHostGuest(g) && !!phoneDigits(g.phone);
  }

  function renderGuestBulkBar(visible) {
    const validIds = new Set(state.guests.filter(selectableGuest).map((g) => g.id));
    selectedGuestIds = new Set([...selectedGuestIds].filter((id) => validIds.has(id)));
    const count = selectedGuestIds.size;
    const eligibleVisible = visible.filter(selectableGuest);
    const selectedVisible = eligibleVisible.filter((g) => selectedGuestIds.has(g.id)).length;
    $("#guestBulkCount").textContent = count + (count === 1 ? " selecionado" : " selecionados");
    $("#guestBulkHint").textContent = count ? " Os envios serão abertos um por vez." : " Selecione convidados com telefone.";
    $("#clearGuestSelectionBtn").disabled = !count;
    $("#prepareGuestInvitesBtn").disabled = !count;
    $("#selectVisibleGuestsBtn").disabled = !eligibleVisible.length;
    $("#selectVisibleGuestsBtn").textContent = eligibleVisible.length && selectedVisible === eligibleVisible.length
      ? "Desmarcar deste filtro"
      : "Selecionar deste filtro";
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
    const reminder = g.status === "pending" && waReminderLink(g)
      ? ' · <a class="guest-wa-reminder" data-guest-reminder="' + esc(g.id) + '" href="' + esc(waReminderLink(g)) +
        '" target="_blank" rel="noopener noreferrer">' + (g.reminderSentAt ? "Reenviar lembrete" : "Enviar lembrete") + " ↗</a>"
      : "";
    const phone = g.phone
      ? '<div class="guest-contact">📱 ' + esc(g.phone) +
        (waLink(g.phone)
          ? ' <a class="guest-wa-chat" href="' + esc(waLink(g.phone)) +
            '" target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa com ' + esc(g.name) +
            ' no WhatsApp" title="Abrir conversa no WhatsApp">' + whatsappIconSvg() + '</a>'
          : "") +
        (waInviteLink(g)
          ? ' · <a class="guest-wa-invite" data-guest-send="' + esc(g.id) + '" href="' + esc(waInviteLink(g)) +
            '" target="_blank" rel="noopener noreferrer">Enviar convite ↗</a>'
          : "") +
        reminder +
        "</div>"
      : "";
    const notes = g.notes ? '<div class="guest-notes">' + esc(g.notes) + "</div>" : "";
    const unlistedBadge = g.unlisted
      ? '<span class="guest-unlisted-badge" title="Confirmou presença sem estar na lista inicial">Novo convidado</span>'
      : "";
    const hostBadge = isHostGuest(g)
      ? ' <span class="guest-host-badge" title="Anfitrião: aparece na lista, mas não entra na contagem de convidados">Anfitrião</span>'
      : "";
    const sentAt = g.inviteSentAt ? new Date(g.inviteSentAt) : null;
    const sentLabel = sentAt && !isNaN(sentAt.getTime())
      ? sentAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "";
    const sentNote = sentLabel
      ? '<div class="guest-invite-sent-note">✉ Convite enviado ' + esc(timeAgo(g.inviteSentAt)) + "</div>"
      : "";
    const reminderNote = g.reminderSentAt
      ? '<div class="guest-reminder-sent-note">🔔 Lembrete enviado ' + esc(timeAgo(g.reminderSentAt)) + "</div>"
      : "";
    const inviteSentButton =
      '<button class="icon-btn guest-invite-status' + (sentLabel ? " is-sent" : "") +
        '" type="button" data-guest-invite-toggle="' + esc(g.id) +
        '" aria-label="' + (sentLabel ? "Convite enviado para " : "Marcar convite como enviado para ") + esc(g.name) +
        '" title="' + (sentLabel ? "Convite enviado em " + esc(sentLabel) + " · clique para desmarcar" : "Convite ainda não enviado · clique para marcar") +
        '"><span aria-hidden="true">✉</span><b aria-hidden="true">✓</b></button>';
    const selectBox = selectableGuest(g)
      ? '<label class="guest-select" title="Selecionar ' + esc(g.name) + '"><input type="checkbox" data-guest-select="' + esc(g.id) + '"' +
        (selectedGuestIds.has(g.id) ? " checked" : "") + ' aria-label="Selecionar ' + esc(g.name) + '"><span></span></label>'
      : "";

    const guardians =
      g.type === "child"
        ? guests.filter((a) => a.type === "adult" && g.guardians.includes(a.id))
        : [];
    const confirmedGuardians = guardians.filter((adult) => adult.status === "confirmed");
    const accompaniedBadge =
      g.type === "child" && g.status === "confirmed" && confirmedGuardians.length
        ? ' <span class="guest-accompanied-badge" title="Presença confirmada com responsável">✓ Vai com ' +
          esc(confirmedGuardians.map((adult) => displayGuestName(adult)).join(", ")) + "</span>"
        : "";
    const kids =
      g.type === "adult"
        ? guests.filter((c) => c.type === "child" && c.guardians.includes(g.id))
        : [];
    const guardianLine = guardians.length
      ? '<div class="guest-links">👨‍👩‍👧 ' +
        (guardians.length > 1 ? "Responsáveis: " : "Responsável: ") +
        guardians.map((a) => esc(displayGuestName(a))).join(", ") + "</div>"
      : "";
    const kidsLine = kids.length
      ? '<div class="guest-links">🧒 Crianças: ' +
        kids.map((c) => esc(displayGuestName(c))).join(", ") + "</div>"
      : "";

    return (
      '<div class="guest-row' + (selectedGuestIds.has(g.id) ? " is-selected" : "") + '">' + selectBox +
        '<div class="guest-avatar ' + g.type + '">' + esc(initials(g.name)) + "</div>" +
        '<div class="guest-main"><div class="guest-name' + (accompaniedBadge ? " is-accompanied" : "") + '">' + esc(displayGuestName(g)) + unlistedBadge + hostBadge + accompaniedBadge + "</div>" +
          '<div class="guest-type">' + (isHostGuest(g) ? "Pais" : g.type === "child" ? "Criança" : "Adulto") +
          " · " + gs.label + "</div>" + phone + sentNote + reminderNote + notes + guardianLine + kidsLine +
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
          '" aria-label="Remover ' + esc(g.name) + '">🗑</button>' + inviteSentButton +
      "</div>"
    );
  }

  function renderGuests() {
    const allGuests = state.guests;
    const guests = countableGuests(allGuests);
    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    const pending = guests.filter((g) => g.status === "pending").length;
    const declined = guests.filter((g) => g.status === "declined").length;
    const children = guests.filter((g) => g.type === "child").length;
    const adults = guests.filter((g) => g.type === "adult").length;
    const inviteTargets = guests.filter((g) => phoneDigits(g.phone));
    const invitesSent = inviteTargets.filter((g) => g.inviteSentAt).length;
    const meta = state.meta;

    const progressCard = (count, max, kind) => {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      const width = Math.max(0, Math.min(100, pct));
      const safeMax = Math.max(1, max);
      const now = Math.max(0, Math.min(count, safeMax));
      const label = kind === "confirmed"
        ? "Percentual de confirmações"
        : kind === "invite"
          ? "Progresso de envio dos convites"
          : "Ocupação do limite";
      const tone = pct > 95 ? "high" : pct >= 76 ? "mid" : "low";
      return (
        '<div class="stat-progress-row"><div class="stat-progress" role="progressbar" aria-label="' + label +
          '" aria-valuemin="0" aria-valuemax="' + safeMax + '" aria-valuenow="' + now + '" aria-valuetext="' + pct + '%">' +
          '<span class="stat-progress-fill ' + kind + (kind === "limit" ? " " + tone : "") + '" style="width:' + width + '%"></span>' +
        "</div>" +
        '<span class="stat-progress-pct' + (kind === "confirmed" || kind === "invite" ? " positive" : " limit-" + tone) + '">' +
          pct + "%" +
        "</span></div>"
      );
    };

    $("#guestStats").innerHTML = [
      { label: "Na lista", value: guests.length, note: "convidados", cls: "" },
      {
        label: "Convites enviados",
        value: invitesSent,
        note: "de " + inviteTargets.length + " com telefone",
        cls: invitesSent && invitesSent === inviteTargets.length ? "good" : "",
        progress: progressCard(invitesSent, inviteTargets.length, "invite"),
      },
      {
        label: "Confirmados",
        value: confirmed,
        note: guests.length ? Math.round((confirmed / guests.length) * 100) + "% da lista" : "—",
        cls: "good",
        progress: progressCard(confirmed, guests.length, "confirmed"),
      },
      {
        label: "Crianças",
        value: children,
        note: "de " + meta.maxChildren,
        cls: "",
        progress: progressCard(children, meta.maxChildren, "limit"),
      },
      {
        label: "Adultos",
        value: adults,
        note: "de " + meta.maxAdults,
        cls: "",
        progress: progressCard(adults, meta.maxAdults, "limit"),
      },
    ]
      .map(
        (c) =>
          '<div class="stat-card guest-stat ' + (c.cls || "") + '"><span class="label">' + c.label +
          '</span><span class="value">' + c.value + '</span><span class="note">' + c.note + "</span>" +
          (c.progress || "") + "</div>"
      )
      .join("");

    const deadlineEl = $("#rsvpDeadlineStatus");
    if (deadlineEl) {
      const deadline = /^\d{4}-\d{2}-\d{2}$/.test(meta.rsvpDeadline) ? new Date(meta.rsvpDeadline + "T23:59:59") : null;
      const days = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null;
      const pendingText = pending + (pending === 1 ? " confirmação pendente" : " confirmações pendentes");
      const tone = days === null ? "" : days < 0 ? " is-overdue" : days <= 7 ? " is-urgent" : "";
      const timing = days === null
        ? "Defina o prazo em Editar festa."
        : days < 0
          ? "O prazo terminou há " + Math.abs(days) + (Math.abs(days) === 1 ? " dia." : " dias.")
          : days === 0
            ? "O prazo termina hoje."
            : "Faltam " + days + (days === 1 ? " dia." : " dias.");
      deadlineEl.className = "rsvp-deadline-status" + tone;
      deadlineEl.innerHTML = '<span aria-hidden="true">⏳</span><div><strong>Confirmações até ' + esc(longDate(meta.rsvpDeadline)) +
        '</strong><small>' + esc(timing + " · " + pendingText) + "</small></div>";
    }

    const noPhone = guests.filter((g) => !phoneDigits(g.phone)).length;
    const notSent = guests.filter((g) => phoneDigits(g.phone) && !g.inviteSentAt).length;
    const needsReminder = guests.filter((g) => g.status === "pending" && phoneDigits(g.phone) && g.inviteSentAt && !g.reminderSentAt).length;
    const pendingGrid = $("#guestPendingGrid");
    if (pendingGrid) {
      pendingGrid.innerHTML = [
        { filter: "no_phone", icon: "📵", value: noPhone, label: "Sem telefone", detail: "Complete o contato" },
        { filter: "unsent", icon: "✉️", value: notSent, label: "Convite não enviado", detail: "Prepare o primeiro envio" },
        { filter: "pending", icon: "⏳", value: pending, label: "Aguardando resposta", detail: "Ainda não confirmaram" },
        { filter: "needs_reminder", icon: "🔔", value: needsReminder, label: "Sem lembrete", detail: "Já receberam o convite" },
      ].map((card) => '<button class="guest-pending-card' + (card.value ? " has-items" : " is-clear") +
        '" type="button" data-pending-filter="' + card.filter + '"><span aria-hidden="true">' + card.icon +
        '</span><b>' + card.value + '</b><strong>' + card.label + '</strong><small>' + card.detail + "</small></button>").join("");
    }

    const counts = {
      all: allGuests.length,
      parents: allGuests.filter(isHostGuest).length,
      adult: allGuests.filter((g) => g.type === "adult" && !isHostGuest(g)).length,
      child: allGuests.filter((g) => g.type === "child").length,
      sent: guests.filter((g) => phoneDigits(g.phone) && g.inviteSentAt).length,
      unsent: guests.filter((g) => phoneDigits(g.phone) && !g.inviteSentAt).length,
      no_phone: guests.filter((g) => !phoneDigits(g.phone)).length,
      needs_reminder: guests.filter((g) => g.status === "pending" && phoneDigits(g.phone) && g.inviteSentAt && !g.reminderSentAt).length,
      confirmed: guests.filter((g) => g.status === "confirmed").length,
      pending: guests.filter((g) => g.status === "pending").length,
      declined: guests.filter((g) => g.status === "declined").length,
    };
    const labels = {
      all: "Todos",
      parents: "Pais",
      adult: "Adultos",
      child: "Crianças",
      sent: "Enviados",
      unsent: "Não enviados",
      no_phone: "Sem telefone",
      needs_reminder: "Sem lembrete",
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
    if (!allGuests.length) {
      renderGuestBulkBar([]);
      list.innerHTML =
        '<div class="empty"><span class="emoji">🎟️</span><h3>Lista vazia</h3>' +
        "<p>Adicione os convidados para acompanhar as confirmações.</p></div>";
      return;
    }

    const visible = allGuests.filter(guestMatchesActiveFilter);
    renderGuestBulkBar(visible);

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
        id: "parents",
        title: "Pais",
        icon: "👨‍👩‍👦",
        items: visible.filter(isHostGuest).sort(byName),
      },
      {
        id: "adult",
        title: "Adultos",
        icon: "🧑",
        items: visible.filter((g) => g.type === "adult" && !isHostGuest(g)).sort(byName),
      },
      {
        id: "child",
        title: "Crianças",
        icon: "🧒",
        items: visible.filter((g) => g.type === "child").sort(byName),
      },
    ].filter((group) => group.items.length);

    list.innerHTML = groups
      .map((group) => {
        const isCollapsed = collapsedGuestGroups.has(group.id);
        return (
          '<div class="guest-group' + (isCollapsed ? " is-collapsed" : "") + '" data-guest-group="' + group.id + '">' +
            '<button class="guest-group-toggle guest-group-title" type="button" data-guest-group-toggle="' + group.id +
              '" aria-expanded="' + (isCollapsed ? "false" : "true") + '" aria-controls="guestRows-' + group.id + '">' +
              '<span class="guest-group-heading">' + group.icon + " " + group.title +
              ' <span class="guest-group-count">' + group.items.length + "</span></span>" +
              '<span class="guest-group-chevron" aria-hidden="true">⌄</span>' +
            "</button>" +
            '<div class="guest-group-rows guest-list" id="guestRows-' + group.id + '"' + (isCollapsed ? " hidden" : "") + ">" +
              group.items.map(guestRowHtml).join("") +
            "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderBulkInviteModal() {
    const total = bulkInviteQueue.length;
    const done = Math.min(bulkInviteIndex, total);
    const current = bulkInviteQueue[bulkInviteIndex];
    $("#bulkInviteProgress").innerHTML = '<strong>' + done + " de " + total + " preparados</strong>" +
      '<div class="stat-progress"><span class="stat-progress-fill invite" style="width:' + (total ? Math.round(done / total * 100) : 0) + '%"></span></div>';
    $("#bulkInviteCurrent").innerHTML = current
      ? '<span>Próximo convite</span><strong>' + esc(displayGuestName(current)) + '</strong><small>' + esc(current.phone) + "</small>"
      : '<strong>Todos os convites foram preparados.</strong><span>Confira as conversas abertas no WhatsApp.</span>';
    $("#bulkInviteList").innerHTML = bulkInviteQueue.map((g, index) =>
      '<div class="bulk-invite-item ' + (index < done ? "is-done" : index === done ? "is-current" : "") + '"><span>' +
      (index < done ? "✓" : index + 1) + '</span><b>' + esc(displayGuestName(g)) + "</b></div>"
    ).join("");
    $("#openNextInviteBtn").disabled = !current;
    $("#openNextInviteBtn").textContent = current ? "Abrir convite de " + current.name + " ↗" : "Envios preparados ✓";
  }

  function openBulkInviteModal() {
    bulkInviteQueue = state.guests.filter((g) => selectedGuestIds.has(g.id) && selectableGuest(g));
    bulkInviteIndex = 0;
    if (!bulkInviteQueue.length) return;
    renderBulkInviteModal();
    openModal($("#bulkInviteModal"), $("#openNextInviteBtn"));
  }

  /* ---------- Render: nuvem ---------- */

  function renderCloudBar() {
    const dot = $("#cloudDot");
    const text = $("#cloudText");
    const saveBtn = $("#saveCloudBtn");
    const pullBtn = $("#pullBtn");
    if (!dot || !text) return;

    pullBtn.hidden = false;
    pullBtn.textContent = hasCloud() ? "⬇️ Carregar da nuvem" : "⬇️ Configurar e carregar";
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
    renderDayMode();
    renderCloudBar();
    if (activeView === "invite") renderInviteView();
  }

  /* ---------- Alterações / persistência ---------- */

  function touch(options) {
    const opts = options || {};
    state.updatedAt = nowISO();
    saveLocal();
    dirty = true;
    cloud.pending = true;
    saveCloudCfg();

    if (opts.cloud === false) {
      renderCloudBar();
      return;
    }

    if (hasCloud() && cloud.auto && cloud.verified) {
      cloudPhase = "dirty";
      renderCloudBar();
      clearTimeout(autoTimer);
      // Agrupa a sessão em um único envio e reduz o histórico de commits automáticos.
      autoTimer = setTimeout(() => saveCloud({ silent: true }), 90000);
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

  function repoApiUrl() {
    return (
      "https://api.github.com/repos/" +
      encodeURIComponent(cloud.owner) +
      "/" +
      encodeURIComponent(cloud.repo)
    );
  }

  async function verifyPrivateRepo() {
    const res = await fetch(repoApiUrl(), {
      headers: {
        Authorization: "Bearer " + cloud.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || "Não foi possível verificar o repositório.");
      error.status = res.status;
      throw error;
    }
    if (!data.private) {
      throw new Error(
        "Este repositório é público. Use um repositório privado separado para proteger convidados, telefones e orçamento."
      );
    }
    cloud.privateVerified = true;
    saveCloudCfg();
    return data;
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
      toast("Abra Editar festa e configure o GitHub primeiro.", "warn");
      openSettings();
      return;
    }

    setCloudPhase("syncing");
    try {
      await verifyPrivateRepo();
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

      if (!opts.silent) {
        const localTime = Date.parse(state.updatedAt || "") || 0;
        const cloudTime = Date.parse(next.updatedAt || "") || 0;
        let message = "Carregar os dados da nuvem neste dispositivo?";
        if (cloudTime > localTime) {
          message = "A versão da nuvem é mais recente.\n\nDeseja atualizar este dispositivo com os dados mais novos?";
        } else if (localTime > cloudTime) {
          message =
            "Atenção: este dispositivo tem alterações mais recentes que a nuvem.\n\n" +
            "Se continuar, essas alterações locais serão substituídas. Deseja carregar mesmo assim?";
        } else {
          message += "\n\nOs itens e convidados locais serão substituídos pela versão online.";
        }
        if (!window.confirm(message)) {
          setCloudPhase("idle");
          toast("Carregamento cancelado. Os dados deste dispositivo foram preservados.", "warn");
          return;
        }
      }

      createAutomaticBackup("antes de carregar dados da nuvem");
      state = next;
      addActivity("cloud", "Dados carregados da nuvem neste dispositivo");
      cloud.sha = data.sha;
      cloud.lastSync = nowISO();
      cloud.verified = true;
      cloud.pending = false;
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
    let changed = 0;

    // Exclusões feitas em qualquer aparelho viram tombstones no arquivo da nuvem.
    // Elas impedem que um convidado removido volte ao atualizar as respostas.
    const blocked = deletedGuestSet();
    const remoteDeleted = Array.isArray(remote.deletedGuestIds) ? remote.deletedGuestIds : [];
    remoteDeleted.forEach((rawId) => {
      const id = String(rawId || "").trim();
      if (!id) return;
      if (!blocked.has(id)) {
        blocked.add(id);
        if (!Array.isArray(state.deletedGuestIds)) state.deletedGuestIds = [];
        if (!state.deletedGuestIds.includes(id)) state.deletedGuestIds.push(id);
        changed++;
      }
      const before = state.guests.length;
      state.guests = state.guests.filter((guest) => guest.id !== id);
      if (state.guests.length !== before) changed++;
    });

    const byId = new Map(remote.guests.map((g) => [g.id, g]));
    state.guests.forEach((g) => {
      if (blocked.has(g.id)) return;
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

    const usedIds = new Set(state.guests.map((guest) => guest.id));
    remote.guests.forEach((raw) => {
      if (!raw || raw.unlisted !== true || usedIds.has(raw.id) || blocked.has(raw.id)) return;
      const record = makeGuestRecord(raw, usedIds);
      if (!record) return;
      state.guests.push(record);
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
        toast("Configure a nuvem em Editar festa para buscar respostas.", "warn");
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
      toast("Configure o GitHub em Editar festa para usar a nuvem.", "warn");
      openSettings();
      return;
    }
    if (savingCloud) {
      // Já existe um envio em andamento: garante um novo envio logo depois,
      // senão a alteração feita durante a sincronização nunca chegaria à nuvem.
      cloudQueued = true;
      return;
    }
    savingCloud = true;
    const savedStamp = state.updatedAt;
    // Salvar é sempre unidirecional: este dispositivo é a fonte da verdade.
    // O snapshot evita que uma leitura remota altere a tela durante o envio.
    const uploadState = normalizeState(JSON.parse(JSON.stringify(state)));
    setCloudPhase("syncing");
    if (opts.fromSettings) setConfigState("Enviando os dados para o GitHub…");

    try {
      await verifyPrivateRepo();
      const head = await gh("GET");
      let sha = head.notFound ? null : head.sha;

      if (!head.notFound) {
        let remoteState = null;
        try {
          remoteState = normalizeState(JSON.parse(b64decode(head.content)));
        } catch (e) {
          throw new Error("A versão da nuvem não pôde ser comparada com este dispositivo.");
        }
        const cloudChangedSinceSync = !cloud.sha || cloud.sha !== head.sha;
        if (cloudChangedSinceSync) {
          const remoteUpdatedAt = remoteState && Date.parse(remoteState.updatedAt || "")
            ? new Date(remoteState.updatedAt).toLocaleString("pt-BR")
            : "horário não informado";
          cloud.pending = true;
          dirty = true;
          saveCloudCfg();
          const conflictMessage =
            "A nuvem mudou em " + remoteUpdatedAt + ". Para não perder itens, carregue a versão online antes de salvar.";
          setCloudPhase("error", conflictMessage);
          if (opts.fromSettings) setConfigState(conflictMessage);
          if (!opts.silent) toast(conflictMessage, "warn");
          return;
        }
      }

      const content = b64encode(JSON.stringify(uploadState, null, 2));

      const body = {
        message:
          "checklist: atualizar festa do " + state.meta.name + " — " +
          new Date().toLocaleString("pt-BR"),
        content,
        branch: cloud.branch || "main",
      };
      if (sha) body.sha = sha;

      let result;
      try {
        result = await gh("PUT", body);
      } catch (writeError) {
        if (writeError.status !== 409 && writeError.status !== 422) throw writeError;
        const conflict = new Error("Outra versão foi salva enquanto este dispositivo enviava os dados. Carregue a nuvem antes de tentar novamente.");
        conflict.status = 409;
        throw conflict;
      }
      if (result && result.content && result.content.sha) {
        cloud.sha = result.content.sha;
      } else {
        cloud.sha = sha || "";
      }
      cloud.lastSync = nowISO();
      cloud.verified = true;
      saveCloudCfg();
      if (state.updatedAt === savedStamp) {
        dirty = false;
        cloud.pending = false;
      }
      saveCloudCfg();
      setCloudPhase("idle");
      if (opts.fromSettings) {
        setConfigState(
          sha
            ? "Enviado! A versão atual deste dispositivo substituiu a versão da nuvem."
            : "Enviado! O arquivo foi criado no GitHub."
        );
      }
      if (!opts.silent) {
        toast(sha ? "Versão atual salva na nuvem ☁️" : "Arquivo criado no GitHub ☁️", "ok");
      }
    } catch (e) {
      let msg = e.message || "erro desconhecido";
      if (e.status === 401) msg = "token inválido ou expirado.";
      if (e.status === 403) msg = "o token não tem permissão de escrita neste repositório.";
      if (e.status === 404) msg = "repositório, branch ou token sem acesso a este repositório.";
      if (e.status === 409 || e.status === 422) {
        msg = "outra versão foi salva ao mesmo tempo. Carregue a nuvem antes de tentar novamente.";
      }
      setCloudPhase("error", msg);
      if (opts.fromSettings) setConfigState("Não foi possível enviar: " + msg);
      if (!opts.silent) toast("Erro ao salvar: " + msg, "err");
    } finally {
      savingCloud = false;
      renderCloudBar();
      if (cloudQueued) {
        cloudQueued = false;
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => saveCloud({ silent: true }), 1200);
      }
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
      // Em telas de toque, focar o primeiro campo abre o teclado e pode deixar
      // a impressão de que o modal não abriu. Preserve o foco automático apenas
      // para mouse/trackpad e teclado.
      if (!window.matchMedia("(pointer: fine)").matches) return;
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

  function updateItemCalculatedTotal() {
    const quantity = Math.max(0, Number(String($("#itemQuantity").value || "").replace(",", ".")) || 0);
    const unitPrice = parseMoney($("#itemUnitPrice").value);
    const composed = $$("#subtaskRows [data-subtask-row]").reduce((sum, row) => {
      const subQuantity = Math.max(0, Number(String(row.querySelector('[data-subtask-field="quantity"]')?.value || "").replace(",", ".")) || 0);
      const subPrice = parseMoney(row.querySelector('[data-subtask-field="unitPrice"]')?.value || "");
      return sum + subQuantity * subPrice;
    }, 0);
    const shipping = parseMoney($("#itemShipping").value);
    const surcharge = parseMoney($("#itemSurcharge").value);
    const discount = parseMoney($("#itemDiscount").value);
    const base = composed > 0 ? composed : quantity * unitPrice;
    const total = Math.max(0, Math.round((base + shipping + surcharge - discount) * 100) / 100);
    $("#itemCost").value = total ? total.toFixed(2).replace(".", ",") : "";
    $("#itemCost").title = (composed > 0 ? "Subitens" : "Quantidade × preço unitário") + " + frete + acréscimo − desconto";
  }

  function renderPaymentRows() {
    const wrap = $("#paymentRows");
    if (!wrap) return;
    const methods = ["", "Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto"];
    wrap.innerHTML = editingPayments.length
      ? editingPayments.map((payment) => '<div class="payment-row" data-payment-id="' + esc(payment.id) + '" data-installment-number="' + (payment.installmentNumber || 0) + '" data-installment-count="' + (payment.installmentCount || 0) + '">' +
          '<label class="field-label">Data<input class="input" type="date" data-payment-field="date" value="' + esc(payment.date || "") + '"></label>' +
          '<label class="field-label">Valor (R$)<input class="input" inputmode="decimal" data-payment-field="amount" value="' + esc(payment.amount ? Number(payment.amount).toFixed(2).replace(".", ",") : "") + '" placeholder="0,00"></label>' +
          '<label class="field-label">Forma<select class="input" data-payment-field="method">' + methods.map((method) => '<option value="' + esc(method) + '"' + (method === payment.method ? " selected" : "") + '>' + esc(method || "Não informado") + '</option>').join("") + '</select></label>' +
          '<label class="payment-paid"><input type="checkbox" data-payment-field="paid"' + (payment.paid ? " checked" : "") + '><span>Pago</span></label>' +
          '<label class="field-label">Observação' + (payment.installmentCount > 1 ? '<span class="installment-tag">' + payment.installmentNumber + "/" + payment.installmentCount + "</span>" : "") + '<input class="input" maxlength="120" data-payment-field="note" value="' + esc(payment.note || "") + '" placeholder="Ex.: sinal"></label>' +
          '<label class="field-label">Comprovante (link)<input class="input" type="url" data-payment-field="receiptUrl" value="' + esc(payment.receiptUrl || "") + '" placeholder="https://…"></label>' +
          '<button class="icon-btn payment-remove" type="button" data-payment-remove="' + esc(payment.id) + '" aria-label="Remover pagamento">🗑</button>' +
        "</div>").join("")
      : '<div class="payment-empty">Nenhum pagamento registrado.</div>';
    const totalPaid = editingPayments.reduce((sum, payment) => sum + (payment.paid ? parseMoney(payment.amount) : 0), 0);
    $("#itemPaid").value = totalPaid ? totalPaid.toFixed(2).replace(".", ",") : "";
  }

  function collectPaymentsFromRows() {
    editingPayments = $$("#paymentRows [data-payment-id]").map((row) => ({
      id: row.dataset.paymentId,
      date: row.querySelector('[data-payment-field="date"]').value,
      amount: parseMoney(row.querySelector('[data-payment-field="amount"]').value),
      method: row.querySelector('[data-payment-field="method"]').value,
      note: row.querySelector('[data-payment-field="note"]').value.trim().slice(0, 120),
      receiptUrl: safeUrl(row.querySelector('[data-payment-field="receiptUrl"]').value),
      installmentNumber: parseInt(row.dataset.installmentNumber, 10) || 0,
      installmentCount: parseInt(row.dataset.installmentCount, 10) || 0,
      paid: row.querySelector('[data-payment-field="paid"]').checked,
    })).filter((payment) => payment.amount > 0);
    return editingPayments;
  }

  function addPaymentRow() {
    collectPaymentsFromRows();
    editingPayments.push({ id: uid(), date: todayISO(), amount: 0, method: "Pix", note: "", receiptUrl: "", paid: false, installmentNumber: 0, installmentCount: 0 });
    renderPaymentRows();
    const rows = $$("#paymentRows [data-payment-id]");
    const last = rows[rows.length - 1];
    if (last) last.querySelector('[data-payment-field="amount"]').focus();
  }

  function addMonthsISO(date, months) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T12:00:00") : new Date();
    const day = parsed.getDate();
    parsed.setDate(1);
    parsed.setMonth(parsed.getMonth() + months);
    parsed.setDate(Math.min(day, new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate()));
    return parsed.toLocaleDateString("sv-SE");
  }

  function generateCreditInstallments() {
    collectPaymentsFromRows();
    updateItemCalculatedTotal();
    const total = parseMoney($("#itemCost").value);
    const count = Math.max(2, Math.min(12, parseInt($("#installmentCount").value, 10) || 2));
    const firstDate = $("#installmentFirstDate").value;
    if (!total) {
      toast("Informe o valor do item ou dos subitens antes de gerar as parcelas.", "warn");
      return;
    }
    if (!firstDate) {
      toast("Informe a data do primeiro vencimento.", "warn");
      $("#installmentFirstDate").focus();
      return;
    }
    const retained = editingPayments.filter((payment) => !(payment.method === "Cartão de crédito" && payment.installmentCount > 1));
    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents - baseCents * count;
    const generated = Array.from({ length: count }, (_, index) => ({
      id: uid(),
      date: addMonthsISO(firstDate, index),
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
      method: "Cartão de crédito",
      note: "Parcela " + (index + 1) + " de " + count,
      receiptUrl: "",
      paid: false,
      installmentNumber: index + 1,
      installmentCount: count,
    }));
    editingPayments = retained.concat(generated);
    renderPaymentRows();
    toast(count + " parcelas do cartão geradas.", "ok");
  }

  function renderSubtaskRows() {
    const wrap = $("#subtaskRows");
    if (!wrap) return;
    wrap.innerHTML = editingSubtasks.length
      ? editingSubtasks.map((subtask) => '<div class="subtask-editor-row" data-subtask-row="' + esc(subtask.id) + '">' +
          '<input type="checkbox" data-subtask-field="done"' + (subtask.done ? " checked" : "") + ' aria-label="Subitem concluído">' +
          '<label class="field-label subtask-title">Descrição<input class="input" maxlength="160" data-subtask-field="title" value="' + esc(subtask.title) + '" placeholder="Ex.: Cachorro Tubet Toy Story"></label>' +
          '<label class="field-label">Qtd.<input class="input" inputmode="decimal" data-subtask-field="quantity" value="' + esc(String(subtask.quantity || 1).replace(".", ",")) + '"></label>' +
          '<label class="field-label">Unidade<select class="input" data-subtask-field="unit">' + ["un.", "pacote", "caixa", "cento", "pessoa", "kg", "litro"].map((unit) => '<option value="' + unit + '"' + (unit === (subtask.unit || "un.") ? " selected" : "") + '>' + unit + "</option>").join("") + "</select></label>" +
          '<label class="field-label">Unitário (R$)<input class="input" inputmode="decimal" data-subtask-field="unitPrice" value="' + esc(subtask.unitPrice ? Number(subtask.unitPrice).toFixed(2).replace(".", ",") : "") + '" placeholder="0,00"></label>' +
          '<output class="subtask-total money">' + (num(subtask.cost) ? money(subtask.cost) : "R$ 0,00") + "</output>" +
          '<button class="icon-btn" type="button" data-subtask-remove="' + esc(subtask.id) + '" aria-label="Remover subitem">🗑</button>' +
        "</div>").join("")
      : '<div class="payment-empty">Nenhum subitem. Adicione apenas quando a tarefa tiver etapas menores.</div>';
  }

  function collectSubtasksFromRows() {
    editingSubtasks = $$("#subtaskRows [data-subtask-row]").map((row) => ({
      id: row.dataset.subtaskRow,
      title: row.querySelector('[data-subtask-field="title"]').value.trim().slice(0, 160),
      done: row.querySelector('[data-subtask-field="done"]').checked,
      quantity: Math.max(0.01, Number(String(row.querySelector('[data-subtask-field="quantity"]').value || "1").replace(",", ".")) || 1),
      unit: row.querySelector('[data-subtask-field="unit"]').value,
      unitPrice: parseMoney(row.querySelector('[data-subtask-field="unitPrice"]').value),
    })).filter((subtask) => subtask.title);
    editingSubtasks.forEach((subtask) => { subtask.cost = Math.round(subtask.quantity * subtask.unitPrice * 100) / 100; });
    return editingSubtasks;
  }

  function addSubtaskRow() {
    collectSubtasksFromRows();
    editingSubtasks.push({ id: uid(), title: "", done: false, quantity: 1, unit: "un.", unitPrice: 0, cost: 0 });
    renderSubtaskRows();
    const rows = $$("#subtaskRows [data-subtask-row]");
    const last = rows[rows.length - 1];
    if (last) last.querySelector('[data-subtask-field="title"]').focus();
  }

  function openItemModal(id, preferredStage) {
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
      const quantity = Math.max(0.01, Number(item.quantity) || 1);
      const hasComposedCost = Array.isArray(item.subtasks) && item.subtasks.some((subtask) => num(subtask.cost) > 0);
      const unitPrice = hasComposedCost ? num(item.unitPrice) : (num(item.unitPrice) || (num(item.cost) / quantity));
      $("#itemQuantity").value = String(quantity);
      $("#itemUnit").value = item.unit || "un.";
      $("#itemUnitPrice").value = unitPrice ? String(unitPrice).replace(".", ",") : "";
      $("#itemShipping").value = item.shipping ? String(item.shipping).replace(".", ",") : "";
      $("#itemSurcharge").value = item.surcharge ? String(item.surcharge).replace(".", ",") : "";
      $("#itemDiscount").value = item.discount ? String(item.discount).replace(".", ",") : "";
      updateItemCalculatedTotal();
      editingPayments = (Array.isArray(item.payments) ? item.payments : []).map((payment) => Object.assign({}, payment));
      if (!editingPayments.length && item.paid) editingPayments = [{ id: uid(), amount: item.paid, date: "", method: "", note: "Pagamento anterior", paid: true }];
      renderPaymentRows();
      $("#itemDue").value = item.due || "";
      $("#itemOrderNumber").value = item.orderNumber || "";
      $("#itemDeliveryDate").value = item.deliveryDate || "";
      $("#itemDeliveryStatus").value = item.deliveryStatus || "";
      $("#itemSupplier").value = item.supplier || "";
      $("#itemSupplierPhone").value = formatPhoneBR(item.supplierPhone || "");
      $("#itemSupplierInstagram").value = item.supplierInstagram ? "@" + item.supplierInstagram : "";
      $("#itemLink").value = item.link || "";
      $("#itemNotes").value = item.notes || "";
      editingSubtasks = (Array.isArray(item.subtasks) ? item.subtasks : []).map((subtask) => Object.assign({}, subtask));
      renderSubtaskRows();
      updateItemCalculatedTotal();
      $("#installmentFirstDate").value = item.due || todayISO();
      $("#itemModalTitle").textContent = "Editar item";
      $("#deleteItemBtn").hidden = false;
    } else {
      $("#itemStatus").value = "todo";
      const filterStage = $("#stageFilter").value;
      $("#itemStage").value = preferredStage || filterStage || "planejamento";
      $("#itemQuantity").value = "1";
      $("#itemUnit").value = "un.";
      $("#itemUnitPrice").value = "";
      $("#itemShipping").value = "";
      $("#itemSurcharge").value = "";
      $("#itemDiscount").value = "";
      updateItemCalculatedTotal();
      $("#itemDue").value = "";
      editingPayments = [];
      renderPaymentRows();
      editingSubtasks = [];
      renderSubtaskRows();
      $("#installmentFirstDate").value = todayISO();
      if (preferredStage) {
        collapsed.delete(preferredStage);
        saveCollapsed();
      }
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

    const quantity = Math.max(0.01, Number(String($("#itemQuantity").value || "1").replace(",", ".")) || 1);
    const unitPrice = parseMoney($("#itemUnitPrice").value);
    if (!isValidPhone($("#itemSupplierPhone").value)) {
      toast("Confira o telefone do fornecedor e inclua o código do país.", "warn");
      $("#itemSupplierPhone").focus();
      return;
    }
    const payments = collectPaymentsFromRows();
    const subtasks = collectSubtasksFromRows();
    const composedCost = subtasks.reduce((sum, subtask) => sum + num(subtask.cost), 0);
    const shipping = parseMoney($("#itemShipping").value);
    const surcharge = parseMoney($("#itemSurcharge").value);
    const discount = parseMoney($("#itemDiscount").value);
    const baseCost = composedCost > 0 ? composedCost : quantity * unitPrice;
    const data = {
      title,
      stage: $("#itemStage").value,
      status: $("#itemStatus").value,
      quantity,
      unit: $("#itemUnit").value,
      unitPrice,
      cost: Math.max(0, Math.round((baseCost + shipping + surcharge - discount) * 100) / 100),
      shipping,
      surcharge,
      discount,
      paid: Math.round(payments.reduce((sum, payment) => sum + (payment.paid ? payment.amount : 0), 0) * 100) / 100,
      payments,
      supplier: $("#itemSupplier").value.trim(),
      supplierPhone: normalizePhone($("#itemSupplierPhone").value),
      supplierInstagram: instagramHandle($("#itemSupplierInstagram").value),
      due: $("#itemDue").value,
      orderNumber: $("#itemOrderNumber").value.trim().slice(0, 80),
      deliveryDate: $("#itemDeliveryDate").value,
      deliveryStatus: $("#itemDeliveryStatus").value,
      link: $("#itemLink").value.trim(),
      notes: $("#itemNotes").value.trim(),
      subtasks,
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

    addActivity("update", (id ? "Item atualizado: " : "Item adicionado: ") + title);
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
    addActivity("update", "Item excluído: " + item.title);
    touch();
    closeModal($("#itemModal"));
    renderAll();
    toast("Item excluído.", "ok");
  }

  /* ---------- Convidado: editar / excluir ---------- */

  function guestById(id) {
    return state.guests.find((g) => g.id === id) || null;
  }

  function linkedConfirmedChildren(guest) {
    if (!guest || guest.type !== "adult") return [];
    return state.guests.filter(
      (child) =>
        child.type === "child" &&
        child.status === "confirmed" &&
        Array.isArray(child.guardians) &&
        child.guardians.includes(guest.id)
    );
  }

  function applyGuardianStatusChange(guest, nextStatus) {
    const previousStatus = guest.status;
    if (guest.type !== "adult" || nextStatus === "confirmed" || nextStatus === previousStatus) {
      guest.status = nextStatus;
      return true;
    }

    const children = linkedConfirmedChildren(guest);
    if (!children.length) {
      guest.status = nextStatus;
      return true;
    }

    const names = children.map((child) => displayGuestName(child)).join(", ");
    const proceed = window.confirm(
      displayGuestName(guest) + " tem " + (children.length === 1 ? "uma criança confirmada" : children.length + " crianças confirmadas") +
      " vinculada(s): " + names + ".\n\nDeseja realmente alterar o adulto para “" +
      (GUEST_STATUS[nextStatus] || GUEST_STATUS.pending).label + "”?"
    );
    if (!proceed) return false;

    const keepChildren = window.confirm(
      "As crianças continuarão confirmadas mesmo sem este adulto?\n\n" +
      "OK: manter as crianças confirmadas.\nCancelar: alterar as crianças para “" +
      (GUEST_STATUS[nextStatus] || GUEST_STATUS.pending).label + "”."
    );
    guest.status = nextStatus;
    if (!keepChildren) {
      children.forEach((child) => {
        child.status = nextStatus;
        child.rsvpAt = nowISO();
        child.rsvpSource = "owner";
        addActivity("rsvp", displayGuestName(child) + ": " + (GUEST_STATUS[nextStatus] || GUEST_STATUS.pending).label + " (com responsável)");
      });
    }
    return true;
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
      relation: "",
      type: "adult",
      status: "pending",
      phone: "",
      notes: "",
      guardians: [],
    };

    $("#guestEditId").value = guest ? guest.id : "";
    $("#guestEditName").value = draft.name;
    $("#guestEditRelation").value = draft.relation || "";
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

    const phoneRaw = $("#guestEditPhone").value;
    if (!isValidPhone(phoneRaw)) {
      toast(
        "Telefone incompleto: informe DDD + número (10 ou 11 dígitos) ou deixe em branco.",
        "err"
      );
      $("#guestEditPhone").focus();
      return;
    }

    if (existing && existing.type === "adult" && type === "adult" &&
        !applyGuardianStatusChange(existing, status)) return;

    let guest = existing;
    if (!guest) {
      const usedIds = new Set(state.guests.map((g) => g.id));
      guest = makeGuestRecord({ name, type, status }, usedIds);
      if (!guest) return;
      state.guests.push(guest);
      reviveGuest(guest.id);
    } else if (type !== guest.type) {
      state.guests.forEach((g) => {
        if (g.type === "child" && Array.isArray(g.guardians)) {
          g.guardians = g.guardians.filter((id) => id !== guest.id);
        }
      });
    }

    guest.name = name;
    guest.relation = String($("#guestEditRelation").value || "").trim().slice(0, 32);
    guest.type = type;
    guest.status = status;
    guest.phone = normalizePhone(phoneRaw);
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
      const count = countableGuests(state.guests).filter((g) => g.type === type).length;
      if (!isHostGuest(guest) && count > max) {
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
    addActivity("guest", displayGuestName(guest) + " foi removido da lista");
    markGuestDeleted(guest.id);
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

  function openSettings(focusStageNames) {
    const meta = state.meta;
    const guess = guessRepoFromHost();
    $("#setName").value = meta.name;
    $("#setAge").value = meta.age;
    $("#setDate").value = meta.date;
    $("#setRsvpDeadline").value = meta.rsvpDeadline || "";
    $("#setTime").value = meta.time;
    $("#setLocation").value = meta.location || "";
    $("#setMapsUrl").value = meta.mapsUrl || "";
    $("#setFatherPhone").value = formatPhoneBR(meta.fatherPhone || "");
    $("#setMotherPhone").value = formatPhoneBR(meta.motherPhone || "");
    $("#setBudget").value = meta.budget ? String(meta.budget).replace(".", ",") : "";
    $("#setMaxAdults").value = meta.maxAdults;
    $("#setMaxChildren").value = meta.maxChildren;
    $("#stageNamesFields").innerHTML = STAGES
      .map((stage) => {
        const name = meta.stageNames && meta.stageNames[stage.id] || stage.name;
        return '<label class="field-label stage-name-field">' + esc(stage.name) +
          '<input class="input" type="text" maxlength="48" data-stage-name="' + esc(stage.id) +
          '" value="' + esc(name) + '" aria-label="Nome da etapa ' + esc(stage.name) + '" /></label>';
      })
      .join("");
    $("#setOwner").value = cloud.owner || (guess ? guess.owner : "");
    $("#setRepo").value = cloud.repo || (guess ? guess.repo : "");
    $("#setBranch").value = cloud.branch || "main";
    $("#setPath").value = cloud.path || "data.json";
    $("#setToken").value = cloud.token || "";
    $("#setAuto").checked = !!cloud.auto;
    $("#setPublicRepo").value = cloud.publicRepo || "";
    $("#setPublicBranch").value = cloud.publicBranch || "main";
    $("#setPublicToken").value = cloud.publicToken || "";
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
    renderBackupState();
    openModal($("#settingsModal"));
    if (focusStageNames) {
      requestAnimationFrame(() => {
        $("#stageNamesTitle").scrollIntoView({ behavior: "smooth", block: "center" });
        $("[data-stage-name]").focus({ preventScroll: true });
      });
    }
  }

  function readCloudForm() {
    cloud.owner = $("#setOwner").value.trim();
    cloud.repo = $("#setRepo").value.trim();
    cloud.branch = $("#setBranch").value.trim() || "main";
    cloud.path = $("#setPath").value.trim() || "data.json";
    cloud.token = $("#setToken").value.trim();
    cloud.auto = $("#setAuto").checked;
    cloud.publicRepo = $("#setPublicRepo").value.trim();
    cloud.publicBranch = $("#setPublicBranch").value.trim() || "main";
    cloud.publicToken = $("#setPublicToken").value.trim();

    const identity = [cloud.owner, cloud.repo, cloud.branch, cloud.path, cloud.token].join("|");
    if (cloud._identity && cloud._identity !== identity) {
      cloud.verified = false;
      cloud.privateVerified = false;
    }
    cloud._identity = identity;

    if (!cloud.owner && !cloud.repo && !cloud.token && !cloud.publicRepo && !cloud.publicToken) {
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
    meta.rsvpDeadline = /^\d{4}-\d{2}-\d{2}$/.test($("#setRsvpDeadline").value)
      ? $("#setRsvpDeadline").value
      : meta.rsvpDeadline;
    meta.time = $("#setTime").value || "18:00";
    meta.location = $("#setLocation").value.trim();
    meta.mapsUrl = safeUrl($("#setMapsUrl").value.trim());
    meta.fatherPhone = normalizePhone($("#setFatherPhone").value);
    meta.motherPhone = normalizePhone($("#setMotherPhone").value);
    meta.budget = parseMoney($("#setBudget").value);
    meta.maxAdults = Math.min(999, Math.max(1, parseInt($("#setMaxAdults").value, 10) || 50));
    meta.maxChildren = Math.min(999, Math.max(1, parseInt($("#setMaxChildren").value, 10) || 25));
    meta.stageNames = {};
    $$('[data-stage-name]').forEach((input) => {
      const stage = STAGES.find((s) => s.id === input.dataset.stageName);
      const custom = String(input.value || "").trim().slice(0, 48);
      if (stage && custom && custom !== stage.name) meta.stageNames[stage.id] = custom;
    });
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
    fillStageSelects();
    renderAll();

    if (needsUpload) {
      const send = window.confirm(
        "Festa atualizada!\n\nAinda não há dados deste aparelho no GitHub.\n\n" +
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
      toast("Festa atualizada.", "ok");
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
      await verifyPrivateRepo();
      const data = await gh("GET");
      status.textContent = data.notFound
        ? "Repositório privado conectado! Envie os dados para criar o arquivo."
        : "Repositório privado conectado e arquivo encontrado.";
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
        createAutomaticBackup("antes de importar um arquivo JSON");
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

  function parseCsvRows(text) {
    const source = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const firstLine = source.split(/\r?\n/, 1)[0] || "";
    const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < source.length; index++) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && source[index + 1] === "\n") index++;
        row.push(cell.trim());
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some((value) => value !== "")) rows.push(row);
    return rows;
  }

  function csvKey(value) {
    return norm(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function csvObjects(text) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(csvKey);
    return rows.slice(1).map((cells, rowIndex) => {
      const object = { _row: rowIndex + 2 };
      headers.forEach((header, index) => { if (header) object[header] = cells[index] || ""; });
      return object;
    });
  }

  function downloadCsvTemplate(filename, lines) {
    const blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------- Convite ---------- */

  const INVITE_RELEASE = "20261110p12";

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

  function animatedInviteUrl() {
    try {
      const url = new URL("convite-animado.html", location.href);
      url.search = "";
      url.searchParams.set("v", INVITE_RELEASE);
      url.hash = "";
      return url.href;
    } catch (e) {
      return "convite-animado.html";
    }
  }

  function guestInviteUrl(guest) {
    const key = guest && guest.id ? String(guest.id) : guestKey(guest.name, guest.type);
    return invitePageUrl() + "?convite=" + encodeURIComponent(key);
  }

  function guestAnimatedInviteUrl(guest) {
    const key = guest && guest.id ? String(guest.id) : guestKey(guest.name, guest.type);
    try {
      const url = new URL(animatedInviteUrl(), location.href);
      url.searchParams.set("convite", key);
      return url.href;
    } catch (e) {
      return "convite-animado.html?v=" + encodeURIComponent(INVITE_RELEASE) + "&convite=" + encodeURIComponent(key);
    }
  }

  function inviteMessageText(options) {
    const opts = options || {};
    return opts.animatedUrl || animatedInviteUrl();
  }

  function waInviteLink(guest) {
    const phone = internationalPhoneDigits(guest && guest.phone);
    if (!phone) return "";
    const text = inviteMessageText({
      animatedUrl: guestAnimatedInviteUrl(guest),
    });
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
  }

  function waReminderLink(guest) {
    const phone = internationalPhoneDigits(guest && guest.phone);
    if (!phone) return "";
    const firstName = String(guest && guest.name || "").trim().split(/\s+/)[0];
    const text = "Oi" + (firstName ? ", " + firstName : "") +
      "! Passando para lembrar do aniversário do " + (state.meta.name || "Ben") + " 🎉 " +
      "Você consegue confirmar sua presença até " + fmtDate(state.meta.rsvpDeadline) + "? " +
      guestAnimatedInviteUrl(guest);
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
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

  async function copyInviteLink() {
    const ok = await copyText(invitePageUrl());
    toast(ok ? "Link do convite copiado." : "Não foi possível copiar automaticamente.", ok ? "ok" : "err");
  }

  async function copyLinkWithToast(url, message) {
    const ok = await copyText(url);
    toast(ok ? message : "Não foi possível copiar automaticamente.", ok ? "ok" : "err");
  }

  function renderInvitePreview() {
    const el = $("#invitePreview");
    if (!el) return;

    const name = (($("#invName") && $("#invName").value) || state.meta.name || "Ben").trim().slice(0, 40);
    const age = parseInt($("#invAge") && $("#invAge").value, 10) || state.meta.age;
    const date = ($("#invDate") && $("#invDate").value) || state.meta.date;
    const rsvpDeadline = ($("#invRsvpDeadline") && $("#invRsvpDeadline").value) || state.meta.rsvpDeadline;
    const time = ($("#invTime") && $("#invTime").value) || state.meta.time;
    const location = (($("#invLocation") && $("#invLocation").value) || "").trim();
    const customMap = safeUrl($("#invMapsUrl") && $("#invMapsUrl").value);
    const map = customMap || (location ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location) : "");

      const blocks = Array.from(name.toUpperCase()).map((letter, index) =>
      '<span class="hero-name-block block-' + (index % 3) + '" aria-hidden="true">' + esc(letter) + "</span>"
    ).join("");

    const chips = [];
    chips.push('<span class="invite-preview-chip">📅 ' + esc(longDate(date)) + "</span>");
    if (time) chips.push('<span class="invite-preview-chip">⏰ ' + esc(time.replace(":", "h")) + "</span>");
    if (rsvpDeadline) chips.push('<span class="invite-preview-chip">⏳ Confirmar até ' + esc(longDate(rsvpDeadline)) + "</span>");
    if (location) {
      chips.push(
        map
          ? '<a class="invite-preview-chip" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">📍 ' + esc(location) + " ↗</a>"
          : '<span class="invite-preview-chip">📍 ' + esc(location) + "</span>"
      );
    }

    el.innerHTML =
      '<span class="invite-preview-label">Prévia do convite</span>' +
      '<div class="invite-preview-title">' +
        '<span class="hero-name-blocks" role="img" aria-label="' + esc(name) + '">' + blocks + "</span>" +
        " faz " + esc(String(age)) + "!" +
      "</div>" +
      '<div class="invite-preview-chips">' + chips.join("") + "</div>";
  }

  function renderInviteView() {
    const meta = state.meta;
    const animated = animatedInviteUrl();
    const confirm = invitePageUrl();

    const animatedInput = $("#animatedInviteLink");
    if (animatedInput) animatedInput.value = animated;
    const confirmInput = $("#confirmInviteLink");
    if (confirmInput) confirmInput.value = confirm;
    const openAnimated = $("#openAnimatedInviteLink");
    if (openAnimated) openAnimated.href = animated;
    const openConfirm = $("#openConfirmInviteLink");
    if (openConfirm) openConfirm.href = confirm;

    const setValue = (selector, value) => {
      const el = $(selector);
      if (el) el.value = value;
    };
    setValue("#invName", meta.name);
    setValue("#invAge", meta.age);
    setValue("#invDate", meta.date);
    setValue("#invRsvpDeadline", meta.rsvpDeadline || "");
    setValue("#invTime", meta.time);
    setValue("#invLocation", meta.location || "");
    setValue("#invMapsUrl", meta.mapsUrl || "");
    setValue("#invRsvpUrl", meta.rsvpUrl || "");
    setValue("#invMode", meta.inviteMode === "links" ? "links" : "search");
    Object.keys(INVITE_FIELD_IDS).forEach((key) => {
      setValue("#" + INVITE_FIELD_IDS[key], meta.invite[key] || INVITE_COPY_DEFAULTS[key]);
    });
    setValue("#invGiftSuggestions", (meta.giftSuggestions || []).join("\n"));

    const publishState = $("#publishInviteState");
    if (publishState && cloud.lastPublish) {
      publishState.textContent = "Último envio do convite: " +
        new Date(cloud.lastPublish).toLocaleString("pt-BR");
    }

    renderInvitePreview();
  }

  function collectInviteMeta() {
    const meta = state.meta;
    const name = ($("#invName").value || "").trim();
    if (!name) {
      toast("Informe o nome do aniversariante.", "err");
      $("#invName").focus();
      return false;
    }

    const rsvpValue = $("#invRsvpUrl").value.trim();
    const rsvpUrl = safeUrl(rsvpValue);
    if (rsvpValue && !rsvpUrl) {
      toast("A URL do Apps Script precisa começar com https://", "err");
      $("#invRsvpUrl").focus();
      return false;
    }

    const date = $("#invDate").value;
    const time = $("#invTime").value;

    meta.name = name.slice(0, 40);
    meta.age = Math.min(99, Math.max(1, parseInt($("#invAge").value, 10) || meta.age));
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) meta.date = date;
    const rsvpDeadline = $("#invRsvpDeadline").value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rsvpDeadline)) meta.rsvpDeadline = rsvpDeadline;
    if (/^\d{2}:\d{2}$/.test(time)) meta.time = time;
    meta.location = $("#invLocation").value.trim().slice(0, 120);
    meta.mapsUrl = safeUrl($("#invMapsUrl").value.trim());
    meta.rsvpUrl = rsvpUrl;
    meta.inviteMode = $("#invMode").value === "links" ? "links" : "search";

    const giftField = $("#invGiftSuggestions");
    const gifts = giftField
      ? giftField.value.split(/\r?\n/).map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, 6)
      : [];
    meta.giftSuggestions = gifts.length ? gifts : defaultGiftSuggestions();

    if (!meta.invite || typeof meta.invite !== "object") meta.invite = defaultInviteCopy();
    Object.keys(INVITE_COPY_DEFAULTS).forEach((key) => {
      const field = $("#" + INVITE_FIELD_IDS[key]);
      if (!field) return;
      const value = String(field.value || "").trim().slice(0, 400);
      meta.invite[key] = value || INVITE_COPY_DEFAULTS[key];
    });

    return true;
  }

  function handleInviteSubmit(event) {
    event.preventDefault();
    if (!collectInviteMeta()) return;
    touch();
    renderAll();
    renderInviteView();
    closeModal($("#inviteSettingsModal"));
    toast("Configurações do convite salvas.", "ok");
    if (publicRepoInfo() && publicPublishToken()) {
      publishInvite();
    }
  }

  /* ---------- Publicação do convite público ---------- */

  function publicRepoInfo() {
    const custom = String(cloud.publicRepo || "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "");
    if (custom) {
      const parts = custom.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
          branch: cloud.publicBranch || "main",
        };
      }
    }
    const guessed = guessRepoFromHost();
    if (!guessed) return null;
    return {
      owner: guessed.owner,
      repo: guessed.repo,
      branch: cloud.publicBranch || "main",
    };
  }

  function publicPublishToken() {
    return String(cloud.publicToken || cloud.token || "").trim();
  }

  function publicEventPayload() {
    const meta = state.meta;
    return {
      version: 1,
      meta: {
        name: meta.name,
        age: meta.age,
        date: meta.date,
        rsvpDeadline: meta.rsvpDeadline,
        time: meta.time,
        location: meta.location,
        theme: meta.theme,
        rsvpUrl: meta.rsvpUrl,
        mapsUrl: meta.mapsUrl,
        inviteMode: meta.inviteMode,
        giftSuggestions: Array.isArray(meta.giftSuggestions)
          ? meta.giftSuggestions.slice(0, 6)
          : defaultGiftSuggestions(),
        invite: Object.assign({}, INVITE_COPY_DEFAULTS, meta.invite || {}),
      },
    };
  }

  async function ghPublic(method, body) {
    const info = publicRepoInfo();
    const token = publicPublishToken();
    if (!info) throw new Error("não consegui detectar o repositório público do site.");
    if (!token) throw new Error("configure o token para publicar o convite.");

    const headers = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (body) headers["Content-Type"] = "application/json";

    let url =
      "https://api.github.com/repos/" +
      encodeURIComponent(info.owner) + "/" + encodeURIComponent(info.repo) +
      "/contents/event.json";
    if (method === "GET") url += "?ref=" + encodeURIComponent(info.branch);

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (res.status === 404) return { notFound: true };

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || "Erro " + res.status + " na API do GitHub");
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function verifyPublicRepo() {
    const info = publicRepoInfo();
    const token = publicPublishToken();
    if (!info) throw new Error("não consegui detectar o repositório público do site.");
    if (!token) throw new Error("configure o token para publicar o convite.");

    const res = await fetch(
      "https://api.github.com/repos/" + encodeURIComponent(info.owner) + "/" + encodeURIComponent(info.repo),
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || "Não foi possível verificar o repositório público.");
      error.status = res.status;
      throw error;
    }
    if (data.private) {
      throw new Error("o repositório configurado é privado; o convite precisa de um repositório público.");
    }
    return data;
  }

  async function publishInvite() {
    const status = $("#publishInviteState");
    const setStatus = (text) => {
      if (status) status.textContent = text;
    };

    if (!publicRepoInfo() || !publicPublishToken()) {
      setStatus("Salvo neste aparelho. Para atualizar o convite no site, configure repositório e token em Editar festa.");
      return false;
    }

    setStatus("Publicando o convite no site…");

    try {
      await verifyPublicRepo();
      const payload = JSON.stringify(publicEventPayload(), null, 2) + "\n";

      for (let attempt = 0; attempt < 2; attempt++) {
        const head = await ghPublic("GET");
        const body = {
          message: "convite: atualizar textos e dados públicos — " + new Date().toLocaleString("pt-BR"),
          content: b64encode(payload),
          branch: publicRepoInfo().branch,
        };
        if (!head.notFound) body.sha = head.sha;

        try {
          await ghPublic("PUT", body);
          cloud.lastPublish = nowISO();
          saveCloudCfg();
          setStatus("Convite publicado! O GitHub Pages atualiza em alguns minutos.");
          toast("Convite publicado no site 🚀", "ok");
          return true;
        } catch (error) {
          if (attempt === 0 && (error.status === 409 || error.status === 422)) continue;
          throw error;
        }
      }
    } catch (error) {
      let message = error.message || "erro desconhecido";
      if (error.status === 401) message = "token inválido ou expirado.";
      if (error.status === 403) message = "o token não tem permissão de escrita no repositório público.";
      if (error.status === 404) message = "repositório público não encontrado ou token sem acesso.";
      if (error.status === 409 || error.status === 422) {
        message = "outra publicação aconteceu ao mesmo tempo. Tente de novo.";
      }
      setStatus("Não foi possível publicar: " + message);
      toast("Não foi possível publicar o convite: " + message, "err");
      return false;
    }
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
    const v = norm(value).replace(/[_-]+/g, " ");
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
              relation: o.relation || o.parentesco || o.relationship || "",
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

    const csvRows = csvObjects(raw);
    if (csvRows.length && Object.keys(csvRows[0]).some((key) => ["nome", "name", "convidado"].includes(key))) {
      const guests = csvRows.map((row) => ({
        name: cleanGuestName(row.nome || row.name || row.convidado),
        type: parseGuestType(row.tipo || row.type, "adult"),
        status: parseGuestStatus(row.status || row.confirmacao),
        phone: row.celular || row.telefone || row.whatsapp || row.phone || "",
        relation: row.parentesco || row.relacao || row.relation || "",
        notes: row.observacoes || row.observacao || row.notes || "",
      })).filter((guest) => guest.name);
      return dedupeGuestList(guests);
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
    $("#guestImportResults").hidden = false;

    const counted = countableGuests(parsed.guests);
    const hosts = parsed.guests.length - counted.length;
    const adults = counted.filter((g) => g.type === "adult").length;
    const kids = counted.filter((g) => g.type === "child").length;
    $("#guestImportSummary").textContent =
      counted.length +
      " convidado(s) " + sourceLabel + ": " +
      adults + " adulto(s) e " + kids + " criança(s)." +
      (hosts ? " " + hosts + " anfitrião(ões) fora da contagem." : "");

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
      state.deletedGuestIds = [];
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
        reviveGuest(record.id);
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

  function openGuestImportGuide() {
    pendingGuestImport = null;
    $("#guestImportResults").hidden = true;
    $("#guestImportSummary").textContent = "";
    $("#guestImportPreview").innerHTML = "";
    $("#guestImportDupes").hidden = true;
    openModal($("#guestImportModal"));
  }

  let pendingChecklistImport = null;

  function parseChecklistStatus(value) {
    const key = csvKey(value);
    if (["concluido", "concluida", "done", "finalizado"].includes(key)) return "done";
    if (["contratado", "contratada", "contracted"].includes(key)) return "contracted";
    if (["em_andamento", "andamento", "doing"].includes(key)) return "doing";
    return "todo";
  }

  function parseChecklistStage(value) {
    const key = csvKey(value);
    if (!key) return "planejamento";
    const found = stageList().find((stage) => csvKey(stage.id) === key || csvKey(stage.name) === key);
    return found ? found.id : "";
  }

  function parseChecklistUnit(value) {
    const key = csvKey(value);
    const units = {
      un: "un.", unidade: "un.", unidades: "un.", pacote: "pacote", pacotes: "pacote",
      caixa: "caixa", caixas: "caixa", cento: "cento", pessoa: "pessoa", pessoas: "pessoa",
      kg: "kg", quilograma: "kg", litro: "litro", litros: "litro",
    };
    return units[key] || "un.";
  }

  function parseChecklistCsv(text) {
    const rows = csvObjects(text);
    const items = [];
    const warnings = [];
    rows.forEach((row) => {
      const title = String(row.item || row.titulo || row.title || "").trim();
      if (!title) {
        warnings.push("Linha " + row._row + ": item sem nome.");
        return;
      }
      const stageValue = row.etapa || row.stage || "planejamento";
      const stage = parseChecklistStage(stageValue);
      if (!stage) {
        warnings.push("Linha " + row._row + ': etapa "' + stageValue + '" não reconhecida; usado Planejamento.');
      }
      const quantity = Math.max(0.01, Number(String(row.quantidade || row.qtd || "1").replace(",", ".")) || 1);
      const unitPrice = parseMoney(row.preco_unitario || row.valor_unitario || row.unitario || 0);
      const paid = parseMoney(row.total_pago || row.pago || 0);
      const dueRaw = String(row.vencimento || row.data || "").trim();
      const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : "";
      if (dueRaw && !due) warnings.push("Linha " + row._row + ": vencimento deve usar AAAA-MM-DD.");
      items.push({
        id: uid(), title: title.slice(0, 200), stage: stage || "planejamento",
        status: parseChecklistStatus(row.status), quantity, unit: parseChecklistUnit(row.unidade || row.unit),
        unitPrice, cost: Math.max(0, Math.round((quantity * unitPrice + parseMoney(row.frete || 0) + parseMoney(row.acrescimo || 0) - parseMoney(row.desconto || 0)) * 100) / 100), paid,
        payments: paid ? [{ id: uid(), amount: paid, date: "", method: "", note: "Valor importado do CSV", paid: true }] : [],
        supplier: String(row.fornecedor || row.loja || "").trim().slice(0, 120), due,
        supplierPhone: normalizePhone(row.telefone_fornecedor || row.telefone || ""),
        supplierInstagram: instagramHandle(row.instagram_fornecedor || row.instagram || ""),
        shipping: parseMoney(row.frete || 0), surcharge: parseMoney(row.acrescimo || 0), discount: parseMoney(row.desconto || 0),
        orderNumber: String(row.pedido_contrato || row.pedido || "").trim().slice(0, 80),
        deliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(row.entrega || "") ? row.entrega : "",
        deliveryStatus: ["ordered", "production", "shipped", "delivered"].includes(row.status_entrega) ? row.status_entrega : "",
        link: safeUrl(row.link || row.url || ""), notes: String(row.observacoes || row.observacao || row.notes || "").trim().slice(0, 1000),
        subtasks: String(row.subitens || row.subtarefas || "").split("|").map((title) => title.trim()).filter(Boolean).map((title) => ({ id: uid(), title: title.slice(0, 160), done: false })),
        createdAt: nowISO(),
      });
    });
    return { items, warnings };
  }

  function openChecklistImportGuide() {
    pendingChecklistImport = null;
    $("#checklistImportResults").hidden = true;
    $("#checklistImportSummary").textContent = "";
    $("#checklistImportPreview").innerHTML = "";
    $("#checklistImportWarnings").hidden = true;
    openModal($("#checklistImportModal"));
  }

  function handleChecklistImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseChecklistCsv(String(reader.result || ""));
      if (!parsed.items.length) {
        toast("Não encontrei itens válidos. Confira o cabeçalho do modelo CSV.", "err");
        return;
      }
      pendingChecklistImport = parsed.items;
      $("#checklistImportResults").hidden = false;
      $("#checklistImportSummary").textContent = parsed.items.length + (parsed.items.length === 1 ? " item pronto para importar." : " itens prontos para importar.");
      $("#checklistImportPreview").innerHTML = parsed.items.slice(0, 8).map((item) =>
        "<li>" + esc(item.title) + '<span class="muted">' + esc(stageById(item.stage).name) + " · " + money(item.cost) + "</span></li>"
      ).join("") + (parsed.items.length > 8 ? '<li class="muted">… e mais ' + (parsed.items.length - 8) + "</li>" : "");
      const warning = $("#checklistImportWarnings");
      warning.hidden = !parsed.warnings.length;
      warning.textContent = parsed.warnings.slice(0, 5).join(" ") + (parsed.warnings.length > 5 ? " Outros avisos foram omitidos." : "");
      $("input[name=checklistImportMode][value=merge]").checked = true;
    };
    reader.onerror = () => toast("Não foi possível ler o arquivo.", "err");
    reader.readAsText(file);
  }

  function confirmChecklistImport() {
    if (!pendingChecklistImport || !pendingChecklistImport.length) return;
    const mode = ($("input[name=checklistImportMode]:checked") || {}).value || "merge";
    if (mode === "replace") state.items = [];
    state.items.push(...pendingChecklistImport);
    const count = pendingChecklistImport.length;
    pendingChecklistImport = null;
    addActivity("update", count + (count === 1 ? " item importado no checklist" : " itens importados no checklist"));
    touch();
    closeModal($("#checklistImportModal"));
    renderAll();
    toast(count + (count === 1 ? " item importado." : " itens importados."), "ok");
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
    const views = {
      checklist: "#view-checklist",
      budget: "#view-budget",
      guests: "#view-guests",
      invite: "#view-invite",
      day: "#view-day",
      activity: "#view-activity",
    };
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
    if (name === "invite") renderInviteView();
    if (name === "day") renderDayMode();
    renderHero();

    try {
      const hash = name === "checklist" ? "" : "#" + name;
      history.replaceState(null, "", location.pathname + location.search + hash);
    } catch (e) {
      /* file:// pode bloquear replaceState */
    }
  }

  /* ---------- Eventos ---------- */

  function useChecklistTemplate() {
    if (state.items.length && !window.confirm("Adicionar o checklist modelo aos itens atuais?")) return;
    createAutomaticBackup("antes de aplicar o checklist modelo");
    const templateItems = seedItems(state.meta.date).map((item) => Object.assign({}, item, { id: uid() }));
    state.items = state.items.length ? state.items.concat(templateItems) : templateItems;
    collapsed.clear();
    saveCollapsed();
    addActivity("update", "Checklist modelo adicionado com " + templateItems.length + " itens");
    touch();
    renderAll();
    toast("Checklist modelo adicionado sem alterar convidados ou configurações.", "ok");
  }

  function bindEvents() {
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => showView(tab.dataset.view));
    });
    $("#addDayTaskBtn").addEventListener("click", () => openItemModal(null, "dia"));
    $("#view-day").addEventListener("click", (event) => {
      const view = event.target.closest("[data-day-view]");
      if (view) {
        showView(view.dataset.dayView);
        return;
      }
      const edit = event.target.closest("[data-day-item-edit]");
      if (edit) openItemModal(edit.dataset.dayItemEdit);
    });
    $("#dayTasks").addEventListener("change", (event) => {
      const input = event.target.closest("[data-day-item-status]");
      if (!input) return;
      const item = state.items.find((candidate) => candidate.id === input.dataset.dayItemStatus);
      if (!item) return;
      item.status = input.checked ? "done" : "todo";
      addActivity("update", (input.checked ? "Item concluído: " : "Item reaberto: ") + item.title);
      touch();
      renderAll();
      toast(input.checked ? "Tarefa concluída." : "Tarefa reaberta.", "ok");
    });
    $("#clearTodayActivityBtn").addEventListener("click", () => clearActivity("today"));
    $("#clearAllActivityBtn").addEventListener("click", () => clearActivity("all"));

    $("#searchInput").addEventListener("input", renderChecklist);
    $("#stageFilter").addEventListener("change", renderChecklist);
    $("#statusFilter").addEventListener("change", () => {
      renderHero();
      renderChecklist();
    });
    $("#sortItems").addEventListener("change", renderChecklist);
    $("#pendingOnly").addEventListener("change", renderChecklist);
    $("#expandStagesBtn").addEventListener("click", () => {
      collapsed.clear();
      saveCollapsed();
      renderChecklist();
    });
    $("#collapseStagesBtn").addEventListener("click", () => {
      collapsed = new Set(stageList().map((stage) => stage.id));
      saveCollapsed();
      renderChecklist();
    });

    /* Menu "Mais ações": fica ancorado ao botão e abre para cima quando não
       houver espaço embaixo, em vez de cair no fim da página no celular. */
    const toolbarMore = $(".toolbar-more");
    if (toolbarMore) {
      const toolbarMenu = toolbarMore.querySelector(".toolbar-more-menu");
      const closeToolbarMenu = () => {
        if (toolbarMore.open) toolbarMore.open = false;
      };
      const placeToolbarMenu = () => {
        toolbarMore.classList.remove("opens-up");
        if (!toolbarMore.open || !toolbarMenu) return;
        const trigger = toolbarMore.getBoundingClientRect();
        const menuHeight = toolbarMenu.offsetHeight;
        const spaceBelow = window.innerHeight - trigger.bottom;
        const spaceAbove = trigger.top;
        if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
          toolbarMore.classList.add("opens-up");
        }
      };
      toolbarMore.addEventListener("toggle", placeToolbarMenu);
      window.addEventListener("resize", placeToolbarMenu);
      window.addEventListener("scroll", () => {
        if (toolbarMore.open) placeToolbarMenu();
      }, { passive: true });
      document.addEventListener("click", (event) => {
        if (toolbarMore.open && !toolbarMore.contains(event.target)) closeToolbarMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && toolbarMore.open) {
          closeToolbarMenu();
          toolbarMore.querySelector("summary").focus();
        }
      });
      toolbarMore.addEventListener("click", (event) => {
        if (event.target.closest(".toolbar-more-menu .btn")) closeToolbarMenu();
      });
    }

    $("#checklistAlerts").addEventListener("click", (event) => {
      const alert = event.target.closest("[data-check-alert]");
      if (!alert) return;
      checklistAlertFilter = checklistAlertFilter === alert.dataset.checkAlert ? "" : alert.dataset.checkAlert;
      renderChecklist();
    });
    $("#checklistStats").addEventListener("click", (event) => {
      const chip = event.target.closest("[data-status-chip]");
      if (!chip) return;
      const status = chip.dataset.statusChip;
      $("#statusFilter").value = $("#statusFilter").value === status ? "" : status;
      renderHero();
      renderChecklist();
    });
    $("#addItemBtn").addEventListener("click", () => openItemModal());
    $("#itemQuantity").addEventListener("input", updateItemCalculatedTotal);
    $("#itemUnitPrice").addEventListener("input", updateItemCalculatedTotal);
    ["#itemShipping", "#itemSurcharge", "#itemDiscount"].forEach((selector) => $(selector).addEventListener("input", updateItemCalculatedTotal));
    $("#addPaymentBtn").addEventListener("click", addPaymentRow);
    $("#generateInstallmentsBtn").addEventListener("click", generateCreditInstallments);
    $("#paymentRows").addEventListener("input", () => {
      collectPaymentsFromRows();
      const totalPaid = editingPayments.reduce((sum, payment) => sum + (payment.paid ? payment.amount : 0), 0);
      $("#itemPaid").value = totalPaid ? totalPaid.toFixed(2).replace(".", ",") : "";
    });
    $("#paymentRows").addEventListener("change", () => {
      collectPaymentsFromRows();
      const totalPaid = editingPayments.reduce((sum, payment) => sum + (payment.paid ? payment.amount : 0), 0);
      $("#itemPaid").value = totalPaid ? totalPaid.toFixed(2).replace(".", ",") : "";
    });
    $("#paymentRows").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-payment-remove]");
      if (!remove) return;
      collectPaymentsFromRows();
      editingPayments = editingPayments.filter((payment) => payment.id !== remove.dataset.paymentRemove);
      renderPaymentRows();
    });
    $("#addSubtaskBtn").addEventListener("click", addSubtaskRow);
    $("#subtaskRows").addEventListener("input", (event) => {
      const row = event.target.closest("[data-subtask-row]");
      if (!row) return;
      const quantity = Math.max(0, Number(String(row.querySelector('[data-subtask-field="quantity"]').value || "").replace(",", ".")) || 0);
      const unitPrice = parseMoney(row.querySelector('[data-subtask-field="unitPrice"]').value);
      const total = Math.round(quantity * unitPrice * 100) / 100;
      row.querySelector(".subtask-total").textContent = money(total);
      updateItemCalculatedTotal();
    });
    $("#subtaskRows").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-subtask-remove]");
      if (!remove) return;
      collectSubtasksFromRows();
      editingSubtasks = editingSubtasks.filter((subtask) => subtask.id !== remove.dataset.subtaskRemove);
      renderSubtaskRows();
    });
    $("#editStageNamesBtn").addEventListener("click", () => openSettings(true));
    // Não repasse o evento de clique/toque para openSettings. Em celulares, o
    // evento era interpretado como `focusStageNames = true`, deslocando o modal
    // e abrindo o teclado assim que a tela de edição aparecia.
    $("#heroEditBtn").addEventListener("click", () => openSettings(false));

    $("#inviteForm").addEventListener("submit", handleInviteSubmit);
    $("#inviteForm").addEventListener("input", renderInvitePreview);
    $("#inviteForm").addEventListener("change", renderInvitePreview);
    $("#copyAnimatedInviteBtn").addEventListener("click", () =>
      copyLinkWithToast(animatedInviteUrl(), "Link do convite animado copiado.")
    );
    $("#copyConfirmInviteBtn").addEventListener("click", () =>
      copyLinkWithToast(invitePageUrl(), "Link da confirmação copiado.")
    );
    $("#saveInviteCloudBtn").addEventListener("click", () => {
      if (!hasCloud()) openSettings();
      else saveCloud();
    });
    $("#openInviteSettingsBtn").addEventListener("click", () => {
      renderInviteView();
      openModal($("#inviteSettingsModal"));
    });

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

    $("#guestPendingGrid").addEventListener("click", (event) => {
      const card = event.target.closest("[data-pending-filter]");
      if (!card) return;
      guestFilter = GUEST_FILTERS.includes(card.dataset.pendingFilter) ? card.dataset.pendingFilter : "all";
      saveGuestView();
      renderGuests();
      $("#guestList").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("#saveCloudBtn").addEventListener("click", () => {
      if (!hasCloud()) openSettings();
      else saveCloud();
    });
    $("#pullBtn").addEventListener("click", () => pullCloud());
    $("#quickBackupBtn").addEventListener("click", exportData);

    $("#budgetInput").addEventListener("change", (e) => {
      state.meta.budget = parseMoney(e.target.value);
      touch();
      renderHero();
      renderBudget();
      renderCloudBar();
    });
    $("#exportPartyPdfBtn").addEventListener("click", exportPartyPdf);
    $("#exportChecklistPdfBtn").addEventListener("click", exportChecklistPdf);
    $("#exportConfirmedPdfBtn").addEventListener("click", exportConfirmedPdf);

    /* Checklist */
    $("#checklist").addEventListener("change", (event) => {
      const subtaskCheck = event.target.closest("[data-subtask-check]");
      if (subtaskCheck) {
        const item = state.items.find((candidate) => candidate.id === subtaskCheck.dataset.subtaskCheck);
        const subtask = item && Array.isArray(item.subtasks)
          ? item.subtasks.find((candidate) => candidate.id === subtaskCheck.dataset.subtaskId)
          : null;
        if (!subtask) return;
        subtask.done = subtaskCheck.checked;
        addActivity("update", (subtask.done ? "Subitem concluído: " : "Subitem reaberto: ") + subtask.title);
        touch();
        renderAll();
        return;
      }
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
        addActivity("update", "Status atualizado: " + item.title + " — " + (STATUS[item.status] || STATUS.todo).label);
        touch();
        renderAll();
      }
    });

    $("#checklist").addEventListener("click", (event) => {
      if (event.target.closest("[data-use-checklist-template]")) {
        useChecklistTemplate();
        return;
      }
      if (event.target.closest("[data-empty-add-item]")) {
        openItemModal();
        return;
      }
      if (event.target.closest("[data-empty-import]")) {
        openChecklistImportModal();
        return;
      }
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

      const duplicate = event.target.closest("[data-duplicate]");
      if (duplicate) {
        const original = state.items.find((item) => item.id === duplicate.dataset.duplicate);
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = uid();
        copy.title = original.title + " (cópia)";
        copy.status = "todo";
        copy.paid = 0;
        copy.payments = [];
        copy.subtasks = (copy.subtasks || []).map((subtask) => Object.assign({}, subtask, { id: uid(), done: false }));
        copy.createdAt = nowISO();
        state.items.push(copy);
        addActivity("update", "Item duplicado: " + original.title);
        touch();
        renderAll();
        toast("Item duplicado.", "ok");
        return;
      }

      const addStage = event.target.closest("[data-add-stage]");
      if (addStage) {
        openItemModal(null, addStage.dataset.addStage);
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
        checklistAlertFilter = "";
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

    $("#selectVisibleGuestsBtn").addEventListener("click", () => {
      const visible = state.guests.filter(guestMatchesActiveFilter).filter(selectableGuest);
      const allSelected = visible.length && visible.every((g) => selectedGuestIds.has(g.id));
      visible.forEach((g) => allSelected ? selectedGuestIds.delete(g.id) : selectedGuestIds.add(g.id));
      renderGuests();
    });
    $("#clearGuestSelectionBtn").addEventListener("click", () => {
      selectedGuestIds.clear();
      renderGuests();
    });
    $("#prepareGuestInvitesBtn").addEventListener("click", openBulkInviteModal);
    $("#openNextInviteBtn").addEventListener("click", () => {
      const guest = bulkInviteQueue[bulkInviteIndex];
      if (!guest) return;
      window.open(waInviteLink(guest), "_blank", "noopener,noreferrer");
      guest.inviteSentAt = nowISO();
      addActivity("invite", "Convite de " + displayGuestName(guest) + " aberto para envio");
      selectedGuestIds.delete(guest.id);
      bulkInviteIndex += 1;
      touch();
      renderBulkInviteModal();
      renderGuests();
      renderCloudBar();
    });

    $("#guestList").addEventListener("change", (event) => {
      const check = event.target.closest("[data-guest-select]");
      if (check) {
        if (check.checked) selectedGuestIds.add(check.dataset.guestSelect);
        else selectedGuestIds.delete(check.dataset.guestSelect);
        renderGuests();
        return;
      }
      const select = event.target.closest("[data-guest-status]");
      if (!select) return;
      const guest = state.guests.find((g) => g.id === select.dataset.guestStatus);
      if (!guest) return;
      const previousStatus = guest.status;
      if (!applyGuardianStatusChange(guest, select.value)) {
        select.value = previousStatus;
        return;
      }
      guest.rsvpAt = nowISO();
      guest.rsvpSource = "owner";
      addActivity("rsvp", displayGuestName(guest) + ": " + (GUEST_STATUS[guest.status] || GUEST_STATUS.pending).label);
      touch();
      renderGuests();
      renderCloudBar();
    });

    $("#guestList").addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-guest-group-toggle]");
      if (toggle) {
        const id = toggle.dataset.guestGroupToggle;
        if (collapsedGuestGroups.has(id)) collapsedGuestGroups.delete(id);
        else collapsedGuestGroups.add(id);
        saveGuestGroupsCollapsed();
        renderGuests();
        return;
      }

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

      const sentToggle = event.target.closest("[data-guest-invite-toggle]");
      if (sentToggle) {
        const guest = state.guests.find((g) => g.id === sentToggle.dataset.guestInviteToggle);
        if (!guest) return;
        guest.inviteSentAt = guest.inviteSentAt ? "" : nowISO();
        addActivity("invite", "Convite de " + displayGuestName(guest) + (guest.inviteSentAt ? " marcado como enviado" : " marcado como não enviado"));
        touch();
        renderGuests();
        renderCloudBar();
        toast(guest.inviteSentAt ? "Convite marcado como enviado." : "Convite marcado como não enviado.", guest.inviteSentAt ? "ok" : "neutral");
        return;
      }

      const sendInvite = event.target.closest("[data-guest-send]");
      if (sendInvite) {
        const guest = state.guests.find((g) => g.id === sendInvite.dataset.guestSend);
        if (guest) {
          guest.inviteSentAt = nowISO();
          addActivity("invite", "Convite de " + displayGuestName(guest) + " aberto para envio");
          touch();
          renderCloudBar();
          window.setTimeout(renderGuests, 0);
        }
        return;
      }

      const reminder = event.target.closest("[data-guest-reminder]");
      if (reminder) {
        const guest = state.guests.find((g) => g.id === reminder.dataset.guestReminder);
        if (guest) {
          guest.reminderSentAt = nowISO();
          addActivity("reminder", "Lembrete de " + displayGuestName(guest) + " aberto para envio");
          touch();
          renderCloudBar();
          window.setTimeout(renderGuests, 0);
        }
        return;
      }

      const del = event.target.closest("[data-guest-del]");
      if (del) deleteGuest(del.dataset.guestDel);
    });

    /* Modal de convidado */
    $("#guestEditForm").addEventListener("submit", handleGuestEditSubmit);
    ["#guestEditPhone", "#setFatherPhone", "#setMotherPhone", "#itemSupplierPhone"].forEach((selector) => {
      const field = $(selector);
      if (!field) return;
      field.addEventListener("input", (event) => {
        const input = event.target;
        // Números internacionais são normalizados só ao sair do campo, para
        // não atrapalhar a digitação com espaços e agrupamentos a cada tecla.
        if (/^\s*(?:\+|00)/.test(input.value)) return;
        const digits = phoneDigits(input.value);
        if (digits.length < 4 || digits.length > 11) return;
        const atEnd = input.selectionStart === input.value.length;
        const formatted = formatPhoneLocal(input.value);
        if (formatted === input.value) return;
        input.value = formatted;
        if (atEnd) {
          try {
            input.setSelectionRange(formatted.length, formatted.length);
          } catch (e) {
            /* ignora */
          }
        }
      });
      field.addEventListener("blur", () => {
        const value = field.value.trim();
        if (value && isValidPhone(value)) field.value = normalizePhone(value);
      });
    });
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

    $("#copyInviteLinkBtn2").addEventListener("click", copyInviteLink);
    $("#refreshGuestsBtn").addEventListener("click", () => refreshGuestResponses({ manual: true }));
    $("#importGuestsBtn").addEventListener("click", openGuestImportGuide);
    $("#chooseGuestCsvBtn").addEventListener("click", () => $("#guestImportFile").click());
    $("#downloadGuestCsvBtn").addEventListener("click", () => downloadCsvTemplate(
      "modelo-convidados-ben.csv",
      [
        "nome;tipo;celular;parentesco;status;observacoes",
        "Maria Silva;adulto;5511999999999;Tia;pendente;",
        "João Silva;crianca;;Primo;confirmado;Alergia a amendoim",
      ]
    ));
    $("#guestImportFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleGuestImportFile(file);
      event.target.value = "";
    });
    $("#guestImportConfirm").addEventListener("click", confirmGuestImport);

    $("#importChecklistBtn").addEventListener("click", openChecklistImportGuide);
    $("#chooseChecklistCsvBtn").addEventListener("click", () => $("#checklistImportFile").click());
    $("#downloadChecklistCsvBtn").addEventListener("click", () => downloadCsvTemplate(
      "modelo-checklist-ben.csv",
      [
        "etapa;item;status;quantidade;unidade;preco_unitario;total_pago;vencimento;fornecedor;telefone_fornecedor;instagram_fornecedor;frete;acrescimo;desconto;pedido_contrato;entrega;status_entrega;link;observacoes;subitens",
        "Lembrancinhas;Sacolinhas Toy Story;a_fazer;25;unidade;12,50;100,00;2026-12-15;Loja Exemplo;+55 83 98875-4742;@lojaexemplo;25,00;0;10,00;Pedido 1234;2026-12-20;production;;Confirmar cores;Comprar sacolas|Separar brindes|Montar kits",
        "Comida & Bolo;Bolo principal;contratado;1;unidade;450,00;200,00;2027-01-05;Confeitaria Exemplo;+351 912 345 678;@confeitariaexemplo;0;0;0;Contrato 45;2027-01-08;ordered;;;Confirmar sabor|Confirmar entrega",
      ]
    ));
    $("#checklistImportFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleChecklistImportFile(file);
      event.target.value = "";
    });
    $("#checklistImportConfirm").addEventListener("click", confirmChecklistImport);

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
    $("#restoreAutoBackupBtn").addEventListener("click", openBackupHistory);
    $("#backupHistoryList").addEventListener("click", (event) => {
      const restore = event.target.closest("[data-restore-backup]");
      if (restore) restoreAutomaticBackup(restore.dataset.restoreBackup);
    });
    $("#clearBackupHistoryBtn").addEventListener("click", clearAutomaticBackups);
    $("#createAutoBackupBtn").addEventListener("click", createManualAutomaticBackup);
    $("#verifyBackupBtn").addEventListener("click", verifyRecovery);
    $("#importFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importData(file);
      event.target.value = "";
    });

    $("#resetBtn").addEventListener("click", () => {
      if (!window.confirm("Restaurar o checklist de exemplo?\n\nOs itens atuais serão substituídos.")) return;
      createAutomaticBackup("antes de restaurar o checklist de exemplo");
      state = defaultState();
      touch();
      closeAllModals();
      renderAll();
      toast("Checklist de exemplo restaurado.", "ok");
    });

    $("#clearBtn").addEventListener("click", () => {
      if (!window.confirm("Apagar todos os itens e convidados?\n\nOs dados da festa serão mantidos.")) return;
      createAutomaticBackup("antes de apagar itens e convidados");
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
        // No celular, a abertura/fechamento do teclado muda a área visível e
        // pode transformar um toque de digitação em toque no fundo. Fechar ao
        // tocar fora fica restrito a mouse/trackpad; o botão X continua sempre.
        if (event.target === modal && window.matchMedia("(pointer: fine)").matches) closeModal(modal);
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
    const stages = stageList();
    filter.innerHTML =
      '<option value="">Todas as etapas</option>' +
      stages.map((s) => '<option value="' + s.id + '">' + s.icon + " " + esc(s.name) + "</option>").join("");
    itemSelect.innerHTML = stages.map(
      (s) => '<option value="' + s.id + '">' + s.icon + " " + esc(s.name) + "</option>"
    ).join("");
  }

  async function checkForAppUpdate() {
    if (!/^https?:$/.test(location.protocol) || /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
    const current = document.querySelector('meta[name="app-version"]');
    if (!current || !current.content) return;
    try {
      const checkUrl = new URL("painel.html", location.href);
      checkUrl.searchParams.set("_check", Date.now().toString());
      const response = await fetch(checkUrl.href, { cache: "no-store" });
      if (!response.ok) return;
      const html = await response.text();
      const documentCopy = new DOMParser().parseFromString(html, "text/html");
      const remote = documentCopy.querySelector('meta[name="app-version"]');
      if (!remote || !remote.content || remote.content === current.content) return;
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.set("versao", remote.content);
      location.replace(nextUrl.href);
    } catch (e) {
      /* A checagem é auxiliar; o painel continua funcionando mesmo sem rede. */
    }
  }

  function init() {
    checkForAppUpdate();
    if (cloud.pending) dirty = true;
    loadGuestView();
    loadHiddenValues();
    applyValuesHidden();
    fillStageSelects();
    bindEvents();
    renderAll();

    const hash = (location.hash || "").replace("#", "");
    showView(["budget", "guests", "invite", "day", "activity"].includes(hash) ? hash : "checklist");

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
    if (dirty && hasCloud() && cloud.auto && cloud.verified) {
      autoTimer = setTimeout(() => saveCloud({ silent: true }), 10000);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      const guestsView = $("#view-guests");
      if (guestsView && !guestsView.hidden) refreshGuestResponses();
    });
  }

  /* ---------- API do assistente local (Buzz) ---------- */
  /* O assistente conversa apenas neste navegador. Ele usa as mesmas regras
     de dados do painel e nunca envia nada para fora. */

  let assistantUndo = null;

  function assistantClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assistantScore(value, query) {
    const text = norm(value);
    const q = norm(query);
    if (!text || !q) return 0;
    if (text === q) return 100;
    if (text.startsWith(q)) return 80 + Math.min(10, q.length);
    if (text.includes(q)) return 60 + Math.min(10, q.length);
    const tokens = q.split(/\s+/).filter((token) => token.length > 1);
    if (!tokens.length) return 0;
    const hits = tokens.filter((token) => text.includes(token)).length;
    return hits ? 20 + Math.round((40 * hits) / tokens.length) : 0;
  }

  function assistantSnapshot() {
    return {
      meta: assistantClone(state.meta),
      guests: state.guests.map((guest) => assistantClone(guest)),
      items: state.items.map((item) => assistantClone(item)),
    };
  }

  function assistantStats() {
    const countable = countableGuests(state.guests);
    const s = summary();
    const today = todayISO();
    return {
      guests: {
        total: countable.length,
        adults: countable.filter((guest) => guest.type === "adult").length,
        children: countable.filter((guest) => guest.type === "child").length,
        confirmed: countable.filter((guest) => guest.status === "confirmed").length,
        pending: countable.filter((guest) => guest.status === "pending").length,
        declined: countable.filter((guest) => guest.status === "declined").length,
        parents: state.guests.filter(isHostGuest).length,
        withPhone: countable.filter((guest) => phoneDigits(guest.phone)).length,
        invitesSent: countable.filter((guest) => guest.inviteSentAt).length,
      },
      checklist: {
        total: s.total,
        done: s.done,
        pct: s.pct,
        doing: state.items.filter((item) => item.status === "doing").length,
        contracted: state.items.filter((item) => item.status === "contracted").length,
        todo: state.items.filter((item) => item.status === "todo").length,
        overdue: state.items.filter(
          (item) => item.status !== "done" && item.due && item.due < today
        ).length,
      },
      budget: {
        budget: s.budget,
        previsto: s.previsto,
        pago: s.pago,
        contratado: s.contratado,
        aPagar: s.aPagar,
        saldo: s.saldo,
        saldoPrevisto: s.saldoPrevisto,
      },
    };
  }

  function assistantFindGuests(query) {
    return state.guests
      .map((guest) => ({
        guest,
        score: Math.max(
          assistantScore(guest.name, query),
          assistantScore(displayGuestName(guest), query),
          assistantScore(guest.relation, query)
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.guest.name.localeCompare(b.guest.name, "pt-BR"))
      .slice(0, 8)
      .map((entry) => ({ guest: assistantClone(entry.guest), score: entry.score }));
  }

  function assistantFindItems(query) {
    return state.items
      .map((item) => ({ item, score: assistantScore(item.title, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "pt-BR"))
      .slice(0, 8)
      .map((entry) => ({ item: assistantClone(entry.item), score: entry.score }));
  }

  function assistantRevealGuest(id) {
    const guest = guestById(id);
    if (!guest) return { ok: false, error: "Convidado não encontrado." };
    guestFilter = "all";
    guestQuery = "";
    saveGuestView();
    const group = isHostGuest(guest) ? "parents" : guest.type === "child" ? "child" : "adult";
    collapsedGuestGroups.delete(group);
    saveGuestGroupsCollapsed();
    const search = $("#guestSearch");
    if (search) search.value = "";
    showView("guests");
    return { ok: true };
  }

  function assistantAddGuest(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const name = cleanGuestName(input.name || "");
    if (!name) return { ok: false, error: "Qual é o nome do convidado?" };
    const type = input.type === "child" ? "child" : "adult";
    const duplicate = state.guests.find(
      (guest) => norm(guest.name) === norm(name) && guest.type === type
    );
    if (duplicate) {
      return {
        ok: false,
        error:
          '"' +
          duplicate.name +
          '" já está na lista como ' +
          (type === "child" ? "criança" : "adulto") +
          ".",
        guest: assistantClone(duplicate),
      };
    }

    const guardianIds = (Array.isArray(input.guardians) ? input.guardians : [])
      .map(String)
      .filter((id) => state.guests.some((guest) => guest.id === id && guest.type === "adult"));
    const usedIds = new Set(state.guests.map((guest) => guest.id));
    const record = makeGuestRecord(
      {
        name,
        type,
        status: GUEST_STATUS[input.status] ? input.status : "pending",
        relation: input.relation || "",
        phone: input.phone || "",
        notes: input.notes || "",
        guardians: guardianIds,
      },
      usedIds
    );
    if (!record) return { ok: false, error: "Não consegui criar este convidado." };

    const before = JSON.stringify(state);
    reviveGuest(record.id);
    state.guests.push(record);
    state.guests = normalizeGuestList(state.guests);
    const saved = state.guests.find((guest) => guest.id === record.id) || record;
    addActivity("guest", "Convidado adicionado: " + displayGuestName(saved));
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, guest: assistantClone(saved) };
  }

  function assistantSetGuestStatus(id, status) {
    const guest = guestById(id);
    if (!guest) return { ok: false, error: "Convidado não encontrado." };
    if (!GUEST_STATUS[status]) return { ok: false, error: "Status de convidado inválido." };

    const before = JSON.stringify(state);
    if (!applyGuardianStatusChange(guest, status)) {
      return { ok: false, error: "Alteração cancelada para revisar as crianças vinculadas." };
    }
    guest.rsvpAt = nowISO();
    guest.rsvpSource = "owner";
    addActivity(
      "rsvp",
      displayGuestName(guest) + ": " + (GUEST_STATUS[status] || GUEST_STATUS.pending).label
    );
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, guest: assistantClone(guest) };
  }

  function assistantRemoveGuest(id) {
    const guest = guestById(id);
    if (!guest) return { ok: false, error: "Convidado não encontrado." };

    const before = JSON.stringify(state);
    const name = displayGuestName(guest);
    state.guests = state.guests.filter((candidate) => candidate.id !== guest.id);
    state.guests.forEach((candidate) => {
      if (candidate.type === "child" && Array.isArray(candidate.guardians)) {
        candidate.guardians = candidate.guardians.filter((guardianId) => guardianId !== guest.id);
      }
    });
    markGuestDeleted(guest.id);
    addActivity("guest", "Convidado removido: " + name);
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, guest: assistantClone(guest) };
  }

  function assistantAddItem(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const title = String(input.title || "").replace(/\s+/g, " ").trim().slice(0, 140);
    if (!title) return { ok: false, error: "Qual é o nome do item?" };

    const stage = STAGES.some((candidate) => candidate.id === input.stage)
      ? input.stage
      : "planejamento";
    const status = STATUS[input.status] ? input.status : "todo";
    const quantity = Math.max(0.01, Number(input.quantity) || 1);
    let unitPrice = parseMoney(input.unitPrice);
    let cost = parseMoney(input.cost);
    if (!cost && unitPrice) cost = Math.round(quantity * unitPrice * 100) / 100;
    if (cost && !unitPrice) unitPrice = Math.round((cost / quantity) * 100) / 100;
    const unit = ["un.", "pacote", "caixa", "cento", "pessoa", "kg", "litro"].includes(input.unit)
      ? input.unit
      : "un.";
    const subtasks = (Array.isArray(input.subtasks) ? input.subtasks : [])
      .map((subtask) =>
        typeof subtask === "string"
          ? { id: uid(), title: subtask.trim().slice(0, 160), done: false }
          : subtask
      )
      .filter((subtask) => subtask && String(subtask.title || "").trim())
      .map((subtask) => ({
        id: String(subtask.id || uid()),
        title: String(subtask.title).trim().slice(0, 160),
        done: subtask.done === true,
        quantity: Math.max(0.01, Number(subtask.quantity) || 1),
        unit: ["un.", "pacote", "caixa", "cento", "pessoa", "kg", "litro"].includes(subtask.unit) ? subtask.unit : "un.",
        unitPrice: parseMoney(subtask.unitPrice),
        cost: Math.round(Math.max(0.01, Number(subtask.quantity) || 1) * parseMoney(subtask.unitPrice) * 100) / 100,
      }));

    const composedCost = subtasks.reduce((sum, subtask) => sum + subtask.cost, 0);
    if (composedCost > 0) cost = composedCost;
    const shipping = parseMoney(input.shipping);
    const surcharge = parseMoney(input.surcharge);
    const discount = parseMoney(input.discount);
    cost = Math.max(0, Math.round((cost + shipping + surcharge - discount) * 100) / 100);

    const before = JSON.stringify(state);
    const item = {
      id: uid(),
      title,
      stage,
      status,
      quantity,
      unit,
      unitPrice,
      cost,
      paid: 0,
      payments: [],
      supplier: String(input.supplier || "").trim().slice(0, 120),
      supplierPhone: normalizePhone(input.supplierPhone || ""),
      supplierInstagram: instagramHandle(input.supplierInstagram || ""),
      shipping,
      surcharge,
      discount,
      orderNumber: String(input.orderNumber || "").trim().slice(0, 80),
      deliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate) ? input.deliveryDate : "",
      deliveryStatus: ["ordered", "production", "shipped", "delivered"].includes(input.deliveryStatus) ? input.deliveryStatus : "",
      due: /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : "",
      link: "",
      notes: String(input.notes || "").slice(0, 1000),
      subtasks,
      createdAt: nowISO(),
    };
    state.items.push(item);
    addActivity("update", "Item adicionado: " + title);
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, item: assistantClone(item) };
  }

  function assistantSetItemStatus(id, status) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return { ok: false, error: "Item não encontrado." };
    if (!STATUS[status]) return { ok: false, error: "Status de item inválido." };

    const before = JSON.stringify(state);
    item.status = status;
    addActivity(
      "update",
      (status === "done" ? "Item concluído: " : "Status atualizado: ") +
        item.title +
        " — " +
        STATUS[status].label
    );
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, item: assistantClone(item) };
  }

  function assistantAddSubtask(itemId, title) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) return { ok: false, error: "Item não encontrado." };
    const cleanTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!cleanTitle) return { ok: false, error: "Qual é o nome do subitem?" };
    if (!Array.isArray(item.subtasks)) item.subtasks = [];

    const before = JSON.stringify(state);
    const subtask = { id: uid(), title: cleanTitle, done: false };
    item.subtasks.push(subtask);
    addActivity("update", "Subitem adicionado em " + item.title + ": " + cleanTitle);
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, item: assistantClone(item), subtask: assistantClone(subtask) };
  }

  function assistantSetSubtaskStatus(itemId, subtaskId, done) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    const subtask =
      item && Array.isArray(item.subtasks)
        ? item.subtasks.find((candidate) => candidate.id === subtaskId)
        : null;
    if (!item || !subtask) return { ok: false, error: "Subitem não encontrado." };

    const before = JSON.stringify(state);
    subtask.done = done === true;
    addActivity(
      "update",
      (subtask.done ? "Subitem concluído: " : "Subitem reaberto: ") +
        subtask.title +
        " (" +
        item.title +
        ")"
    );
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, item: assistantClone(item), subtask: assistantClone(subtask) };
  }

  function assistantRemoveItem(id) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return { ok: false, error: "Item não encontrado." };

    const before = JSON.stringify(state);
    state.items = state.items.filter((candidate) => candidate.id !== id);
    addActivity("update", "Item excluído: " + item.title);
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, item: assistantClone(item) };
  }

  function assistantSetBudget(value) {
    const before = JSON.stringify(state);
    state.meta.budget = parseMoney(value);
    addActivity("update", "Orçamento atualizado: " + money(state.meta.budget));
    touch();
    renderAll();
    assistantUndo = before;
    return { ok: true, budget: state.meta.budget };
  }

  function assistantRestoreUndo() {
    if (!assistantUndo) return { ok: false, error: "Não há nenhuma alteração do Buzz para desfazer." };
    let restored;
    try {
      restored = normalizeState(JSON.parse(assistantUndo));
    } catch (e) {
      restored = null;
    }
    if (!restored) return { ok: false, error: "Não consegui desfazer esta alteração." };
    state = restored;
    assistantUndo = null;
    touch();
    renderAll();
    return { ok: true };
  }

  window.BenApp = {
    version: "1.0",
    snapshot: assistantSnapshot,
    stats: assistantStats,
    findGuests: assistantFindGuests,
    findItems: assistantFindItems,
    revealGuest: assistantRevealGuest,
    stages: () => stageList().map((stage) => ({ id: stage.id, name: stage.name, icon: stage.icon })),
    addGuest: assistantAddGuest,
    setGuestStatus: assistantSetGuestStatus,
    removeGuest: assistantRemoveGuest,
    addItem: assistantAddItem,
    setItemStatus: assistantSetItemStatus,
    addSubtask: assistantAddSubtask,
    setSubtaskStatus: assistantSetSubtaskStatus,
    removeItem: assistantRemoveItem,
    setBudget: assistantSetBudget,
    showView: (name) => {
      showView(name);
      return { ok: true };
    },
    canUndo: () => !!assistantUndo,
    undo: assistantRestoreUndo,
    cloudStatus: () => ({
      configured: hasCloud(),
      phase: cloudPhase,
      error: cloudError,
      pending: !!cloud.pending,
      lastSync: cloud.lastSync || "",
    }),
    saveCloud: () => saveCloud(),
    pullCloud: () => pullCloud(),
    refreshResponses: () => refreshGuestResponses({ manual: true }),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
