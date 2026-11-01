/* ============================================================
   RSVP do convite — Ben faz 5!
   Google Apps Script que grava a resposta do convidado no
   data.json do repositório (GitHub Contents API).

   Configuração: veja apps-script/README.md
   ============================================================ */

var DEFAULTS = {
  GH_BRANCH: 'main',
  GH_PATH: 'data.json',
};

var STATUS_OK = ['confirmed', 'declined'];

function props_() {
  return PropertiesService.getScriptProperties();
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

function readFile_(cfg) {
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
  return { sha: res.data.sha, json: json };
}

function writeFile_(cfg, json, sha) {
  var content = Utilities.base64Encode(JSON.stringify(json, null, 2) + '\n', Utilities.Charset.UTF_8);
  var res = ghFetch_(cfg, 'put', apiUrl_(cfg), {
    message: 'RSVP: ' + new Date().toISOString(),
    content: content,
    sha: sha,
    branch: cfg.branch,
  });
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
    guest.rsvpMessage = message;
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

/* GET /exec?ping=1 — teste rápido da configuração. */
function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.ping) {
    try {
      var cfg = config_();
      var file = readFile_(cfg);
      var count = file.json && Array.isArray(file.json.guests) ? file.json.guests.length : 0;
      return json_({
        ok: true,
        service: 'rsvp-ben',
        repo: cfg.owner + '/' + cfg.repo,
        branch: cfg.branch,
        path: cfg.path,
        guests: count,
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

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Muitas respostas ao mesmo tempo. Tente de novo em instantes.');
    }
    try {
      var result = updateGuest_(body);
      return json_({ ok: true, guest: result.guest, children: result.children });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
