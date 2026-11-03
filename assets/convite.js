/* ============================================================
   Convite digital + RSVP — Ben faz 5!
   Lê somente a configuração pública e consulta os convidados no Apps Script.
   ============================================================ */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const GUEST_STATUS = {
    confirmed: { label: "Confirmado" },
    pending: { label: "Pendente" },
    declined: { label: "Não vai" },
  };

  const FALLBACK_META = {
    name: "Ben",
    age: 5,
    date: "2027-01-09",
    time: "18:00",
    location: "Enjoy Kids, Liv Mall Shopping — Av. Gov. Flávio Ribeiro Coutinho, 500 - Jardim Oceania, João Pessoa - PB, 58037-005",
    theme: "Toy Story",
    rsvpUrl: "",
    mapsUrl: "",
    fatherPhone: "",
    motherPhone: "",
    inviteMode: "search",
  };

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const norm = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

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

  function displayTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return value;
    return match[2] === "00" ? match[1] + "h" : match[1] + "h" + match[2];
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function displayGuestName(guest) {
    return [String(guest.relation || "").trim(), guest.name].filter(Boolean).join(" ");
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff) || diff < 60000) return "agora";
    const min = Math.floor(diff / 60000);
    if (min < 60) return "há " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "há " + h + " h";
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function appError(message) {
    const err = new Error(message);
    err.__app = true;
    return err;
  }

  let meta = Object.assign({}, FALLBACK_META);
  let guests = [];
  let current = null;
  let sending = false;
  let toastTimer = null;
  let remoteDirectory = false;
  let lookupTimer = null;
  let lookupSequence = 0;
  const pageStartedAt = Date.now();

  function toast(message, type) {
    const el = $("#inviteToast");
    if (!el) return;
    el.textContent = message;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = "toast" + (type ? " " + type : "");
    }, 3600);
  }

  /* Estrelas subindo quando a presença é confirmada. */
  function celebrate() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const old = $("#partyParade");
    if (old) old.remove();

    const layer = document.createElement("div");
    layer.className = "party-parade";
    layer.id = "partyParade";
    layer.setAttribute("aria-hidden", "true");

    for (let i = 0; i < 26; i++) {
      const spark = document.createElement("span");
      spark.className = "parade-spark";
      spark.textContent = i % 4 === 0 ? "✨" : i % 3 === 0 ? "🌟" : "⭐";
      spark.style.setProperty("--x", Math.round(Math.random() * 100) + "vw");
      spark.style.setProperty("--dur", (2.2 + Math.random() * 1.8).toFixed(2) + "s");
      spark.style.setProperty("--delay", (Math.random() * 1.6).toFixed(2) + "s");
      spark.style.setProperty("--size", Math.round(14 + Math.random() * 18) + "px");
      layer.appendChild(spark);
    }

    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 5600);
  }

  function normalizeMeta(raw) {
    const base = Object.assign({}, FALLBACK_META, raw && typeof raw === "object" ? raw : {});
    const url = String(base.rsvpUrl || "").trim();
    let location = String(base.location || FALLBACK_META.location);
    if (["enjoy livmall", "buffet alegria — salão 2"].includes(location.trim().toLowerCase())) {
      location = FALLBACK_META.location;
    }
    return {
      name: String(base.name || "Ben").slice(0, 40),
      age: Math.min(99, Math.max(1, parseInt(base.age, 10) || 5)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(base.date) ? base.date : FALLBACK_META.date,
      time: /^\d{2}:\d{2}$/.test(base.time) ? base.time : FALLBACK_META.time,
      location,
      theme: String(base.theme || "Toy Story"),
      rsvpUrl: /^https?:\/\//i.test(url) ? url : "",
      mapsUrl: /^https?:\/\//i.test(String(base.mapsUrl || "").trim())
        ? String(base.mapsUrl).trim()
        : "",
      fatherPhone: String(base.fatherPhone || "").replace(/\D/g, "").slice(0, 15),
      motherPhone: String(base.motherPhone || "").replace(/\D/g, "").slice(0, 15),
      inviteMode: base.inviteMode === "links" ? "links" : "search",
    };
  }

  function mapsLink() {
    if (meta.mapsUrl) return meta.mapsUrl;
    const query = String(meta.location || "").trim();
    if (!query) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function normalizeGuest(raw) {
    const g = raw && typeof raw === "object" ? raw : {};
    if (!g.name) return null;
    const name = String(g.name).slice(0, 80);
    const type = g.type === "adult" ? "adult" : "child";
    let key = String(g.id || g.key || "").trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) key = guestKey(name, type);
    const rsvpAt =
      typeof g.rsvpAt === "string" && !isNaN(Date.parse(g.rsvpAt)) ? g.rsvpAt : "";
    return {
      key,
      name,
      relation: String(g.relation || g.parentesco || g.relationship || "").trim().slice(0, 32),
      type,
      status: GUEST_STATUS[g.status] ? g.status : "pending",
      guardians: Array.isArray(g.guardians) ? g.guardians.map(String) : [],
      rsvpAt,
      rsvpMessage: String(g.rsvpMessage || "").slice(0, 280),
      unlisted: !!g.unlisted,
    };
  }

  function mergeGuests(list) {
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const guest = normalizeGuest(raw);
      if (!guest) return;
      const index = guests.findIndex((item) => item.key === guest.key);
      if (index >= 0) guests[index] = guest;
      else guests.push(guest);
    });
  }

  async function loadData() {
    try {
      const response = await fetch("event.json?t=" + Date.now(), { cache: "no-store" });
      if (response.ok) {
        const event = await response.json();
        meta = normalizeMeta(event && event.meta);
        remoteDirectory = !!meta.rsvpUrl;
      }
    } catch (e) {
      /* os textos padrão mantêm o convite utilizável */
    }

    if (remoteDirectory) {
      try {
        const configUrl = new URL(meta.rsvpUrl);
        configUrl.searchParams.set("action", "config");
        const configResponse = await fetch(configUrl.toString(), { cache: "no-store", redirect: "follow" });
        const config = await configResponse.json();
        if (config && config.ok) {
          meta.fatherPhone = String(config.fatherPhone || "").replace(/\D/g, "").slice(0, 15);
          meta.motherPhone = String(config.motherPhone || "").replace(/\D/g, "").slice(0, 15);
        }
      } catch (e) {
        /* Os contatos são opcionais. */
      }
    }
    return remoteDirectory;
  }

  function calendarHref() {
    const compactDate = meta.date.replace(/-/g, "");
    const compactTime = meta.time.replace(":", "") + "00";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Festa Ben//Convite//PT-BR", "BEGIN:VEVENT",
      "DTSTART;TZID=America/Sao_Paulo:" + compactDate + "T" + compactTime,
      "DTEND;TZID=America/Sao_Paulo:" + compactDate + "T220000",
      "SUMMARY:Aniversário do " + meta.name + " - " + meta.age + " anos",
      "LOCATION:" + String(meta.location || "").replace(/,/g, "\\,"),
      "DESCRIPTION:Venha comemorar com a gente!", "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }

  function whatsappHref(phone, parent) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length <= 11) digits = "55" + digits;
    const text = "Olá! Preciso de ajuda com a confirmação do aniversário do Ben.";
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
  }

  function renderParentContacts() {
    const host = $("#parentContacts");
    if (!host) return;
    const parents = [
      { label: "Papai", phone: meta.fatherPhone },
      { label: "Mamãe", phone: meta.motherPhone },
    ];
    const parentMarkup = parents.map((item) => {
      const label = '<span class="parent-contact-name">' + esc(item.label) + '</span>';
      if (!item.phone) return label;
      return label + ' <a class="parent-whatsapp-link" href="' + esc(whatsappHref(item.phone, item.label)) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Conversar com ' + esc(item.label) + ' pelo WhatsApp" title="Conversar com ' + esc(item.label) + ' pelo WhatsApp">' +
        '<svg aria-hidden="true" viewBox="0 0 32 32" focusable="false"><path fill="currentColor" d="M16 3a12.7 12.7 0 0 0-11 19l-1.5 5.5L9.2 26A12.8 12.8 0 1 0 16 3Zm6.8 18.1c-.3.9-1.8 1.7-2.5 1.8-.7.1-1.6.2-5.2-1.3-4.4-1.9-7.2-6.4-7.4-6.7-.2-.3-1.8-2.4-1.8-4.6s1.1-3.2 1.5-3.7c.4-.4.9-.5 1.2-.5h.9c.3 0 .6 0 .8.7l1.2 2.9c.1.2.1.5 0 .7l-.5.8-.7.8c-.2.2-.4.5-.2.9.2.4 1.1 1.8 2.4 2.9 1.7 1.5 3.1 2 3.5 2.2.4.2.7.2.9-.1l1.3-1.6c.3-.4.6-.3 1-.2l2.7 1.3c.4.2.7.3.8.5.2.2.2 1 .1 1.9Z"/></svg>' +
      '</a>';
    });
    host.innerHTML = '<span>Se tiver alguma dificuldade, fale com o ' + parentMarkup[0] +
      ' ou a ' + parentMarkup[1] + '!</span>';
  }

  async function remoteLookup(params) {
    if (!remoteDirectory || !meta.rsvpUrl) return null;
    const url = new URL(meta.rsvpUrl);
    url.searchParams.set("action", "lookup");
    Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
    const response = await fetch(url.toString(), { cache: "no-store", redirect: "follow" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false || !Array.isArray(data.guests)) {
      throw appError((data && data.error) || "Não foi possível consultar a lista.");
    }
    mergeGuests(data.guests);
    mergeGuests(data.related);
    return data.guests.map((item) => normalizeGuest(item)).filter(Boolean);
  }

  function renderMeta() {
    const name = $("#inviteName");
    if (name) {
      name.replaceChildren();
      name.setAttribute("aria-label", meta.name);
      Array.from(meta.name.toUpperCase()).forEach((letter) => {
        const block = document.createElement("span");
        block.textContent = letter === " " ? "\u00a0" : letter;
        if (letter === " ") block.className = "is-space";
        name.appendChild(block);
      });
    }
    const ageBadge = $("#inviteAge");
    if (ageBadge) ageBadge.textContent = meta.age;
    $("#inviteAgeText").textContent = meta.age;
    document.title = "Confirmação de presença · " + meta.name + " faz " + meta.age + "!";

    const chips = [];
    chips.push('<a class="invite-chip invite-chip-link" href="' + esc(calendarHref()) + '" download="aniversario-ben.ics" title="Adicionar à agenda">📅 ' + esc(longDate(meta.date)) + " · adicionar ↗</a>");
    if (meta.time) {
      chips.push('<span class="invite-chip">🕒 ' + esc(displayTime(meta.time)) + "</span>");
    }
    const map = mapsLink();
    const place = meta.location || (map ? "Ver no mapa" : "Local a definir");
    chips.push(
      map
        ? '<a class="invite-chip invite-chip-link" href="' + esc(map) +
          '" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps">📍 ' +
          esc(place) + " ↗</a>"
        : '<span class="invite-chip">📍 ' + esc(place) + "</span>"
    );
    $("#inviteMeta").innerHTML = chips.join("");
    renderParentContacts();
  }

  function renderPicker() {
    current = null;

    if (meta.inviteMode === "links") {
      $("#inviteSub").textContent = "Abra o link pessoal que você recebeu.";
      $("#inviteContent").innerHTML =
        '<div class="invite-error">' +
          '<p>Para confirmar sua presença, use o <strong>link individual</strong> que os anfitriões enviaram. 💌</p>' +
          '<p class="invite-hint">Não encontrou seu link? Fale com os anfitriões. 💬</p>' +
        "</div>";
      return;
    }

    $("#inviteSub").textContent = "Encontre seu nome para confirmar a presença.";

    $("#inviteContent").innerHTML =
      '<div class="invite-picker">' +
        '<p class="invite-step-label">🔎 Digite seu nome para buscar na lista</p>' +
        '<label class="field-label invite-search">' +
          '<input id="guestSearch" class="input" type="search" placeholder="Digite seu nome para confirmar…" autocomplete="off" aria-label="Digite seu nome para confirmar presença" />' +
        "</label>" +
        '<div id="guestPickList" class="invite-guest-list"></div>' +
      "</div>";

    renderPickList("");
    const search = $("#guestSearch");
    if (search) {
      search.addEventListener("input", () => {
        clearTimeout(lookupTimer);
        const value = search.value;
        if (norm(value).length < 3) {
          renderPickList(value);
          return;
        }
        const list = $("#guestPickList");
        if (list) list.innerHTML = lookupLoadingMarkup();
        lookupTimer = setTimeout(() => renderPickList(value), 100);
      });
    }
  }

  function lookupLoadingMarkup() {
    return '<div class="invite-search-progress" role="status">' +
      '<span class="invite-spinner" aria-hidden="true"></span>' +
      '<span>Estamos buscando seu nome…</span>' +
    '</div>';
  }

  async function renderPickList(query) {
    const list = $("#guestPickList");
    if (!list) return;

    const q = norm(query);
    if (q.length < 3) {
      list.innerHTML =
        '<p class="invite-hint invite-search-hint">Digite pelo menos 3 letras do seu nome para ver as opções.</p>';
      return;
    }

    const sequence = ++lookupSequence;
    let source = guests;
    if (remoteDirectory) {
      list.innerHTML = lookupLoadingMarkup();
      try {
        const remote = await remoteLookup({ q });
        if (sequence !== lookupSequence) return;
        if (remote) source = remote;
      } catch (error) {
        if (sequence !== lookupSequence) return;
        if (!guests.length) {
          list.innerHTML =
            '<p class="invite-hint">Não consegui consultar os nomes agora. Verifique sua internet e tente novamente.</p>';
          return;
        }
      }
    }

    const matches = source
      .filter((g) => norm(displayGuestName(g)).includes(q))
      .sort((a, b) => {
        const aStarts = norm(displayGuestName(a)).startsWith(q) ? 0 : 1;
        const bStarts = norm(displayGuestName(b)).startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name, "pt-BR");
      })
      .slice(0, 12);

    const groups = [
      { title: "Adultos", items: matches.filter((g) => g.type === "adult") },
      { title: "Crianças", items: matches.filter((g) => g.type === "child") },
    ];

    const html = groups
      .filter((group) => group.items.length)
      .map(
        (group) =>
          '<div class="invite-group"><h2>' + group.title + "</h2>" +
          '<div class="invite-guest-grid">' +
            group.items
              .map(
                (g) =>
                  '<button class="invite-guest-btn" type="button" data-key="' + esc(g.key) + '">' +
                    '<span class="invite-guest-avatar ' + g.type + '">' + esc(initials(g.name)) + "</span>" +
                    '<span class="invite-guest-name">' + esc(displayGuestName(g)) + "</span>" +
                  "</button>"
              )
              .join("") +
          "</div></div>"
      )
      .join("");

    list.innerHTML = html ||
      '<div class="invite-unlisted">' +
        '<p class="invite-unlisted-title">Não encontrou seu nome?</p>' +
        '<p class="invite-hint">Digite seu nome completo abaixo. Sua presença será confirmada e aparecerá para os pais do Ben como um novo convidado.</p>' +
        '<form id="unlistedGuestForm" class="invite-unlisted-form">' +
          '<label class="field-label" for="unlistedGuestName">Seu nome completo</label>' +
          '<input id="unlistedGuestName" class="input" name="name" type="text" minlength="3" maxlength="80" autocomplete="name" required value="' + esc(String(query || "").trim()) + '" />' +
          '<input class="invite-honeypot" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
          '<button class="btn btn-primary invite-unlisted-submit" type="submit">Confirmar minha presença</button>' +
          '<p class="invite-status" id="unlistedStatus" role="status" aria-live="polite"></p>' +
        '</form>' +
      '</div>';
  }

  async function submitUnlisted(form) {
    if (!form || sending || !meta.rsvpUrl) return;
    const nameInput = $("#unlistedGuestName", form);
    const websiteInput = $("[name=website]", form);
    const statusEl = $("#unlistedStatus", form);
    const name = String(nameInput ? nameInput.value : "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (name.length < 3) {
      if (statusEl) statusEl.textContent = "Digite seu nome completo.";
      if (nameInput) nameInput.focus();
      return;
    }

    sending = true;
    const button = $("button[type=submit]", form);
    if (button) button.disabled = true;
    if (statusEl) statusEl.textContent = "Enviando sua confirmação…";

    try {
      const result = await sendRsvp({
        action: "unlisted-rsvp",
        name,
        type: "adult",
        status: "confirmed",
        website: websiteInput ? websiteInput.value : "",
        startedAt: pageStartedAt,
      });
      const guest = normalizeGuest(result.guest || {
        id: guestKey(name, "adult"), name, type: "adult", status: "confirmed",
        rsvpAt: new Date().toISOString(), unlisted: true,
      });
      if (!guest) throw appError("Não foi possível registrar esse nome.");
      guest.status = "confirmed";
      guest.unlisted = true;
      mergeGuests([guest]);
      sending = false;
      renderRsvp(guests.find((item) => item.key === guest.key) || guest);
      celebrate();
      const savedStatus = $("#rsvpStatus");
      if (savedStatus) savedStatus.textContent = "Presença confirmada e enviada aos pais do Ben. Obrigado!";
      toast("Presença confirmada! 🎉", "ok");
    } catch (error) {
      sending = false;
      if (button) button.disabled = false;
      if (statusEl) statusEl.textContent = "Não foi possível enviar: " + (error.message || "erro de conexão") + ". Tente novamente.";
      toast("Não foi possível enviar sua confirmação.", "err");
    }
  }

  function linkedChildren(guest) {
    if (!guest || guest.type !== "adult") return [];
    return guests.filter(
      (c) =>
        c.type === "child" &&
        Array.isArray(c.guardians) &&
        c.guardians.includes(guest.key)
    );
  }

  function childStatusOptions(selected) {
    const options = [
      { value: "pending", label: "Ainda não sei" },
      { value: "confirmed", label: "Vai comigo" },
      { value: "declined", label: "Não vai" },
    ];
    return options
      .map(
        (o) =>
          '<option value="' + o.value + '"' +
          (o.value === selected ? " selected" : "") + ">" + o.label + "</option>"
      )
      .join("");
  }

  function renderRsvp(guest) {
    current = guest;
    $("#inviteSub").textContent = "Olá, " + displayGuestName(guest) + "! Confirme sua presença.";

    const configured = !!meta.rsvpUrl;
    const status = GUEST_STATUS[guest.status] || GUEST_STATUS.pending;
    const when = guest.rsvpAt ? " · " + timeAgo(guest.rsvpAt) : "";

    let answer = "";
    if (guest.status === "confirmed") {
      answer = '<div class="invite-answer ok">✅ Presença confirmada — Obrigado, nos vemos lá!<span>' + esc(when) + "</span></div>";
    } else if (guest.status === "declined") {
      answer = '<div class="invite-answer no">Não tem problema, nos vemos em breve! Obrigado!<span>' + esc(when) + "</span></div>";
    }

    const kids = linkedChildren(guest);
    const kidsHtml = kids.length
      ? '<div class="invite-kids">' +
          '<h2>🧒 Crianças com você</h2>' +
          '<p class="invite-hint">Confirme também a presença das crianças pelas quais você é responsável.</p>' +
          kids
            .map(
              (child) =>
                '<label class="invite-kid-row">' +
                  '<span class="invite-guest-avatar child">' + esc(initials(child.name)) + "</span>" +
                  '<span class="invite-kid-name">' + esc(displayGuestName(child)) + "</span>" +
                  '<select class="input invite-kid-select" data-child-status="' + esc(child.key) +
                    '" aria-label="Presença de ' + esc(displayGuestName(child)) + '">' +
                    childStatusOptions(child.status) +
                  "</select>" +
                "</label>"
            )
            .join("") +
        "</div>"
      : "";

    let guardianNote = "";
    if (guest.type === "child" && Array.isArray(guest.guardians) && guest.guardians.length) {
      const names = guests
        .filter((a) => a.type === "adult" && guest.guardians.includes(a.key))
        .map((a) => displayGuestName(a));
      if (names.length) {
        guardianNote =
          '<p class="invite-hint">Responsável: <strong>' + esc(names.join(", ")) + "</strong></p>";
      }
    }

    const messageField =
      '<label class="field-label invite-message-label">Quer deixar um recadinho para o Ben? <span>(opcional)</span>' +
        '<textarea id="rsvpMessage" class="input invite-textarea" maxlength="280" rows="3" ' +
          'placeholder="Ex.: Estamos animados para comemorar com você!">' +
          esc(guest.rsvpMessage || "") +
        "</textarea>" +
      "</label>";

    const responseArea = guest.status === "declined"
      ? '<div class="decline-farewell">' +
          '<p>Se quiser deixar uma mensagem para o Ben, fique à vontade!</p>' +
          messageField +
          '<button class="btn decline-exit-btn" type="button" data-exit-invite><span aria-hidden="true">🚪</span> Salvar recado e sair</button>' +
          '<button class="invite-link-btn" type="button" data-rsvp="confirmed">Mudei de ideia: vou comemorar</button>' +
        '</div>'
      : messageField +
        '<p class="invite-step-label">Escolha sua resposta</p>' +
        '<div class="invite-actions">' +
          '<button class="btn btn-primary invite-btn invite-confirm-btn' + (guest.status === "confirmed" ? " is-current" : "") +
            '" type="button" data-rsvp="confirmed"' + (configured ? "" : " disabled") + ">🎉 Vou comemorar</button>" +
          '<button class="btn btn-ghost invite-btn" type="button" data-rsvp="declined"' + (configured ? "" : " disabled") + ">😢 Não poderei ir</button>" +
        "</div>";

    $("#inviteContent").innerHTML =
      '<div class="invite-rsvp">' +
        '<p class="invite-hello">Olá, <strong>' + esc(displayGuestName(guest)) + "</strong>! 🎉</p>" +
        answer +
        guardianNote +
        kidsHtml +
        responseArea +
        '<p class="invite-status" id="rsvpStatus" role="status" aria-live="polite">' +
          (guest.status === "pending" ? "Status atual: " + status.label : "") +
        "</p>" +
        (configured
          ? ""
          : '<p class="invite-warning">A confirmação online ainda não foi configurada. Fale com os anfitriões para avisar.</p>') +
        (meta.inviteMode === "links"
          ? ""
          : '<button class="invite-link-btn" type="button" data-change-name>Não sou ' +
            esc(displayGuestName(guest)) + " · escolher outro nome</button>") +
      "</div>";
  }

  async function selectGuest(key) {
    let guest = guests.find((g) => g.key === key);
    if (remoteDirectory) {
      try {
        const found = await remoteLookup({ id: key });
        if (found && found.length) guest = guests.find((g) => g.key === key) || found[0];
      } catch (error) {
        if (!guest) {
          toast("Não consegui abrir esse convite agora.", "err");
          return;
        }
      }
    }
    if (!guest) return;
    try {
      history.replaceState(null, "", location.pathname + "?convite=" + encodeURIComponent(key));
    } catch (e) {
      /* file:// pode bloquear */
    }
    renderRsvp(guest);
  }

  function clearGuestParam() {
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {
      /* file:// pode bloquear */
    }
    renderPicker();
  }

  async function sendRsvp(payload) {
    const url = meta.rsvpUrl;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
        cache: "no-store",
      });

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = null;
      }

      if (!res.ok) throw appError((data && data.error) || "Erro " + res.status + " no servidor.");
      if (data && data.ok === false) {
        throw appError(data.error || "O servidor recusou a resposta.");
      }
      return {
        ok: true,
        guest: data && data.guest ? data.guest : null,
        children: data && Array.isArray(data.children) ? data.children : [],
      };
    } catch (err) {
      if (err && err.__app) throw err;

      // Alguns navegadores bloqueiam a leitura da resposta do Apps Script (CORS).
      // Nesse caso, reenvia em modo opaco: a resposta é gravada e confirmamos na tela.
      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        return { ok: true, opaque: true };
      } catch (err2) {
        throw appError("Não consegui conectar. Verifique a internet e tente de novo.");
      }
    }
  }

  function showFarewell() {
    document.body.classList.add("is-invite-closing");
    $("#inviteContent").innerHTML =
      '<div class="invite-goodbye" role="status">' +
        '<div class="goodbye-door" aria-hidden="true"><span></span></div>' +
        '<h2>Obrigado por responder!</h2>' +
        '<p>Nos vemos em breve! 🚀</p>' +
      '</div>';
  }

  async function submit(status, exitAfter) {
    if (!current || sending) return;
    if (!meta.rsvpUrl) {
      toast("A confirmação online ainda não foi configurada.", "warn");
      return;
    }

    const messageEl = $("#rsvpMessage");
    const message = (messageEl ? messageEl.value : "").trim().slice(0, 280);
    const guest = current;

    const childUpdates = [];
    $$("[data-child-status]").forEach((select) => {
      const child = guests.find((g) => g.key === select.dataset.childStatus);
      if (!child || child.status === select.value) return;
      if (select.value !== "confirmed" && select.value !== "declined") return;
      childUpdates.push({ id: child.key, status: select.value });
    });

    sending = true;
    $$("[data-rsvp]").forEach((btn) => { btn.disabled = true; });
    const statusEl = $("#rsvpStatus");
    if (statusEl) statusEl.textContent = "Enviando sua resposta…";

    try {
      const result = await sendRsvp({
        id: guest.key,
        name: guest.name,
        type: guest.type,
        status,
        message,
        children: childUpdates,
      });

      guest.status = status;
      guest.rsvpAt =
        result.guest && result.guest.rsvpAt ? result.guest.rsvpAt : new Date().toISOString();
      guest.rsvpMessage =
        result.guest && typeof result.guest.rsvpMessage === "string"
          ? result.guest.rsvpMessage
          : message;

      // Atualiza as crianças localmente (o servidor devolve o que conseguiu gravar).
      const savedChildren = Array.isArray(result.children) ? result.children : childUpdates;
      savedChildren.forEach((update) => {
        const child = guests.find((g) => g.key === update.id);
        if (!child) return;
        child.status = update.status;
        child.rsvpAt = update.rsvpAt || new Date().toISOString();
      });

      sending = false;
      renderRsvp(guest);
      if (status === "confirmed") celebrate();

      const el = $("#rsvpStatus");
      if (el) {
        el.textContent = result.opaque
          ? "Resposta enviada! Pode levar alguns segundos para aparecer na lista dos anfitriões."
          : "Resposta registrada. Obrigado!";
      }
      toast(status === "confirmed" ? "Presença confirmada! 🎉" : "Resposta enviada. 💙", "ok");
      if (exitAfter) window.setTimeout(showFarewell, 250);
    } catch (e) {
      sending = false;
      renderRsvp(guest);
      const el = $("#rsvpStatus");
      if (el) {
        el.textContent = "Não foi possível enviar: " + (e.message || "erro de conexão") + ". Tente de novo.";
      }
      toast("Não foi possível enviar sua resposta.", "err");
    }
  }

  function bind() {
    $("#inviteContent").addEventListener("submit", (event) => {
      if (event.target.matches("#unlistedGuestForm")) {
        event.preventDefault();
        submitUnlisted(event.target);
      }
    });

    $("#inviteContent").addEventListener("click", (event) => {
      const pick = event.target.closest("[data-key]");
      if (pick) {
        selectGuest(pick.dataset.key);
        return;
      }

      const rsvp = event.target.closest("[data-rsvp]");
      if (rsvp) {
        submit(rsvp.dataset.rsvp);
        return;
      }

      if (event.target.closest("[data-exit-invite]")) {
        submit("declined", true);
        return;
      }

      if (event.target.closest("[data-change-name]")) {
        clearGuestParam();
        return;
      }

      if (event.target.closest("[data-retry]")) {
        init();
      }
    });
  }

  async function init() {
    const ok = await loadData();
    renderMeta();

    if (!ok) {
      $("#inviteSub").textContent = "Não consegui carregar o convite.";
      $("#inviteContent").innerHTML =
        '<div class="invite-error"><p>Verifique sua internet e tente de novo.</p>' +
        '<button class="btn btn-primary" type="button" data-retry>Tentar de novo</button></div>';
      return;
    }

    const key = new URLSearchParams(location.search).get("convite");
    if (key) {
      if (remoteDirectory) {
        try {
          await remoteLookup({ id: key });
        } catch (error) {
          /* usa a cópia de contingência, se existir */
        }
      }
      const guest = guests.find((g) => g.key === key);
      if (guest) {
        renderRsvp(guest);
        return;
      }

      $("#inviteSub").textContent = "Não encontrei esse convite.";
      $("#inviteContent").innerHTML =
        '<div class="invite-error"><p>Este link não corresponde a nenhum convidado. ' +
        "Talvez o nome tenha sido atualizado.</p>" +
        (meta.inviteMode === "links"
          ? '<p class="invite-hint">Confira o link com os anfitriões. 💬</p>'
          : '<button class="btn btn-primary" type="button" data-change-name>Ver lista de convidados</button>') +
        "</div>";
      return;
    }

    renderPicker();
  }

  bind();
  init();
})();
