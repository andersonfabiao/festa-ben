/* ============================================================
   Buzz — assistente local do painel do Ben
   Conversa em português, consulta os dados do painel e executa
   ações simples. Nada é enviado para fora deste navegador.
   ============================================================ */

(() => {
  "use strict";

  const api = window.BenApp;
  const root = document.getElementById("buzzRoot");
  if (!api || !root) return;

  const els = {
    toggle: document.getElementById("buzzToggle"),
    panel: document.getElementById("buzzPanel"),
    close: document.getElementById("buzzClose"),
    clear: document.getElementById("buzzClear"),
    messages: document.getElementById("buzzMessages"),
    suggestions: document.getElementById("buzzSuggestions"),
    form: document.getElementById("buzzForm"),
    input: document.getElementById("buzzInput"),
    send: document.getElementById("buzzSend"),
  };
  if (!els.panel || !els.messages || !els.form || !els.input) return;

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = (value) => brl.format(Number(value) || 0);
  const statusLabel = { confirmed: "Confirmado", pending: "Pendente", declined: "Não vai" };
  const itemStatusLabel = {
    todo: "A fazer",
    doing: "Em andamento",
    contracted: "Contratado",
    done: "Concluído",
  };

  let welcomed = false;
  let busy = false;
  let pendingConfirm = null;
  let awaiting = null;
  let actionToken = 0;

  const norm = (value) =>
    String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const todayISO = () => {
    const date = new Date();
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  };

  function plural(count, singular, pluralForm) {
    return count === 1 ? singular : pluralForm;
  }

  function formatDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "data a definir";
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const text = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatShortDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    const [year, month, day] = iso.split("-");
    return day + "/" + month + "/" + year;
  }

  function isHost(guest) {
    return ["pai", "mae", "papai", "mamae"].includes(norm(guest && guest.relation));
  }

  function displayName(guest) {
    const relation = String((guest && guest.relation) || "").trim();
    const name = String((guest && guest.name) || "").trim();
    if (relation && norm(name).startsWith(norm(relation) + " ")) return name;
    return [relation, name].filter(Boolean).join(" ");
  }

  function guestType(guest) {
    return guest && guest.type === "child" ? "criança" : "adulto";
  }

  function stageName(id) {
    const stage = api.stages().find((candidate) => candidate.id === id);
    return stage ? stage.name : id;
  }

  function findStage(value) {
    const query = norm(value);
    if (!query) return null;
    const stages = api.stages();
    let best = null;
    let bestScore = 0;
    stages.forEach((stage) => {
      const name = norm(stage.name);
      const id = norm(stage.id);
      let score = 0;
      if (query === id || query === name) score = 100;
      else if (query.includes(name) || name.includes(query)) score = 70;
      else if (id.length > 3 && new RegExp("\\b" + id + "\\b").test(query)) score = 60;
      if (score > bestScore) {
        best = stage;
        bestScore = score;
      }
    });
    if (best) return best;

    const aliases = [
      { id: "dia", words: ["depois da festa", "no dia", "dia da festa", "hora da festa"] },
      { id: "comida", words: ["comida", "bolo", "buffet", "doces", "salgados", "bebida"] },
      { id: "decoracao", words: ["decoracao", "decoração", "enfeites", "tema", "mesa"] },
      { id: "convidados", words: ["convite", "convidados", "lista"] },
      { id: "lembrancinhas", words: ["lembrancinhas", "brindes", "presentes", "sacolinhas"] },
      { id: "atividades", words: ["atividades", "brincadeiras", "recreacao", "recreação"] },
      { id: "local", words: ["local", "salao", "salão", "estrutura"] },
      { id: "ben", words: ["look do ben", "roupa do ben", "fantasia", "figurino"] },
      { id: "planejamento", words: ["planejamento", "inicio", "comeco", "começo"] },
    ];
    for (const alias of aliases) {
      if (alias.words.some((word) => query.includes(norm(word)))) {
        return stages.find((stage) => stage.id === alias.id) || null;
      }
    }
    return null;
  }

  function listLines(values, limit) {
    const max = limit || 12;
    if (!values.length) return "";
    const shown = values.slice(0, max).map((value) => "• " + value);
    if (values.length > max) shown.push("• e mais " + (values.length - max) + "…");
    return shown.join("\n");
  }

  function guestLine(guest) {
    const host = isHost(guest) ? " (anfitrião)" : "";
    return displayName(guest) + host;
  }

  function itemLine(item) {
    const parts = [item.title + " — " + (itemStatusLabel[item.status] || item.status)];
    if (item.due) parts.push("vence " + formatShortDate(item.due));
    if (Number(item.cost)) parts.push(money(item.cost));
    return parts.join(" · ");
  }

  function sortByDue(items) {
    return items.slice().sort((a, b) => {
      if (a.due && b.due) return a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "pt-BR");
      if (a.due) return -1;
      if (b.due) return 1;
      return a.title.localeCompare(b.title, "pt-BR");
    });
  }

  function daysUntil(iso, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year, month, day] = iso.split("-").map(Number);
    const [hour, minute] = String(time || "00:00").split(":").map(Number);
    const target = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
    return Math.ceil((target.getTime() - Date.now()) / 86400000);
  }

  /* ---------- Interface ---------- */

  function addMessage(role, text, actions) {
    const wrap = document.createElement("div");
    wrap.className = "buzz-msg is-" + role;

    if (role === "bot") {
      const avatar = document.createElement("span");
      avatar.className = "buzz-msg-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "🚀";
      wrap.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "buzz-bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);

    if (Array.isArray(actions) && actions.length) {
      const row = document.createElement("div");
      row.className = "buzz-actions";
      actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "buzz-action" +
          (action.primary ? " is-primary" : "") +
          (action.danger ? " is-danger" : "");
        button.textContent = action.label;
        button.addEventListener("click", () => {
          row.querySelectorAll("button").forEach((candidate) => {
            candidate.disabled = true;
          });
          row.classList.add("is-used");
          try {
            action.onClick();
          } catch (error) {
            console.error("Buzz:", error);
            bot("Tive um problema ao executar essa ação.");
          }
        });
        row.appendChild(button);
      });
      wrap.appendChild(row);
    }

    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
    return wrap;
  }

  function bot(text, actions) {
    return addMessage("bot", text, actions);
  }

  function setSuggestions(values) {
    if (!els.suggestions) return;
    els.suggestions.innerHTML = "";
    const items = (values || []).filter(Boolean);
    els.suggestions.hidden = !items.length;
    items.forEach((value) => {
      const label = typeof value === "string" ? value : value.label;
      const message = typeof value === "string" ? value : value.message;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "buzz-suggestion";
      button.textContent = label;
      button.addEventListener("click", () => sendMessage(message));
      els.suggestions.appendChild(button);
    });
  }

  function showTyping() {
    hideTyping();
    const wrap = document.createElement("div");
    wrap.className = "buzz-msg is-bot buzz-typing";
    wrap.id = "buzzTyping";
    const avatar = document.createElement("span");
    avatar.className = "buzz-msg-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "🚀";
    const bubble = document.createElement("div");
    bubble.className = "buzz-bubble";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("buzzTyping");
    if (typing) typing.remove();
  }

  function openPanel() {
    if (!welcomed) {
      welcomed = true;
      bot(
        "Oi! Eu sou o Buzz, assistente do Ben. 🚀\n\n" +
          "Posso consultar convidados, orçamento e checklist — e também adicionar convidados, criar itens e marcar tarefas. " +
          "Nossa conversa fica neste dispositivo. As alterações feitas por mim seguem a mesma sincronização do painel.\n\nO que você precisa?"
      );
      setSuggestions([
        "Quantos confirmados?",
        "O que falta no checklist?",
        "Ver o convite?",
        "Adicionar convidado",
      ]);
    }
    root.classList.add("is-open");
    els.panel.hidden = false;
    if (els.toggle) els.toggle.setAttribute("aria-expanded", "true");
    window.setTimeout(() => {
      if (window.matchMedia("(pointer: fine)").matches) els.input.focus();
    }, 80);
  }

  function closePanel() {
    root.classList.remove("is-open");
    els.panel.hidden = true;
    if (els.toggle) {
      els.toggle.setAttribute("aria-expanded", "false");
      els.toggle.focus();
    }
  }

  function clearChat() {
    els.messages.innerHTML = "";
    welcomed = false;
    pendingConfirm = null;
    awaiting = null;
    openPanel();
  }

  if (els.toggle) els.toggle.addEventListener("click", () => (els.panel.hidden ? openPanel() : closePanel()));
  if (els.close) els.close.addEventListener("click", closePanel);
  if (els.clear) els.clear.addEventListener("click", clearChat);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.panel.hidden) closePanel();
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(els.input.value);
  });

  async function sendMessage(value) {
    const text = String(value || "").trim();
    if (!text || busy) return;
    addMessage("user", text);
    els.input.value = "";
    setSuggestions([]);
    busy = true;
    if (els.send) els.send.disabled = true;
    showTyping();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 160));
      await respond(text);
    } catch (error) {
      console.error("Buzz:", error);
      hideTyping();
      bot("Tive um problema para responder. Tente de novo ou use o painel normalmente.");
    } finally {
      hideTyping();
      busy = false;
      if (els.send) els.send.disabled = false;
    }
  }

  /* ---------- Ações e confirmações ---------- */

  function finishAction(text) {
    const token = ++actionToken;
    const actions = [];
    if (api.canUndo()) {
      actions.push({
        label: "↩️ Desfazer",
        onClick: () => {
          if (token !== actionToken) {
            bot("Essa alteração já foi substituída por outra mais recente.");
            return;
          }
          actionToken++;
          const result = api.undo();
          bot(result.ok ? "Pronto, desfiz a última alteração." : result.error || "Não consegui desfazer.");
        },
      });
    }
    bot(text, actions);
  }

  function askConfirm(question, run) {
    pendingConfirm = run;
    bot(question, [
      {
        label: "Confirmar",
        primary: true,
        onClick: () => {
          pendingConfirm = null;
          run();
        },
      },
      {
        label: "Cancelar",
        onClick: () => {
          pendingConfirm = null;
          bot("Cancelado. Nada foi alterado.");
        },
      },
    ]);
  }

  function askChoice(question, matches, callback) {
    const actions = matches.slice(0, 5).map((match) => ({
      label:
        match.guest !== undefined
          ? displayName(match.guest)
          : match.subtask !== undefined
            ? (match.subtask.title.length > 30
                ? match.subtask.title.slice(0, 27) + "…"
                : match.subtask.title) + " (" + match.item.title + ")"
            : match.item.title.length > 36
              ? match.item.title.slice(0, 33) + "…"
              : match.item.title,
      onClick: () => callback(match),
    }));
    if (!actions.length) {
      bot("Não encontrei uma opção para essa escolha.");
      return;
    }
    bot(question, actions);
  }

  function resolveGuest(query, callback) {
    const matches = api.findGuests(query);
    if (!matches.length) {
      bot('Não encontrei ninguém com "' + query + '" na lista.');
      return;
    }
    const top = matches[0];
    const next = matches[1];
    if (
      top.score >= 85 ||
      (top.score >= 60 && (!next || top.score - next.score >= 15))
    ) {
      callback(top.guest);
      return;
    }
    askChoice("Encontrei mais de um convidado. Qual deles?", matches.slice(0, 5), (match) =>
      callback(match.guest)
    );
  }

  function resolveItem(query, callback) {
    const matches = api.findItems(query);
    if (!matches.length) {
      bot('Não encontrei nenhum item com "' + query + '" no checklist.');
      return;
    }
    const top = matches[0];
    const next = matches[1];
    if (
      top.score >= 85 ||
      (top.score >= 60 && (!next || top.score - next.score >= 15))
    ) {
      callback(top.item);
      return;
    }
    askChoice("Encontrei mais de um item. Qual deles?", matches.slice(0, 5), (match) =>
      callback(match.item)
    );
  }

  function findSubtasks(query) {
    const q = norm(query);
    if (!q) return [];
    const tokens = q.split(/\s+/).filter((token) => token.length > 1);
    const results = [];
    api.snapshot().items.forEach((item) => {
      (Array.isArray(item.subtasks) ? item.subtasks : []).forEach((subtask) => {
        const title = norm(subtask.title);
        let score = 0;
        if (title === q) score = 100;
        else if (title.includes(q)) score = 70 + Math.min(10, q.length);
        else if (q.includes(title)) score = 55;
        else if (tokens.length) {
          const hits = tokens.filter((token) => title.includes(token)).length;
          if (hits) score = 20 + Math.round((40 * hits) / tokens.length);
        }
        if (score) results.push({ item, subtask, score });
      });
    });
    return results
      .sort((a, b) => b.score - a.score || a.subtask.title.localeCompare(b.subtask.title, "pt-BR"))
      .slice(0, 6);
  }

  function resolveSubtask(query, callback) {
    const matches = findSubtasks(query);
    if (!matches.length) {
      bot('Não encontrei nenhum subitem com "' + query + '".');
      return;
    }
    const top = matches[0];
    const next = matches[1];
    if (
      top.score >= 85 ||
      (top.score >= 60 && (!next || top.score - next.score >= 15))
    ) {
      callback(top);
      return;
    }
    askChoice("Encontrei mais de um subitem. Qual deles?", matches.slice(0, 5), (match) =>
      callback(match)
    );
  }

  /* ---------- Extração de comandos ---------- */

  function looksLikeCommand(raw) {
    const text = norm(raw);
    if (!text) return false;
    if (
      /^(adicionar|incluir|criar|cadastrar|colocar|marcar|confirmar|excluir|remover|apagar|deletar|reabrir|abrir|ir|mostrar|ver|salvar|baixar|atualizar|quantos|quantas|quem|qual|quando|onde|como|o que|quanto|me ajuda|ajuda|oi|ola|bom dia|boa tarde|boa noite)\b/.test(
        text
      )
    ) {
      return true;
    }
    return /\b(convidado|convidada|item|tarefa|subitem|checklist|orcamento|nuvem|respostas|festa)\b/.test(
      text
    );
  }

  function parseGuestAdd(raw) {
    const text = String(raw || "");
    let type = null;
    const typeMatch = text.match(/\b(adulto|adulta|crian[cç]a|menino|menina|filho|filha)\b/i);
    if (typeMatch) type = /crian|menin|filh/i.test(typeMatch[1]) ? "child" : "adult";

    let rest = text
      .replace(/^\s*(?:por favor[,\s]+|pfv[,\s]+|quero\s+|gostaria de\s+|pode\s+|poderia\s+)/i, "")
      .replace(/^\s*(?:adicionar|incluir|criar|cadastrar|colocar)\s+/i, "")
      .replace(/^\s*(?:um|uma|o|a|os|as|novo|nova)\s+/i, "")
      .replace(/^\s*(?:convidado|convidada|adulto|adulta|crian[cç]a|menino|menina|pessoa)\s+/i, "")
      .trim();

    let guardianName = "";
    const guardianMatch = rest.match(/[,\s]+(?:filh[oa]\s+d[eoa]|respons[aá]vel\s+por)\s+(.+)$/i);
    if (guardianMatch) {
      guardianName = guardianMatch[1].replace(/[.,;!?]+$/g, "").trim();
      rest = rest.slice(0, guardianMatch.index).trim();
    }

    let phone = "";
    const phoneMatch = rest.match(/[,\s]+(?:com\s+)?(?:telefone|whatsapp|celular)\s*:?\s*([\d\s()+-]{8,})$/i);
    if (phoneMatch) {
      phone = phoneMatch[1].trim();
      rest = rest.slice(0, phoneMatch.index).trim();
    }

    const suffixType = rest.match(/[,\s]+como\s+(adulto|adulta|crian[cç]a|menino|menina)\s*$/i);
    if (suffixType) {
      type = /crian|menin/i.test(suffixType[1]) ? "child" : "adult";
      rest = rest.slice(0, suffixType.index).trim();
    }

    rest = rest.replace(/^[,;:\s]+|[,;:\s]+$/g, "").replace(/\s+/g, " ").trim();
    if (/^(convidado|convidada|adulto|adulta|crianca|menino|menina|pessoa)$/.test(norm(rest))) {
      rest = "";
    }
    return { name: rest, type, guardianName, phone };
  }

  function parseItemAdd(raw) {
    let rest = String(raw || "")
      .replace(/^\s*(?:por favor[,\s]+|pfv[,\s]+|quero\s+|gostaria de\s+|pode\s+|poderia\s+)/i, "")
      .replace(/^\s*(?:adicionar|incluir|criar|colocar)\s+/i, "")
      .replace(/^\s*(?:um|uma|o|a|novo|nova)\s+/i, "")
      .replace(/^\s*(?:item|tarefa)\s+/i, "")
      .replace(/\s+(?:no|na|ao|a)\s+(?:checklist|lista)\s*$/i, "")
      .trim();

    let stage = null;
    const stageMatch = rest.match(/[,\s]+(?:na|no|em)\s+(?:a\s+)?etapa\s+(.+)$/i);
    if (stageMatch) {
      stage = findStage(stageMatch[1]);
      rest = rest.slice(0, stageMatch.index).trim();
    } else {
      const placeMatch = rest.match(/[,\s]+(?:na|no|em)\s+(.+)$/i);
      if (placeMatch) {
        const candidate = findStage(placeMatch[1]);
        if (candidate) {
          stage = candidate;
          rest = rest.slice(0, placeMatch.index).trim();
        }
      }
    }
    const title = rest.replace(/[,\s]+$/g, "").trim();
    return {
      title: /^(item|tarefa|checklist)$/.test(norm(title)) ? "" : title,
      stage: stage ? stage.id : null,
    };
  }

  function parseSubtaskAdd(raw) {
    let rest = String(raw || "")
      .replace(/^\s*(?:adicionar|incluir|criar)\s+(?:um\s+|uma\s+)?subitem\s+/i, "")
      .trim();
    const match = rest.match(/^(.+?)\s+(?:em|no|na)\s+(?:o\s+|a\s+)?(?:item\s+|tarefa\s+)?(.+)$/i);
    if (match) return { title: match[1].trim(), itemQuery: match[2].trim() };
    return { title: /^subitem$/.test(norm(rest)) ? "" : rest, itemQuery: "" };
  }

  function parseSubtaskStatus(raw) {
    let match = String(raw || "").match(
      /^\s*(?:marcar|concluir|finalizar|terminar|riscar)\s+(?:o\s+|a\s+)?subitem\s+(.+?)\s+(?:como\s+)?(?:feito|conclu[ií]do|conclu[ií]da|pronto|pronta|riscad[oa]|ok)\s*$/i
    );
    if (match) return { query: match[1].trim(), done: true };

    match = String(raw || "").match(
      /^\s*(?:concluir|finalizar|terminar)\s+(?:o\s+|a\s+)?subitem\s+(.+)$/i
    );
    if (match) return { query: match[1].replace(/[.,;!?]+$/g, "").trim(), done: true };

    match = String(raw || "").match(
      /^\s*(?:reabrir|desmarcar|reverter|voltar)\s+(?:o\s+|a\s+)?subitem\s+(.+?)(?:\s+(?:para|como)\s+(?:a fazer|pendente|todo))?\s*$/i
    );
    if (match) return { query: match[1].trim(), done: false };

    return null;
  }

  function parseGuestStatus(raw) {
    let match = String(raw || "").match(
      /^\s*(?:marcar|definir|colocar|atualizar|mudar)\s+(?:a\s+presen[cç]a\s+d[eo]\s+|o\s+|a\s+)?(.+?)\s+como\s+(.+)$/i
    );
    if (match) {
      const status = guestStatusFrom(match[2]);
      if (status) return { query: match[1].trim(), status };
      return null;
    }

    match = String(raw || "").match(
      /^\s*(?:confirmar|confirmo)\s+(?:a\s+presen[cç]a\s+d[eo]\s+|o\s+|a\s+)?(.+)$/i
    );
    if (match && !/^(sim|isso|confirmar|confirmado)\b/i.test(match[1])) {
      return { query: match[1].replace(/[.,;!?]+$/g, "").trim(), status: "confirmed" };
    }

    match = String(raw || "").match(/^\s*(.+?)\s+(confirmou|vai|n[aã]o\s+vai|recusou)\b/i);
    if (match && !/^(quem|qual|quais|quantos|quantas|onde|quando|como|o que|alguem)\b/i.test(match[1].trim())) {
      return { query: match[1].trim(), status: guestStatusFrom(match[2]) };
    }
    return null;
  }

  function guestStatusFrom(value) {
    const text = norm(value);
    if (/^(confirmado|confirmada|confirmou|presente|vai|sim|comparecer|comparecera)$/.test(text)) {
      return "confirmed";
    }
    if (/^(nao vai|nao|recusou|recusado|recusada|declinou|ausente)$/.test(text)) {
      return "declined";
    }
    if (/^(pendente|talvez|aguardando|em aberto)$/.test(text)) {
      return "pending";
    }
    return null;
  }

  function parseItemStatus(raw) {
    let match = String(raw || "").match(
      /^\s*(?:marcar|concluir|finalizar|terminar|riscar)\s+(?:o\s+|a\s+)?(?:item\s+|tarefa\s+)?(.+?)\s+(?:como\s+)?(?:feito|conclu[ií]do|conclu[ií]da|pronto|pronta|riscad[oa]|ok)\s*$/i
    );
    if (match) return { query: match[1].trim(), status: "done" };

    match = String(raw || "").match(
      /^\s*(?:reabrir|desmarcar|reverter|voltar)\s+(?:o\s+|a\s+)?(?:item\s+|tarefa\s+)?(.+?)(?:\s+(?:para|como)\s+(?:a fazer|pendente|todo))?\s*$/i
    );
    if (match) return { query: match[1].trim(), status: "todo" };

    match = String(raw || "").match(
      /^\s*(?:marcar|definir|colocar|atualizar|mudar)\s+(?:o\s+|a\s+)?(?:item\s+|tarefa\s+)?(.+?)\s+como\s+(em andamento|andamento|contratado|contratada)\s*$/i
    );
    if (match) {
      return { query: match[1].trim(), status: /contrat/i.test(match[2]) ? "contracted" : "doing" };
    }

    match = String(raw || "").match(
      /^\s*(?:concluir|finalizar|terminar)\s+(?:o\s+|a\s+)?(?:item\s+|tarefa\s+)?(.+)$/i
    );
    if (match && !/\b(festa|orcamento|nuvem|convidado)\b/i.test(match[1])) {
      return { query: match[1].replace(/[.,;!?]+$/g, "").trim(), status: "done" };
    }
    return null;
  }

  function parseDelete(raw, kind) {
    const text = String(raw || "");
    if (kind === "item") {
      const itemMatch = text.match(
        /^\s*(?:excluir|remover|apagar|deletar)\s+(?:o\s+|a\s+)?(?:item|tarefa)\s+(.+)$/i
      );
      if (itemMatch) return itemMatch[1].trim();
      return "";
    }
    const guestMatch = text.match(
      /^\s*(?:excluir|remover|apagar|deletar)\s+(?:o\s+|a\s+)?(?:convidado|convidada|adulto|adulta|crian[cç]a)\s+(.+)$/i
    );
    if (guestMatch) return guestMatch[1].trim();
    const generic = text.match(/^\s*(?:excluir|remover|apagar|deletar)\s+(?:o\s+|a\s+)?(.+)$/i);
    if (generic && !/^(item|tarefa|subitem)\b/i.test(generic[1])) return generic[1].trim();
    return "";
  }

  function parseMoneyText(raw) {
    const match = String(raw || "").match(/(\d[\d.,]*)\s*(mil|k)?/i);
    if (!match) return null;
    let value = match[1];
    if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
    if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
    let number = parseFloat(value);
    if (!Number.isFinite(number)) return null;
    if (match[2]) number *= 1000;
    return Math.max(0, number);
  }

  function parseBudgetSet(raw) {
    const text = norm(raw);
    if (!/\b(orcamento|total)\b/.test(text)) return null;
    if (!/^(definir|mudar|alterar|ajustar|colocar|atualizar|trocar|aumentar|diminuir)|orcamento\b/.test(text)) {
      return null;
    }
    if (!/\b(para|de|em)\b/.test(text) && !/^definir|^mudar|^alterar|^ajustar|^colocar/.test(text)) return null;
    return parseMoneyText(raw);
  }

  function isGreeting(text) {
    return /^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|tudo bem|hey)\b/.test(text);
  }

  function isHelp(text) {
    return /\b(ajuda|me ajuda|comandos|o que voce (faz|pode)|como funciona|o que da para fazer)\b/.test(
      text
    );
  }

  function isAddGuest(text) {
    if (/\b(item|tarefa|subitem|checklist|orcamento|nuvem|convite)\b/.test(text)) return false;
    if (
      /^(adicionar|incluir|cadastrar|colocar)\b/.test(text) &&
      /\b(convidado|convidada|adulto|adulta|crianca|menino|menina|pessoa)\b/.test(text)
    ) {
      return true;
    }
    return /^(adicionar|incluir|cadastrar)\b/.test(text);
  }

  function isAddItem(text) {
    return (
      /^(adicionar|incluir|criar|colocar)\b/.test(text) &&
      /\b(item|tarefa)\b/.test(text) &&
      !/\bsubitem\b/.test(text)
    );
  }

  function isAddSubtask(text) {
    return /^(adicionar|incluir|criar)\b/.test(text) && /\bsubitem\b/.test(text);
  }

  function isNavigation(text) {
    return (
      /^(abrir|ir|mostrar|ver|navegar|entrar)\b/.test(text) &&
      /\b(checklist|orcamento|convidados|convite|atividade|painel|inicio|dia da festa)\b/.test(text)
    );
  }

  /* ---------- Respostas ---------- */

  function welcome() {
    bot(
      "Oi! Eu sou o Buzz. 🚀\n\n" +
        "Posso responder sobre convidados, orçamento e checklist, além de adicionar convidados, criar itens e marcar tarefas. " +
        "A conversa é local; qualquer alteração segue a sincronização configurada no painel."
    );
    setSuggestions([
      "Quantos confirmados?",
      "O que falta no checklist?",
      "Ver o convite?",
      "Adicionar convidado",
    ]);
  }

  function help() {
    bot(
      "Alguns exemplos do que você pode pedir:\n\n" +
        "• quantos confirmados?\n" +
        "• quem ainda não confirmou?\n" +
        "• qual o saldo do orçamento?\n" +
        "• o que falta no checklist?\n" +
        "• adicionar convidado João\n" +
        "• adicionar criança Lia, filha de João\n" +
        "• criar item bolo na etapa comida\n" +
        "• marcar bolo como feito\n" +
        "• excluir convidado João\n" +
        "• abrir convidados\n\n" +
        "Ações que apagam dados sempre pedem confirmação, e as outras podem ser desfeitas."
    );
    setSuggestions(["Quantos confirmados?", "O que falta no checklist?", "Ver o convite?", "Adicionar convidado"]);
  }

  function showGuestInfo(guest, includePhone) {
    const allGuests = api.snapshot().guests;
    const guardians = (guest.guardians || [])
      .map((id) => {
        const match = allGuests.find((candidate) => candidate.id === id);
        return match ? displayName(match) : "";
      })
      .filter(Boolean);
    const children = allGuests
      .filter((candidate) => (candidate.guardians || []).includes(guest.id))
      .map((candidate) => candidate.name);
    const lines = [
      displayName(guest) + (isHost(guest) ? " (anfitrião)" : ""),
      "Tipo: " + guestType(guest),
      "Confirmação: " + (statusLabel[guest.status] || guest.status),
    ];
    if (guest.relation) lines.push("Parentesco: " + guest.relation);
    if (includePhone) {
      lines.push("Telefone: " + (guest.phone ? guest.phone : "não cadastrado"));
    }
    if (guardians.length) lines.push("Responsável: " + guardians.join(", "));
    if (children.length) lines.push("Crianças vinculadas: " + children.join(", "));
    bot(lines.join("\n"));
  }

  function budgetSummary() {
    const stats = api.stats().budget;
    return (
      "Orçamento total: " + money(stats.budget) + "\n" +
      "Previsto: " + money(stats.previsto) + "\n" +
      "Contratado: " + money(stats.contratado) + "\n" +
      "Pago: " + money(stats.pago) + "\n" +
      "A pagar: " + money(stats.aPagar) + "\n" +
      "Saldo do orçamento: " + money(stats.saldo)
    );
  }

  function openItemsList(items, limit) {
    return listLines(
      sortByDue(items.filter((item) => item.status !== "done")).map(itemLine),
      limit
    );
  }

  function checklistOverview() {
    const stats = api.stats().checklist;
    return (
      "Checklist: " + stats.done + " de " + stats.total + " concluídos (" + stats.pct + "%).\n" +
      "Em andamento: " + stats.doing + " · Contratados: " + stats.contracted + " · A fazer: " + stats.todo +
      (stats.overdue ? "\nItens atrasados: " + stats.overdue : "")
    );
  }

  function addGuestAction(parsed) {
    const name = String(parsed.name || "").trim();
    if (!name) {
      awaiting = { kind: "guest-name", parsed: { ...parsed } };
      bot(
        "Qual é o nome " +
          (parsed.type === "child" ? "da criança" : parsed.type === "adult" ? "do adulto" : "do convidado") +
          "?\n\nVocê pode responder só o nome."
      );
      return;
    }

    if (!parsed.type) {
      askGuestType({ ...parsed, name });
      return;
    }

    if (parsed.guardianName) {
      const matches = api
        .findGuests(parsed.guardianName)
        .filter((match) => match.guest.type === "adult");
      if (matches.length) {
        const top = matches[0];
        const next = matches[1];
        if (top.score >= 85 || (top.score >= 60 && (!next || top.score - next.score >= 15))) {
          createGuest({ ...parsed, name, guardians: [top.guest.id], relation: "" });
          return;
        }
        askChoice("Quem é o responsável por " + name + "?", matches.slice(0, 5), (match) =>
          createGuest({ ...parsed, name, guardians: [match.guest.id], relation: "" })
        );
        return;
      }
      bot(
        'Não encontrei o adulto "' +
          parsed.guardianName +
          '". Vou adicionar ' +
          name +
          " como criança sem responsável vinculado."
      );
    }

    createGuest({ ...parsed, name, guardians: [], relation: "" });
  }

  function askGuestType(parsed) {
    bot("“" + parsed.name + "” é adulto ou criança?", [
      {
        label: "🧑 Adulto",
        primary: true,
        onClick: () => addGuestAction({ ...parsed, type: "adult" }),
      },
      {
        label: "🧒 Criança",
        onClick: () => addGuestAction({ ...parsed, type: "child" }),
      },
    ]);
  }

  function createGuest(parsed) {
    const result = api.addGuest({
      name: parsed.name,
      type: parsed.type,
      phone: parsed.phone,
      guardians: parsed.guardians || [],
      relation: parsed.relation || "",
    });
    if (!result.ok) {
      bot(result.error || "Não consegui adicionar este convidado.");
      return;
    }
    api.revealGuest(result.guest.id);
    finishAction(
      "Adicionei " +
        displayName(result.guest) +
        " como " +
        guestType(result.guest) +
        ". A aba Convidados foi aberta e o grupo correto está expandido." +
        (result.guest.type === "child" && !(result.guest.guardians || []).length
          ? "\nSem responsável vinculado; você pode ajustar em Convidados."
          : "")
    );
  }

  function addItemAction(parsed) {
    if (!parsed.title) {
      awaiting = { kind: "item-title", stage: parsed.stage };
      bot("Qual é o nome do item do checklist?");
      return;
    }
    const result = api.addItem({ title: parsed.title, stage: parsed.stage });
    if (!result.ok) {
      bot(result.error || "Não consegui criar este item.");
      return;
    }
    finishAction(
      "Criei o item “" + result.item.title + "” em " + stageName(result.item.stage) + "."
    );
  }

  async function handleAwaiting(raw) {
    const current = awaiting;
    awaiting = null;
    if (!current) return;
    if (current.kind === "guest-name") {
      const parsed = parseGuestAdd(raw);
      addGuestAction({
        ...(current.parsed || {}),
        ...parsed,
        name: parsed.name,
        type: parsed.type || (current.parsed && current.parsed.type) || null,
        guardians: [],
      });
      return;
    }
    if (current.kind === "item-title") {
      const parsed = parseItemAdd(raw);
      addItemAction({ title: parsed.title, stage: current.stage || parsed.stage });
      return;
    }
    if (current.kind === "subtask-title") {
      addSubtaskAction(current.itemId, String(raw || "").trim());
    }
  }

  function addSubtaskAction(itemId, title) {
    if (!title) {
      awaiting = { kind: "subtask-title", itemId };
      bot("Qual é o nome do subitem?");
      return;
    }
    const result = api.addSubtask(itemId, title);
    if (!result.ok) {
      bot(result.error || "Não consegui criar o subitem.");
      return;
    }
    finishAction("Adicionei o subitem “" + result.subtask.title + "” em “" + result.item.title + "”.");
  }

  async function cloudSave() {
    if (!api.cloudStatus().configured) {
      bot("A nuvem ainda não está configurada. Abra “✏️ Editar festa” e preencha usuário, repositório e token do GitHub.");
      return;
    }
    bot("Enviando a versão atual para a nuvem…");
    await api.saveCloud();
    const status = api.cloudStatus();
    if (status.phase === "error") bot("Não consegui salvar: " + (status.error || "erro"));
    else bot("Versão atual salva na nuvem. Em outro aparelho, use “Carregar da nuvem” para receber.");
  }

  function cloudPull() {
    if (!api.cloudStatus().configured) {
      bot("A nuvem ainda não está configurada. Abra “✏️ Editar festa” primeiro.");
      return;
    }
    askConfirm(
      "Baixar a versão da nuvem?\n\nOs itens e convidados deste dispositivo serão substituídos pelo que está no GitHub.",
      async () => {
        bot("Baixando a versão da nuvem…");
        await api.pullCloud();
        const status = api.cloudStatus();
        if (status.phase === "error") bot("Não consegui baixar: " + (status.error || "erro"));
        else bot("Dados carregados da nuvem.");
      }
    );
  }

  async function refreshResponses() {
    if (!api.cloudStatus().configured) {
      bot("A nuvem ainda não está configurada. Abra “✏️ Editar festa” primeiro.");
      return;
    }
    bot("Buscando respostas novas no convite…");
    await api.refreshResponses();
    bot("Atualização concluída. Confira a lista de convidados.");
  }

  async function respond(raw) {
    const text = norm(raw);
    if (!text) return;

    if (pendingConfirm) {
      if (/^(sim|confirmo|confirmar|pode|isso|claro|manda|ok|uhum)\b/.test(text)) {
        const run = pendingConfirm;
        pendingConfirm = null;
        await run();
        return;
      }
      if (/^(nao|cancelar|cancela|deixa|nao quero|melhor nao)\b/.test(text)) {
        pendingConfirm = null;
        bot("Cancelado. Nada foi alterado.");
        return;
      }
      pendingConfirm = null;
    }

    if (awaiting && !looksLikeCommand(raw)) {
      await handleAwaiting(raw);
      return;
    }

    if (isGreeting(text)) {
      welcome();
      return;
    }
    if (isHelp(text)) {
      help();
      return;
    }

    if (
      /\b(nuvem|github|sincronizacao|sincronizado)\b/.test(text) &&
      /\b(status|como esta|situacao|configurad[ao]|ultima|ultimo|sincroniz|salvo|pendente|erro)\b/.test(text)
    ) {
      const status = api.cloudStatus();
      if (!status.configured) {
        bot(
          "A nuvem ainda não está configurada. Abra “✏️ Editar festa” e preencha usuário, repositório e token do GitHub. Enquanto isso, tudo fica salvo somente neste dispositivo."
        );
        return;
      }
      const lines = ["Nuvem configurada e pronta para sincronizar."];
      if (status.lastSync) {
        const when = new Date(status.lastSync);
        lines.push(
          "Última sincronização: " +
            (isNaN(when.getTime())
              ? status.lastSync
              : when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }))
        );
      } else {
        lines.push("Ainda não houve sincronização nesta sessão.");
      }
      if (status.phase === "error") lines.push("Último erro: " + (status.error || "desconhecido"));
      else if (status.phase === "saving" || status.phase === "syncing") lines.push("Uma sincronização está em andamento.");
      if (status.pending) lines.push("Há uma configuração aguardando confirmação.");
      bot(lines.join("\n"));
      return;
    }

    if (/\b(salvar|enviar|sincronizar).*\b(nuvem|github)\b/.test(text)) {
      await cloudSave();
      return;
    }
    if (/\b(baixar|carregar).*\b(nuvem|github)\b/.test(text)) {
      cloudPull();
      return;
    }
    if (/\b(atualizar|buscar).*\brespostas\b/.test(text)) {
      await refreshResponses();
      return;
    }

    if (isNavigation(text)) {
      const view = /\bchecklist\b/.test(text)
        ? "checklist"
        : /\borcamento\b/.test(text)
          ? "budget"
          : /\bconvidados\b/.test(text)
            ? "guests"
            : /\bconvite\b/.test(text)
              ? "invite"
              : /\bdia da festa\b/.test(text)
                ? "day"
                : /\batividade\b/.test(text)
                  ? "activity"
                  : "checklist";
      api.showView(view);
      bot("Abri a aba " + (view === "budget" ? "Orçamento" : view === "guests" ? "Convidados" : view === "invite" ? "Convite" : view === "day" ? "Dia da festa" : view === "activity" ? "Atividade" : "Checklist") + ".");
      return;
    }

    const budgetValue = parseBudgetSet(raw);
    if (budgetValue !== null) {
      const currentBudget = api.stats().budget.budget;
      askConfirm(
        "Alterar o orçamento total de " + money(currentBudget) + " para " + money(budgetValue) + "?",
        () => {
          const result = api.setBudget(budgetValue);
          if (!result.ok) {
            bot(result.error || "Não consegui alterar o orçamento.");
            return;
          }
          finishAction("Orçamento total atualizado para " + money(result.budget) + ".");
        }
      );
      return;
    }

    if (isAddSubtask(text)) {
      const parsed = parseSubtaskAdd(raw);
      if (!parsed.itemQuery) {
        bot(
          "Em qual item devo adicionar esse subitem? Exemplo: “adicionar subitem separar caixas em lembrancinhas”."
        );
        return;
      }
      resolveItem(parsed.itemQuery, (item) => addSubtaskAction(item.id, parsed.title));
      return;
    }

    const subtaskStatus = parseSubtaskStatus(raw);
    if (subtaskStatus) {
      resolveSubtask(subtaskStatus.query, (match) => {
        const result = api.setSubtaskStatus(match.item.id, match.subtask.id, subtaskStatus.done);
        if (!result.ok) {
          bot(result.error || "Não consegui atualizar o subitem.");
          return;
        }
        finishAction(
          (subtaskStatus.done ? "Concluí o subitem “" : "Reabri o subitem “") +
            match.subtask.title +
            "” em “" +
            match.item.title +
            "”."
        );
      });
      return;
    }

    if (isAddItem(text)) {
      const parsed = parseItemAdd(raw);
      addItemAction(parsed);
      return;
    }

    if (isAddGuest(text)) {
      const parsed = parseGuestAdd(raw);
      addGuestAction(parsed);
      return;
    }

    const itemDeleteQuery = parseDelete(raw, "item");
    if (itemDeleteQuery) {
      resolveItem(itemDeleteQuery, (item) => {
        askConfirm(
          "Excluir o item “" + item.title + "”?\n\nEssa ação também será refletida na nuvem.",
          () => {
            const result = api.removeItem(item.id);
            if (!result.ok) {
              bot(result.error || "Não consegui excluir o item.");
              return;
            }
            finishAction("Excluí o item “" + result.item.title + "” do checklist.");
          }
        );
      });
      return;
    }

    const guestDeleteQuery =
      /^\s*(?:excluir|remover|apagar|deletar)\b/i.test(String(raw || ""))
        ? parseDelete(raw, "guest")
        : "";
    if (guestDeleteQuery) {
      resolveGuest(guestDeleteQuery, (guest) => {
        askConfirm(
          "Remover “" + displayName(guest) + "” da lista?\n\nA exclusão também será registrada na nuvem.",
          () => {
            const result = api.removeGuest(guest.id);
            if (!result.ok) {
              bot(result.error || "Não consegui remover o convidado.");
              return;
            }
            finishAction("Removi “" + displayName(result.guest) + "” da lista.");
          }
        );
      });
      return;
    }

    const guestStatus = parseGuestStatus(raw);
    if (guestStatus) {
      resolveGuest(guestStatus.query, (guest) => {
        const result = api.setGuestStatus(guest.id, guestStatus.status);
        if (!result.ok) {
          bot(result.error || "Não consegui atualizar a confirmação.");
          return;
        }
        finishAction(
          "Marquei " +
            displayName(result.guest) +
            " como " +
            (statusLabel[guestStatus.status] || guestStatus.status) +
            "."
        );
      });
      return;
    }

    const itemStatus = parseItemStatus(raw);
    if (itemStatus) {
      resolveItem(itemStatus.query, (item) => {
        const result = api.setItemStatus(item.id, itemStatus.status);
        if (!result.ok) {
          bot(result.error || "Não consegui atualizar o item.");
          return;
        }
        finishAction(
          "Atualizei “" +
            result.item.title +
            "” para " +
            (itemStatusLabel[itemStatus.status] || itemStatus.status) +
            "."
        );
      });
      return;
    }

    if (/\b(quando|que dia|data|horario|que horas)\b/.test(text) && /\b(festa|aniversario|ben)\b/.test(text)) {
      const meta = api.snapshot().meta;
      const days = daysUntil(meta.date, meta.time);
      bot(
        "A festa é " +
          formatDate(meta.date) +
          (meta.time ? " às " + meta.time.replace(":", "h") : "") +
          "." +
          (days !== null && days >= 0
            ? " Faltam " + days + " " + plural(days, "dia", "dias") + "."
            : days !== null
              ? " A data já passou."
              : "")
      );
      return;
    }

    if (/\b(onde|local|endereco|lugar)\b/.test(text) && /\b(festa|aniversario|comemoracao)\b/.test(text)) {
      const meta = api.snapshot().meta;
      bot(meta.location ? "A festa será em:\n" + meta.location : "O local ainda não foi definido no painel.");
      return;
    }

    if (/\btema\b/.test(text)) {
      bot("O tema da festa é " + (api.snapshot().meta.theme || "Toy Story") + ".");
      return;
    }

    if (/\b(quantos anos|idade)\b/.test(text) && /\b(ben|aniversariante|festa)\b/.test(text)) {
      const meta = api.snapshot().meta;
      bot("O " + meta.name + " vai fazer " + meta.age + " anos.");
      return;
    }

    if (/\b(quanto falta|quantos dias|contagem)\b/.test(text)) {
      const meta = api.snapshot().meta;
      const days = daysUntil(meta.date, meta.time);
      if (days === null) {
        bot("A data da festa ainda não está definida.");
        return;
      }
      bot(
        days >= 0
          ? "Faltam " + days + " " + plural(days, "dia", "dias") + " para a festa, em " + formatDate(meta.date) + "."
          : "A data da festa já passou (" + formatDate(meta.date) + ")."
      );
      return;
    }

    if (/\b(telefone|whatsapp|celular)\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\b(?:telefone|whatsapp|celular)\b\s*(?:d[eo]|d[ao])?\s*/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (!query) {
        bot("De quem você quer o telefone? Exemplo: “telefone do João”.");
        return;
      }
      resolveGuest(query, (guest) => {
        bot(
          guest.phone
            ? "Telefone de " + displayName(guest) + ": " + guest.phone
            : displayName(guest) + " não tem telefone cadastrado."
        );
      });
      return;
    }

    if (/\b(quem (e|sao)|ficha|informacoes|detalhes)\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\b(?:quem e|quem sao|ficha de|ficha do|ficha da|informacoes sobre|detalhes de|detalhes do|detalhes da)\b\s*/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (query && !/\b(convidados|confirmados|pendentes|anfitrioes|pais)\b/.test(norm(query))) {
        resolveGuest(query, (guest) => showGuestInfo(guest, false));
        return;
      }
    }

    if (/\bresponsavel\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\brespons[aá]vel\s+(?:pela|pelo|por|de|do|da)\s+/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (query) {
        resolveGuest(query, (guest) => {
          const allGuests = api.snapshot().guests;
          const guardians = (guest.guardians || [])
            .map((id) => allGuests.find((candidate) => candidate.id === id))
            .filter(Boolean)
            .map(displayName);
          bot(
            guardians.length
              ? "Responsável por " + guest.name + ": " + guardians.join(", ") + "."
              : guest.name + " não tem responsável vinculado na lista."
          );
        });
        return;
      }
    }

    if (/\b(criancas|filhos|filhas)\b/.test(text) && /\b(d[eo]|d[ao])\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\b(?:criancas|filhos|filhas)\s+(?:d[eo]|d[ao])\s+/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (query) {
        resolveGuest(query, (guest) => {
          const children = api
            .snapshot()
            .guests.filter((candidate) => (candidate.guardians || []).includes(guest.id));
          bot(
            children.length
              ? "Crianças vinculadas a " + displayName(guest) + ":\n" + listLines(children.map((child) => child.name))
              : "Não há crianças vinculadas a " + displayName(guest) + "."
          );
        });
        return;
      }
    }

    if (/\b(anfitrioes|donos da festa|pais do ben|papai e mamae)\b/.test(text)) {
      const hosts = api.snapshot().guests.filter(isHost);
      bot(
        hosts.length
          ? "Anfitriões na lista:\n" + listLines(hosts.map(displayName))
          : "Não encontrei os anfitriões na lista."
      );
      return;
    }

    if (/\b(quanto custa|quanto foi|qual o valor|preco|preco de)\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\b(?:quanto custa|quanto foi|qual o valor(?: de)?|pre[cç]o(?: de)?)\b\s*(?:o|a|os|as|do|da|dos|das)?\s*/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (query && !/\b(festa|tudo|total|orcamento)\b/.test(norm(query))) {
        resolveItem(query, (item) => {
          const missing = Math.max(0, Number(item.cost) - Number(item.paid));
          bot(
            "“" +
              item.title +
              "”\n" +
              "Status: " +
              (itemStatusLabel[item.status] || item.status) +
              "\nPrevisto: " +
              money(item.cost) +
              "\nPago: " +
              money(item.paid) +
              "\nFalta: " +
              money(missing)
          );
        });
        return;
      }
    }

    if (/\b(saldo|falta pagar|quanto falta pagar|ja pagamos|quanto ja pagamos|pago|previsto|orcamento|gastos|maior gasto|mais caro)\b/.test(text)) {
      const stats = api.stats().budget;
      if (/\b(maior|maiores) gastos?\b|\bmais caros?\b/.test(text)) {
        const top = api
          .snapshot()
          .items.slice()
          .sort((a, b) => Number(b.cost) - Number(a.cost))
          .slice(0, 4);
        bot(
          top.length
            ? "Maiores gastos do checklist:\n" +
                top
                  .map(
                    (item, index) =>
                      (index + 1) + ". " + item.title + " — " + money(item.cost) + " (" + stageName(item.stage) + ")"
                  )
                  .join("\n")
            : "Ainda não há gastos cadastrados."
        );
        return;
      }
      if (/\bgastos\b/.test(text) && /\betapa\b/.test(text)) {
        const stages = api.stages();
        const lines = stages
          .map((stage) => {
            const items = api.snapshot().items.filter((item) => item.stage === stage.id);
            const total = items.reduce((sum, item) => sum + Number(item.cost), 0);
            return total ? "• " + stage.name + ": " + money(total) : "";
          })
          .filter(Boolean);
        bot(lines.length ? "Gastos previstos por etapa:\n" + lines.join("\n") : "Ainda não há gastos por etapa.");
        return;
      }
      if (/\bsaldo\b/.test(text)) {
        bot(
          "Orçamento: " +
            money(stats.budget) +
            "\nContratado: " +
            money(stats.contratado) +
            "\nSaldo do orçamento: " +
            money(stats.saldo) +
            (stats.saldo < 0 ? " (acima do orçamento)" : "")
        );
        return;
      }
      if (/\bfalta pagar|a pagar\b/.test(text)) {
        bot("A pagar (itens contratados): " + money(stats.aPagar) + ".");
        return;
      }
      if (/\bja pagamos|quanto ja pagamos|pago\b/.test(text)) {
        bot("Já pago: " + money(stats.pago) + " de " + money(stats.previsto) + " previstos.");
        return;
      }
      bot(budgetSummary());
      return;
    }

    if (/\b(o que falta|pendentes|a fazer|aguardando|o que tem para fazer|proximos|proximas|atrasados|vencidos)\b/.test(text)) {
      const snapshot = api.snapshot();
      if (/\batrasados|vencidos\b/.test(text)) {
        const today = todayISO();
        const late = snapshot.items.filter(
          (item) => item.status !== "done" && item.due && item.due < today
        );
        bot(
          late.length
            ? "Itens atrasados:\n" + listLines(sortByDue(late).map(itemLine), 12)
            : "Nenhum item atrasado. 👏"
        );
        return;
      }
      if (/\bproximos|proximas\b/.test(text)) {
        const coming = sortByDue(snapshot.items.filter((item) => item.status !== "done"));
        bot(coming.length ? "Próximos itens:\n" + listLines(coming.map(itemLine), 8) : "Nada pendente no checklist. 🎉");
        return;
      }
      const open = snapshot.items.filter((item) => item.status !== "done");
      bot(
        open.length
          ? "Ainda faltam " + open.length + " " + plural(open.length, "item", "itens") + ":\n" +
              listLines(sortByDue(open).map(itemLine), 10)
          : "O checklist está todo concluído. 🎉"
      );
      return;
    }

    if (/\b(progresso|como esta o checklist|andamento do checklist|resumo do checklist|checklist)\b/.test(text)) {
      const stage = findStage(raw);
      if (stage) {
        const items = api.snapshot().items.filter((item) => item.stage === stage.id);
        const done = items.filter((item) => item.status === "done").length;
        bot(
          stage.name + ": " + done + " de " + items.length + " concluídos.\n" +
            (items.length ? listLines(items.map(itemLine), 12) : "Nenhum item nesta etapa.")
        );
        return;
      }
      bot(checklistOverview());
      const open = api.snapshot().items.filter((item) => item.status !== "done");
      if (open.length) bot("Próximos itens:\n" + listLines(sortByDue(open).map(itemLine), 5));
      return;
    }

    if (/\b(subitens|subtarefas)\b/.test(text)) {
      const query = String(raw || "")
        .replace(/^.*?\b(?:subitens|subtarefas)\s+(?:d[eo]|d[ao])\s+/i, "")
        .replace(/[?.!]+$/g, "")
        .trim();
      if (!query) {
        bot("De qual item você quer ver os subitens? Exemplo: “subitens do bolo”.");
        return;
      }
      resolveItem(query, (item) => {
        const subtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
        bot(
          subtasks.length
            ? "Subitens de “" + item.title + "”:\n" +
                listLines(
                  subtasks.map((subtask) => (subtask.done ? "✓ " : "○ ") + subtask.title),
                  15
                )
            : "“" + item.title + "” não tem subitens."
        );
      });
      return;
    }

    if (/\betapa\b/.test(text)) {
      const stage = findStage(raw);
      if (stage) {
        const items = api.snapshot().items.filter((item) => item.stage === stage.id);
        const done = items.filter((item) => item.status === "done").length;
        bot(
          stage.icon + " " + stage.name + "\n" + done + " de " + items.length + " concluídos.\n" +
            (items.length ? listLines(items.map(itemLine), 12) : "Nenhum item nesta etapa.")
        );
        return;
      }
    }

    if (/\b(quem confirmou|lista de confirmados|confirmados)\b/.test(text)) {
      const guests = api.snapshot().guests.filter((guest) => !isHost(guest) && guest.status === "confirmed");
      const stats = api.stats().guests;
      bot(
        stats.confirmed +
          " " +
          plural(stats.confirmed, "confirmado", "confirmados") +
          " de " +
          stats.total +
          " " +
          plural(stats.total, "convidado", "convidados") +
          "." +
          (guests.length ? "\n" + listLines(guests.map(guestLine), 20) : "")
      );
      return;
    }

    if (/\b(quem (ainda )?(falta|nao confirmou)|aguardando resposta|pendentes de resposta|nao confirmaram)\b/.test(text)) {
      const pending = api
        .snapshot()
        .guests.filter((guest) => !isHost(guest) && guest.status === "pending");
      bot(
        pending.length
          ? "Ainda não confirmaram (" + pending.length + "):\n" + listLines(pending.map(guestLine), 20)
          : "Todo mundo já respondeu. 🎉"
      );
      return;
    }

    if (/\b(quem nao vai|recusaram|recusaram o convite|declinaram)\b/.test(text)) {
      const declined = api
        .snapshot()
        .guests.filter((guest) => !isHost(guest) && guest.status === "declined");
      bot(
        declined.length
          ? "Não vão (" + declined.length + "):\n" + listLines(declined.map(guestLine), 20)
          : "Ninguém marcou “não vai” até agora."
      );
      return;
    }

    if (/\b(quantos|quantas|numero de|total de)\b/.test(text) && /\bconvidados?|adultos?|criancas?|confirmac|lista\b/.test(text)) {
      const stats = api.stats().guests;
      if (/\badultos?\b/.test(text)) {
        bot("Adultos na lista: " + stats.adults + " (fora os pais). Crianças: " + stats.children + ".");
        return;
      }
      if (/\bcriancas?\b/.test(text)) {
        bot("Crianças na lista: " + stats.children + ". Adultos: " + stats.adults + ".");
        return;
      }
      if (/\bconfirmad/.test(text)) {
        bot(
          stats.confirmed +
            " de " +
            stats.total +
            " " +
            plural(stats.total, "convidado", "convidados") +
            " já confirmaram. Pendentes: " +
            stats.pending +
            ". Não vão: " +
            stats.declined +
            "."
        );
        return;
      }
      bot(
        "Na lista: " +
          stats.total +
          " " +
          plural(stats.total, "convidado", "convidados") +
          " (" +
          stats.adults +
          " adultos e " +
          stats.children +
          " crianças).\n" +
          "Confirmados: " +
          stats.confirmed +
          " · Pendentes: " +
          stats.pending +
          " · Não vão: " +
          stats.declined +
          ".\n" +
          "Os pais não entram nessa contagem."
      );
      return;
    }

    if (/\b(como esta a lista|resumo dos convidados|situacao dos convidados)\b/.test(text)) {
      const stats = api.stats().guests;
      bot(
        "Convidados: " +
          stats.total +
          " (" +
          stats.adults +
          " adultos e " +
          stats.children +
          " crianças).\n" +
          "Confirmados: " +
          stats.confirmed +
          " · Pendentes: " +
          stats.pending +
          " · Não vão: " +
          stats.declined +
          ".\n" +
          "Com telefone: " +
          stats.withPhone +
          " · Convites enviados: " +
          stats.invitesSent
      );
      return;
    }

    fallback();
  }

  function fallback() {
    bot(
      "Ainda não entendi esse pedido. Você pode tentar:\n\n" +
        "• quantos confirmados?\n" +
        "• o que falta no checklist?\n" +
        "• qual o saldo?\n" +
        "• adicionar convidado João\n" +
        "• criar item bolo na etapa comida\n" +
        "• marcar bolo como feito"
    );
    setSuggestions([
      "Quantos confirmados?",
      "O que falta no checklist?",
      "Ver o convite?",
      "Adicionar convidado",
    ]);
  }
})();
