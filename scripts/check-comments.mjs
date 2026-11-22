import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = ['tuw-admin/src', 'packages/heart/src', 'tuw-website/src', 'db/migrate', 'scripts'];
const extensions = new Set(['.ts', '.tsx', '.mjs', '.cjs', '.js', '.sql', '.css']);
const ratchetPath = path.join(root, 'comment-ratchet.json');
const auditPath = path.join(root, 'state-for-agents/admin/comment-audit.csv');
const marker = /^\s*(\/\/|\/\*|\*|<!--|--|#)/;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function commentLines(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const found = [];
  lines.forEach((line, index) => {
    if (marker.test(line)) found.push({ line: index + 1, text: line.trim() });
  });
  return found;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function previousClassifications() {
  if (!fs.existsSync(auditPath)) return new Map();
  const rows = parseCsv(fs.readFileSync(auditPath, 'utf8')).slice(1);
  const map = new Map();
  for (const row of rows) {
    if (row.length < 6) continue;
    map.set(`${row[0]}::${row[2]}`, [row[3], row[4], row[5]]);
  }
  return map;
}

function counts() {
  const result = {};
  const audit = [];
  const prior = previousClassifications();
  for (const dir of roots) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file).replace(/\\/g, '/');
      const found = commentLines(file);
      if (!found.length) continue;
      result[rel] = found.length;
      for (const item of found) {
        const saved = prior.get(`${rel}::${item.text}`) ?? ['UNCLASSIFIED', '', ''];
        const row = [rel, String(item.line), item.text, ...saved]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(',');
        audit.push(row);
      }
    }
  }
  return { result, audit };
}

const update = process.argv.includes('--update');
const audit = process.argv.includes('--audit');
const { result, audit: rows } = counts();

if (update) {
  fs.writeFileSync(ratchetPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), total: Object.values(result).reduce((a, b) => a + b, 0), files: result }, null, 2)}\n`);
  console.log(`ratchet updated: ${Object.values(result).reduce((a, b) => a + b, 0)} comment lines`);
  process.exit(0);
}

if (audit) {
  fs.writeFileSync(auditPath, `path,line,text,category,action,issue_or_adr\n${rows.join('\n')}\n`);
  console.log(`audit written: ${rows.length} comments`);
  process.exit(0);
}

if (!fs.existsSync(ratchetPath)) {
  console.error(`missing ${path.relative(root, ratchetPath)}; run node scripts/check-comments.mjs --update`);
  process.exit(1);
}

const ratchet = JSON.parse(fs.readFileSync(ratchetPath, 'utf8'));
const failures = [];
for (const [file, count] of Object.entries(result)) {
  const allowed = ratchet.files[file] ?? 0;
  if (count > allowed) failures.push(`${file}: ${count} > ${allowed}`);
}
const total = Object.values(result).reduce((a, b) => a + b, 0);
if (total > ratchet.total) failures.push(`total: ${total} > ${ratchet.total}`);

if (failures.length) {
  console.error(`comment ratchet failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`comment ratchet ok: ${total}/${ratchet.total}`);
