/* ============================================================
   Convite digital + RSVP — Ben faz 5!
   Lê data.json (ou convidados.json) e envia a resposta ao Apps Script.
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
      inviteMode: base.inviteMode === "links" ? "links" : "search",
    };
  }

  function mapsLink() {
    if (meta.mapsUrl) return meta.mapsUrl;
    const query = String(meta.location || "").trim();
    if (!query) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  async function loadData() {
    const files = ["data.json", "convidados.json"];
    for (const file of files) {
      try {
        const res = await fetch(file + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        const list = Array.isArray(json)
          ? json
          : json && Array.isArray(json.guests)
            ? json.guests
            : [];
        if (!list.length) continue;

        meta = normalizeMeta(json && json.meta);

        const seen = new Set();
        guests = list
          .filter((g) => g && typeof g === "object" && g.name)
          .map((g) => {
            const name = String(g.name).slice(0, 80);
            const type = g.type === "adult" ? "adult" : "child";
            let key = String(g.id || "").trim();
            if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) key = guestKey(name, type);
            const rsvpAt =
              typeof g.rsvpAt === "string" && !isNaN(Date.parse(g.rsvpAt)) ? g.rsvpAt : "";
            return {
              key,
              name,
              type,
              status: GUEST_STATUS[g.status] ? g.status : "pending",
              guardians: Array.isArray(g.guardians) ? g.guardians.map(String) : [],
              rsvpAt,
              rsvpMessage: String(g.rsvpMessage || "").slice(0, 280),
            };
          })
          .filter((g) => {
            if (seen.has(g.key)) return false;
            seen.add(g.key);
            return true;
          });

        if (guests.length) return true;
      } catch (e) {
        /* tenta o próximo arquivo */
      }
    }
    return false;
  }

  function renderMeta() {
    $("#inviteName").textContent = meta.name;
    $("#inviteAge").textContent = meta.age;
    $("#inviteAgeText").textContent = meta.age;
    document.title = "Convite · " + meta.name + " faz " + meta.age + "!";

    const chips = [];
    chips.push('<span class="invite-chip">📅 ' + esc(longDate(meta.date)) + "</span>");
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
        '<p class="invite-step-label"><span>1</span> Digite 3 letras e escolha seu nome</p>' +
        '<label class="field-label invite-search">🔎' +
          '<input id="guestSearch" class="input" type="search" placeholder="Digite seu nome para confirmar…" autocomplete="off" aria-label="Digite seu nome para confirmar presença" />' +
        "</label>" +
        '<div id="guestPickList" class="invite-guest-list"></div>' +
        '<p class="invite-hint">Não encontrou seu nome? Fale com os anfitriões. 💬</p>' +
      "</div>";

    renderPickList("");
    const search = $("#guestSearch");
    if (search) {
      search.addEventListener("input", () => renderPickList(search.value));
    }
  }

  function renderPickList(query) {
    const list = $("#guestPickList");
    if (!list) return;

    const q = norm(query);
    if (q.length < 3) {
      list.innerHTML =
        '<p class="invite-hint invite-search-hint">Digite pelo menos 3 letras do seu nome para ver as opções.</p>';
      return;
    }

    const matches = guests
      .filter((g) => norm(g.name).includes(q))
      .sort((a, b) => {
        const aStarts = norm(a.name).startsWith(q) ? 0 : 1;
        const bStarts = norm(b.name).startsWith(q) ? 0 : 1;
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
                    '<span class="invite-guest-name">' + esc(g.name) + "</span>" +
                  "</button>"
              )
              .join("") +
          "</div></div>"
      )
      .join("");

    list.innerHTML =
      html || '<p class="invite-hint">Nenhum nome encontrado com essas letras. Tente outro trecho do nome.</p>';
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
    $("#inviteSub").textContent = "Olá, " + guest.name + "! Confirme sua presença.";

    const configured = !!meta.rsvpUrl;
    const status = GUEST_STATUS[guest.status] || GUEST_STATUS.pending;
    const when = guest.rsvpAt ? " · " + timeAgo(guest.rsvpAt) : "";

    let answer = "";
    if (guest.status === "confirmed") {
      answer = '<div class="invite-answer ok">✅ Presença confirmada<span>' + esc(when) + "</span></div>";
    } else if (guest.status === "declined") {
      answer = '<div class="invite-answer no">💙 Você marcou que não poderá ir<span>' + esc(when) + "</span></div>";
    }

    const hint =
      guest.status === "pending"
        ? "Sua resposta ajuda a organizar tudo. Escolha uma opção:"
        : "Mudou de ideia? É só responder de novo.";

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
                  '<span class="invite-kid-name">' + esc(child.name) + "</span>" +
                  '<select class="input invite-kid-select" data-child-status="' + esc(child.key) +
                    '" aria-label="Presença de ' + esc(child.name) + '">' +
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
        .map((a) => a.name);
      if (names.length) {
        guardianNote =
          '<p class="invite-hint">Responsável: <strong>' + esc(names.join(", ")) + "</strong></p>";
      }
    }

    $("#inviteContent").innerHTML =
      '<div class="invite-rsvp">' +
        '<p class="invite-hello">Olá, <strong>' + esc(guest.name) + "</strong>! 🎉</p>" +
        answer +
        guardianNote +
        '<p class="invite-hint">' + hint + "</p>" +
        kidsHtml +
        '<label class="field-label">Recado para os anfitriões (opcional)' +
          '<textarea id="rsvpMessage" class="input invite-textarea" maxlength="280" rows="3" ' +
            'placeholder="Ex.: Vamos adorar! O Ben está ansioso?">' +
            esc(guest.rsvpMessage || "") +
          "</textarea>" +
        "</label>" +
        '<p class="invite-step-label"><span>2</span> Escolha sua resposta</p>' +
        '<div class="invite-actions">' +
          '<button class="btn btn-primary invite-btn invite-confirm-btn' + (guest.status === "confirmed" ? " is-current" : "") +
            '" type="button" data-rsvp="confirmed"' + (configured ? "" : " disabled") + ">🎉 Vou comemorar</button>" +
          '<button class="btn btn-ghost invite-btn' + (guest.status === "declined" ? " is-current" : "") +
            '" type="button" data-rsvp="declined"' + (configured ? "" : " disabled") + ">😢 Não poderei ir</button>" +
        "</div>" +
        '<p class="invite-status" id="rsvpStatus" role="status" aria-live="polite">' +
          (guest.status === "pending" ? "Status atual: " + status.label : "") +
        "</p>" +
        (configured
          ? ""
          : '<p class="invite-warning">A confirmação online ainda não foi configurada. Fale com os anfitriões para avisar.</p>') +
        (meta.inviteMode === "links"
          ? ""
          : '<button class="invite-link-btn" type="button" data-change-name>Não sou ' +
            esc(guest.name) + " · escolher outro nome</button>") +
      "</div>";
  }

  function selectGuest(key) {
    const guest = guests.find((g) => g.key === key);
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
      return { ok: true, guest: data && data.guest ? data.guest : null };
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

  async function submit(status) {
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
