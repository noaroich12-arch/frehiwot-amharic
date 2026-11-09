// אוסף את כל הטקסטים האמהריים מקובצי התוכן, כדי לייצר להם קובצי שמע.
// שימוש: node tools/collect.js am > list.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const lang = process.argv[2] || 'am';
const FCore = require(path.join(root, 'js', 'core.js'));
const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'content', 'langs.js'), 'utf8'), ctx);
const info = ctx.window.LANG_LIST.find(l => l.id === lang);
for (const f of info.files) vm.runInContext(fs.readFileSync(path.join(root, 'content', lang, f), 'utf8'), ctx, { filename: f });
const data = ctx.window.LANG_DATA[lang];
const out = new Map();
function add(s) {
  if (!s || !FCore.hasEthiopic(s) || s.includes('...') || /^-/.test(s.trim())) return;
  if (/[א-ת]/.test(s)) { (s.match(/[ሀ-᎟]+(?:[ ፡-፨]+[ሀ-᎟]+)*/g) || []).forEach(add); return; }
  const parts = s.includes(' / ') ? FCore.splitGender(s) : [s];
  for (const p of parts) {
    const k = FCore.normKey(p); if (!k) continue;
    if (!out.has(k)) out.set(k, p.trim());
    for (const t of FCore.tokens(p)) if (!out.has(t)) out.set(t, t);   // גם כל מילה בנפרד
  }
}
for (const m of (data.more || [])) for (const l of String(m.w || m.add || '').split('\n')) { const p = l.split('|'); if (p.length >= 4 && p[4] !== 'n') add(p[2].trim()); }
delete data.more;
(function walk(o) {
  if (typeof o === 'string') return add(o);
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === 'object') Object.values(o).forEach(walk);
})(data);
process.stdout.write(JSON.stringify([...out.entries()]));
