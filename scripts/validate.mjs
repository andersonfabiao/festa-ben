import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];

function filesIn(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== ".git" && entry.name !== ".private") {
      return filesIn(path, extension);
    }
    return entry.isFile() && extname(path) === extension ? [path] : [];
  });
}

for (const name of ["event.json", "data.json"]) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  try {
    JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${name}: JSON inválido (${error.message})`);
  }
}

const publicEvent = JSON.parse(readFileSync(join(root, "event.json"), "utf8"));
for (const forbidden of ["guests", "items", "budget", "phone", "notes"]) {
  if (forbidden in publicEvent || forbidden in (publicEvent.meta || {})) {
    errors.push(`event.json: campo privado não permitido: ${forbidden}`);
  }
}

for (const forbiddenFile of ["convidados.json", "lista_convidados.txt"]) {
  if (existsSync(join(root, forbiddenFile))) {
    errors.push(`${forbiddenFile}: lista pessoal não deve ser publicada`);
  }
}

const refPattern = /(?:src|href)=["']([^"'#?]+)["']/g;
for (const htmlPath of filesIn(root, ".html")) {
  const html = readFileSync(htmlPath, "utf8");
  for (const match of html.matchAll(refPattern)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(ref)) continue;
    const target = resolve(htmlPath, "..", ref);
    if (!existsSync(target)) {
      errors.push(`${relative(root, htmlPath)}: referência ausente: ${ref}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Validação concluída: JSON, privacidade básica e referências locais OK.");
