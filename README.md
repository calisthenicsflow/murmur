# Murmur — read & listen

A mobile-first reading app: library shelves, a calm paper reader, and listening with neural voices and word-by-word highlight.

**Live:** https://calisthenicsflow.github.io/murmur/

## Features
- Library on glass shelves: sample public-domain books (EN + RU), your imports with generated covers
- Import: paste text, `.txt`, `.pdf` (pdf.js), `.epub` (JSZip), web articles by link (via the r.jina.ai reader)
- Reader: drop cap, justified serif text, Paper / Sepia / Night, text size, typeface, line spacing, brightness
- Listen: per-word highlight that glides with the voice and auto-scrolls, tap any word to start there, sentence skip, speed 0.5–3×, voice picker by language
- Focus mode (only the current sentence), bilingual mode (translation under every sentence, optionally read aloud after the original)
- Sleep timer with fade-out, bookmarks and resume, quote cards exported as PNG, stats with day streak
- Skip filler: links, footnote marks and page numbers are not read aloud
- PWA: installable, offline app shell, versioned cache

## Voices
| Engine | Where it works | Notes |
|---|---|---|
| Microsoft Edge neural voices (pre-voiced) | everywhere, no server | the sample books ship with neural audio + word timings in `audio/` (generated with `edge-tts`) |
| Microsoft Edge neural voices (relay) | any text, 300+ voices | needs `relay/relay.py` running somewhere reachable over HTTPS; set its URL in Voice → Neural relay or in `config.json` |
| Device voices (Web Speech API) | everywhere | Siri / enhanced voices on iPhone, free; used automatically when neural is unavailable |

Why a relay: Microsoft's Read Aloud endpoint only accepts Microsoft Edge's browser identity (User-Agent) plus a rotating `Sec-MS-GEC` token, which a web page in Safari/Chrome cannot send. The relay runs the open-source `edge-tts` library and returns MP3 + exact word boundaries.

The engine layer (`js/engines.js`) is pluggable: `createAudioEngine({ synth })` accepts any service that returns audio + word timings (ElevenLabs, Azure Speech, Grok TTS…).

### Run the relay
```
pip install edge-tts aiohttp
python3 relay/relay.py --port 8787     # then expose it over HTTPS (tunnel / small VPS)
```

## Develop
Static files, no build step: `python3 -m http.server 8080` and open http://localhost:8080.

Sample texts: Wikisource (public domain).
