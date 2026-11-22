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

function counts() {
  const result = {};
  const audit = [];
  for (const dir of roots) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file).replace(/\\/g, '/');
      const found = commentLines(file);
      if (!found.length) continue;
      result[rel] = found.length;
      for (const item of found) {
        audit.push([rel, item.line, item.text.replace(/"/g, '""'), 'UNCLASSIFIED', '', ''].join(','));
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
