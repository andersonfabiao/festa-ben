/* ============================================================
   RSVP do convite — Ben faz 5!
   Google Apps Script que consulta e grava respostas no arquivo
   de dados de um repositório GitHub privado.

   Configuração: veja apps-script/README.md
   ============================================================ */

var DEFAULTS = {
  GH_BRANCH: 'main',
  GH_PATH: 'data.json',
};

var STATUS_OK = ['confirmed', 'declined'];
var MAX_UNLISTED_GUESTS = 60;

function props_() {
  return PropertiesService.getScriptProperties();
}

function cache_() {
  try {
    return CacheService.getScriptCache();
  } catch (e) {
    return null;
  }
}

function cacheKey_(prefix, cfg) {
  return prefix + ':' + cfg.owner + '/' + cfg.repo + '@' + cfg.branch + ':' + cfg.path;
}

function config_() {
  var p = props_();
  var cfg = {
    token: (p.getProperty('GH_TOKEN') || '').trim(),
    owner: (p.getProperty('GH_OWNER') || '').trim(),
    repo: (p.getProperty('GH_REPO') || '').trim(),
    branch: (p.getProperty('GH_BRANCH') || DEFAULTS.GH_BRANCH).trim() || DEFAULTS.GH_BRANCH,
    path: (p.getProperty('GH_PATH') || DEFAULTS.GH_PATH).trim() || DEFAULTS.GH_PATH,
  };

  var missing = [];
  if (!cfg.token) missing.push('GH_TOKEN');
  if (!cfg.owner) missing.push('GH_OWNER');
  if (!cfg.repo) missing.push('GH_REPO');
  if (missing.length) {
    throw new Error('Configuração incompleta: falta ' + missing.join(', ') + ' nas Propriedades do script.');
  }
  return cfg;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* Mesmo algoritmo de assets/guest-id.js — o ID do convidado é estável. */
function guestKey_(name, type) {
  var base = String(name == null ? '' : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  var kind = type === 'adult' ? 'adult' : 'child';
  var text = base + '|' + kind;

  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'g' + (hash >>> 0).toString(36);
}

function apiUrl_(cfg) {
  return (
    'https://api.github.com/repos/' +
    encodeURIComponent(cfg.owner) +
    '/' +
    encodeURIComponent(cfg.repo) +
    '/contents/' +
    cfg.path
      .split('/')
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join('/')
  );
}

function ghFetch_(cfg, method, url, body) {
  var headers = {
    Authorization: 'Bearer ' + cfg.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  var options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
    options.payload = JSON.stringify(body);
  }

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  var data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = null;
  }
  return { code: code, data: data, text: text };
}

function assertPrivateRepo_(cfg) {
  var c = cache_();
  var key = 'priv:' + cfg.owner + '/' + cfg.repo;
  if (c && c.get(key) === '1') return;

  var url =
    'https://api.github.com/repos/' +
    encodeURIComponent(cfg.owner) +
    '/' +
    encodeURIComponent(cfg.repo);
  var res = ghFetch_(cfg, 'get', url);
  if (res.code !== 200 || !res.data) {
    throw new Error('Não foi possível verificar o repositório de dados (' + res.code + ').');
  }
  if (!res.data.private) {
    throw new Error('O repositório de dados precisa ser privado.');
  }
  if (c) {
    try {
      c.put(key, '1', 600);
    } catch (e) {}
  }
}

function readFile_(cfg, options) {
  var useCache = options && options.useCache === true;
  var c = useCache ? cache_() : null;
  var key = cacheKey_('file', cfg);
  if (c) {
    var cached = c.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }

  var res = ghFetch_(cfg, 'get', apiUrl_(cfg) + '?ref=' + encodeURIComponent(cfg.branch));
  if (res.code === 404) {
    throw new Error(
      'O arquivo ' + cfg.path + ' não existe em ' + cfg.owner + '/' + cfg.repo + ' (' + cfg.branch + ').'
    );
  }
  if (res.code !== 200 || !res.data || typeof res.data.content !== 'string') {
    throw new Error('GitHub recusou a leitura (' + res.code + '): ' + errorMessage_(res));
  }

  var raw = Utilities.newBlob(
    Utilities.base64Decode(res.data.content.replace(/\s/g, ''))
  ).getDataAsString('UTF-8');

  var json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error('O ' + cfg.path + ' não é um JSON válido.');
  }
  var result = { sha: res.data.sha, json: json };
  if (c) {
    try {
      c.put(key, JSON.stringify(result), 10);
    } catch (e) {}
  }
  return result;
}

function writeFile_(cfg, json, sha) {
  var content = Utilities.base64Encode(JSON.stringify(json, null, 2) + '\n', Utilities.Charset.UTF_8);
  var res = ghFetch_(cfg, 'put', apiUrl_(cfg), {
    message: 'RSVP: ' + new Date().toISOString(),
    content: content,
    sha: sha,
    branch: cfg.branch,
  });
  if (res.code === 200 || res.code === 201) {
    var c = cache_();
    if (c) {
      try {
        c.remove(cacheKey_('file', cfg));
      } catch (e) {}
    }
  }
  return res;
}

function errorMessage_(res) {
  if (res && res.data && res.data.message) return res.data.message;
  return (res && res.text ? String(res.text).slice(0, 200) : 'sem detalhes');
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Nenhum dado recebido.');
  }
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('O corpo da resposta não é um JSON válido.');
  }
  if (!body || typeof body !== 'object') throw new Error('Resposta inválida.');
  return body;
}

function findGuest_(guests, id, name, type) {
  var key = id ? String(id) : name ? guestKey_(name, type) : '';
  if (!key) return null;

  for (var i = 0; i < guests.length; i++) {
    var g = guests[i];
    if (!g || typeof g !== 'object' || !g.name) continue;
    var gid = g.id ? String(g.id) : guestKey_(g.name, g.type);
    if (gid === key) return g;
  }

  if (name) {
    var wanted = String(name).toLowerCase().trim();
    var kind = type === 'adult' ? 'adult' : 'child';
    for (var j = 0; j < guests.length; j++) {
      var h = guests[j];
      if (!h || !h.name) continue;
      if (String(h.name).toLowerCase().trim() === wanted && (h.type === 'adult' ? 'adult' : 'child') === kind) {
        return h;
      }
    }
  }
  return null;
}

function normalizeSearch_(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/* Nunca envia telefone, observações ou recados para o navegador público. */
function publicGuest_(guest) {
  var type = guest.type === 'adult' ? 'adult' : 'child';
  return {
    id: guest.id || guestKey_(guest.name, type),
    name: String(guest.name || '').slice(0, 80),
    relation: String(guest.relation || '').slice(0, 32),
    type: type,
    status: STATUS_OK.indexOf(guest.status) >= 0 ? guest.status : 'pending',
    guardians: Array.isArray(guest.guardians) ? guest.guardians.map(String) : [],
    rsvpAt: guest.rsvpAt || '',
    unlisted: guest.unlisted === true,
  };
}

function createUnlistedGuest_(body) {
  if (String(body.website || '').trim()) throw new Error('Não foi possível validar o envio.');
  var startedAt = Number(body.startedAt || 0);
  if (startedAt > 0 && Date.now() - startedAt < 1500) {
    throw new Error('Não foi possível validar o envio.');
  }
  var name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 3) throw new Error('Digite seu nome completo.');

  var cfg = config_();
  var lastError = null;
  for (var attempt = 0; attempt < 4; attempt++) {
    var file = readFile_(cfg);
    var data = file.json;
    if (!data || typeof data !== 'object' || !Array.isArray(data.guests)) {
      throw new Error('O ' + cfg.path + ' não tem uma lista de convidados.');
    }

    var unlistedCount = data.guests.filter(function (guest) {
      return guest && guest.unlisted === true;
    }).length;
    if (unlistedCount >= MAX_UNLISTED_GUESTS) {
      throw new Error('O limite de novos cadastros pelo convite foi atingido. Fale com os anfitriões.');
    }

    var normalizedName = normalizeSearch_(name);
    var existing = data.guests.filter(function (guest) {
      return guest && normalizeSearch_(guest.name) === normalizedName;
    })[0];
    if (existing) {
      throw new Error('Esse nome já está na lista. Volte à busca e selecione a opção correspondente.');
    }

    var now = new Date().toISOString();
    var baseId = guestKey_(name, 'adult');
    var id = baseId;
    var suffix = 2;
    while (findGuest_(data.guests, id, '', 'adult')) {
      id = String(baseId).slice(0, 36) + '-' + suffix;
      suffix++;
    }
    var guest = {
      id: id,
      name: name,
      type: 'adult',
      status: 'confirmed',
      phone: '',
      relation: 'Novo convidado',
      notes: 'Confirmou pelo convite sem estar na lista inicial.',
      guardians: [],
      rsvpAt: now,
      rsvpMessage: '',
      rsvpSource: 'guest',
      unlisted: true,
    };
    data.guests.push(guest);
    data.updatedAt = now;

    var res = writeFile_(cfg, data, file.sha);
    if (res.code === 200 || res.code === 201) {
      return { guest: publicGuest_(guest), children: [] };
    }
    if (res.code === 409 || res.code === 422) {
      lastError = new Error('Outra atualização aconteceu ao mesmo tempo. Tente de novo.');
      Utilities.sleep(400 + attempt * 500);
      continue;
    }
    throw new Error('GitHub recusou a gravação (' + res.code + '): ' + errorMessage_(res));
  }
  throw lastError || new Error('Não foi possível gravar a confirmação. Tente de novo.');
}

function lookupGuests_(data, params) {
  var guests = data && Array.isArray(data.guests) ? data.guests : [];
  var id = String(params.id || '').trim().slice(0, 40);
  var query = normalizeSearch_(params.q || '');
  var matches = [];

  if (id) {
    var direct = findGuest_(guests, id, '', 'adult');
    if (direct) matches.push(direct);
  } else {
    if (query.length < 3) throw new Error('Digite pelo menos 3 letras para pesquisar.');
    matches = guests
      .filter(function (guest) {
        if (!guest || !guest.name) return false;
        return normalizeSearch_((guest.relation || '') + ' ' + guest.name).indexOf(query) >= 0;
      })
      .sort(function (a, b) {
        var an = normalizeSearch_((a.relation || '') + ' ' + a.name);
        var bn = normalizeSearch_((b.relation || '') + ' ' + b.name);
        var ap = an.indexOf(query) === 0 ? 0 : 1;
        var bp = bn.indexOf(query) === 0 ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return an < bn ? -1 : an > bn ? 1 : 0;
      })
      .slice(0, 12);
  }

  var relatedById = {};
  matches.forEach(function (guest) {
    var gid = guest.id || guestKey_(guest.name, guest.type);
    if (guest.type === 'adult') {
      guests.forEach(function (child) {
        if (!child || child.type !== 'child' || !Array.isArray(child.guardians)) return;
        if (child.guardians.map(String).indexOf(String(gid)) >= 0) {
          var cid = child.id || guestKey_(child.name, child.type);
          relatedById[cid] = child;
        }
      });
    } else if (Array.isArray(guest.guardians)) {
      guest.guardians.forEach(function (guardianId) {
        var adult = findGuest_(guests, String(guardianId), '', 'adult');
        if (adult) relatedById[String(guardianId)] = adult;
      });
    }
  });

  return {
    guests: matches.map(publicGuest_),
    related: Object.keys(relatedById).map(function (key) {
      return publicGuest_(relatedById[key]);
    }),
  };
}

function updateGuest_(body) {
  var status = String(body.status || '').trim();
  if (STATUS_OK.indexOf(status) === -1) {
    throw new Error('Status inválido. Use "confirmed" ou "declined".');
  }

  var id = body.id ? String(body.id).slice(0, 40) : '';
  var name = body.name ? String(body.name).slice(0, 80) : '';
  var type = body.type === 'adult' ? 'adult' : 'child';
  var message = body.message ? String(body.message).slice(0, 280) : '';

  // Crianças vinculadas ao adulto (o convite envia só as que mudaram).
  var childUpdates = [];
  if (Array.isArray(body.children)) {
    body.children.slice(0, 30).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var childId = item.id ? String(item.id).slice(0, 40) : '';
      var childStatus = String(item.status || '').trim();
      if (!childId || STATUS_OK.indexOf(childStatus) === -1) return;
      childUpdates.push({ id: childId, status: childStatus });
    });
  }

  var cfg = config_();
  var lastError = null;

  // Lê, altera e grava; se outra pessoa gravou no meio, tenta de novo.
  for (var attempt = 0; attempt < 4; attempt++) {
    var file = readFile_(cfg);
    var data = file.json;

    if (!data || typeof data !== 'object' || !Array.isArray(data.guests)) {
      throw new Error('O ' + cfg.path + ' não tem uma lista de convidados.');
    }

    var guest = findGuest_(data.guests, id, name, type);
    if (!guest) {
      throw new Error('Convidado não encontrado. O nome pode ter sido atualizado.');
    }

    var now = new Date().toISOString();
    guest.id = guest.id || guestKey_(guest.name, guest.type);
    guest.status = status;
    guest.rsvpAt = now;
    guest.rsvpMessage = message || guest.rsvpMessage || '';
    guest.rsvpSource = 'guest';
    data.updatedAt = now;

    // Só permite alterar crianças que tenham este adulto como responsável.
    var updatedChildren = [];
    childUpdates.forEach(function (update) {
      var child = findGuest_(data.guests, update.id, '', 'child');
      if (!child || child.type !== 'child') return;
      var guardians = Array.isArray(child.guardians) ? child.guardians.map(String) : [];
      if (guardians.indexOf(guest.id) === -1) return;
      child.id = child.id || guestKey_(child.name, child.type);
      child.status = update.status;
      child.rsvpAt = now;
      child.rsvpSource = 'guest';
      updatedChildren.push({
        id: child.id,
        name: child.name,
        type: 'child',
        status: child.status,
        rsvpAt: child.rsvpAt,
      });
    });

    var res = writeFile_(cfg, data, file.sha);
    if (res.code === 200 || res.code === 201) {
      return {
        guest: {
          id: guest.id,
          name: guest.name,
          type: guest.type,
          status: guest.status,
          rsvpAt: guest.rsvpAt,
          rsvpMessage: guest.rsvpMessage,
        },
        children: updatedChildren,
      };
    }

    if (res.code === 409 || res.code === 422) {
      lastError = new Error('Outra atualização aconteceu ao mesmo tempo. Tente de novo.');
      Utilities.sleep(400 + attempt * 500);
      continue;
    }

    throw new Error('GitHub recusou a gravação (' + res.code + '): ' + errorMessage_(res));
  }

  throw lastError || new Error('Não foi possível gravar a resposta. Tente de novo.');
}

/* GET /exec?ping=1 — teste rápido; ?action=lookup&q=ana consulta sem expor a lista. */
function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === 'config') {
    try {
      var contactCfg = config_();
      assertPrivateRepo_(contactCfg);
      var contactFile = readFile_(contactCfg, { useCache: true });
      var contactMeta = contactFile.json && contactFile.json.meta || {};
      return json_({
        ok: true,
        fatherPhone: String(contactMeta.fatherPhone || '').replace(/\D/g, '').slice(0, 15),
        motherPhone: String(contactMeta.motherPhone || '').replace(/\D/g, '').slice(0, 15),
      });
    } catch (contactError) {
      return json_({ ok: false, error: String(contactError.message || contactError) });
    }
  }
  if (params.action === 'lookup') {
    try {
      var lookupCfg = config_();
      assertPrivateRepo_(lookupCfg);
      var lookupFile = readFile_(lookupCfg, { useCache: true });
      var result = lookupGuests_(lookupFile.json, params);
      return json_({ ok: true, guests: result.guests, related: result.related });
    } catch (lookupError) {
      return json_({ ok: false, error: String(lookupError.message || lookupError) });
    }
  }
  if (params.ping) {
    try {
      var cfg = config_();
      assertPrivateRepo_(cfg);
      var file = readFile_(cfg);
      var count = file.json && Array.isArray(file.json.guests) ? file.json.guests.length : 0;
      return json_({
        ok: true,
        service: 'rsvp-ben',
        repo: cfg.owner + '/' + cfg.repo,
        branch: cfg.branch,
        path: cfg.path,
        guests: count,
        features: { lookup: true, unlistedRsvp: true },
      });
    } catch (err) {
      return json_({ ok: false, error: String(err.message || err) });
    }
  }
  return json_({ ok: true, service: 'rsvp-ben', hint: 'Use ?ping=1 para testar.' });
}

/* POST /exec — resposta do convite. */
function doPost(e) {
  try {
    var body = parseBody_(e);
    assertPrivateRepo_(config_());

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Muitas respostas ao mesmo tempo. Tente de novo em instantes.');
    }
    try {
      var result = body.action === 'unlisted-rsvp' ? createUnlistedGuest_(body) : updateGuest_(body);
      return json_({ ok: true, guest: result.guest, children: result.children });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
