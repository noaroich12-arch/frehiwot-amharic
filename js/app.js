/* לומדים עם פריאות – האפליקציה */
(function () {
'use strict';

/* ================= כלים קטנים ================= */
var APP = document.getElementById('app');
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { return dstr(new Date()); }
function addDays(ds, n) { var p = ds.split('-').map(Number); return dstr(new Date(p[0], p[1] - 1, p[2] + n)); }
function dayDiff(a, b) { var pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((new Date(pa[0], pa[1] - 1, pa[2]) - new Date(pb[0], pb[1] - 1, pb[2])) / 864e5); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function uniqBy(a, f) { var s = {}, o = []; a.forEach(function (x) { var k = f(x); if (!s[k]) { s[k] = 1; o.push(x); } }); return o; }
var F = window.F = {};          // פונקציות שהכפתורים קוראים להן
var REG = [];                   // רישום פריטים לכפתורים
function reg(x) { REG.push(x); return REG.length - 1; }
function it(i) { return REG[i]; }

/* ================= שמירה במכשיר ================= */
var LANG = 'am';
try { LANG = localStorage.getItem('frehiwot.lang') || 'am'; } catch (e) {}
var S = null;
function blank() { return { v: 1, known: {}, seen: {}, star: {}, lessons: {}, stations: {}, catq: {}, srs: {}, days: [], revDays: [], stickers: {}, fresh: {}, first: true, mine: [] }; }
function load() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('frehiwot.p.' + LANG) || 'null'); } catch (e) {}
  S = Object.assign(blank(), s || {});
}
var saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem('frehiwot.p.' + LANG, JSON.stringify(S)); } catch (e) {} }, 150); }

/* ================= טעינת שפה ================= */
function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(src); }; document.head.appendChild(s); }); }
var D, AUD = {}, CATS = [], LESSONS = [], LEVELS = [], WORDS = [], LINES = [], ITEM = {}, BYHE = {}, LANGINFO;

function buildModel() {
  D = window.LANG_DATA[LANG];
  AUD = (window.AUDIO_MAP && window.AUDIO_MAP[LANG]) || {};
  LEVELS = D.levels; CATS = []; WORDS = []; LINES = []; ITEM = {}; BYHE = {};
  var src = D.cats.map(function (c) { return Object.assign({}, c, { w: c.w.slice() }); });
  (D.more || []).forEach(function (m) {
    var rows = String(m.w || m.add || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.split('|').length >= 4; })
      .map(function (l) { var p = l.split('|').map(function (x) { return x.trim(); }); return [p[0], p[1], p[2], p[3], p[4] === 'n' ? { noaudio: 1 } : {}]; });
    var ex = src.filter(function (c) { return c.id === m.id; })[0];
    if (ex) ex.w = ex.w.concat(rows); else src.push({ id: m.id, he: m.he, ic: m.ic, lv: m.lv, intro: m.intro, w: rows });
  });
  src.forEach(function (c) {
    var cat = { id: c.id, he: c.he, ic: c.ic, lv: c.lv, intro: c.intro, w: [] }, inCat = {};
    c.w.forEach(function (t) {
      var w = mkWord(t, cat);
      if (inCat[w.key]) return; inCat[w.key] = 1;
      cat.w.push(w);
      if (!ITEM[w.key]) { ITEM[w.key] = w; WORDS.push(w); }
      [w.he, t[0]].forEach(function (h) { var hk = h.replace(/[?!.]/g, '').trim(); if (!BYHE[hk]) BYHE[hk] = w; });
    });
    CATS.push(cat);
  });
  var ord = [];
  LEVELS.forEach(function (lv) { D.lessons.forEach(function (l) { if (l.lv === lv.lv) ord.push(l); }); });
  LESSONS = ord.map(function (l, i) {
    var o = Object.assign({}, l); o.num = i + 1;
    o.lines = l.L.map(function (r, j) {
      var x = { kind: 'l', spk: r[0], tr: r[1], am: r[2], he: r[3], lesson: o.id, j: j, key: 'l:' + FCore.normKey(r[2]) };
      if (r[2] && FCore.normKey(r[2]) && !/^\(/.test(r[1])) { if (!ITEM[x.key]) { ITEM[x.key] = x; LINES.push(x); } }
      return x;
    });
    return o;
  });
}
/* בעברית: "הוא אוכל / היא אוכלת" = שני משפטים שלמים; "בוא / בואי" = מילה אחת מתחלפת */
function splitHe(he) {
  if (he.indexOf(' / ') < 0) return null;
  var p = he.split(' / ');
  if (p.length === 2 && p[0].trim().split(/\s+/).length > 1 && p[1].trim().split(/\s+/).length > 1) return [p[0].trim(), p[1].trim()];
  return FCore.splitGender(he);
}
function mkWord(t, cat) {
  var he = t[0], tr = t[1], am = t[2], pic = t[3], o = t[4] || {};
  var w = { kind: 'w', cat: cat.id, he: he, tr: tr, am: am, pic: pic, o: o, f: null };
  var g = !o.nog && FCore.splitGender(tr), ga = !o.nog && FCore.splitGender(am);
  if (g && ga) {
    var gh = splitHe(he);
    w.tr = g[0]; w.am = ga[0]; w.he = gh ? gh[0] : he;
    w.f = { tr: g[1], am: ga[1], he: gh ? gh[1] : he };
  } else if (o.f) {
    var gh2 = splitHe(he);
    w.he = gh2 ? gh2[0] : he;
    w.f = { tr: o.f[0], am: o.f[1], he: o.f[2] || (gh2 ? gh2[1] : he) };
  }
  w.key = 'w:' + FCore.normKey(w.am) + (o.dup ? ':' + he : '');
  w.lat = o.lat || (D.latin && (D.latin[FCore.normKey(w.am)] || D.latin[w.am]));
  return w;
}
function lessonById(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i]; return null; }
function catById(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; return null; }
function findWord(he) {
  var k = he.replace(/[?!.]/g, '').trim();
  if (BYHE[k]) return BYHE[k];
  var k1 = k.split(' / ')[0].trim();
  if (BYHE[k1]) return BYHE[k1];
  for (var i = 0; i < WORDS.length; i++) { var h = WORDS[i].he.replace(/[?!.]/g, '').trim(); if (h === k1 || h.split(/[,(]/)[0].trim() === k1) return WORDS[i]; }
  return null;
}
function picSmall(p) {
  if (!p) return '';
  if (p.indexOf('c:') === 0) return '<span style="width:34px;height:34px;border-radius:50%;display:inline-block;border:2px solid #cdbba6;background:' + esc(p.slice(2)) + '"></span>';
  if (p.indexOf('t:') === 0) return '<b>' + esc(p.slice(2)) + '</b>';
  return esc(p);
}

/* ================= שמע ================= */
var cur = null, last = { k: null, t: 0, slow: false };
function audioUrl(am) { var f = AUD[FCore.normKey(am)]; return f ? 'audio/' + LANG + '/' + f : null; }
function stopAudio() { if (cur) { try { cur.pause(); } catch (e) {} cur = null; } if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} document.querySelectorAll('.playing').forEach(function (b) { b.classList.remove('playing'); }); }
function play(am, slow, onend, btn) {
  stopAudio();
  if (!am) { if (onend) onend(); return; }
  var u = audioUrl(am);
  if (btn) btn.classList.add('playing');
  var done = function () { if (btn) btn.classList.remove('playing'); if (onend) { var f = onend; onend = null; f(); } };
  if (!u) { toast('להקלטה הזו אין עדיין קובץ שמע'); done(); return; }
  var a = new Audio(u);
  a.playbackRate = slow ? 0.68 : 1;
  try { a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true; } catch (e) {}
  a.onended = done;
  a.onerror = function () { toast('לא הצלחתי להשמיע. בדקי שהרמקול פתוח ושיש אינטרנט.'); done(); };
  cur = a;
  var p = a.play(); if (p && p.catch) p.catch(function () { done(); });
}
/* לחיצה אחת = רגיל, לחיצה נוספת תוך כמה שניות = לאט */
function smartPlay(am, btn) {
  var now = Date.now();
  var slow = last.k === am && now - last.t < 6000 && !last.slow;
  last = { k: am, t: now, slow: slow };
  play(am, slow, null, btn);
  if (slow) toast('🐢 עכשיו לאט');
}
F.p = function (i, btn) { var x = it(i); smartPlay(x.am, btn); };
F.ps = function (i, btn) { var x = it(i); last = { k: x.am, t: Date.now(), slow: true }; play(x.am, true, null, btn); };
F.pa = function (am, btn) { smartPlay(am, btn); };
var actx = null;
function ding(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    var t = actx.currentTime;
    o.frequency.setValueAtTime(ok ? 660 : 330, t);
    if (ok) o.frequency.setValueAtTime(880, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.start(t); o.stop(t + 0.3);
  } catch (e) {}
}

/* ================= תעתיק עם סימוני הגייה ================= */
var DAG = 'ּ', SHVA = 'ְ';
function trHTML(tr, am) {
  var cl = [];
  Array.from(tr || '').forEach(function (ch) {
    if (/[֑-ׇ׳']/.test(ch) && cl.length && cl[cl.length - 1].h) cl[cl.length - 1].t += ch;
    else cl.push({ t: ch, h: /[א-ת]/.test(ch) });
  });
  var seq = { K: [], C: [], P: [] };
  Array.from(am || '').forEach(function (ch) {
    var c = ch.codePointAt(0);
    if (c >= 0x1240 && c <= 0x125F) seq.K.push(1); else if (c >= 0x12B0 && c <= 0x12B5) seq.K.push(0);
    else if (c >= 0x1328 && c <= 0x132F) seq.C.push(1); else if (c >= 0x1278 && c <= 0x127F) seq.C.push(0); else if (c >= 0x1338 && c <= 0x1347) seq.C.push(1);
    else if (c >= 0x1330 && c <= 0x1337) seq.P.push(1); else if (c >= 0x1350 && c <= 0x1357) seq.P.push(0);
  });
  function cls(c) { var b = c.t[0]; if (b === 'ק') return 'K'; if (b === 'צ' || b === 'ץ') return 'C'; if (b === 'פ' && c.t.indexOf(DAG) >= 0) return 'P'; if (b === 'ט') return 'T'; return null; }
  var heb = { K: [], C: [], P: [] }, ej = {};
  cl.forEach(function (c, i) { var k = cls(c); if (k === 'T') ej[i] = 1; else if (k) heb[k].push(i); });
  ['K', 'C', 'P'].forEach(function (k) {
    var H = heb[k], G = seq[k]; if (!H.length) return;
    if (H.length === G.length) H.forEach(function (i, j) { if (G[j]) ej[i] = 1; });
    else if (G.length && G.every(function (x) { return x; })) H.forEach(function (i) { ej[i] = 1; });
  });
  // מילים: כדי לדעת אם ה׳ בסוף נשמעת, מתאימים כל מילה בתעתיק למילה בכתב האמהרי
  var wIdx = [], wn = -1;
  cl.forEach(function (c, i) { if (c.h && (i === 0 || !cl[i - 1].h)) wn++; wIdx.push(c.h ? wn : -1); });
  var gz = FCore.tokens(am || ''), aligned = gz.length === wn + 1;
  var VOW = /[ִ-ֻ]/;
  var out = '', say = '', notes = {};
  cl.forEach(function (c, i) {
    var prev = cl[i - 1], next = cl[i + 1], start = !prev || !prev.h, b = c.t[0];
    var end = c.h && (!next || !next.h);
    var gem = c.h && c.t.indexOf(DAG) >= 0 && !start && 'בכפו'.indexOf(b) < 0 &&
      !(c.t.indexOf(SHVA) >= 0 && 'גדת'.indexOf(b) >= 0) && prev.h && prev.t.indexOf(SHVA) < 0;
    var marks = c.t.slice(1).replace(/[׳']/g, '');
    var prevVowel = prev && prev.h && (VOW.test(prev.t) || /^ו[ֹּ]/.test(prev.t));
    var sil = false;
    if (c.h && b === 'א' && !marks && !start && prevVowel) { sil = true; notes.alef = 1; }
    if (c.h && b === 'ה' && !marks && end && !start && prevVowel) {
      var g = aligned ? gz[wIdx[i]] : '', lastC = g ? g.codePointAt(g.length - 1) : 0;
      if ([0x1205, 0x1215, 0x1285].indexOf(lastC) >= 0 || (!aligned && /[ֵֶ]/.test(prev.t))) notes.hpro = 1;
      else { sil = true; notes.hsil = 1; }
    }
    if (c.h && b === 'ו' && /[ְִֵֶַָ]/.test(c.t) && c.t.indexOf(DAG) < 0) notes.w = 1;
    if (c.h && b === 'נ' && c.t.indexOf(SHVA) >= 0 && next && next.t[0] === 'י') notes.ny = 1;
    if (c.h && (b === 'ק' || b === 'ג') && c.t.indexOf(SHVA) >= 0 && next && next.t[0] === 'ו' && /[ַָ]/.test(next.t)) notes.kw = 1;
    if (gem) notes.gem = 1; else if (ej[i]) notes.ej = 1;
    if (sil) out += '<span class="sil" data-m="s">' + esc(c.t) + '</span>';
    else if (gem) out += '<span class="gem" data-m="g">' + esc(c.t) + '</span>';
    else if (ej[i]) out += '<span class="ej" data-m="e">' + esc(c.t) + '</span>';
    else out += esc(c.t);
    if (!sil) say += c.t;
  });
  LASTINFO = { notes: notes, say: (notes.alef || notes.hsil) ? say : '' };
  return out;
}
var LASTINFO = { notes: {}, say: '' };
var NOTE_TXT = {
  alef: 'האות א׳ החיוורת שותקת. היא רק מאריכה את התנועה שלפניה, ולא אומרים אותה.',
  hsil: 'ה׳ החיוורת בסוף המילה שותקת. המילה נגמרת בתנועה.',
  hpro: 'ה׳ בסוף המילה כן נשמעת: נשיפה קטנה ורכה בסוף.',
  w: 'ו׳ עם תנועה נשמעת כמו w באנגלית (כמו בתחילת "ווטסאפ"), ולא כמו v.',
  ny: 'נְי = "ני" צמוד, בהברה אחת.',
  kw: 'קְוַ / גְוַ נאמרות מהר, בהברה אחת.',
  gem: 'אות בכחול = צליל כפול. מחזיקים אותה רגע.',
  ej: 'אות בסגול = "פופ" קטן בגרון.'
};
/* ⭐ שימי לב: הסבר על מה שמוזר בקריאה של המילה */
function noteBox(x, big) {
  trHTML(x.tr, x.am);
  var info = LASTINFO, keys = Object.keys(info.notes);
  if (!keys.length) return '';
  var order = ['alef', 'hsil', 'hpro', 'w', 'ny', 'kw', 'gem', 'ej'].filter(function (k) { return info.notes[k]; });
  if (!big) return '<div class="starline">⭐ ' + order.map(function (k) { return esc(NOTE_TXT[k]); }).join(' ') + (info.say ? ' <b>אומרים בערך: ' + esc(info.say) + '</b>' : '') + '</div>';
  return '<div class="starbox"><b>⭐ שימי לב</b><ul>' + order.map(function (k) { return '<li>' + esc(NOTE_TXT[k]) + '</li>'; }).join('') + '</ul>' +
    (info.say ? '<div class="sayas">אומרים בערך: <b>' + esc(info.say) + '</b></div>' : '') + '<div class="muted" style="font-size:.85rem">לחיצה על אות צבועה או חיוורת: הסבר והשמעה איטית.</div></div>';
}
function trBox(x, cls) { return '<div class="tr ' + (cls || '') + '" data-am="' + esc(x.am) + '">' + trHTML(x.tr, x.am) + '</div>'; }
document.addEventListener('click', function (e) {
  var m = e.target.closest && e.target.closest('[data-m]');
  if (!m) return;
  var box = m.closest('[data-am]'); var am = box && box.getAttribute('data-am');
  var kind = m.getAttribute('data-m'), g = kind === 'g';
  showModal('<div class="sheet"><h2>' + (kind === 's' ? '⭐ <span class="sil">אות שותקת</span>' : g ? '<span class="gem">אות כפולה</span>' : '<span class="ej">עיצור לחוץ</span>') + '</h2><p style="font-size:1.2rem">' +
    (kind === 's' ? 'את האות החיוורת לא אומרים. היא רק עוזרת לקרוא את התנועה שלפניה. הקשיבי להשמעה האיטית.' : g ? 'החזיקי את הצליל עוד רגע. אם לא מחזיקים, לפעמים זו מילה אחרת.' : 'פופ קטן בגרון: עצירה קצרה ואז שחרור. אם לא יוצא, אומרים רגיל וזה עדיין מובן.') +
    '</p><div class="acts"><button class="btn" onclick="F.slowAm()">🐢 השמעה איטית</button><button class="btn sec" onclick="F.closeModal()">סגירה</button></div></div>');
  F.slowAm = function () { play(am, true); };
  play(am, true);
});

/* ================= תמונה, פריאות ================= */
function picHTML(p, he) {
  if (!p) return '<span style="font-size:2rem">' + esc(he || '') + '</span>';
  if (p.indexOf('c:') === 0) return '<span class="dot" style="background:' + esc(p.slice(2)) + '"></span>';
  if (p.indexOf('t:') === 0) return '<span class="num">' + esc(p.slice(2)) + '</span>';
  return esc(p);
}
function fr(mood) {
  mood = mood || 'happy';
  var skin = '#8a5a3c', hair = '#241712';
  var eyes = mood === 'cheer'
    ? '<path d="M45 57 Q50 52 55 57 M65 57 Q70 52 75 57" stroke="#1b120d" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="50" cy="57" rx="3.3" ry="4.2" fill="#1b120d"/><ellipse cx="70" cy="57" rx="3.3" ry="4.2" fill="#1b120d"/><circle cx="51.2" cy="55.6" r="1.1" fill="#fff"/><circle cx="71.2" cy="55.6" r="1.1" fill="#fff"/>';
  var mouth = mood === 'cheer' ? '<path d="M48 71 Q60 86 72 71 Z" fill="#5a2a1a"/><path d="M54 77 Q60 82 66 77" fill="#e57373"/>'
    : mood === 'think' ? '<path d="M53 75 Q60 72 67 75" stroke="#5a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : '<path d="M50 72 Q60 81 70 72" stroke="#5a2a1a" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
  var arms = '';
  if (mood === 'cheer') arms = '<path d="M30 112 Q14 92 16 68" stroke="#2a8c82" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M90 112 Q106 92 104 68" stroke="#2a8c82" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="16" cy="64" r="7" fill="' + skin + '"/><circle cx="104" cy="64" r="7" fill="' + skin + '"/>';
  if (mood === 'listen') arms = '<path d="M94 122 Q104 94 92 70" stroke="#2a8c82" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="90" cy="64" r="7" fill="' + skin + '"/>';
  if (mood === 'think') arms = '<path d="M90 124 Q88 98 70 88" stroke="#2a8c82" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="66" cy="85" r="7" fill="' + skin + '"/>';
  return '<svg viewBox="0 0 120 140" aria-label="פריאות" role="img">' +
    '<path d="M18 140 Q20 98 60 95 Q100 98 102 140 Z" fill="#2a8c82"/>' +
    '<rect x="52" y="80" width="16" height="20" rx="6" fill="#7a4a2f"/>' +
    '<path d="M34 102 Q60 124 86 102 L82 96 Q60 114 38 96 Z" fill="#e9a23b"/>' +
    '<g fill="' + hair + '"><circle cx="60" cy="48" r="33"/><circle cx="33" cy="36" r="12"/><circle cx="47" cy="23" r="13"/><circle cx="64" cy="19" r="13"/><circle cx="80" cy="25" r="12"/><circle cx="90" cy="39" r="11"/><circle cx="29" cy="52" r="10"/><circle cx="92" cy="55" r="9"/></g>' +
    '<path d="M30 42 Q60 24 90 42" stroke="#e07a3f" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<circle cx="35" cy="61" r="5" fill="#7d5034"/><circle cx="85" cy="61" r="5" fill="#7d5034"/><circle cx="35" cy="69" r="3" fill="#f2c14e"/><circle cx="85" cy="69" r="3" fill="#f2c14e"/>' +
    '<ellipse cx="60" cy="59" rx="25" ry="28" fill="' + skin + '"/>' +
    '<path d="M44 48 Q50 44.5 56 48 M64 48 Q70 44.5 76 48" stroke="' + hair + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    eyes + '<circle cx="44" cy="67" r="4.5" fill="#c0705a" opacity=".45"/><circle cx="76" cy="67" r="4.5" fill="#c0705a" opacity=".45"/>' +
    '<path d="M60 59 Q57 66 60.5 67.5" stroke="#6b4029" stroke-width="2" fill="none" stroke-linecap="round"/>' + mouth + arms + '</svg>';
}
function say(text, mood, extra) { return '<div class="say">' + fr(mood) + '<div class="bubble">' + text + (extra || '') + '</div></div>'; }

/* ================= הודעות, מודאל, קונפטי ================= */
var toastT;
function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2600); }
function showModal(h) { var m = document.getElementById('modal'); m.innerHTML = h; m.classList.remove('hidden'); }
F.closeModal = function () { var m = document.getElementById('modal'); m.classList.add('hidden'); m.innerHTML = ''; stopRec(); };
document.getElementById('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') F.closeModal(); });
function confetti() {
  var c = document.getElementById('confetti'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  var cols = ['#c8601f', '#e9a23b', '#2f7d4f', '#1d4fbf', '#a3195b', '#f2c14e'], P = [];
  for (var i = 0; i < 140; i++) P.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3.5, s: 6 + Math.random() * 7, r: Math.random() * 6, c: pick(cols) });
  var t0 = performance.now();
  (function fr2(t) {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += 0.1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (t - t0 < 2600) requestAnimationFrame(fr2); else x.clearRect(0, 0, c.width, c.height);
  })(t0);
}

/* ================= התקדמות, מדבקות, רצף ================= */
function markDay() { var t = today(); if (S.days.indexOf(t) < 0) { S.days.push(t); save(); } checkStreak(); }
function streak() {
  var days = {}; S.days.forEach(function (d) { days[d] = 1; });
  var d = today(); if (!days[d]) d = addDays(d, -1);
  var n = 0, misses = [];
  for (var k = 0; k < 500; k++) {
    if (days[d]) n++;
    else {
      if (n === 0 || misses.some(function (m) { return dayDiff(m, d) < 7; })) break;
      misses.push(d);
    }
    d = addDays(d, -1);
  }
  return n;
}
function checkStreak() { var s = streak(); [3, 7, 14, 30].forEach(function (n) { if (s >= n) award('s' + n); }); }
function flower(s) { return s >= 30 ? '🌻' : s >= 14 ? '🌷' : s >= 7 ? '🌿' : s >= 1 ? '🌱' : '🌰'; }
function knownCount() { return Object.keys(S.known).length; }
function rank() {
  var pts = knownCount() + 4 * Object.keys(S.lessons).length + 6 * Object.keys(S.stations).filter(function (k) { return S.stations[k] >= 7; }).length;
  var R = [[0, 'מתחילה'], [30, 'מבינה'], [110, 'מדברת'], [240, 'מדברת בביטחון'], [99999, '']];
  for (var i = R.length - 2; i >= 0; i--) if (pts >= R[i][0]) return { name: R[i][1], next: R[i + 1][1], pts: pts, from: R[i][0], to: R[i + 1][0] };
}
var EMO = ['🌼', '🍀', '🌸', '🍓', '🎈', '🐞', '🌈', '🍊', '🦋', '⭐', '🎵', '🍎', '🌻', '🐢', '🧁', '🎀', '🍉', '🌙', '🐝', '🍒', '🌺', '🐠', '🍋', '🎨', '🦜', '🍇', '🌵', '🐬', '🥥', '🎁', '🌹', '🐿️', '🍑', '🌟', '🐣', '🍪', '🦚', '🌴', '🍯', '🎐', '🍐', '🐳'];
function stickerDefs() {
  var L = [];
  LEVELS.forEach(function (l, i) { L.push({ id: 'st' + l.lv, e: ['🥉', '🥈', '🥇', '🏅', '🏆'][i] || '🏅', n: 'תחנה ' + l.lv + ': ' + l.short, h: 'עוברים את המבחן הקטן בסוף התחנה' }); });
  [3, 7, 14, 30].forEach(function (n, i) { L.push({ id: 's' + n, e: ['🌱', '🌿', '🌷', '🌻'][i], n: n + ' ימים ברצף', h: 'מתרגלים ' + n + ' ימים ברצף (יום חופש אחד בשבוע לא מאפס)' }); });
  L.push({ id: 'snake', e: '🎲', n: 'ניצחת את פריאות', h: 'מנצחים את פריאות בסולמות ונחשים' });
  L.push({ id: 'mem', e: '🧠', n: 'זיכרון של פיל', h: 'מסיימים משחק זיכרון של 16 קלפים' });
  L.push({ id: 'rev1', e: '☀️', n: 'חזרה ראשונה', h: 'מסיימים חזרה יומית אחת' });
  L.push({ id: 'rev10', e: '🌞', n: '10 חזרות', h: 'מסיימים 10 חזרות יומיות' });
  L.push({ id: 'rec', e: '🎙️', n: 'הקול שלי', h: 'מקליטים את עצמך ומשווים לקריינית' });
  L.push({ id: 'ear', e: '👂🏾', n: 'פריאות שמעה אותי', h: 'פריאות מזהה את כל המילים במשפט שאמרת' });
  CATS.forEach(function (c) { L.push({ id: 'c:' + c.id, e: c.ic, n: c.he, h: 'מסמנים "אני יודעת" על כל המילים בקטגוריה' }); });
  LESSONS.forEach(function (l, i) { L.push({ id: 'l:' + l.id, e: EMO[i % EMO.length], n: 'שיעור ' + l.num, h: 'מסיימים את שיעור ' + l.num + ': ' + l.t }); });
  return L;
}
function award(id) {
  if (S.stickers[id]) return false;
  S.stickers[id] = today(); save();
  var d = stickerDefs().filter(function (x) { return x.id === id; })[0];
  if (d) { setTimeout(function () { toast('מדבקה חדשה! ' + d.e + ' ' + d.n); confetti(); }, 400); }
  return true;
}
function setKnown(w, on) {
  if (on) { S.known[w.key] = today(); srsAdd(w.key); } else delete S.known[w.key];
  save();
  var c = catById(w.cat);
  if (on && c && c.w.every(function (x) { return S.known[x.key]; })) award('c:' + c.id);
}
function seen(x) { if (!S.seen[x.key]) { S.seen[x.key] = today(); save(); } }

/* ================= חזרה מרווחת ================= */
var GAP = [0, 3, 7, 30];
function srsAdd(k) { if (!S.srs[k]) S.srs[k] = { b: 0, d: today() }; }
function srsResult(k, ok) {
  var r = S.srs[k] || { b: 0 };
  if (ok) { r.b = Math.min((r.b || 0) + 1, 3); r.d = addDays(today(), GAP[r.b]); } else { r.b = 0; r.d = addDays(today(), 1); }
  S.srs[k] = r; save();
}
function dueKeys() { var t = today(); return Object.keys(S.srs).filter(function (k) { return S.srs[k].d <= t && ITEM[k]; }).sort(function (a, b) { return S.srs[a].d < S.srs[b].d ? -1 : 1; }); }

/* ================= גיוון: לא חוזרים על אותו דבר ================= */
function freshPick(key, pool, n) {
  if (!pool.length) return [];
  var seenK = S.fresh[key] || [], lastK = S.fresh[key + '#last'] || [];
  var unseen = pool.filter(function (x) { return seenK.indexOf(x.key) < 0; });
  if (unseen.length < n) { seenK = []; unseen = pool.filter(function (x) { return lastK.indexOf(x.key) < 0; }); if (unseen.length < n) unseen = pool.slice(); }
  var out = shuffle(unseen).slice(0, n);
  if (out.length < n) out = out.concat(shuffle(pool.filter(function (x) { return out.indexOf(x) < 0; })).slice(0, n - out.length));
  S.fresh[key] = seenK.concat(out.map(function (x) { return x.key; }));
  S.fresh[key + '#last'] = out.map(function (x) { return x.key; });
  save();
  return out;
}

/* ================= ניווט ================= */
var R = {};
function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }
F.go = go;
F.back = function () { if (history.length > 1) history.back(); else go('home'); };
window.addEventListener('hashchange', render);
var routeArgs = [];
function render() {
  stopAudio(); F.closeModal(); REG = []; QZ = null; G = null;
  var parts = (location.hash.slice(1) || 'home').split('/').map(decodeURIComponent);
  routeArgs = parts.slice(1);
  (R[parts[0]] || R.home).apply(null, parts.slice(1));
  window.scrollTo(0, 0);
}
function top(title, noBack) {
  return '<div class="top">' + (noBack ? '' : '<button class="ibtn" onclick="F.back()" aria-label="חזרה">→</button>') +
    '<h1>' + esc(title) + '</h1><button class="ibtn" onclick="F.go(\'home\')" aria-label="דף הבית">🏠</button></div>';
}
function setView(h) { APP.innerHTML = h; }

/* ================= דף הבית ================= */
function nextLesson() { for (var i = 0; i < LESSONS.length; i++) if (!S.lessons[LESSONS[i].id]) return LESSONS[i]; return null; }
function hourGreet() { var h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'; }
function weekSummary() {
  var t = today(), w = 0, d = 0;
  Object.keys(S.known).forEach(function (k) { if (dayDiff(t, S.known[k]) < 7) w++; });
  S.days.forEach(function (x) { if (dayDiff(t, x) < 7) d++; });
  return { words: w, days: d };
}
R.home = function () {
  var due = dueKeys().length, st = streak(), rk = rank(), nl = nextLesson();
  var stickN = Object.keys(S.stickers).length, total = stickerDefs().length, ws = weekSummary();
  var revToday = S.revDays.indexOf(today()) >= 0;
  var g = D.guide;
  var bubble = '<b>' + hourGreet() + '!</b> ' + (S.first ? 'אני ' + g.name + ', ואלמד אותך ' + g.langHe + ' מדוברת לגן ולשיחות עם הורים. כל מילה אפשר לשמוע.' :
    revToday ? 'סיימת את החזרה של היום. גוֹבֶּז! אפשר להמשיך בשיעור הבא.' :
    !Object.keys(S.srs).length ? 'בואי נתחיל: "מילים ראשונות" או שיעור 1. כל מילה שתסמני "אני יודעת" תיכנס לחזרה היומית.' :
    'יש לך ' + Math.min(10, Math.max(due, Object.keys(S.srs).length)) + ' מילים לחזור עליהן היום.');
  var langs = window.LANG_LIST.map(function (l) { return '<button class="chip ' + (l.id === LANG ? 'on' : '') + '" onclick="F.lang(\'' + l.id + '\')">' + esc(l.name) + (l.ready ? '' : ' <small>(בקרוב)</small>') + '</button>'; }).join('');
  var path = LEVELS.map(function (lv) {
    var ls = LESSONS.filter(function (l) { return l.lv === lv.lv; }), dn = ls.filter(function (l) { return S.lessons[l.id]; }).length;
    var passed = (S.stations[lv.lv] || 0) >= 7, isNext = nl && nl.lv === lv.lv;
    return '<button class="station ' + (passed ? 'done ' : '') + (isNext ? 'next' : '') + '" onclick="F.go(\'station/' + lv.lv + '\')"><span class="num">' + (passed ? '✅' : lv.ic) + '</span><span class="grow"><b>תחנה ' + lv.lv + ': ' + esc(lv.short) + '</b><br><span class="small">' + esc(lv.t) + ' · ' + dn + '/' + ls.length + ' שיעורים' + (isNext ? ' · <b style="color:var(--accent)">ממשיכים מכאן</b>' : '') + '</span></span><span>←</span></button>';
  }).join('');
  var pct = rk.to < 99999 ? Math.round(100 * (rk.pts - rk.from) / (rk.to - rk.from)) : 100;
  setView(
    '<div class="top"><h1>לומדים עם ' + esc(g.name) + '</h1><button class="ibtn" onclick="F.go(\'about\')" aria-label="אודות">ℹ️</button></div>' +
    (window.LANG_LIST.length > 1 ? '<div class="langs">' + langs + '</div>' : '') +
    say(bubble, 'happy', ' <button class="ibtn" style="height:40px;min-width:40px" onclick="F.pa(\'ሰላም\',this)" aria-label="השמעה">🔊</button>') +
    '<button class="daily" onclick="F.go(\'review\')"><span style="font-size:2rem">☀️</span><span>החזרה היומית שלי<small>' + (revToday ? '✓ סיימת להיום · אפשר עוד סיבוב' : '5 דקות · 10 פריטים') + '</small></span></button>' +
    '<div class="tiles">' +
      '<button class="tile" onclick="F.go(\'words\')"><span class="e">🗂️</span>מילים<small>' + WORDS.length + ' כרטיסיות</small></button>' +
      '<button class="tile" onclick="F.go(\'lessons\')"><span class="e">💬</span>שיחות<small>' + LESSONS.length + ' שיעורים</small></button>' +
      '<button class="tile" onclick="F.go(\'pron\')"><span class="e">🎙️</span>תרגול הגייה<small>שמיעה, הקלטה, השוואה</small></button>' +
      '<button class="tile" onclick="F.go(\'games\')"><span class="e">🎲</span>משחקים<small>5 משחקים</small></button>' +
    '</div>' +
    '<div class="stats"><div class="stat"><b>' + flower(st) + ' ' + st + '</b><span>ימים ברצף</span></div>' +
      '<button class="stat" style="font:inherit" onclick="F.go(\'album\')"><b>🏷️ ' + stickN + '</b><span>מדבקות מתוך ' + total + '</span></button>' +
      '<div class="stat"><b>' + knownCount() + '</b><span>מילים שאני יודעת</span></div></div>' +
    '<div class="card"><div class="row"><b class="grow">הרמה שלי: ' + rk.name + '</b>' + (rk.next ? '<span class="muted">הבאה: ' + rk.next + '</span>' : '') + '</div><div class="bar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div>' +
      '<p class="muted" style="margin-top:8px">השבוע למדת ' + ws.words + ' מילים חדשות ותרגלת ' + ws.days + ' ימים.</p></div>' +
    (nl ? '<button class="btn big" onclick="F.go(\'lesson/' + nl.id + '\')">📍 להמשיך: שיעור ' + nl.num + ' – ' + esc(nl.t) + '</button>' : '') +
    '<h2>המסלול שלי</h2><div class="path">' + path + '</div>' +
    '<h2>עוד דברים טובים</h2><div class="menu">' +
      '<button onclick="F.go(\'read\')">📖 איך קוראים</button>' +
      '<button onclick="F.go(\'steps\')">🧭 שיחה טיפולית צעד אחר צעד</button>' +
      '<button onclick="F.go(\'tips\')">💡 טיפים מ' + esc(g.name) + '</button>' +
      '<button onclick="F.go(\'bank\')">🔎 בנק המילים</button>' +
      '<button onclick="F.go(\'print\')">🖨️ כרטיסיות להדפסה</button>' +
      '<button onclick="F.go(\'album\')">🏷️ אלבום המדבקות</button>' +
    '</div>' +
    '<p class="foot">ההשמעה: קול ממוחשב (מקדס). ההתקדמות נשמרת רק במכשיר הזה, בלי הרשמה.</p>'
  );
  if (S.first) {
    S.first = false; save();
    setTimeout(function () {
      showModal('<div class="sheet">' + say('שלום! אני ' + esc(g.name) + '. לפני שמתחילים, רוצה לעבור איתי דקה אחת על "איך קוראים"? שם מוסבר מה אומרים הצבעים בתוך המילים.', 'cheer') +
        '<div class="acts"><button class="btn" onclick="F.go(\'read\')">כן, בואי</button><button class="btn sec" onclick="F.closeModal()">אחר כך</button></div></div>');
    }, 500);
  }
};
F.lang = function (id) {
  var l = window.LANG_LIST.filter(function (x) { return x.id === id; })[0];
  if (!l || !l.ready) { toast('השפה הזו עוד לא מוכנה'); return; }
  if (id === LANG) return;
  try { localStorage.setItem('frehiwot.lang', id); } catch (e) {}
  location.reload();
};

/* ================= תחנה ================= */
R.station = function (n) {
  var lv = LEVELS.filter(function (x) { return String(x.lv) === String(n); })[0]; if (!lv) return go('home');
  var cats = CATS.filter(function (c) { return c.lv === lv.lv; }), ls = LESSONS.filter(function (l) { return l.lv === lv.lv; });
  var nl = nextLesson(), best = S.stations[lv.lv];
  setView(top('תחנה ' + lv.lv + ': ' + lv.short) +
    say('<b>' + esc(lv.t) + '</b><br>' + esc(lv.d), 'happy') +
    '<h2>🗂️ מילים לתחנה</h2><div class="grid2">' + cats.map(catTile).join('') + '</div>' +
    '<h2>💬 השיחות</h2><div class="list">' + ls.map(function (l) { return lessonRow(l, nl); }).join('') + '</div>' +
    '<h2>🏁 מבחן קטן לסוף התחנה</h2><div class="card">' + say('10 שאלות קצרות על המילים והשיחות של התחנה. ' + (best != null ? 'התוצאה הכי טובה שלך: <b>' + best + '/10</b>.' : 'אין כאן ציון שמוריד. כל טעות היא הזדמנות לשמוע שוב.'), 'think') +
      '<button class="btn big" onclick="F.stationQuiz(' + lv.lv + ')">' + ((best || 0) >= 7 ? '✅ עברת! לנסות שוב' : 'למבחן התחנה') + '</button></div>');
};
var PART = 12;
function nParts(c) { return Math.ceil(c.w.length / PART); }
function partWords(c, k) { return c.w.slice(k * PART, (k + 1) * PART); }
function nextHref(c, i) { return ((i + 1) % PART === 0 || i + 1 >= c.w.length) ? 'pend/' + c.id + '/' + Math.floor(i / PART) : 'cat/' + c.id + '/' + (i + 1); }
function catTile(c) {
  var k = c.w.filter(function (w) { return S.known[w.key]; }).length;
  return '<button class="tile" onclick="F.go(\'catx/' + c.id + '\')"><span class="e">' + c.ic + '</span>' + esc(c.he) + '<small>' + c.w.length + ' מילים · ' + nParts(c) + ' שיעורים' + (k ? '<br>יודעת ' + k + (k === c.w.length ? ' ✅' : '') : '') + '</small></button>';
}
/* קטגוריה = כמה שיעורי מילים קצרים, 12 מילים בכל אחד */
R.catx = function (id) {
  var c = catById(id); if (!c) return go('words');
  var rows = [];
  for (var k = 0; k < nParts(c); k++) {
    var pw = partWords(c, k), kn = pw.filter(function (w) { return S.known[w.key]; }).length, q = S.catq[id + ':' + k];
    var done = q != null && q >= 4;
    rows.push('<button class="li" onclick="F.go(\'cat/' + id + '/' + (k * PART) + '\')"><span class="e">' + (done ? '✅' : '📗') + '</span><span class="t"><b>שיעור מילים ' + (k + 1) + '</b><span class="muted">' + esc(pw.slice(0, 4).map(function (w) { return w.he; }).join(' · ')) + '…</span></span><span class="badge ' + (kn === pw.length ? 'g' : '') + '">' + kn + '/' + pw.length + '</span></button>');
  }
  setView(top(c.he) + say((c.intro ? esc(c.intro) + '<br>' : '') + 'יש כאן ' + c.w.length + ' מילים, מחולקות ל־' + nParts(c) + ' שיעורים קצרים. בסוף כל שיעור יש מבחן קטן.', 'happy') +
    '<div class="list">' + rows.join('') + '</div>' +
    '<p class="center"><button class="chip" onclick="F.go(\'catlist/' + id + '\')">📋 כל המילים ברשימה</button><button class="chip" onclick="F.catQuiz(\'' + id + '\')">🏁 מבחן על כל הקטגוריה</button></p>');
};
R.pend = function (id, k) {
  var c = catById(id); if (!c) return go('words'); k = +k;
  var pw = partWords(c, k), kn = pw.filter(function (w) { return S.known[w.key]; }).length, last = k + 1 >= nParts(c);
  markDay();
  setView(top(c.he) + say('<b>סיימת את שיעור מילים ' + (k + 1) + '!</b><br>את יודעת ' + kn + ' מתוך ' + pw.length + ' מילים בשיעור הזה. עכשיו מבחן קטן של 6 שאלות?', 'cheer') +
    '<button class="btn big" onclick="F.partQuiz(\'' + id + '\',' + k + ')">🏁 למבחן הקטן</button><p></p>' +
    (last ? '' : '<button class="btn big sec" onclick="F.go(\'cat/' + id + '/' + ((k + 1) * PART) + '\')">לשיעור מילים ' + (k + 2) + ' ←</button><p></p>') +
    '<button class="btn big sec" onclick="F.go(\'catx/' + id + '\')">לכל השיעורים של "' + esc(c.he) + '"</button>');
};
F.partQuiz = function (id, k) {
  var c = catById(id), pool = partWords(c, k).filter(function (w) { return !w.o.noaudio; });
  if (pool.length < 2) return go('catx/' + id);
  var pk = freshPick('pq:' + id + ':' + k, pool, Math.min(6, pool.length));
  var types = ['listen', 'how', 'pic', 'listen', 'meaning', 'say'];
  runQuiz({ title: 'מבחן קטן · ' + c.he + ' ' + (k + 1), qs: pk.map(function (w, i) { return makeQ(w, pool.concat(c.w), types[i % types.length]); }), back: 'catx/' + id, again: function () { F.partQuiz(id, k); },
    onDone: function (s) { var key = id + ':' + k; S.catq[key] = Math.max(S.catq[key] || 0, s); pk.forEach(function (w) { seen(w); srsAdd(w.key); }); save(); return ''; } });
};
function lessonRow(l, nl) {
  var done = S.lessons[l.id], isNext = nl && nl.id === l.id;
  return '<button class="li ' + (isNext ? 'next' : '') + '" onclick="F.go(\'lesson/' + l.id + '\')"><span class="e">' + (done ? '✅' : isNext ? '📍' : '💬') + '</span><span class="t"><b>שיעור ' + l.num + ': ' + esc(l.t) + '</b><span class="muted">' + esc(l.sit.length > 70 ? l.sit.slice(0, 68) + '…' : l.sit) + '</span></span>' + (isNext ? '<span class="badge">מומלץ</span>' : '') + '</button>';
}

/* ================= מילים ================= */
R.words = function () {
  setView(top('מילים') + say('בחרי קטגוריה. כל כרטיסייה: תמונה, תעתיק, השמעה והקלטה. בסוף כל קטגוריה יש מבחן קטן.', 'happy') +
    LEVELS.map(function (lv) {
      var cats = CATS.filter(function (c) { return c.lv === lv.lv; }); if (!cats.length) return '';
      return '<h2>' + lv.ic + ' תחנה ' + lv.lv + ': ' + esc(lv.short) + '</h2><div class="grid2">' + cats.map(catTile).join('') + '</div>';
    }).join(''));
};
var gender = 'm';
R.cat = function (id, idx) {
  var c = catById(id); if (!c) return go('words');
  var i = Math.max(0, Math.min(c.w.length, +idx || 0));
  if (i >= c.w.length) return catEnd(c);
  var w = c.w[i]; seen(w);
  var x = gender === 'f' && w.f ? { tr: w.f.tr, am: w.f.am, he: w.f.he } : w;
  var ri = reg({ am: x.am, tr: x.tr, he: x.he });
  var lat = gender === 'f' && w.f ? null : w.lat;
  var known = S.known[w.key];
  var ex = w.o.ex ? reg({ tr: w.o.ex[0], am: w.o.ex[1], he: w.o.ex[2] }) : -1;
  setView(top(c.he) +
    (i === 0 && c.intro ? say(esc(c.intro), 'happy') : '') +
    '<div class="row muted" style="justify-content:space-between"><span>שיעור מילים ' + (Math.floor(i / PART) + 1) + '/' + nParts(c) + ' · מילה ' + (i % PART + 1) + ' מתוך ' + partWords(c, Math.floor(i / PART)).length + '</span><button class="star" onclick="F.star(\'' + esc(w.key) + '\',this)" aria-label="שמירה למילים שלי">' + (S.star[w.key] ? '⭐' : '☆') + '</button></div>' +
    '<div class="wcard">' +
      '<div class="pic">' + picHTML(w.pic, w.he) + '</div>' +
      (w.f ? '<div class="gtog"><button class="' + (gender === 'm' ? 'on' : '') + '" onclick="F.gen(\'m\')">לבן</button><button class="' + (gender === 'f' ? 'on' : '') + '" onclick="F.gen(\'f\')">לבת</button></div>' : '') +
      trBox(x) + (lat ? '<div class="lat">' + esc(lat) + '</div>' : '') +
      '<div class="he">' + esc(x.he) + '</div>' +
      '<div class="amx am">' + esc(x.am) + '</div>' +
      (w.o.noaudio ? '<p class="muted">זה חלק של מילה, ולכן אין לו השמעה לבד. שמעי את הדוגמה.</p>' :
      '<div class="acts"><button class="play" onclick="F.p(' + ri + ',this)" aria-label="השמעה">🔊</button><button class="play sec" onclick="F.ps(' + ri + ',this)" aria-label="השמעה איטית">🐢</button><button class="play sec" onclick="F.rec(' + ri + ')" aria-label="הקלטה והשוואה">🎙️</button><button class="play sec" onclick="F.listen(' + ri + ')" aria-label="פריאות מקשיבה">👂🏾</button></div>' +
      '<div class="muted" style="font-size:.85rem">🔊 לחיצה נוספת = לאט · 🎙️ הקליטי והשווי · 👂🏾 ' + esc(D.guide.name) + ' מקשיבה</div>') +
      (ex >= 0 ? '<div class="note"><b>דוגמה:</b> <span style="font-size:1.25rem;font-weight:800">' + trHTML(it(ex).tr, it(ex).am) + '</span> – ' + esc(it(ex).he) + ' <button class="ibtn" style="height:40px;min-width:40px" onclick="F.p(' + ex + ',this)">🔊</button></div>' : '') +
      (w.o.note ? '<div class="note">' + esc(w.o.note) + '</div>' : '') +
      noteBox(x, true) +
    '</div>' +
    '<div class="navrow"><button class="ibtn" onclick="F.go(\'cat/' + c.id + '/' + (i - 1) + '\')" ' + (i === 0 ? 'disabled' : '') + '>→ הקודמת</button>' +
      '<button class="know ' + (known ? 'done' : '') + '" onclick="F.know(\'' + esc(w.key) + '\')">' + (known ? '✓ אני יודעת' : 'אני יודעת') + '</button>' +
      '<button class="ibtn" onclick="F.go(\'' + nextHref(c, i) + '\')">הבאה ←</button></div>' +
    '<p class="center"><button class="chip" onclick="F.go(\'catlist/' + c.id + '\')">📋 כל המילים ברשימה</button><button class="chip" onclick="F.catQuiz(\'' + c.id + '\')">🏁 מבחן קטן</button></p>');
  setTimeout(function () { if (!w.o.noaudio) play(x.am); }, 250);
};
function legend(x) {
  var h = trHTML(x.tr, x.am), g = h.indexOf('class="gem"') >= 0, e = h.indexOf('class="ej"') >= 0;
  if (!g && !e) return '';
  return '<div class="legend">' + (g ? '<span class="gem">כחול</span> = אות כפולה, מחזיקים רגע. ' : '') + (e ? '<span class="ej">סגול</span> = פופ קטן בגרון. ' : '') + 'לחצי על אות צבועה להסבר.</div>';
}
F.gen = function (g) { gender = g; render(); };
F.know = function (key) { var w = ITEM[key]; var on = !S.known[key]; setKnown(w, on); if (on) { ding(true); toast('גוֹבֶּז! נכנסה לחזרה היומית'); var a = routeArgs; setTimeout(function () { go(nextHref(catById(a[0]), +a[1])); }, 450); } else render(); };
F.star = function (key, b) { if (S.star[key]) delete S.star[key]; else S.star[key] = 1; save(); if (b) b.textContent = S.star[key] ? '⭐' : '☆'; toast(S.star[key] ? 'נשמרה ב"המילים שלי"' : 'הוסרה מ"המילים שלי"'); };
function catEnd(c) {
  var k = c.w.filter(function (w) { return S.known[w.key]; }).length;
  setView(top(c.he) + say('<b>סיימת לעבור על "' + esc(c.he) + '"!</b><br>את יודעת ' + k + ' מתוך ' + c.w.length + ' מילים. רוצה מבחן קטן של 6 שאלות?', 'cheer') +
    '<button class="btn big" onclick="F.catQuiz(\'' + c.id + '\')">🏁 למבחן הקטן</button><p></p>' +
    '<button class="btn big sec" onclick="F.go(\'cat/' + c.id + '/0\')">לעבור שוב על הכרטיסיות</button><p></p>' +
    '<button class="btn big sec" onclick="F.go(\'words\')">לקטגוריות</button>');
  markDay();
}
R.catlist = function (id) {
  var c = catById(id); if (!c) return go('words');
  setView(top(c.he) + '<div class="list">' + c.w.map(function (w, i) {
    var ri = reg(w);
    return '<div class="li"><span class="e">' + picSmall(w.pic) + '</span><span class="t" onclick="F.go(\'cat/' + c.id + '/' + i + '\')" style="cursor:pointer">' + trBox(w, 's') + '<span>' + esc(w.he) + (w.f ? ' <small class="muted">(יש גם לבת)</small>' : '') + '</span></span>' + (S.known[w.key] ? '✅' : '') + '<button class="play small" onclick="F.p(' + ri + ',this)">🔊</button></div>';
  }).join('') + '</div>');
};

/* ================= שיחות ================= */
R.lessons = function () {
  var nl = nextLesson();
  setView(top('שיחות') + say('אפשר להיכנס לכל שיעור. הסימן 📍 מראה איפה מומלץ להמשיך.', 'happy') +
    LEVELS.map(function (lv) {
      return '<h2>' + lv.ic + ' רמה ' + lv.lv + ': ' + esc(lv.t) + '</h2><p class="muted">' + esc(lv.d) + '</p><div class="list">' +
        LESSONS.filter(function (l) { return l.lv === lv.lv; }).map(function (l) { return lessonRow(l, nl); }).join('') +
        '</div><button class="chip" onclick="F.go(\'station/' + lv.lv + '\')">🏁 למבחן של תחנה ' + lv.lv + '</button>';
    }).join(''));
};
var turnMode = false;
R.lesson = function (id) {
  var l = lessonById(id); if (!l) return go('lessons');
  var pplOther = l.lines.filter(function (x) { return x.spk !== 'a'; }).map(function (x) { return x.spk; })[0] || '';
  var msgs = l.lines.map(function (x, j) {
    var me = x.spk === 'a', stage = /^\(/.test(x.tr) && !FCore.normKey(x.am);
    var ri = reg(x);
    var body;
    if (stage) body = '<div class="stage">' + esc(x.he) + '</div>';
    else if (me && turnMode && !x._shown) body = '<div class="he">' + esc(x.he) + '</div><button class="hidebox" style="width:100%;border:none" onclick="F.reveal(' + j + ')">🗣️ אמרי בקול, ואז לחצי לראות ולשמוע</button>';
    else body = trBox(x) + noteBox(x, false) + '<div class="he">' + esc(x.he) + '</div><div class="amx am">' + esc(x.am) + '</div>' +
      '<div class="acts"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><button class="play small sec" onclick="F.ps(' + ri + ',this)">🐢</button><button class="play small sec" onclick="F.rec(' + ri + ')">🎙️</button><button class="play small sec" onclick="F.listen(' + ri + ')">👂🏾</button></div>';
    return '<div class="msg ' + (me ? 'me' : 'other') + '" id="m' + j + '"><div class="who">' + (me ? 'את' : esc(x.spk)) + '</div>' + body + '</div>';
  }).join('');
  var wchips = (l.words || []).map(function (h) {
    var w = findWord(h);
    if (!w) return '<span class="chip">' + esc(h) + '</span>';
    var c = catById(w.cat), i = c.w.indexOf(w);
    return '<button class="chip" onclick="F.go(\'cat/' + c.id + '/' + i + '\')">' + esc(w.tr) + ' · ' + esc(h) + '</button>';
  }).join('');
  var extra = (l.extra || []).map(function (e) { var ri = reg({ tr: e[0], am: e[1], he: e[2] }); return '<div class="phrase"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><span class="tr">' + trHTML(e[0], e[1]) + '</span><span>– ' + esc(e[2]) + '</span></div>'; }).join('');
  var qs = (l.q || []).map(function (q, k) { return '<details><summary>' + esc(q[0]) + '</summary><p style="font-size:1.15rem;font-weight:700">' + esc(q[1]) + '</p></details>'; }).join('');
  setView(top('שיעור ' + l.num + ': ' + l.t) +
    say(esc(l.sit), 'happy') +
    '<div class="row"><button class="btn" onclick="F.playAll()">▶ השמיעי את כל השיחה</button><button class="btn sec" onclick="F.turn()">' + (turnMode ? '👀 להציג הכול' : '🗣️ תורי לדבר') + '</button></div>' +
    (turnMode ? '<p class="muted">במצב "תורי לדבר" השורות שלך מוסתרות. קראי את התרגום, אמרי בקול, ואז לחצי.</p>' : '') +
    '<div class="chat">' + msgs + '</div>' +
    (extra ? '<div class="box build"><h3>מילים נוספות לשיעור</h3>' + extra + '</div>' : '') +
    (l.build ? '<div class="box build"><h3>🧱 איך בונים את זה</h3><p>' + esc(l.build) + '</p></div>' : '') +
    (l.tip ? '<div class="box tip"><h3>💡 טיפ ' + esc(l.tipT || '') + ' מ' + esc(D.guide.name) + '</h3><p>' + esc(l.tip) + '</p></div>' : '') +
    (wchips ? '<h3>🗂️ מילים מהשיעור</h3><div class="wchips">' + wchips + '</div>' : '') +
    (qs ? '<h3>🤔 שאלות לחשיבה</h3><p class="muted">חשבי על התשובה, ואז לחצי לראות.</p>' + qs : '') +
    '<div class="card">' + say('בסוף כל שיעור: "שמעי ובחרי". אני משמיעה משפט, ואת בוחרת מה הוא אומר.', 'listen') + '<button class="btn big" onclick="F.lessonQuiz(\'' + l.id + '\')">🎧 לתרגול הקצר</button></div>' +
    lessonNav(l));
};
function lessonNav(l) {
  var i = LESSONS.indexOf(l), p = LESSONS[i - 1], n = LESSONS[i + 1];
  return '<div class="navrow">' + (p ? '<button class="ibtn" onclick="F.go(\'lesson/' + p.id + '\')"><small>→ שיעור ' + p.num + '</small></button>' : '<span></span>') + (n ? '<button class="ibtn" onclick="F.go(\'lesson/' + n.id + '\')"><small>שיעור ' + n.num + ' ←</small></button>' : '') + '</div>';
}
F.turn = function () { turnMode = !turnMode; var l = lessonById(routeArgs[0]); l.lines.forEach(function (x) { x._shown = false; }); render(); };
F.reveal = function (j) { var l = lessonById(routeArgs[0]); var x = l.lines[j]; x._shown = true; var y = window.scrollY; render(); window.scrollTo(0, y); play(x.am); };
F.playAll = function () {
  var l = lessonById(routeArgs[0]); var arr = l.lines.map(function (x, j) { return [x, j]; }).filter(function (p) { return FCore.normKey(p[0].am); });
  var k = 0;
  (function nx() {
    document.querySelectorAll('.msg.hl').forEach(function (m) { m.classList.remove('hl'); });
    if (k >= arr.length) return;
    var p = arr[k++], el = document.getElementById('m' + p[1]);
    if (el) { el.classList.add('hl'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    play(p[0].am, false, function () { setTimeout(nx, 450); });
  })();
};

/* ================= חידון כללי ================= */
var QZ = null;
function optionsFor(item, pool, n, field) {
  var others = pool.filter(function (x) { return x.key !== item.key && x[field] !== item[field] && x.he !== item.he; });
  if (others.length < n - 1) others = others.concat(WORDS.filter(function (x) { return x.key !== item.key && x[field] !== item[field] && x.he !== item.he; }));
  others = uniqBy(shuffle(others), function (x) { return x[field]; }).slice(0, n - 1);
  return shuffle(others.concat([item]));
}
function makeQ(item, pool, type, n) {
  n = n || 4;
  if (type === 'pic' && !(item.kind === 'w' && item.pic)) type = 'how';
  var field = (type === 'listen' || type === 'meaning') ? 'he' : 'tr';
  var q = { type: type, item: item };
  if (type !== 'say') { q.opts = optionsFor(item, pool, n, field); q.ans = q.opts.indexOf(item); q.field = field; }
  return q;
}
function runQuiz(cfg) {
  QZ = { cfg: cfg, i: 0, score: 0, wrong: [], answered: false };
  drawQ();
}
function drawQ() {
  var z = QZ, q = z.cfg.qs[z.i], x = q.item, ri = reg(x);
  var head = '<div class="qhead"><span>' + esc(z.cfg.title) + '</span><span>' + (z.i + 1) + ' / ' + z.cfg.qs.length + '</span></div>';
  var prompt = '';
  if (q.type === 'listen') prompt = '<div class="qprompt">🔊 מה שמעת?</div><div class="acts"><button class="play" onclick="F.p(' + ri + ',this)">🔊</button><button class="play sec" onclick="F.ps(' + ri + ',this)">🐢</button></div>';
  if (q.type === 'how') prompt = '<div class="qprompt">איך אומרים: "' + esc(x.he) + '"?</div>' + (x.pic && x.kind === 'w' ? '<div class="pic">' + picHTML(x.pic) + '</div>' : '');
  if (q.type === 'pic') prompt = '<div class="qprompt">מה זה?</div><div class="pic">' + picHTML(x.pic) + '</div>';
  if (q.type === 'meaning') prompt = '<div class="qprompt">מה פירוש:</div>' + trBox(x, 's center') + '<div class="acts"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button></div>';
  if (q.type === 'say') prompt = '<div class="qprompt">🗣️ אמרי בקול:</div><div class="he center" style="font-size:1.5rem">' + esc(x.he) + '</div>' + (x.pic && x.kind === 'w' ? '<div class="pic">' + picHTML(x.pic) + '</div>' : '');
  var opts = '';
  if (q.type === 'say') opts = '<div id="sayBox"><button class="btn big" onclick="F.sayReveal()">אמרתי. גלי לי ושמעי</button></div>';
  else opts = '<div class="opts ' + (q.field === 'he' && q.opts.every(function (o) { return o.kind === 'w' && o.pic && o.pic.indexOf('t:') < 0; }) ? 'two' : '') + '">' + q.opts.map(function (o, k) {
    var inner = q.field === 'he' ? ((o.kind === 'w' && o.pic && q.type === 'listen' ? '<span class="e">' + picHTML(o.pic) + '</span>' : '') + esc(o.he)) : '<span class="tr s" style="font-size:1.35rem">' + esc(o.tr) + '</span>';
    return '<button class="opt" id="o' + k + '" onclick="F.ans(' + k + ')">' + inner + '</button>';
  }).join('') + '</div>';
  setView(top(z.cfg.title) + '<div class="card">' + head + prompt + opts + '<div id="fb"></div></div>');
  z.answered = false;
  if (q.type === 'listen') setTimeout(function () { play(x.am); }, 300);
}
F.ans = function (k) {
  var z = QZ; if (!z || z.answered) return; z.answered = true;
  var q = z.cfg.qs[z.i], ok = k === q.ans;
  document.getElementById('o' + q.ans).classList.add('ok');
  if (!ok) document.getElementById('o' + k).classList.add('no');
  qResult(ok);
};
F.sayReveal = function () {
  var z = QZ, q = z.cfg.qs[z.i], x = q.item, ri = reg(x);
  document.getElementById('sayBox').innerHTML = trBox(x) + '<div class="acts"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button></div><div class="row" style="justify-content:center"><button class="btn green" onclick="F.selfOk(1)">👍 אמרתי נכון</button><button class="btn sec" onclick="F.selfOk(0)">עוד לא</button></div>';
  play(x.am);
};
F.selfOk = function (ok) { var z = QZ; if (z.answered) return; z.answered = true; document.querySelectorAll('#sayBox .btn').forEach(function (b) { b.disabled = true; }); qResult(!!ok); };
function qResult(ok) {
  var z = QZ, q = z.cfg.qs[z.i], x = q.item;
  if (ok) z.score++; else z.wrong.push(x);
  if (z.cfg.srs && ITEM[x.key]) srsResult(x.key, ok);
  ding(ok);
  var ch = pick(D.cheers);
  var fb = ok ? '<div class="feedback ok">' + esc(ch[0]) + ' ' + esc(ch[2]) + '</div>'
    : '<div class="feedback no">כמעט! שמעי שוב: <span style="font-size:1.25rem">' + esc(x.tr) + '</span> – ' + esc(x.he) + '<br><small>' + esc(D.soft[0]) + ' – ' + esc(D.soft[2]) + '</small></div>';
  document.getElementById('fb').innerHTML = fb + '<button class="btn big" onclick="F.nextQ()">' + (z.i + 1 < z.cfg.qs.length ? 'הבאה ←' : 'לסיכום') + '</button>';
  if (!ok || q.type === 'how' || q.type === 'pic') setTimeout(function () { play(x.am); }, ok ? 200 : 350);
}
F.nextQ = function () { var z = QZ; z.i++; if (z.i < z.cfg.qs.length) drawQ(); else endQuiz(); };
function endQuiz() {
  var z = QZ, c = z.cfg, n = c.qs.length;
  markDay();
  var extra = c.onDone ? c.onDone(z.score, z.wrong) : '';
  if (z.score >= Math.ceil(n * 0.6)) confetti();
  endScreen({ title: c.title, score: z.score, total: n, wrong: z.wrong, msg: extra, again: c.again, back: c.back });
}
function endScreen(o) {
  var wrong = uniqBy(o.wrong || [], function (x) { return x.key; });
  var wi = reg(wrong);
  var good = o.score >= Math.ceil(o.total * 0.7);
  setView(top(o.title) + '<div class="card center">' + say((good ? '<b>' + esc(pick(D.cheers)[0]) + ' כל הכבוד!</b> ' : '<b>יופי של ניסיון!</b> ') + 'ענית נכון על <b>' + o.score + ' מתוך ' + o.total + '</b>. ' + (o.msg || ''), good ? 'cheer' : 'happy') + '</div>' +
    (wrong.length ? '<h3>כדאי לחזור על:</h3><div class="list">' + wrong.map(function (x) { var ri = reg(x); return '<div class="li"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><span class="t">' + trBox(x, 's') + '<span>' + esc(x.he) + '</span></span></div>'; }).join('') + '</div>' +
      '<button class="btn big" onclick="F.drill(' + wi + ')">🔁 תרגלי את המילים האלה</button><p></p>' : '') +
    (o.again ? '<button class="btn big sec" onclick="F.again()">' + (wrong.length ? 'סיבוב חדש' : '🎲 עוד סיבוב') + '</button><p></p>' : '') +
    '<button class="btn big sec" onclick="' + (o.back ? 'F.go(\'' + o.back + '\')' : 'F.back()') + '">סיום</button>');
  F.again = o.again || function () {};
}
F.drill = function (wi) {
  var items = it(wi);
  var qs = [];
  items.forEach(function (x, i) { qs.push(makeQ(x, items.concat(WORDS.slice(0, 40)), i % 2 ? 'how' : 'listen')); });
  items.forEach(function (x) { qs.push(makeQ(x, items.concat(WORDS.slice(0, 40)), 'meaning')); });
  runQuiz({ title: 'תרגול חוזר', qs: shuffle(qs).slice(0, 10), back: 'home' });
};

/* ---- מבחן שיעור, קטגוריה, תחנה ---- */
F.lessonQuiz = function (id) {
  var l = lessonById(id);
  var pool = l.lines.filter(function (x) { return ITEM[x.key]; });
  pool = uniqBy(pool, function (x) { return x.he; });
  var pickd = freshPick('lq:' + id, pool, Math.min(5, Math.max(3, pool.length)));
  var qs = pickd.map(function (x) { return makeQ(x, pool, 'listen', 3); });
  runQuiz({ title: 'שמעי ובחרי · שיעור ' + l.num, qs: qs, back: 'lesson/' + id, again: function () { F.lessonQuiz(id); },
    onDone: function () {
      var first = !S.lessons[id];
      S.lessons[id] = today(); pool.forEach(function (x) { srsAdd(x.key); }); save();
      award('l:' + id);
      return first ? '<br>סיימת את שיעור ' + l.num + '! המשפטים נכנסו לחזרה היומית.' : '';
    } });
};
F.catQuiz = function (id) {
  var c = catById(id), pool = c.w.filter(function (w) { return !w.o.noaudio; });
  var pk = freshPick('cq:' + id, pool, Math.min(6, pool.length));
  var types = ['listen', 'how', 'pic', 'listen', 'meaning', 'how'];
  var qs = pk.map(function (w, i) { return makeQ(w, pool, types[i % types.length]); });
  runQuiz({ title: 'מבחן קטן · ' + c.he, qs: qs, back: 'words', again: function () { F.catQuiz(id); },
    onDone: function (s) { S.catq[id] = Math.max(S.catq[id] || 0, s); pk.forEach(function (w) { seen(w); }); save(); return ''; } });
};
F.stationQuiz = function (n) {
  var cats = CATS.filter(function (c) { return c.lv === n; }), ls = LESSONS.filter(function (l) { return l.lv === n; });
  var wpool = [].concat.apply([], cats.map(function (c) { return c.w; })).filter(function (w) { return !w.o.noaudio; });
  var lpool = uniqBy([].concat.apply([], ls.map(function (l) { return l.lines; })).filter(function (x) { return ITEM[x.key] && FCore.tokens(x.am).length > 1; }), function (x) { return x.he; });
  var ws = freshPick('sqw:' + n, wpool, 5), lsP = freshPick('sql:' + n, lpool, 5);
  var qs = ws.map(function (w, i) { return makeQ(w, wpool, ['pic', 'listen', 'how', 'listen', 'how'][i]); })
    .concat(lsP.map(function (x, i) { return makeQ(x, lpool, ['listen', 'meaning', 'listen', 'say', 'meaning'][i]); }));
  runQuiz({ title: 'מבחן תחנה ' + n, qs: shuffle(qs), back: 'station/' + n, again: function () { F.stationQuiz(n); },
    onDone: function (s) {
      S.stations[n] = Math.max(S.stations[n] || 0, s); save();
      if (s >= 7) { award('st' + n); return '<br>עברת את תחנה ' + n + '! 🎉'; }
      return '<br>כדי לקבל את מדבקת התחנה צריך 7 תשובות נכונות. אפשר לנסות שוב מתי שתרצי.';
    } });
};

/* ================= חזרה יומית ================= */
R.review = function () {
  var keys = dueKeys().slice(0, 10);
  var have = {}; keys.forEach(function (k) { have[k] = 1; });
  if (keys.length < 10) {
    var more = Object.keys(S.srs).filter(function (k) { return !have[k] && ITEM[k]; }).sort(function (a, b) { return S.srs[a].d < S.srs[b].d ? -1 : 1; });
    more.concat(Object.keys(S.seen).filter(function (k) { return !have[k] && ITEM[k]; })).forEach(function (k) { if (keys.length < 10 && !have[k]) { keys.push(k); have[k] = 1; } });
  }
  if (keys.length < 10) catById('first').w.concat(catById('greet').w).forEach(function (w) { if (keys.length < 10 && !have[w.key]) { keys.push(w.key); have[w.key] = 1; } });
  keys.forEach(srsAdd);
  var items = keys.map(function (k) { return ITEM[k]; });
  var pool = items.concat(WORDS);
  var types = ['listen', 'how', 'pic', 'say', 'meaning'];
  var qs = items.map(function (x, i) { var t = types[i % types.length]; if (x.kind === 'l' && t === 'pic') t = 'listen'; return makeQ(x, x.kind === 'l' ? items.filter(function (y) { return y.kind === 'l'; }).concat(LINES) : pool, t); });
  setView(top('החזרה היומית שלי') + say('<b>' + hourGreet() + '!</b> יש לך ' + items.length + ' פריטים לחזור עליהם היום. מילה שתעני עליה נכון תחזור בעוד 3 ימים, אחר כך בעוד שבוע, ואחר כך בעוד חודש. מה שעוד לא יושב יחזור מחר.', 'happy') +
    '<button class="btn big" onclick="F.startReview()">☀️ מתחילות</button>');
  F.startReview = function () {
    runQuiz({ title: 'החזרה היומית', qs: qs, srs: true, back: 'home', again: function () { render(); },
      onDone: function () {
        if (S.revDays.indexOf(today()) < 0) S.revDays.push(today());
        save(); award('rev1'); if (S.revDays.length >= 10) award('rev10');
        return '<br>סיימת את החזרה של היום. נתראה מחר! ' + flower(streak());
      } });
  };
};

/* ================= תרגול הגייה ================= */
R.pron = function (src) {
  if (!src) {
    setView(top('תרגול הגייה') +
      say('<b>שלושה כלים:</b><br>🔊 <b>הקשבה</b>: לחיצה אחת רגיל, לחיצה נוספת לאט.<br>🎙️ <b>הקליטי והשווי</b>: את מקליטה, ואז שומעים את הקריינית ואחריה אותך, עם שני גלי קול.<br>👂🏾 <b>' + esc(D.guide.name) + ' מקשיבה</b>: את אומרת, והמחשב מנסה לזהות את המילים. מילים שזוהו בירוק, ושלא זוהו בכתום.', 'listen') +
      '<p class="muted">הרשאת מיקרופון מתבקשת רק בלחיצה הראשונה על הקלטה. ההקלטות נשארות רק במכשיר.</p>' +
      '<h2>מה מתרגלים?</h2><div class="list">' +
      '<button class="li" onclick="F.go(\'read\')"><span class="e">📖</span><span class="t"><b>חוקי הקריאה</b><span class="muted">כל חוק עם מילת דוגמה</span></span></button>' +
      CATS.map(function (c) { return '<button class="li" onclick="F.go(\'pron/c:' + c.id + '\')"><span class="e">' + c.ic + '</span><span class="t"><b>' + esc(c.he) + '</b></span></button>'; }).join('') +
      LESSONS.map(function (l) { return '<button class="li" onclick="F.go(\'pron/l:' + l.id + '\')"><span class="e">💬</span><span class="t"><b>שיעור ' + l.num + ': ' + esc(l.t) + '</b></span></button>'; }).join('') +
      '</div>');
    return;
  }
  var items = [], title = '';
  if (src.indexOf('c:') === 0) { var c = catById(src.slice(2)); title = c.he; items = c.w.filter(function (w) { return !w.o.noaudio; }); }
  else { var l = lessonById(src.slice(2)); title = 'שיעור ' + l.num; items = l.lines.filter(function (x) { return ITEM[x.key]; }); }
  setView(top('הגייה · ' + title) + '<div class="list">' + items.map(function (x) {
    var ri = reg(x);
    return '<div class="card"><div class="row"><span class="grow">' + trBox(x, 's') + '<div class="muted">' + esc(x.he) + '</div></span></div><div class="acts" style="justify-content:flex-start"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><button class="play small sec" onclick="F.ps(' + ri + ',this)">🐢</button><button class="play small sec" onclick="F.rec(' + ri + ')">🎙️</button><button class="play small sec" onclick="F.listen(' + ri + ')">👂🏾</button></div></div>';
  }).join('') + '</div>');
};

/* ---- הקלטה והשוואה ---- */
var micStream = null, recorder = null, recTimer = null;
function stopRec() { clearTimeout(recTimer); if (recorder && recorder.state === 'recording') try { recorder.stop(); } catch (e) {} }
F.rec = function (i) {
  var x = it(i);
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('בדפדפן הזה אין אפשרות להקליט. נסי בכרום.'); return; }
  showModal('<div class="sheet"><h2>🎙️ הקליטי והשווי</h2>' + trBox(x) + '<div class="he">' + esc(x.he) + '</div>' +
    '<div class="acts"><button class="btn" id="recB" onclick="F.recGo()">⏺ להקליט</button><button class="btn sec" onclick="F.p(' + i + ',this)">🔊 לשמוע קודם</button></div>' +
    '<div id="recOut"></div><div class="acts"><button class="btn sec" onclick="F.closeModal()">סגירה</button></div></div>');
  F.recGo = async function () {
    var b = document.getElementById('recB');
    if (recorder && recorder.state === 'recording') { stopRec(); return; }
    try { micStream = micStream || await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { toast('צריך לאשר את המיקרופון בדפדפן כדי להקליט'); return; }
    stopAudio();
    var chunks = [];
    recorder = new MediaRecorder(micStream);
    recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = function () {
      b.classList.remove('rec'); b.textContent = '⏺ להקליט שוב';
      var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      var url = URL.createObjectURL(blob);
      award('rec');
      var out = document.getElementById('recOut'); if (!out) return;
      out.innerHTML = '<div class="wl">הקריינית</div><canvas class="wave" id="wv1"></canvas><div class="wl">את</div><canvas class="wave" id="wv2"></canvas>' +
        '<div class="acts"><button class="btn sec" onclick="F.p(' + i + ',this)">🔊 הקריינית</button><button class="btn sec" id="mineB">▶ ההקלטה שלי</button><button class="btn sec" id="bothB">🔁 שתיהן ברצף</button></div>' +
        '<p class="muted center">שימי לב לאורך ולקצב: האם יש עצירות ואותיות כפולות במקומות דומים?</p>';
      var mine = function () { stopAudio(); var a = new Audio(url); cur = a; a.play(); };
      document.getElementById('mineB').onclick = mine;
      var both = function () { play(x.am, false, function () { setTimeout(mine, 300); }); };
      document.getElementById('bothB').onclick = both;
      drawWaves(audioUrl(x.am), blob);
      both();
    };
    recorder.start();
    b.classList.add('rec'); b.textContent = '⏹ סיימתי';
    var len = Math.min(10000, 2500 + FCore.tokens(x.am).length * 1100);
    recTimer = setTimeout(stopRec, len);
  };
};
async function drawWaves(refUrl, blob) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    var bufs = await Promise.all([
      refUrl ? fetch(refUrl).then(function (r) { return r.arrayBuffer(); }).then(function (a) { return actx.decodeAudioData(a); }) : Promise.resolve(null),
      blob.arrayBuffer().then(function (a) { return actx.decodeAudioData(a); })
    ]);
    var segs = bufs.map(function (b) {
      if (!b) return null; var d = b.getChannelData(0), mx = 0, i;
      for (i = 0; i < d.length; i += 50) mx = Math.max(mx, Math.abs(d[i]));
      var th = mx * 0.08, s = 0, e = d.length - 1;
      while (s < e && Math.abs(d[s]) < th) s++; while (e > s && Math.abs(d[e]) < th) e--;
      return { d: d, s: s, e: e, sr: b.sampleRate, mx: mx || 1 };
    });
    var maxDur = Math.max.apply(null, segs.filter(Boolean).map(function (g) { return (g.e - g.s) / g.sr; }));
    ['wv1', 'wv2'].forEach(function (id, k) {
      var cv = document.getElementById(id), g = segs[k]; if (!cv || !g) return;
      var W = cv.width = cv.clientWidth * 2, H = cv.height = 140, cx = cv.getContext('2d');
      var dur = (g.e - g.s) / g.sr, w = W * dur / maxDur, n = Math.floor(w / 6);
      cx.fillStyle = k ? '#1d4fbf' : '#c8601f';
      for (var j = 0; j < n; j++) {
        var a = g.s + Math.floor((g.e - g.s) * j / n), b2 = g.s + Math.floor((g.e - g.s) * (j + 1) / n), m = 0;
        for (var q = a; q < b2; q += 8) m = Math.max(m, Math.abs(g.d[q]));
        var h = Math.max(3, (m / g.mx) * (H - 10));
        cx.fillRect(W - (j * 6 + 6), (H - h) / 2, 4, h);
      }
    });
  } catch (e) { /* אם לא מצליחים לצייר, ההשמעה עדיין עובדת */ }
}

/* ---- פריאות מקשיבה (זיהוי דיבור) ---- */
function canon(s) {
  var M = { 0x1210: 0x1200, 0x1280: 0x1200, 0x1220: 0x1230, 0x12D0: 0x12A0, 0x1340: 0x1338 };
  return Array.from(FCore.normKey(s)).map(function (ch) {
    var c = ch.codePointAt(0);
    if (c < 0x1200 || c > 0x137F) return ch;
    var base = c - (c - 0x1200) % 8, ord = (c - 0x1200) % 8;
    if (M[base]) base = M[base];
    if ((base === 0x1200 || base === 0x12A0) && ord === 3) ord = 0;
    return String.fromCodePoint(base + ord);
  }).join('');
}
function lev(a, b) {
  a = Array.from(a); b = Array.from(b);
  var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; for (var j = 1; j <= b.length; j++) d[i][j] = i === 0 ? j : 0; }
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
F.listen = function (i) {
  var x = it(i);
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showModal('<div class="sheet">' + say('בדפדפן הזה אני לא יכולה להקשיב. זה עובד בכרום או באדג׳, במחשב ובאנדרואיד. בינתיים אפשר להשתמש ב"הקליטי והשווי" 🎙️.', 'think') + '<div class="acts"><button class="btn" onclick="F.rec(' + i + ')">🎙️ הקליטי והשווי</button><button class="btn sec" onclick="F.closeModal()">סגירה</button></div></div>');
    return;
  }
  showModal('<div class="sheet"><h2>👂🏾 ' + esc(D.guide.name) + ' מקשיבה</h2>' + trBox(x) + '<div class="he">' + esc(x.he) + '</div>' +
    '<div class="acts"><button class="btn" id="lsB" onclick="F.lsGo()">🎤 לחצי ואמרי</button><button class="btn sec" onclick="F.p(' + i + ',this)">🔊 לשמוע קודם</button></div><div id="lsOut"></div>' +
    '<p class="muted" style="font-size:.85rem">זה משוב משוער ולא ציון הגייה מדויק. המחשב לא תמיד מזהה אמהרית, גם כשהיא נאמרת נכון.</p><div class="acts"><button class="btn sec" onclick="F.closeModal()">סגירה</button></div></div>');
  F.lsGo = function () {
    stopAudio();
    var r = new SR(); r.lang = (window.LANG_LIST.filter(function (l) { return l.id === LANG; })[0] || {}).speech || 'am-ET';
    r.maxAlternatives = 5; r.interimResults = false; r.continuous = false;
    var b = document.getElementById('lsB'); b.classList.add('rec'); b.textContent = '...מקשיבה';
    var got = false;
    r.onresult = function (e) {
      got = true;
      var alts = []; for (var k = 0; k < e.results[0].length; k++) alts.push(e.results[0][k].transcript);
      var exp = FCore.tokens(x.am), best = null;
      alts.forEach(function (t) {
        var heard = FCore.tokens(t).map(canon);
        var marks = exp.map(function (w) { var cw = canon(w); return heard.some(function (h) { var L = Array.from(cw).length; var dd = lev(cw, h); return dd === 0 || (L >= 3 && dd <= 1) || (L >= 6 && dd <= 2); }); });
        var sc = marks.filter(Boolean).length;
        if (!best || sc > best.sc) best = { sc: sc, marks: marks, t: t };
      });
      var trT = FCore.tokens(x.tr.replace(/[׳']/g, '׳')).filter(function (w) { return /[א-ת]/.test(w); });
      var useTr = trT.length === exp.length;
      var words = exp.map(function (w, k) {
        var lbl = useTr ? esc(trT[k]) : '<span class="am">' + esc(w) + '</span>';
        return best.marks[k] ? '<span class="ok">' + lbl + '</span>' : '<span class="no" onclick="F.pa(\'' + esc(w) + '\',this)">' + lbl + ' 🔊</span>';
      }).join(' ');
      var all = best.sc === exp.length;
      if (all) { award('ear'); confetti(); ding(true); }
      document.getElementById('lsOut').innerHTML = '<div class="card"><div class="words tr s">' + words + '</div>' +
        say(all ? 'גוֹבֶּז! שמעתי את כל המילים.' : best.sc ? 'כמעט! לחצי על המילים בכתום כדי לשמוע אותן שוב, ונסי שוב.' : 'לא הצלחתי לשמוע הפעם. נסי לדבר קצת יותר לאט וקרוב למיקרופון.', all ? 'cheer' : 'listen') +
        '<p class="muted" style="font-size:.85rem">מה ששמעתי: <span class="am">' + esc(best.t) + '</span></p></div>';
    };
    r.onerror = function (e) {
      var m = e.error === 'not-allowed' ? 'צריך לאשר את המיקרופון בדפדפן.' : e.error === 'language-not-supported' ? 'בדפדפן הזה אין זיהוי לאמהרית. נסי בכרום.' : e.error === 'no-speech' ? 'לא שמעתי כלום. נסי שוב, קרוב יותר למיקרופון.' : 'משהו לא הסתדר. נסי שוב, או השתמשי ב"הקליטי והשווי".';
      var o = document.getElementById('lsOut'); if (o) o.innerHTML = say(m, 'think');
    };
    r.onend = function () { if (b) { b.classList.remove('rec'); b.textContent = '🎤 לנסות שוב'; } if (!got) { var o = document.getElementById('lsOut'); if (o && !o.innerHTML) o.innerHTML = say('לא שמעתי כלום. נסי שוב.', 'think'); } };
    try { r.start(); } catch (e) { toast('לא הצלחתי להפעיל את המיקרופון'); }
  };
};

/* ================= משחקים ================= */
var G = null;
var GAMES = [
  { id: 'memory', e: '🃏', n: 'זיכרון', d: 'קלפים הפוכים: תעתיק ותמונה. מוצאים זוגות. קלף מילה גם מושמע.', kind: 'w' },
  { id: 'snakes', e: '🎲', n: 'סולמות ונחשים עם ' , d: 'מטילים קובייה, עונים על שאלה, ומתחרים בפריאות. סולם מקפיץ קדימה.', kind: 'any' },
  { id: 'hear', e: '👂🏾', n: 'מה שמעת?', d: 'מושמעת מילה או משפט, ובוחרים את התמונה או התרגום הנכון מתוך 4.', kind: 'any' },
  { id: 'build', e: '🧱', n: 'בני את המשפט', d: 'מילים בתעתיק מעורבבות. לוחצים עליהן לפי הסדר, ושומעים את המשפט השלם.', kind: 'l' },
  { id: 'reply', e: '💬', n: 'מה עונים?', d: 'פריאות "משחקת" ילד או הורה ואומרת שורה מתוך שיחה. בוחרים את התגובה המתאימה.', kind: 'l' }
];
R.games = function () {
  setView(top('משחקים') + say('המטרה: להכניס את המילים לראש בכיף. לפני כל משחק בוחרים קטגוריה, שיעור או תחנה.', 'cheer') +
    '<div class="list">' + GAMES.map(function (g) { return '<button class="li" onclick="F.go(\'game/' + g.id + '\')"><span class="e">' + g.e + '</span><span class="t"><b>' + esc(g.n + (g.id === 'snakes' ? D.guide.name : '')) + '</b><span class="muted">' + esc(g.d.replace('פריאות', D.guide.name)) + '</span></span></button>'; }).join('') + '</div>');
};
function learnedPool(kind) {
  var keys = Object.keys(S.known).concat(Object.keys(S.seen), Object.keys(S.srs));
  var arr = uniqBy(keys.map(function (k) { return ITEM[k]; }).filter(Boolean), function (x) { return x.key; });
  if (kind === 'w') arr = arr.filter(function (x) { return x.kind === 'w'; });
  if (kind === 'l') arr = arr.filter(function (x) { return x.kind === 'l'; });
  return arr;
}
function poolFrom(src, kind) {
  var w = [], l = [];
  if (src === 'mine') { return learnedPool(kind); }
  if (src.indexOf('c:') === 0) w = catById(src.slice(2)).w;
  if (src.indexOf('lv:') === 0) { var n = +src.slice(3); CATS.filter(function (c) { return c.lv === n; }).forEach(function (c) { w = w.concat(c.w); }); LESSONS.filter(function (x) { return x.lv === n; }).forEach(function (x) { l = l.concat(x.lines); }); }
  if (src.indexOf('l:') === 0) { var ls = lessonById(src.slice(2)); l = ls.lines; (ls.words || []).forEach(function (h) { var x = findWord(h); if (x) w.push(x); }); }
  w = w.filter(function (x) { return !x.o.noaudio; }); l = l.filter(function (x) { return ITEM[x.key]; });
  return uniqBy(kind === 'w' ? w : kind === 'l' ? l : w.concat(l), function (x) { return x.key; });
}
R.game = function (id, src, lvl) {
  var g = GAMES.filter(function (x) { return x.id === id; })[0]; if (!g) return go('games');
  if (!src) {
    var mine = learnedPool(g.kind).length;
    var opts = [];
    if (mine >= 6) opts.push(['mine', '⭐ מכל מה שלמדתי', mine + ' פריטים']);
    LEVELS.forEach(function (lv) { opts.push(['lv:' + lv.lv, lv.ic + ' תחנה ' + lv.lv + ': ' + lv.short, '']); });
    if (g.kind !== 'l') CATS.forEach(function (c) { opts.push(['c:' + c.id, c.ic + ' ' + c.he, c.w.length + ' מילים']); });
    LESSONS.forEach(function (l) { opts.push(['l:' + l.id, '💬 שיעור ' + l.num + ': ' + l.t, '']); });
    setView(top(g.n + (id === 'snakes' ? D.guide.name : '')) + say(esc(g.d.replace('פריאות', D.guide.name)) + '<br><b>מאיפה המילים?</b>', 'happy') +
      (id === 'memory' ? '<div class="row" style="justify-content:center"><span>גודל:</span>' + [6, 10, 16].map(function (n) { return '<button class="chip ' + ((G_SIZE === n) ? 'on' : '') + '" onclick="F.msize(' + n + ')">' + n + ' קלפים</button>'; }).join('') + '</div>' : '') +
      '<div class="list">' + opts.map(function (o) { return '<button class="li" onclick="F.go(\'game/' + id + '/' + o[0] + '\')"><span class="t"><b>' + esc(o[1]) + '</b>' + (o[2] ? '<span class="muted">' + esc(o[2]) + '</span>' : '') + '</span></button>'; }).join('') + '</div>');
    return;
  }
  var pool = poolFrom(src, g.kind === 'any' ? 'any' : g.kind);
  if (id === 'memory') return gMemory(pool, src);
  if (id === 'snakes') return gSnakes(pool, src);
  if (id === 'hear') return gHear(pool, src);
  if (id === 'build') return gBuild(pool, src);
  if (id === 'reply') return gReply(src);
};
var G_SIZE = 10;
F.msize = function (n) { G_SIZE = n; render(); };
function tooSmall(back) { setView(top('משחק') + say('אין כאן מספיק מילים למשחק הזה. אפשר לבחור תחנה שלמה, או את "מכל מה שלמדתי".', 'think') + '<button class="btn big" onclick="F.go(\'' + back + '\')">לבחור מקור אחר</button>'); }

/* ---- זיכרון ---- */
function gMemory(pool, src) {
  var pairs = G_SIZE / 2;
  var wp = pool.filter(function (x) { return x.kind === 'w'; });
  if (wp.length < pairs) wp = wp.concat(pool.filter(function (x) { return x.kind === 'l'; }));
  wp = uniqBy(wp, function (x) { return x.he; });
  if (wp.length < pairs) return tooSmall('game/memory');
  var chosen = freshPick('mem:' + src, wp, pairs);
  var cards = shuffle([].concat.apply([], chosen.map(function (x) { return [{ x: x, s: 't' }, { x: x, s: 'p' }]; })));
  G = { cards: cards, open: [], match: {}, tries: 0, src: src };
  drawMem();
}
function drawMem() {
  var cols = G.cards.length <= 6 ? 3 : 4;
  setView(top('זיכרון') + '<p class="center muted">נסיונות: ' + G.tries + ' · זוגות: ' + Object.keys(G.match).length + '/' + G.cards.length / 2 + '</p>' +
    '<div class="mem" style="grid-template-columns:repeat(' + cols + ',1fr)">' + G.cards.map(function (c, i) {
      var open = G.open.indexOf(i) >= 0, m = G.match[c.x.key];
      var face = c.s === 't' ? '<span class="w" style="font-size:' + (c.x.tr.length > 14 ? '.9rem' : '1.15rem') + '">' + esc(c.x.tr) + '</span>' : (c.x.kind === 'w' && c.x.pic ? picHTML(c.x.pic) : '<span class="w">' + esc(c.x.he) + '</span>');
      return '<button class="mcard ' + (m ? 'match' : open ? 'open' : '') + '" onclick="F.flip(' + i + ')">' + (m || open ? face : '?') + '</button>';
    }).join('') + '</div>');
}
F.flip = function (i) {
  if (!G || G.open.length >= 2 || G.open.indexOf(i) >= 0 || G.match[G.cards[i].x.key]) return;
  G.open.push(i);
  var c = G.cards[i]; if (c.s === 't') play(c.x.am);
  if (G.open.length === 2) {
    G.tries++;
    var a = G.cards[G.open[0]], b = G.cards[G.open[1]];
    if (a.x.key === b.x.key) { G.match[a.x.key] = 1; G.open = []; ding(true); drawMem(); if (c.s !== 't') play(c.x.am);
      if (Object.keys(G.match).length === G.cards.length / 2) { markDay(); if (G.cards.length >= 16) award('mem'); confetti();
        var src = G.src, g0 = G; setTimeout(function () { if (G !== g0) return; endScreen({ title: 'זיכרון', score: G.cards.length / 2, total: G.cards.length / 2, msg: 'מצאת את כל הזוגות ב־' + G.tries + ' נסיונות.', again: function () { render(); }, back: 'games' }); }, 1200); }
    } else { drawMem(); var g1 = G; setTimeout(function () { if (G === g1) { G.open = []; drawMem(); } }, 1300); }
  } else drawMem();
};

/* ---- מה שמעת ---- */
function gHear(pool, src) {
  pool = uniqBy(pool, function (x) { return x.he; });
  if (pool.length < 4) return tooSmall('game/hear');
  var items = freshPick('hear:' + src, pool, Math.min(8, pool.length));
  runQuiz({ title: 'מה שמעת?', qs: items.map(function (x) { return makeQ(x, pool, 'listen', 4); }), back: 'games', again: function () { gHear(pool, src); } });
}

/* ---- סולמות ונחשים ---- */
var LADDERS = { 3: 12, 7: 15, 13: 21, 18: 26 }, SNAKES = { 16: 6, 24: 14, 28: 19 };
function gSnakes(pool, src) {
  pool = uniqBy(pool, function (x) { return x.he; });
  if (pool.length < 4) return tooSmall('game/snakes');
  G = { me: 0, fr: 0, pool: pool, src: src, turn: 'me', msg: 'התור שלך! הטילי קובייה.', busy: false, right: 0, total: 0, wrong: [] };
  drawSnakes();
}
function boardHTML() {
  var cells = [];
  for (var r = 4; r >= 0; r--) for (var c = 0; c < 6; c++) { var n = r * 6 + (r % 2 ? 6 - c : c + 1); cells.push(n); }
  return '<div class="board">' + cells.map(function (n) {
    var cls = LADDERS[n] ? 'l' : SNAKES[n] ? 's' : '';
    return '<div class="cell ' + cls + '">' + (n === 30 ? '🏁' : n) + (LADDERS[n] ? '<span class="ic">⬆️' + LADDERS[n] + '</span>' : SNAKES[n] ? '<span class="ic">🐍' + SNAKES[n] + '</span>' : '') +
      (G.me === n ? '<span class="tok me">את</span>' : '') + (G.fr === n ? '<span class="tok fr">פ</span>' : '') + '</div>';
  }).join('') + '</div>';
}
function drawSnakes(qhtml) {
  setView(top('סולמות ונחשים') +
    '<div class="row" style="justify-content:space-between"><span><span class="tok me" style="position:static;display:inline-flex">את</span> משבצת ' + G.me + '</span><span><span class="tok fr" style="position:static;display:inline-flex">פ</span> ' + esc(D.guide.name) + ': ' + G.fr + '</span></div>' +
    boardHTML() + '<div class="card" id="snq">' + (qhtml || (say(G.msg, G.turn === 'me' ? 'happy' : 'think') + (G.turn === 'me' && !G.busy ? '<button class="btn big" onclick="F.roll()">🎲 הטילי קובייה</button>' : ''))) + '</div>');
}
var DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
F.roll = function () {
  if (G.busy) return; G.busy = true;
  var v = 1 + Math.floor(Math.random() * 6); G.die = v;
  var x = pick(G.pool), q = makeQ(x, G.pool, Math.random() < 0.5 ? 'listen' : 'how', 3); G.q = q;
  var ri = reg(x);
  var qh = '<div class="center"><span class="die">' + DIE[v - 1] + '</span> יצא ' + v + '! ענִי נכון ותתקדמי.</div>' +
    (q.type === 'listen' ? '<div class="qprompt">🔊 מה שמעת?</div><div class="acts"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button></div>' : '<div class="qprompt">איך אומרים: "' + esc(x.he) + '"?</div>') +
    '<div class="opts">' + q.opts.map(function (o, k) { return '<button class="opt" id="o' + k + '" onclick="F.snAns(' + k + ')">' + (q.field === 'he' ? esc(o.he) : '<span style="font-size:1.3rem">' + esc(o.tr) + '</span>') + '</button>'; }).join('') + '</div>';
  drawSnakes(qh);
  if (q.type === 'listen') setTimeout(function () { play(x.am); }, 250);
};
F.snAns = function (k) {
  var q = G.q; if (!q || q.done) return; q.done = true;
  var ok = k === q.ans; G.total++;
  document.getElementById('o' + q.ans).classList.add('ok'); if (!ok) document.getElementById('o' + k).classList.add('no');
  ding(ok);
  if (ok) {
    G.right++;
    var to = Math.min(30, G.me + G.die), note = '';
    if (LADDERS[to]) { note = ' סולם! קפצת ל־' + LADDERS[to] + ' 🎉'; to = LADDERS[to]; }
    else if (SNAKES[to]) { note = ' אוי, נחש! אבל ' + esc(D.guide.name) + ' מוותרת לך הפעם, כי ענית נכון 😊'; }
    G.me = to;
    G.msg = 'נכון! ' + esc(pick(D.cheers)[0]) + note;
    play(q.item.am);
  } else {
    G.wrong.push(q.item);
    G.msg = 'כמעט! התשובה: ' + esc(q.item.tr) + ' – ' + esc(q.item.he) + '. נשארים במקום, ושומעים שוב.';
    play(q.item.am);
  }
  var g0 = G;
  setTimeout(function () {
    if (G !== g0) return;
    if (G.me >= 30) return snEnd(true);
    G.turn = 'fr'; G.busy = true; drawSnakes();
    setTimeout(function () { if (G === g0) frTurn(); }, 1600);
  }, 1500);
};
function frTurn() {
  var v = 1 + Math.floor(Math.random() * 6);
  var ok = Math.random() < 0.72, to = G.fr, note;
  if (ok) {
    to = Math.min(30, G.fr + v); note = esc(D.guide.name) + ' הטילה ' + DIE[v - 1] + ' וענתה נכון.';
    if (LADDERS[to]) { note += ' עלתה בסולם!'; to = LADDERS[to]; } else if (SNAKES[to]) { note += ' נחש! ירדה ל־' + SNAKES[to] + '.'; to = SNAKES[to]; }
  } else note = esc(D.guide.name) + ' הטילה ' + DIE[v - 1] + ' אבל התבלבלה, ונשארה במקום.';
  G.fr = to;
  if (G.fr >= 30) { G.msg = note; drawSnakes(); var g0 = G; return setTimeout(function () { if (G === g0) snEnd(false); }, 1400); }
  G.turn = 'me'; G.busy = false; G.msg = note + ' התור שלך!'; drawSnakes();
}
function snEnd(won) {
  markDay(); if (won) { award('snake'); confetti(); }
  var src = G.src;
  endScreen({ title: 'סולמות ונחשים', score: G.right, total: G.total, wrong: G.wrong, msg: won ? '<br><b>ניצחת את ' + esc(D.guide.name) + '!</b>' : '<br>' + esc(D.guide.name) + ' הגיעה ראשונה הפעם. רוצה סיבוב נקמה?', again: function () { render(); }, back: 'games' });
}

/* ---- בני את המשפט ---- */
function gBuild(pool, src) {
  var lines = uniqBy(pool.filter(function (x) { var n = FCore.tokens(x.tr).length; return x.kind === 'l' && n >= 3 && n <= 8; }), function (x) { return x.tr; });
  if (lines.length < 2) return tooSmall('game/build');
  var items = freshPick('build:' + src, lines, Math.min(6, lines.length));
  G = { items: items, i: 0, placed: [], right: 0, wrong: [], src: src };
  buildRound();
}
function buildRound() {
  var x = G.items[G.i];
  var toks = FCore.tokens(x.tr), amT = FCore.tokens(x.am);
  G.toks = toks; G.amT = toks.length === amT.length ? amT : null;
  G.order = shuffle(toks.map(function (t, i) { return i; }));
  if (G.order.every(function (v, i) { return v === i; }) && toks.length > 1) G.order.reverse();
  G.placed = []; G.tries = 0;
  drawBuild();
  play(x.am);
}
function drawBuild(fb) {
  var x = G.items[G.i], ri = reg(x);
  setView(top('בני את המשפט') + '<div class="card"><div class="qhead"><span>בני את המשפט</span><span>' + (G.i + 1) + ' / ' + G.items.length + '</span></div>' +
    '<div class="qprompt">' + esc(x.he) + '</div><div class="acts"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><button class="play small sec" onclick="F.ps(' + ri + ',this)">🐢</button></div>' +
    '<div class="slots">' + G.placed.map(function (ti, k) { return '<button class="wchip" onclick="F.unplace(' + k + ')">' + esc(G.toks[ti]) + '</button>'; }).join('') + (G.placed.length ? '' : '<span class="muted">לחצי על המילים לפי הסדר</span>') + '</div><p></p>' +
    '<div class="row" style="justify-content:center">' + G.order.map(function (ti) { return G.placed.indexOf(ti) >= 0 ? '' : '<button class="wchip" onclick="F.place(' + ti + ')">' + esc(G.toks[ti]) + '</button>'; }).join('') + '</div>' +
    '<div id="fb">' + (fb || '') + '</div>' +
    (G.placed.length === G.toks.length && !fb ? '<button class="btn big" onclick="F.checkBuild()">בדיקה</button>' : '') + '</div>');
}
F.place = function (ti) { G.placed.push(ti); if (G.amT) play(G.amT[ti]); drawBuild(); };
F.unplace = function (k) { G.placed.splice(k, 1); drawBuild(); };
F.checkBuild = function () {
  var x = G.items[G.i];
  var ok = G.placed.map(function (ti) { return G.toks[ti]; }).join(' ') === G.toks.join(' ');
  G.tries++;
  ding(ok);
  if (ok) {
    if (G.tries === 1) G.right++;
    play(x.am);
    drawBuild('<div class="feedback ok">' + esc(pick(D.cheers)[0]) + ' המשפט השלם:</div>' + trBox(x, 's center') + '<button class="btn big" onclick="F.nextBuild()">' + (G.i + 1 < G.items.length ? 'הבא ←' : 'לסיכום') + '</button>');
  } else {
    if (G.tries === 1) G.wrong.push(x);
    drawBuild('<div class="feedback no">כמעט! הסדר עוד לא מדויק. שמעי שוב ונסי.</div><div class="row" style="justify-content:center"><button class="btn sec" onclick="F.resetBuild()">לנסות שוב</button><button class="btn sec" onclick="F.showBuild()">הראי לי</button></div>');
    play(x.am, true);
  }
};
F.resetBuild = function () { G.placed = []; drawBuild(); };
F.showBuild = function () { G.placed = G.toks.map(function (t, i) { return i; }); var x = G.items[G.i]; play(x.am); drawBuild('<div class="feedback ok">כך זה נשמע:</div><button class="btn big" onclick="F.nextBuild()">הבא ←</button>'); };
F.nextBuild = function () { G.i++; if (G.i < G.items.length) buildRound(); else { markDay(); var src = G.src; if (G.right >= G.items.length * 0.6) confetti(); endScreen({ title: 'בני את המשפט', score: G.right, total: G.items.length, wrong: G.wrong, again: function () { render(); }, back: 'games' }); } };

/* ---- מה עונים ---- */
function gReply(src) {
  var lessons = src === 'mine' ? LESSONS.filter(function (l) { return S.lessons[l.id]; }) : src.indexOf('lv:') === 0 ? LESSONS.filter(function (l) { return l.lv === +src.slice(3); }) : src.indexOf('l:') === 0 ? [lessonById(src.slice(2))] : LESSONS;
  if (!lessons.length) lessons = LESSONS.filter(function (l) { return l.lv === 1; });
  var pairs = [];
  lessons.forEach(function (l) {
    for (var j = 0; j + 1 < l.lines.length; j++) {
      var a = l.lines[j], b = l.lines[j + 1];
      if (ITEM[a.key] && ITEM[b.key] && a.spk !== b.spk) pairs.push({ key: a.key + '>' + b.key, a: a, b: b, l: l });
    }
  });
  if (pairs.length < 2) return tooSmall('game/reply');
  var allB = uniqBy(pairs.map(function (p) { return p.b; }), function (x) { return x.he; });
  var items = freshPick('reply:' + src, pairs, Math.min(6, pairs.length));
  G = { items: items, i: 0, right: 0, wrong: [], src: src, allB: allB.concat(LINES.slice(0, 60)) };
  replyRound();
}
function replyRound() {
  var p = G.items[G.i], ra = reg(p.a);
  var others = uniqBy(shuffle(G.allB.filter(function (x) { return x.he !== p.b.he && x.key !== p.b.key; })), function (x) { return x.he; }).slice(0, 2);
  G.opts = shuffle(others.concat([p.b])); G.ans = G.opts.indexOf(p.b); G.done = false;
  var who = p.a.spk === 'a' ? 'אשת הצוות' : p.a.spk;
  setView(top('מה עונים?') + '<div class="card"><div class="qhead"><span>שיעור ' + p.l.num + '</span><span>' + (G.i + 1) + ' / ' + G.items.length + '</span></div>' +
    say('אני ' + esc(who) + ', ואני אומרת:<br>' + trBox(p.a, 's') + '<span class="muted">' + esc(p.a.he) + '</span>', 'listen', ' <button class="play small" onclick="F.p(' + ra + ',this)">🔊</button>') +
    '<div class="qprompt">מה עונים? 🗣️ אפשר להגיד קודם בקול</div><div class="opts">' + G.opts.map(function (o, k) { return '<button class="opt" id="o' + k + '" onclick="F.repAns(' + k + ')"><span style="font-size:1.25rem">' + esc(o.tr) + '</span><br><small class="muted">' + esc(o.he) + '</small></button>'; }).join('') + '</div><div id="fb"></div></div>');
  setTimeout(function () { play(p.a.am); }, 300);
}
F.repAns = function (k) {
  if (G.done) return; G.done = true;
  var p = G.items[G.i], ok = k === G.ans;
  document.getElementById('o' + G.ans).classList.add('ok'); if (!ok) document.getElementById('o' + k).classList.add('no');
  ding(ok); if (ok) G.right++; else G.wrong.push(p.b);
  play(p.b.am);
  document.getElementById('fb').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '">' + (ok ? esc(pick(D.cheers)[0]) + ' זו התשובה מהשיחה.' : 'כמעט! בשיחה עונים: ' + esc(p.b.tr)) + '</div><button class="btn big" onclick="F.nextRep()">' + (G.i + 1 < G.items.length ? 'הבאה ←' : 'לסיכום') + '</button>';
};
F.nextRep = function () { G.i++; if (G.i < G.items.length) replyRound(); else { markDay(); var src = G.src; endScreen({ title: 'מה עונים?', score: G.right, total: G.items.length, wrong: G.wrong, again: function () { render(); }, back: 'games' }); } };

/* ================= איך קוראים ================= */
R.read = function () {
  var gt = D.genderTable;
  setView(top('איך קוראים') +
    say('המטרה היא שפה מדוברת שמבינים אותה, לא הגייה מושלמת. ההשמעה היא תמיד המקור הנכון, והתעתיק עוזר לזכור. הנה החוקים, כל אחד עם דוגמה.', 'happy') +
    D.rules.map(function (r, i) {
      return '<div class="card"><h3>' + (i + 1) + '. ' + esc(r.t) + '</h3><p>' + esc(r.d) + '</p>' + r.ex.map(function (e) {
        var ri = reg({ tr: e[0], am: e[1], he: e[2] });
        return '<div class="phrase"><span class="grow">' + trBox({ tr: e[0], am: e[1] }, 's') + '<span class="muted">' + esc(e[2]) + '</span></span><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><button class="play small sec" onclick="F.ps(' + ri + ',this)">🐢</button><button class="play small sec" onclick="F.rec(' + ri + ')">🎙️</button></div>';
      }).join('') + '</div>';
    }).join('') +
    '<h2>שורת עזר באותיות לטיניות</h2><div class="card"><p>במילים שבהן העברית לא מספיקה, מופיעה מתחת לתעתיק שורה קטנה באותיות לטיניות:</p><table class="gt">' + D.latinHelp.map(function (r) { return '<tr><td class="lat">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div>' +
    '<h2>זכר, נקבה ולשון כבוד</h2><div class="card"><p>' + esc(gt.intro) + '</p><table class="gt"><tr><th>פונים אל</th><th>סיומת</th><th>"מה שלומך?"</th></tr>' + gt.rows.map(function (r) { var ri = reg({ tr: r[2], am: r[3] }); return '<tr><td>' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td><td><b>' + esc(r[2]) + '</b> <button class="ibtn" style="height:38px;min-width:38px" onclick="F.p(' + ri + ',this)">🔊</button></td></tr>'; }).join('') + '</table><p>' + esc(gt.after) + '</p></div>' +
    '<button class="btn big" onclick="F.go(\'cat/build/0\')">🧱 למילות הבניין</button><p></p><button class="btn big sec" onclick="F.go(\'cat/first/0\')">🌱 להתחיל במילים הראשונות</button>');
};

/* ================= טיפים ================= */
R.tips = function () {
  var all = D.tips.slice();
  LESSONS.forEach(function (l) { if (l.tip) all.push({ T: l.tipT || 'מקצועי', t: 'שיעור ' + l.num + ': ' + l.t, d: l.tip, L: l.id }); });
  var groups = [['תרבותי', '🌍 טיפים תרבותיים'], ['מקצועי', '🧑🏾‍🏫 טיפים מקצועיים'], ['לימוד', '📚 איך לומדים הכי טוב']];
  setView(top('טיפים מ' + D.guide.name) + say('כל הטיפים מהשיעורים במקום אחד. לחיצה על "לשיעור" תיקח אותך לשיחה שבה הטיפ מופיע.', 'happy') +
    groups.map(function (g) {
      return '<h2>' + g[1] + '</h2>' + all.filter(function (t) { return t.T === g[0]; }).map(function (t) {
        var l = t.L && lessonById(t.L);
        return '<div class="box tip"><h3>' + esc(t.t) + '</h3><p>' + esc(t.d) + '</p>' + (l ? '<button class="chip" onclick="F.go(\'lesson/' + l.id + '\')">לשיעור ' + l.num + ' ←</button>' : '') + '</div>';
      }).join('');
    }).join('') + '<p></p><button class="btn big sec" onclick="F.go(\'steps\')">🧭 לשיחה טיפולית צעד אחר צעד</button>');
};

/* ================= שיחה צעד אחר צעד ================= */
R.steps = function () {
  setView(top('שיחה טיפולית צעד אחר צעד') + say('כאן אין מילים חדשות, אלא דרך: איך בונים שיחה עם הורה, איך מתווכים לילד רגע גדול, ואיך עובדים עם מתורגמן. ליד כל שלב יש משפט אמהרי שמתאים לו.', 'think') +
    D.steps.map(function (sec, si) {
      return '<details ' + (si === 0 ? 'open' : '') + '><summary>' + sec.ic + ' ' + esc(sec.t) + '</summary><p class="muted">' + esc(sec.intro) + '</p>' + sec.s.map(function (s, k) {
        var ph = '';
        if (s[2]) { var ri = reg({ tr: s[2][0], am: s[2][1], he: s[2][2] }); ph = '<div class="phrase"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><span class="grow">' + trBox({ tr: s[2][0], am: s[2][1] }, 's') + '<span class="muted">' + esc(s[2][2]) + '</span></span></div>'; }
        return '<div class="step"><b>' + (k + 1) + '. ' + esc(s[0]) + '</b><p>' + esc(s[1]) + '</p>' + ph + '</div>';
      }).join('') + '</details>';
    }).join('') +
    '<p class="muted">המבנים כאן מבוססים על הנחיות של משרד החינוך לשיחות עם הורים ולתוכניות התערבות בגן, ועל המלצות של אנשי מקצוע לתיווך לילדים במצבי משבר. הם לא מחליפים את הנוהל, את הצוות או את ההדרכה שלך.</p>');
};

/* ================= בנק המילים ================= */
var bankF = 'all', bankQ = '';
R.bank = function () {
  setView(top('בנק המילים') + say('כל המילים והמשפטים באתר. אפשר לחפש בעברית או בתעתיק, ולשמור ⭐ את מה שחשוב לך.', 'happy') +
    '<input class="search" id="bq" placeholder="חיפוש: למשל אמא, כואב, תודה..." value="' + esc(bankQ) + '" oninput="F.bankQ(this.value)">' +
    '<div class="row" style="margin:8px 0">' + [['all', 'הכול'], ['star', '⭐ המילים שלי'], ['w', 'מילים'], ['l', 'משפטים מהשיחות'], ['known', '✅ אני יודעת']].map(function (f) { return '<button class="chip ' + (bankF === f[0] ? 'on' : '') + '" onclick="F.bankF(\'' + f[0] + '\')">' + f[1] + '</button>'; }).join('') + '</div>' +
    '<div id="bres"></div>' +
    (Object.keys(S.star).length >= 4 ? '<button class="btn big" onclick="F.starQuiz()">🔁 תרגלי את המילים שלי</button>' : ''));
  bankDraw();
};
function bankDraw() {
  var q = bankQ.trim(), qn = q.replace(/[֑-ׇ]/g, '');
  var arr = WORDS.concat(LINES).filter(function (x) {
    if (bankF === 'star' && !S.star[x.key]) return false;
    if (bankF === 'known' && !S.known[x.key]) return false;
    if ((bankF === 'w' || bankF === 'l') && x.kind !== bankF) return false;
    if (!qn) return true;
    return x.he.indexOf(qn) >= 0 || x.tr.replace(/[֑-ׇ]/g, '').indexOf(qn) >= 0 || x.am.indexOf(q) >= 0;
  });
  var shown = arr.slice(0, 80);
  document.getElementById('bres').innerHTML = '<p class="muted">' + arr.length + ' תוצאות' + (arr.length > 80 ? ' (מוצגות 80 הראשונות)' : '') + '</p><div class="list">' + shown.map(function (x) {
    var ri = reg(x), link;
    if (x.kind === 'w') { var c = catById(x.cat); link = 'cat/' + c.id + '/' + c.w.indexOf(x); } else link = 'lesson/' + x.lesson;
    return '<div class="li"><button class="play small" onclick="F.p(' + ri + ',this)">🔊</button><span class="t" onclick="F.go(\'' + link + '\')" style="cursor:pointer">' + trBox(x, 's') + '<span>' + esc(x.he) + '</span></span><button class="star" onclick="F.star(\'' + esc(x.key) + '\',this)">' + (S.star[x.key] ? '⭐' : '☆') + '</button></div>';
  }).join('') + '</div>';
}
F.bankQ = function (v) { bankQ = v; bankDraw(); };
F.bankF = function (f) { bankF = f; render(); };
F.starQuiz = function () {
  var items = Object.keys(S.star).map(function (k) { return ITEM[k]; }).filter(Boolean);
  var pk = freshPick('star', items, Math.min(10, items.length));
  runQuiz({ title: 'המילים שלי', qs: pk.map(function (x, i) { return makeQ(x, items.concat(WORDS), ['listen', 'how', 'say', 'meaning'][i % 4]); }), srs: true, back: 'bank', again: function () { F.starQuiz(); } });
};

/* ================= אלבום ================= */
R.album = function () {
  var defs = stickerDefs(), n = defs.filter(function (d) { return S.stickers[d.id]; }).length;
  var sec = function (t, f) { var a = defs.filter(f); return '<h2>' + t + '</h2><div class="album">' + a.map(function (d) { var on = S.stickers[d.id]; return '<div class="stk ' + (on ? '' : 'off') + '"><span class="e">' + d.e + '</span><b>' + esc(d.n) + '</b><br>' + (on ? '<span class="muted">' + esc(S.stickers[d.id]) + '</span>' : esc(d.h)) + '</div>'; }).join('') + '</div>'; };
  setView(top('אלבום המדבקות') + say('אספת <b>' + n + '</b> מדבקות מתוך ' + defs.length + '. מדבקה שעוד לא הושגה מופיעה כצללית, עם רמז איך משיגים אותה.', 'cheer') +
    sec('🏆 תחנות ורצפים', function (d) { return /^(st|s\d|snake|mem|rev|rec|ear)/.test(d.id); }) +
    sec('🗂️ קטגוריות מילים', function (d) { return d.id.indexOf('c:') === 0; }) +
    sec('💬 שיעורים', function (d) { return d.id.indexOf('l:') === 0; }));
};

/* ================= הדפסה ================= */
R.print = function () {
  setView(top('כרטיסיות להדפסה') + say('בחרי קטגוריה וגודל. ילדים מבתים דוברי אמהרית יראו את השפה שלהם בגן, וגם הצוות ייחשף למילים כל יום.', 'happy') +
    '<div class="list">' + CATS.map(function (c) { return '<div class="li"><span class="e">' + c.ic + '</span><span class="t"><b>' + esc(c.he) + '</b><span class="muted">' + c.w.length + ' מילים</span></span><button class="chip" onclick="F.go(\'printv/' + c.id + '/8\')">8 בדף</button><button class="chip" onclick="F.go(\'printv/' + c.id + '/1\')">כרזה</button></div>'; }).join('') + '</div>');
};
R.printv = function (id, n) {
  var c = catById(id); if (!c) return go('print');
  var big = n === '1';
  setView(top('הדפסה · ' + c.he) + '<div class="noprint">' + say(big ? 'כרזה גדולה: מילה אחת בכל דף, לתלייה בגן.' : 'כרטיסיות קטנות: 8 בכל דף. אחרי ההדפסה גוזרים לפי הקו המקווקו.', 'happy') + '<button class="btn big" onclick="window.print()">🖨️ להדפסה</button><p></p></div>' +
    '<div class="pgrid ' + (big ? '' : 'eight') + '" style="' + (big ? 'grid-template-columns:1fr' : '') + '">' + c.w.filter(function (w) { return !w.o.noaudio; }).map(function (w) {
      return '<div class="pcard ' + (big ? 'big' : '') + '"><div class="pic">' + picHTML(w.pic, w.he) + '</div><div class="he" style="font-weight:800">' + esc(w.he) + '</div><div class="tr">' + esc(w.tr) + '</div>' + (w.f ? '<div class="muted">לבת: ' + esc(w.f.tr) + '</div>' : '') + '<div class="amx am" style="color:#333">' + esc(w.am) + '</div></div>';
    }).join('') + '</div>');
};

/* ================= אודות ================= */
R.about = function () {
  setView(top('על האתר') + say('אני ' + esc(D.guide.name) + '. האתר נבנה בשביל גננות, יועצות, קלינאיות ואנשי טיפול שעובדים עם ילדים בני 3–5 ועם ההורים שלהם, ורוצים להגיד כמה משפטים חמים ושימושיים בשפה של הבית.', 'happy') +
    '<div class="card"><h3>מה יש כאן</h3><p>' + WORDS.length + ' מילים ב־' + CATS.length + ' קטגוריות, ' + LESSONS.length + ' שיחות בחמש רמות, מבחן קטן בסוף כל תחנה, חזרה יומית, 5 משחקים, תרגול הגייה וכרטיסיות להדפסה.</p>' +
    '<h3>ההשמעה</h3><p>כל מילה וכל משפט מושמעים מקובץ שמע שהוכן מראש בקול אמהרי ממוחשב (Microsoft, "מקדס"). לכן ההשמעה זהה בכל מחשב ובכל טלפון. אם יוקלטו בעתיד קבצים של דוברת אמיתית, הם יחליפו את הקול הממוחשב.</p>' +
    '<h3>לפני שימוש בשיחות רגישות</h3><p>חלק מהתוכן נבנה בעזרת בינה מלאכותית. לפני שמשתמשים בשיחות עם הורים ובשיחות האבחוניות, כדאי שדוברת אמהרית (רצוי מהתחום הטיפולי) תעבור עליהן. בשיחה רגישה עובדים תמיד עם מתורגמן מקצועי.</p>' +
    '<h3>פרטיות</h3><p>אין הרשמה. ההתקדמות וההקלטות נשמרות רק בדפדפן שבמכשיר הזה. ניקוי היסטוריית הדפדפן ימחק אותן.</p></div>' +
    '<div class="card"><h3>להתחיל מחדש</h3><p class="muted">מוחק את כל ההתקדמות במכשיר הזה.</p><button class="btn sec" onclick="F.reset()">איפוס ההתקדמות</button></div>');
};
F.reset = function () { if (confirm('למחוק את כל ההתקדמות במכשיר הזה?')) { S = blank(); save(); go('home'); } };

/* ================= הפעלה ================= */
function start() {
  LANGINFO = window.LANG_LIST.filter(function (l) { return l.id === LANG && l.ready; })[0] || window.LANG_LIST[0];
  LANG = LANGINFO.id;
  var files = LANGINFO.files.map(function (f) { return 'content/' + LANG + '/' + f; }).concat(['audio/' + LANG + '/map.js']);
  files.reduce(function (p, f) { return p.then(function () { return loadScript(f).catch(function () {}); }); }, Promise.resolve()).then(function () {
    load(); buildModel(); render();
  }).catch(function (e) { APP.innerHTML = '<div class="loading">משהו לא נטען. נסי לרענן את הדף.</div>'; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
}
start();
})();
