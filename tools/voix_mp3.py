"""Compresse les WAV de tools/voix.ps1 en MP3 (assets/voice) et écrit leur durée dans app/lines.json."""
import array, glob, json, os, sys, wave
import lameenc

src = sys.argv[1]
os.makedirs("assets/voice", exist_ok=True)
for old in glob.glob("assets/voice/*.mp3"):
    os.remove(old)
dur = {}
for f in sorted(glob.glob(os.path.join(src, "*.wav"))):
    w = wave.open(f); sr = w.getframerate(); a = array.array("h"); a.frombytes(w.readframes(w.getnframes())); w.close()
    i, j, th = 0, len(a) - 1, 350                      # coupe les silences de début et de fin
    while i < len(a) and abs(a[i]) < th: i += 1
    while j > i and abs(a[j]) < th: j -= 1
    a = a[max(0, i - int(sr * 0.05)):min(len(a), j + int(sr * 0.25))]
    gain = min(3.0, 29000 / max(1, max(abs(x) for x in a)))  # normalise le niveau
    a = array.array("h", (int(max(-32767, min(32767, x * gain))) for x in a))
    enc = lameenc.Encoder(); enc.set_bit_rate(48); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
    name = os.path.splitext(os.path.basename(f))[0]
    with open(f"assets/voice/{name}.mp3", "wb") as out:
        out.write(enc.encode(a.tobytes()) + enc.flush())
    dur[name] = round(len(a) / sr, 2)
lines = json.load(open("app/lines.json", encoding="utf-8"))
for k in lines:
    if k in dur: lines[k]["d"] = dur[k]
json.dump(lines, open("app/lines.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(dur), "répliques,", round(sum(dur.values())), "s")
