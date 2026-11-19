# Murmur TTS relay — Cloudflare Worker

JS port of `relay/relay.py` (edge-tts 7.3.1 protocol, incl. Sec-MS-GEC v2 token) for the free Workers plan.

- `GET /health`, `GET /voices`, `POST /tts {text, voice}` → `{audio: base64 mp3, words: [[startMs, durMs, word], ...]}`
- CORS + POST origin check: https://calisthenicsflow.github.io and localhost only
- Max 1000 chars per request, ~60 req/min/IP (per isolate)

Deploy: `npm install && npx wrangler login && npx wrangler deploy`
Live: https://murmur-tts.calistenicsflow.workers.dev
