(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const main = $("m2Main");
  const gifts = $("giftScreen");
  const giftAction = $("giftAction");
  const backButton = $("backButton");
  const clipVideo = $("m2ClipVideo");
  const openingVideo = $("openingVideo");
  const experience = $("experience");
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const clipVisible = () => !!clipVideo && clipVideo.offsetParent !== null &&
    !document.hidden && !gifts?.classList.contains("is-active");

  const playClip = () => {
    if (!clipVideo || reduceMotion || !clipVisible()) return;
    clipVideo.play?.().catch(() => { /* autoplay bloqueado: mantém o poster */ });
  };

  if (clipVideo && reduceMotion) {
    clipVideo.pause();
  } else if (clipVideo && "IntersectionObserver" in window) {
    const clipObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) playClip();
      else clipVideo.pause();
    }, { threshold: 0.15 });
    clipObserver.observe(clipVideo);
  } else {
    playClip();
  }

  const openingVisible = () => !!experience &&
    experience.classList.contains("is-prelude-complete") &&
    !experience.classList.contains("is-started");

  const syncOpeningVideo = () => {
    if (!openingVideo) return;
    if (openingVisible() && !document.hidden && !reduceMotion) {
      openingVideo.play?.().catch(() => { /* autoplay bloqueado: mantém o poster */ });
    } else {
      openingVideo.pause();
    }
  };

  if (openingVideo) {
    if (reduceMotion) openingVideo.pause();
    if (experience && "MutationObserver" in window) {
      new MutationObserver(syncOpeningVideo).observe(experience, { attributes: true, attributeFilter: ["class"] });
    }
    syncOpeningVideo();
  }

  const fallback = {
    date: "2027-01-09",
    time: "18:00",
    giftSuggestions: ["Roupa: 6 anos", "Calçado: 27"],
    invite: { giftLoveValue: "Tudo do universo Toy Story ou bloquinhos de montar estilo Lego" },
  };

  const setText = (id, value) => {
    const node = $(id);
    if (node && value != null && String(value).trim()) node.textContent = String(value).trim();
  };

  // Mostra só o nome do lugar (sem o endereço completo) na linha sob a data.
  const shortVenue = (value) => {
    const cleaned = String(value || "").split(/\s*—\s*/)[0].trim();
    if (!cleaned) return "Enjoy Kids - Liv Mall Shopping";
    const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.join(" - ") : parts[0];
  };

  const splitGift = (value, label, content) => {
    const parts = String(value || "").split(":");
    return { label: (parts.shift() || label).trim(), value: (parts.join(":") || content).trim() };
  };

  const applyModelData = (raw) => {
    const meta = Object.assign({}, fallback, raw || {});
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(meta.date || ""));
    if (date) {
      const value = new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
      setText("m2Month", new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(value).toUpperCase());
      setText("m2Day", date[3]);
    }

    const suggestions = Array.isArray(meta.giftSuggestions) ? meta.giftSuggestions : fallback.giftSuggestions;
    const first = splitGift(suggestions[0], "Roupa", "6 anos");
    const second = splitGift(suggestions[1], "Calçado", "27");
    setText("giftOneLabel", first.label);
    setText("giftOneValue", first.value);
    setText("giftTwoLabel", second.label);
    setText("giftTwoValue", second.value);
    setText("giftToyValue", Object.assign({}, fallback.invite, meta.invite || {}).giftLoveValue);

    setText("m2VenueName", shortVenue(meta.location));

    const mapLink = $("animatedLocation");
    const mapsUrl = String(meta.mapsUrl || "").trim();
    if (mapLink && /^https?:\/\//i.test(mapsUrl)) mapLink.href = mapsUrl;
  };

  const showGifts = (visible) => {
    document.getElementById("experience")?.classList.toggle("is-gifts-open", visible);
    main.classList.toggle("is-hidden", visible);
    gifts.classList.toggle("is-active", visible);
    main.setAttribute("aria-hidden", String(visible));
    gifts.setAttribute("aria-hidden", String(!visible));
    if (clipVideo) {
      if (visible) clipVideo.pause();
      else playClip();
    }
    (visible ? backButton : giftAction).focus({ preventScroll: true });
  };

  document.addEventListener("visibilitychange", () => {
    if (openingVideo) {
      if (document.hidden) openingVideo.pause();
      else syncOpeningVideo();
    }
    if (!clipVideo) return;
    if (document.hidden) clipVideo.pause();
    else if (!gifts?.classList.contains("is-active")) playClip();
  });

  giftAction?.addEventListener("click", () => showGifts(true));
  backButton?.addEventListener("click", () => showGifts(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !gifts?.classList.contains("is-active")) return;
    event.preventDefault();
    showGifts(false);
  });

  fetch("event.json?_=" + Date.now(), { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((payload) => applyModelData(payload && payload.meta))
    .catch(() => applyModelData(fallback));
})();
