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
    date: "2026-12-05",
    time: "16:00",
    location: "",
    theme: "Toy Story",
    rsvpUrl: "",
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

  function normalizeMeta(raw) {
    const base = Object.assign({}, FALLBACK_META, raw && typeof raw === "object" ? raw : {});
    const url = String(base.rsvpUrl || "").trim();
    return {
      name: String(base.name || "Ben").slice(0, 40),
      age: Math.min(99, Math.max(1, parseInt(base.age, 10) || 5)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(base.date) ? base.date : FALLBACK_META.date,
      time: /^\d{2}:\d{2}$/.test(base.time) ? base.time : FALLBACK_META.time,
      location: String(base.location || ""),
      theme: String(base.theme || "Toy Story"),
      rsvpUrl: /^https?:\/\//i.test(url) ? url : "",
    };
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
            const rsvpAt =
              typeof g.rsvpAt === "string" && !isNaN(Date.parse(g.rsvpAt)) ? g.rsvpAt : "";
            return {
              key: guestKey(name, type),
              name,
              type,
              status: GUEST_STATUS[g.status] ? g.status : "pending",
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
      chips.push('<span class="invite-chip">🕒 ' + esc(meta.time.replace(":", "h")) + "</span>");
    }
    chips.push('<span class="invite-chip">📍 ' + esc(meta.location || "Local a definir") + "</span>");
    chips.push('<span class="invite-chip">🤠 ' + esc(meta.theme) + "</span>");
    $("#inviteMeta").innerHTML = chips.join("");
  }

  function renderPicker() {
    current = null;
    $("#inviteSub").textContent = "Encontre seu nome para confirmar a presença.";

    $("#inviteContent").innerHTML =
      '<div class="invite-picker">' +
        '<label class="field-label invite-search">🔎' +
          '<input id="guestSearch" class="input" type="search" placeholder="Buscar seu nome…" autocomplete="off" />' +
        "</label>" +
        '<div id="guestPickList" class="invite-guest-list"></div>' +
        '<p class="invite-hint">Não encontrou seu nome? Fale com os anfitriões. 💬</p>' +
      "</div>";

    renderPickList("");
    const search = $("#guestSearch");
    if (search) {
      search.addEventListener("input", () => renderPickList(search.value));
      search.focus();
    }
  }

  function renderPickList(query) {
    const q = norm(query);
    const filter = (g) => !q || norm(g.name).includes(q);

    const groups = [
      { title: "Adultos", items: guests.filter((g) => g.type === "adult" && filter(g)) },
      { title: "Crianças", items: guests.filter((g) => g.type === "child" && filter(g)) },
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

    const list = $("#guestPickList");
    if (list) list.innerHTML = html || '<p class="invite-hint">Nenhum nome encontrado.</p>';
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

    $("#inviteContent").innerHTML =
      '<div class="invite-rsvp">' +
        '<p class="invite-hello">Olá, <strong>' + esc(guest.name) + "</strong>! 🎉</p>" +
        answer +
        '<p class="invite-hint">' + hint + "</p>" +
        '<label class="field-label">Recado para os anfitriões (opcional)' +
          '<textarea id="rsvpMessage" class="input invite-textarea" maxlength="280" rows="3" ' +
            'placeholder="Ex.: Vamos adorar! O Ben está ansioso?">' +
            esc(guest.rsvpMessage || "") +
          "</textarea>" +
        "</label>" +
        '<div class="invite-actions">' +
          '<button class="btn btn-primary invite-btn' + (guest.status === "confirmed" ? " is-current" : "") +
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
        '<button class="invite-link-btn" type="button" data-change-name>Não sou ' +
          esc(guest.name) + " · escolher outro nome</button>" +
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
      });

      guest.status = status;
      guest.rsvpAt =
        result.guest && result.guest.rsvpAt ? result.guest.rsvpAt : new Date().toISOString();
      guest.rsvpMessage =
        result.guest && typeof result.guest.rsvpMessage === "string"
          ? result.guest.rsvpMessage
          : message;

      sending = false;
      renderRsvp(guest);

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
        '<button class="btn btn-primary" type="button" data-change-name>Ver lista de convidados</button></div>';
      return;
    }

    renderPicker();
  }

  bind();
  init();
})();
