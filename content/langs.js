/* רשימת השפות באתר.
   כדי להוסיף שפה (למשל רוסית): יוצרים תיקייה content/ru עם אותם קבצים
   (words.js, lessons.js, extra.js), מוסיפים קובצי שמע ל-audio/ru, ומשנים כאן ready ל-true. */
window.LANG_LIST = [
  { id: 'am', name: 'אמהרית', native: 'አማርኛ', guide: 'פריאות', ready: true, files: ['words.js', 'lessons.js', 'extra.js'], speech: 'am-ET' },
  { id: 'ru', name: 'רוסית', native: 'Русский', guide: '', ready: false, files: ['words.js', 'lessons.js', 'extra.js'], speech: 'ru-RU' }
];
