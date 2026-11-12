import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

function filesIn(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== ".git" && entry.name !== ".private") {
      return filesIn(path, extension);
    }
    return entry.isFile() && extname(path) === extension ? [path] : [];
  });
}

for (const name of ["event.json"]) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  try {
    JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${name}: JSON inválido (${error.message})`);
  }
}

const publicEvent = JSON.parse(readFileSync(join(root, "event.json"), "utf8"));
const eventMeta = publicEvent.meta || {};
if (!/^\d{4}-\d{2}-\d{2}$/.test(eventMeta.date || "")) {
  errors.push("event.json: data da festa inválida");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(eventMeta.rsvpDeadline || "")) {
  errors.push("event.json: prazo de confirmação inválido");
} else if (eventMeta.rsvpDeadline >= eventMeta.date) {
  errors.push("event.json: o prazo de confirmação deve ser anterior à festa");
}
if (!eventMeta.fatherPhone || !eventMeta.motherPhone) {
  warnings.push("event.json: telefones dos pais ainda não foram publicados; os atalhos de WhatsApp ficarão ocultos");
}
for (const forbidden of ["guests", "items", "budget", "phone", "notes"]) {
  if (forbidden in publicEvent || forbidden in (publicEvent.meta || {})) {
    errors.push(`event.json: campo privado não permitido: ${forbidden}`);
  }
}

for (const forbiddenFile of ["data.json", "convidados.json", "lista_convidados.txt"]) {
  if (existsSync(join(root, forbiddenFile))) {
    errors.push(`${forbiddenFile}: lista pessoal não deve ser publicada`);
  }
}

const refPattern = /(?:src|href)=["']([^"'#?]+)["']/g;
for (const htmlPath of filesIn(root, ".html")) {
  const html = readFileSync(htmlPath, "utf8");
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  duplicateIds.forEach((id) => errors.push(`${relative(root, htmlPath)}: id duplicado: ${id}`));
  const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  const baseHref = baseMatch ? baseMatch[1] : "";
  for (const match of html.matchAll(refPattern)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(ref)) continue;
    let decoded = ref;
    try {
      decoded = decodeURIComponent(ref);
    } catch {
      /* mantém a referência original */
    }
    const target = baseHref
      ? resolve(htmlPath, "..", baseHref, decoded)
      : resolve(htmlPath, "..", decoded);
    if (!existsSync(target)) {
      errors.push(`${relative(root, htmlPath)}: referência ausente: ${ref}`);
    }
  }
}

const panelHtml = readFileSync(join(root, "painel.html"), "utf8");
const animatedHtml = readFileSync(join(root, "convite-animado.html"), "utf8");
const rsvpHtml = readFileSync(join(root, "convite.html"), "utf8");
const appJs = readFileSync(join(root, "assets", "app.js"), "utf8");
const animatedJs = readFileSync(join(root, "assets", "convite-animado.js"), "utf8");
const appVersion = (html) => html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)/i)?.[1] || "";
const expectedVersion = appVersion(panelHtml);
if (!expectedVersion || expectedVersion !== appVersion(animatedHtml) || expectedVersion !== appVersion(rsvpHtml)) {
  errors.push("versão: painel.html, convite-animado.html e convite.html devem usar o mesmo app-version");
}
for (const [pageName, html] of [
  ["painel.html", panelHtml],
  ["convite-animado.html", animatedHtml],
  ["convite.html", rsvpHtml],
]) {
  for (const match of html.matchAll(/(?:<link\s+rel=["']stylesheet["']\s+href|<script\s+src)=["'](assets\/[^"'?]+\.(?:css|js))\?v=([^"']+)["']/gi)) {
    const [, assetPath, assetVer] = match;
    if (assetVer !== expectedVersion) {
      errors.push(`versão: ${pageName} carrega ${assetPath}?v=${assetVer} (esperado ${expectedVersion})`);
    }
  }
}
const appReleaseMatch = appJs.match(/INVITE_RELEASE\s*=\s*["']([^"']+)["']/);
const animatedReleaseMatch = animatedJs.match(/inviteRelease\s*=\s*["']([^"']+)["']/);
if (!appReleaseMatch || appReleaseMatch[1] !== expectedVersion) {
  errors.push(`versão: INVITE_RELEASE em assets/app.js deve ser ${expectedVersion}`);
}
if (!animatedReleaseMatch || animatedReleaseMatch[1] !== expectedVersion) {
  errors.push(`versão: inviteRelease em assets/convite-animado.js deve ser ${expectedVersion}`);
}
for (const required of ["buzzPreludeVideo", "startButton", "confirmButton", "giftAction", "animatedLocation"]) {
  if (!animatedHtml.includes(`id="${required}"`)) errors.push(`convite-animado.html: controle obrigatório ausente: ${required}`);
}
if (!/id="buzzPreludeVideo"[^>]+preload="auto"/.test(animatedHtml)) {
  warnings.push("convite-animado.html: a abertura do Buzz não está preparada para início imediato");
}
for (const lazyVideo of ["openingVideo", "revealVideo", "m2ClipVideo"]) {
  const pattern = new RegExp(`id="${lazyVideo}"[^>]+preload="none"`);
  if (!pattern.test(animatedHtml)) warnings.push(`convite-animado.html: ${lazyVideo} deveria carregar somente quando necessário`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

if (warnings.length) console.warn("Avisos:\n- " + warnings.join("\n- "));
console.log("Validação concluída: JSON, privacidade básica e referências locais OK.");
