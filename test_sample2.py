import os
import json
import requests
import jiwer
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

audio_path_2 = r"D:\AAKASH\motion graphics\moonshot-clone\uploads\session_mv72qier_bf3ia\audio.wav"
groq_key = os.environ.get("GROQ_API_KEY")

print(f"Benchmarking Sample 2: {audio_path_2}...")

with open(audio_path_2, "rb") as f:
    files = {"file": ("audio.wav", f, "audio/wav")}
    data = {
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
        "prompt": "Janakpuri township, main highway, residential, commercial, 120 bigha, call karein."
    }
    headers = {"Authorization": f"Bearer {groq_key}"}
    r = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", files=files, data=data, headers=headers)

if r.status_code == 200:
    res = r.json()
    print("Detected language:", res.get("language"))
    print("Text:\n", res.get("text"))
    print(f"Total words: {len(res.get('words', []))}")
    with open("benchmark_sample2_groq.json", "w", encoding="utf-8") as out_f:
        json.dump(res, out_f, indent=2, ensure_ascii=False)
else:
    print("Error:", r.text)
