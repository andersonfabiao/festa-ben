(() => {
  const $ = (id) => document.getElementById(id);

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
  };

  const DEFAULT_GIFTS = ["Roupa: 6 anos", "Calçado: 27"];

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };

  const setIconText = (id, icon, text) => {
    const el = $(id);
    if (el) el.innerHTML = '<span aria-hidden="true">' + icon + "</span> " + escapeHtml(text);
  };

  const longDate = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Data a definir";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const weekday = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const text = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const displayTime = (value) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return "Horário a definir";
    const [hours, minutes] = value.split(":");
    return minutes === "00" ? parseInt(hours, 10) + "h" : parseInt(hours, 10) + "h" + minutes;
  };

  const calendarHref = (meta) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : "2027-01-09";
    const time = /^\d{2}:\d{2}$/.test(meta.time) ? meta.time : "18:00";
    const start = date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Festa Ben//Convite//PT-BR", "BEGIN:VEVENT",
      "DTSTART;TZID=America/Fortaleza:" + start,
      "DTEND;TZID=America/Fortaleza:" + date.replace(/-/g, "") + "T220000",
      "SUMMARY:Aniversário do " + String(meta.name || "Ben") + " - " + (parseInt(meta.age, 10) || 5) + " anos",
      "LOCATION:" + String(meta.location || "Enjoy Kids - Liv Mall Shopping").replace(/,/g, "\\,"),
      "DESCRIPTION:Venha comemorar com a gente!", "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  };

  const splitLocation = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return ["Local a definir", ""];
    const parts = cleaned.split(/\s*—\s*/);
    if (parts.length > 1) {
      return [parts[0], parts.slice(1).join(" — ")];
    }
    const comma = cleaned.indexOf(",");
    if (comma > 0) {
      return [cleaned.slice(0, comma).trim(), cleaned.slice(comma + 1).trim()];
    }
    return [cleaned, ""];
  };

  const normalizeCopy = (raw) => {
    const source = raw && typeof raw === "object" ? raw : {};
    const copy = {};
    Object.keys(INVITE_COPY_DEFAULTS).forEach((key) => {
      const value = String(source[key] == null ? "" : source[key]).trim().slice(0, 400);
      copy[key] = value || INVITE_COPY_DEFAULTS[key];
    });
    return copy;
  };

  const giftItems = (raw) => {
    const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_GIFTS;
    return list
      .map((item) => {
        const text = String(item || "").trim().slice(0, 120);
        if (!text) return null;
        const colon = text.indexOf(":");
        if (colon > 0) {
          return { label: text.slice(0, colon).trim(), value: text.slice(colon + 1).trim() };
        }
        return { label: "Sugestão", value: text };
      })
      .filter(Boolean)
      .slice(0, 6);
  };

  const renderGiftOptions = (meta, copy) => {
    const host = $("giftOptions");
    if (!host) return;
    const smalls = giftItems(meta.giftSuggestions)
      .map(
        (item) =>
          "<span><small>" + escapeHtml(item.label) + "</small><b>" +
          escapeHtml(item.value) + "</b></span>"
      )
      .join("");
    const love = copy.giftLoveValue
      ? '<span class="gift-theme"><small>' + escapeHtml(copy.giftLoveLabel) +
        "</small><b>" + escapeHtml(copy.giftLoveValue) + "</b></span>"
      : "";
    host.innerHTML = smalls + love;
  };

  const applyInviteCopy = (meta, copy) => {
    setText("openingEyebrow", copy.openingEyebrow);
    setText("openingTitleLead", copy.openingTitle);
    setText("openingTitleHighlight", copy.openingHighlight);
    setText("startButtonLabel", copy.startLabel);
    setIconText("openingSoundHint", "♫", copy.openingSoundHint);
    setIconText("buzzSoundHint", "♫", copy.buzzSoundHint);
    setText("missionText", copy.missionText);
    setText("inviteMessage", copy.message);
    setText("animatedTimeLabel", copy.timeLabel);
    setText("giftTitle", copy.giftTitle);
    setText("confirmButtonLabel", copy.confirmLabel);
    setText("confirmNote", copy.confirmNote);
    setText("benVoiceCueTitle", copy.voiceCueTitle);
    setText("benVoiceCueHint", copy.voiceCueHint);
    renderGiftOptions(meta, copy);
    window.BEN_INVITE_COPY = copy;
  };

  const applyMeta = (meta) => {
    if (!meta || typeof meta !== "object") return;

    const name = String(meta.name || "Ben").trim().slice(0, 40) || "Ben";
    const age = Math.min(99, Math.max(1, parseInt(meta.age, 10) || 5));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : "";
    const rsvpDeadline = /^\d{4}-\d{2}-\d{2}$/.test(meta.rsvpDeadline) ? meta.rsvpDeadline : "2026-12-29";
    const time = /^\d{2}:\d{2}$/.test(meta.time) ? meta.time : "";
    const location = splitLocation(meta.location);
    const copy = normalizeCopy(meta.invite);

    applyInviteCopy(meta, copy);

    const blocks = $("animatedNameBlocks");
    if (blocks) {
      blocks.setAttribute("aria-label", name);
      blocks.innerHTML = Array.from(name.toUpperCase())
        .map((letter) => "<span>" + escapeHtml(letter) + "</span>")
        .join("");
    }

    setText("animatedAge", String(age));
    setText("animatedDateText", longDate(date));
    setText("animatedWeekday", weekday(date));
    const calendar = $("animatedDate");
    if (calendar) {
      calendar.setAttribute("aria-label", longDate(date));
    }
    setText("animatedTimeText", displayTime(time));
    const deadline = [copy.deadlinePrefix, longDate(rsvpDeadline), copy.deadlineSuffix]
      .filter(Boolean)
      .join(" ")
      .trim();
    setText("animatedRsvpDeadline", deadline);
    setText("animatedLocationName", location[0]);

    const detail = $("animatedLocationDetail");
    if (detail) {
      detail.textContent = location[1] ? location[1] + " · " + copy.mapHint : copy.mapHint;
      detail.hidden = !location[1] && !copy.mapHint;
    }

    const locationLink = $("animatedLocation");
    if (locationLink) {
      const mapUrl = /^https?:\/\//i.test(String(meta.mapsUrl || "").trim())
        ? String(meta.mapsUrl).trim()
        : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(String(meta.location || ""));
      locationLink.href = mapUrl;
      locationLink.setAttribute("aria-label", "Abrir a localização de " + location[0] + " no Google Maps");
    }

    const finalInvite = $("finalInvite");
    if (finalInvite) finalInvite.setAttribute("aria-label", "Convite do aniversário de " + name);

    document.title = "Uma aventura especial · " + name + " faz " + age + "!";

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        "content",
        "Abra o convite animado do aniversário de " + age + " anos de " + name +
          " e venha viver essa aventura com a gente!"
      );
    }
  };

  const fetchEventData = () => {
    if (!window.__benEventDataPromise) {
      window.__benEventDataPromise = fetch("event.json?t=" + Date.now(), { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
    }
    return window.__benEventDataPromise;
  };

  const load = async () => {
    try {
      const data = await fetchEventData();
      if (!data) return;
      applyMeta(data && data.meta);
    } catch {
      // Mantém os textos estáticos quando a configuração pública não está disponível.
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
