(() => {
  const $ = (id) => document.getElementById(id);

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

  const applyMeta = (meta) => {
    if (!meta || typeof meta !== "object") return;

    const name = String(meta.name || "Ben").trim().slice(0, 40) || "Ben";
    const age = Math.min(99, Math.max(1, parseInt(meta.age, 10) || 5));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : "";
    const time = /^\d{2}:\d{2}$/.test(meta.time) ? meta.time : "";
    const location = splitLocation(meta.location);

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
    setText("animatedTimeText", displayTime(time));
    setText("animatedLocationName", location[0]);

    const detail = $("animatedLocationDetail");
    if (detail) {
      detail.textContent = location[1];
      detail.hidden = !location[1];
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

  const load = async () => {
    try {
      const response = await fetch("event.json?t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
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
