import asyncio, json, os, edge_tts
cur = json.load(open('tools/curated.json')); ph = json.load(open('tools/phrases.json'))
os.makedirs('audio/previews', exist_ok=True)
sem = asyncio.Semaphore(6); fails = []
async def one(l, v):
    f = f'audio/previews/{v}.mp3'
    if os.path.exists(f) and os.path.getsize(f) > 2000: return
    async with sem:
        for att in range(4):
            try:
                a = bytearray()
                async for ch in edge_tts.Communicate(ph[l], v).stream():
                    if ch['type'] == 'audio': a += ch['data']
                open(f, 'wb').write(a); return
            except Exception as e:
                if att == 3: fails.append((v, str(e)))
                await asyncio.sleep(1 + att)
async def main():
    await asyncio.gather(*[one(l, v) for l, vs in cur.items() for v in vs])
asyncio.run(main()); print('fails', fails)
