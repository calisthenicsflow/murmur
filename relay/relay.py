"""Murmur neural-voice relay.

A tiny HTTP relay that lets the Murmur web app (a static site) use the free
Microsoft Edge "Read Aloud" neural voices. Browsers other than Microsoft Edge
are refused by the speech endpoint (it checks the Edge User-Agent, which web
pages cannot set), so synthesis runs here through the open-source `edge-tts`
library and the app receives MP3 audio + exact word timings.

  GET  /health  -> {"ok": true}
  GET  /voices  -> [{"id","name","locale","lang","gender","tags"}]
  POST /tts     {"text","voice"} -> {"audio": <base64 mp3>, "words": [[startMs, durMs, "word"], ...]}

Run:  python3 relay.py --port 8787
"""
import argparse, asyncio, base64, collections, hashlib, json, re, time
from aiohttp import web
import edge_tts

ALLOWED = re.compile(r"^(https://calisthenicsflow\.github\.io|http://(localhost|127\.0\.0\.1)(:\d+)?)$")
MAX_CHARS = 1800
CACHE_MAX = 400
RATE = 150            # requests / minute / IP
_cache = collections.OrderedDict()
_hits = collections.defaultdict(collections.deque)
_voices = {"t": 0, "data": None}
_sem = asyncio.Semaphore(6)


def cors(req, resp):
    origin = req.headers.get("Origin", "")
    if ALLOWED.match(origin):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Max-Age"] = "86400"
    return resp


@web.middleware
async def mw(req, handler):
    if req.method == "OPTIONS":
        return cors(req, web.Response(status=204))
    ip = req.headers.get("CF-Connecting-IP") or req.remote or "?"
    q, now = _hits[ip], time.time()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE:
        return cors(req, web.json_response({"error": "rate"}, status=429))
    q.append(now)
    try:
        resp = await handler(req)
    except web.HTTPException as e:
        resp = web.json_response({"error": e.reason}, status=e.status)
    except Exception as e:  # noqa
        resp = web.json_response({"error": str(e)[:200]}, status=502)
    return cors(req, resp)


async def health(req):
    return web.json_response({"ok": True, "engine": "edge-neural", "time": int(time.time())})


async def voices(req):
    if not _voices["data"] or time.time() - _voices["t"] > 86400:
        raw = await edge_tts.list_voices()
        out = []
        for v in raw:
            fn = v.get("FriendlyName", "")
            m = re.search(r"Microsoft (.+?) Online", fn)
            out.append({
                "id": v["ShortName"],
                "name": (m.group(1) if m else v["ShortName"].split("-")[-1].replace("Neural", "")),
                "locale": v["Locale"],
                "lang": v["Locale"].split("-")[0],
                "langName": v.get("LocaleName", v["Locale"]),
                "gender": v.get("Gender", ""),
                "tags": (v.get("VoiceTag") or {}).get("VoicePersonalities", []),
                "multi": "Multilingual" in v["ShortName"],
            })
        _voices.update(t=time.time(), data=out)
    r = web.json_response(_voices["data"])
    r.headers["Cache-Control"] = "public, max-age=3600"
    return r


async def tts(req):
    body = await req.json()
    text = re.sub(r"\s+", " ", str(body.get("text", ""))).strip()[:MAX_CHARS]
    voice = str(body.get("voice") or "en-US-AvaMultilingualNeural")
    if not text or not re.match(r"^[a-z]{2,3}-[A-Za-z]{2,4}(-[A-Za-z]+)?-[A-Za-z]+Neural$", voice):
        raise web.HTTPBadRequest(reason="bad text or voice")
    key = hashlib.sha1(f"{voice}|{text}".encode()).hexdigest()
    if key in _cache:
        _cache.move_to_end(key)
        return web.json_response(_cache[key])
    async with _sem:
        audio, words = bytearray(), []
        for attempt in range(3):
            try:
                audio, words = bytearray(), []
                c = edge_tts.Communicate(text, voice, boundary="WordBoundary")
                async for ch in c.stream():
                    if ch["type"] == "audio":
                        audio += ch["data"]
                    elif ch["type"] == "WordBoundary":
                        words.append([round(ch["offset"] / 1e4), round(ch["duration"] / 1e4), ch["text"]])
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(0.4 * (attempt + 1))
    data = {"audio": base64.b64encode(bytes(audio)).decode(), "words": words}
    _cache[key] = data
    if len(_cache) > CACHE_MAX:
        _cache.popitem(last=False)
    return web.json_response(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    a = ap.parse_args()
    app = web.Application(middlewares=[mw], client_max_size=64 * 1024)
    app.add_routes([web.get("/health", health), web.get("/voices", voices), web.post("/tts", tts)])
    web.run_app(app, host="127.0.0.1", port=a.port, access_log=None)


if __name__ == "__main__":
    main()
