"""Régénère la voix de Gladys dans toutes les langues.

    python tools/voix.py            # toutes les répliques
    python tools/voix.py fr g01     # une langue, une réplique

Lit app/lines.json ({langue: {id: {t, say?}}}), écrit assets/voice/<langue>/<id>.mp3
et reporte la durée de chaque réplique (champ « d ») dans app/lines.json.
Le champ « say » est une graphie phonétique utilisée seulement pour la synthèse.

Prérequis : pip install edge-tts  (voix neuronales Microsoft Edge, connexion requise).
Une seule voix multilingue pour que Gladys garde la même identité dans les trois langues.
"""
import asyncio
import json
import os
import sys

import edge_tts

VOICE = "fr-FR-VivienneMultilingualNeural"
RATE, PITCH = "+6%", "-4Hz"
LINES = "app/lines.json"


async def one(lang, key, text):
    out = f"assets/voice/{lang}/{key}.mp3"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    end = 0.0
    with open(out, "wb") as f:
        async for chunk in edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                end = max(end, (chunk["offset"] + chunk["duration"]) / 1e7)
    return round(end + 0.35, 2)


async def main():
    only_lang = sys.argv[1] if len(sys.argv) > 1 else None
    only_key = sys.argv[2] if len(sys.argv) > 2 else None
    data = json.load(open(LINES, encoding="utf-8"))
    for lang, lines in data.items():
        if only_lang and lang != only_lang:
            continue
        total = 0.0
        for key, line in lines.items():
            if only_key and key != only_key:
                continue
            for attempt in range(3):
                try:
                    line["d"] = await one(lang, key, line.get("say") or line["t"])
                    break
                except Exception as exc:  # le service coupe parfois la connexion : on réessaie
                    if attempt == 2:
                        raise
                    print("  nouvel essai", lang, key, exc)
                    await asyncio.sleep(2)
            total += line["d"]
        print(lang, len(lines), "répliques,", round(total), "s")
        json.dump(data, open(LINES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


asyncio.run(main())
