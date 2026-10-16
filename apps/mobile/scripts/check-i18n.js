// Verifies that every i18n namespace exists for ru/pl/en and that pl/en have exactly the keys of ru
// (the source of truth, ARCHITECTURE §2.5). Plural suffixes (_zero/_one/_two/_few/_many/_other) are
// normalised because languages need different plural forms. Run via `npm run lint`.
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SOURCE = 'ru';
const LANGUAGES = ['ru', 'pl', 'en'];
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out.add(full.replace(PLURAL_SUFFIX, ''));
  }
  return out;
}

function load(lang, file) {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, lang, file), 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${lang}/${file}: invalid JSON (${e.message})`);
  }
}

const problems = [];
const namespaces = fs
  .readdirSync(path.join(LOCALES_DIR, SOURCE))
  .filter((f) => f.endsWith('.json'));

for (const lang of LANGUAGES) {
  const files = fs.readdirSync(path.join(LOCALES_DIR, lang)).filter((f) => f.endsWith('.json'));
  for (const ns of namespaces)
    if (!files.includes(ns)) problems.push(`${lang}/${ns}: file missing`);
  for (const f of files)
    if (!namespaces.includes(f)) problems.push(`${lang}/${f}: not in ${SOURCE}/`);
}

for (const ns of namespaces) {
  let source;
  try {
    source = flatten(load(SOURCE, ns));
  } catch (e) {
    problems.push(e.message);
    continue;
  }
  for (const lang of LANGUAGES.filter((l) => l !== SOURCE)) {
    let keys;
    try {
      keys = flatten(load(lang, ns));
    } catch (e) {
      problems.push(e.message);
      continue;
    }
    for (const k of source) if (!keys.has(k)) problems.push(`${lang}/${ns}: missing "${k}"`);
    for (const k of keys)
      if (!source.has(k)) problems.push(`${lang}/${ns}: extra "${k}" (not in ${SOURCE})`);
  }
}

if (problems.length > 0) {
  console.error(`[check-i18n] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`[check-i18n] ${namespaces.length} namespaces × ${LANGUAGES.length} languages OK`);
