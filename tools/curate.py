# input: /tmp/voices.json = JSON voice list (edge-tts list_voices()); output: /tmp/curated.json -> copy to tools/curated.json, then regenerate js/voices.js
import json, collections
V = json.load(open('/tmp/voices.json'))
ids = {v['id'] for v in V}
PICK = {
 'en': ['en-US-AvaMultilingualNeural','en-US-AndrewMultilingualNeural','en-US-EmmaMultilingualNeural','en-US-BrianMultilingualNeural','en-GB-SoniaNeural'],
 'ru': ['ru-RU-SvetlanaNeural','ru-RU-DmitryNeural'],
 'de': ['de-DE-TanjaNeural','de-DE-ChristophNeural','de-AT-IngridNeural'],
 'fr': ['fr-FR-VivienneMultilingualNeural','fr-FR-RemyMultilingualNeural','fr-FR-DeniseNeural'],
 'es': ['es-ES-XimenaNeural','es-ES-AlvaroNeural','es-MX-DaliaNeural'],
 'it': ['it-IT-IsabellaNeural','it-IT-GiuseppeMultilingualNeural','it-IT-ElsaNeural'],
 'pt': ['pt-BR-ThalitaMultilingualNeural','pt-BR-AntonioNeural','pt-PT-RaquelNeural'],
 'zh': ['zh-CN-XiaoxiaoNeural','zh-CN-YunxiNeural','zh-TW-HsiaoChenNeural'],
 'ja': ['ja-JP-NanamiNeural','ja-JP-KeitaNeural'],
 'ko': ['ko-KR-SunHiNeural','ko-KR-HyunsuMultilingualNeural','ko-KR-InJoonNeural'],
 'ar': ['ar-SA-ZariyahNeural','ar-SA-HamedNeural','ar-EG-SalmaNeural'],
 'nl': ['nl-NL-FennaNeural','nl-NL-MaartenNeural','nl-NL-ColetteNeural'],
 'sw': ['sw-KE-ZuriNeural','sw-KE-RafikiNeural'],
 'ta': ['ta-IN-PallaviNeural','ta-IN-ValluvarNeural'],
 'ur': ['ur-PK-UzmaNeural','ur-PK-AsadNeural'],
 'bn': ['bn-BD-NabanitaNeural','bn-BD-PradeepNeural'],
 'iu': ['iu-Latn-CA-SiqiniqNeural','iu-Latn-CA-TaqqiqNeural'],
 'en_extra': [],
}
byl = collections.defaultdict(list)
for v in V: byl[v['lang']].append(v)
out = collections.OrderedDict()
for l in sorted(byl):
  if l in PICK: sel = [i for i in PICK[l] if i in ids]; missing = [i for i in PICK[l] if i not in ids]
  else:
    vs = sorted(byl[l], key=lambda v: (v['gender'] != 'Female', v['id'])); sel = [v['id'] for v in vs[:2]]; missing = []
    assert len(byl[l]) <= 2, (l, len(byl[l]))
  if missing: print('MISSING', missing)
  out[l] = sel
json.dump(out, open('/tmp/curated.json','w'), indent=0)
print(sum(len(x) for x in out.values()), 'voices in', len(out), 'languages')
