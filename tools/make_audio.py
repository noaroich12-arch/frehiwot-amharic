# מייצר קובץ שמע לכל טקסט אמהרי באתר (קול Microsoft Mekdes), ושומר מפה audio/<lang>/map.js
# שימוש: python tools/make_audio.py am
# אם יש הקלטה אמיתית של דוברת: שמים אותה בתיקייה audio/<lang>/real/ בשם הטקסט באמהרית (למשל ሰላም.mp3),
# והיא תחליף את הקול הממוחשב.
import asyncio, hashlib, json, os, subprocess, sys
import edge_tts

LANG = sys.argv[1] if len(sys.argv) > 1 else 'am'
VOICE = {'am': 'am-ET-MekdesNeural', 'ru': 'ru-RU-SvetlanaNeural'}[LANG]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', LANG)
REAL = os.path.join(OUT, 'real')
os.makedirs(OUT, exist_ok=True)

items = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'collect.js'), LANG]).decode('utf-8'))
mp = {}
todo = []
for key, text in items:
    real = os.path.join(REAL, key + '.mp3')
    if os.path.exists(real):
        mp[key] = 'real/' + key + '.mp3'
        continue
    name = hashlib.md5(key.encode('utf-8')).hexdigest()[:12] + '.mp3'
    mp[key] = name
    if not os.path.exists(os.path.join(OUT, name)) or os.path.getsize(os.path.join(OUT, name)) < 500:
        todo.append((text, name))

print(len(items), 'texts,', len(todo), 'to generate')
sem = asyncio.Semaphore(6)
fails = []

async def one(text, name):
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate='-8%').save(os.path.join(OUT, name))
                return
            except Exception as e:
                await asyncio.sleep(1.5 * (attempt + 1))
        fails.append(text)

async def main():
    await asyncio.gather(*[one(t, n) for t, n in todo])

asyncio.run(main())
for t in fails:
    for k, v in list(mp.items()):
        pass
with open(os.path.join(OUT, 'map.js'), 'w', encoding='utf-8') as f:
    f.write('window.AUDIO_MAP = window.AUDIO_MAP || {};\nwindow.AUDIO_MAP[' + json.dumps(LANG) + '] = ' + json.dumps(mp, ensure_ascii=False) + ';\n')
print('done. failed:', len(fails))
for t in fails[:20]:
    print('  FAIL', t)
