/* פונקציות משותפות לאתר ולסקריפט שמייצר את קובצי השמע */
(function (root) {
  var PUNCT_END = /[?!.።፧፨,]+$/;

  /* "אִנְדֵּת נֶה / נֶשׁ?" -> ["אִנְדֵּת נֶה?", "אִנְדֵּת נֶשׁ?"]
     הלוכסן מפריד בין מילה אחת (לבן) למילה אחת (לבת). כל השאר משותף. */
  function splitGender(s) {
    if (!s || s.indexOf(' / ') < 0) return null;
    var i = s.indexOf(' / ');
    var L = s.slice(0, i).trim().split(/\s+/);
    var R = s.slice(i + 3).trim().split(/\s+/);
    var head = L.slice(0, -1);
    var lastL = L[L.length - 1];
    var mWords, fWords;
    if (R.length === 1) {
      var p = (R[0].match(PUNCT_END) || [''])[0];
      mWords = head.concat([lastL.replace(PUNCT_END, '') + p]);
      fWords = head.concat(R);
    } else {
      mWords = head.concat([lastL], R.slice(1));
      fWords = head.concat(R);
    }
    return [mWords.join(' '), fWords.join(' ')];
  }

  function hasEthiopic(s) { return /[ሀ-᎟ⶀ-⷟]/.test(s || ''); }

  /* מפתח אחיד לקובץ שמע: בלי פיסוק ובלי רווחים כפולים */
  function normKey(s) {
    return String(s || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[«»"“”'‘’()\[\]:;,.!?፡-፨\-–—…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) { return normKey(s).split(' ').filter(Boolean); }

  root.FCore = { splitGender: splitGender, hasEthiopic: hasEthiopic, normKey: normKey, tokens: tokens };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FCore;
})(typeof window !== 'undefined' ? window : globalThis);
