/* ============================================================
   ID estável do convidado — usado pelo app e pela página do convite
   O mesmo nome + tipo gera sempre o mesmo ID (FNV-1a 32 bits).
   ============================================================ */

(function () {
  "use strict";

  function guestKey(name, type) {
    const base = String(name == null ? "" : name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const kind = type === "adult" ? "adult" : "child";
    const text = base + "|" + kind;

    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "g" + (hash >>> 0).toString(36);
  }

  window.guestKey = guestKey;
})();
