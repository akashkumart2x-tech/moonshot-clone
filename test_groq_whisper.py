import os
import json
import time
import requests

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

groq_key = os.environ.get("GROQ_API_KEY")

audio_path = r"D:\AAKASH\motion graphics\moonshot-clone\uploads\session_mv723uzg_khgnl\audio.wav"

if not os.path.exists(audio_path):
    print("Audio file not found:", audio_path)
    exit(1)

print(f"Testing Groq whisper-large-v3 on {audio_path} ({os.path.getsize(audio_path)} bytes)...")
start_time = time.time()

with open(audio_path, "rb") as f:
    files = {"file": ("audio.wav", f, "audio/wav")}
    data = {
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
        "prompt": "Universal City, Delhi National Highway, NIMS Hospital, Amity University, 50+ amenities, banquet hall, swimming pool, outdoor gym, commercial plots, residential plots, future secure."
    }
    headers = {"Authorization": f"Bearer {groq_key}"}
    r = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", files=files, data=data, headers=headers)

elapsed = time.time() - start_time
print(f"Groq API Response in {elapsed:.2f}s (Status: {r.status_code})")

if r.status_code == 200:
    res = r.json()
    print("\n--- DETECTED LANGUAGE ---")
    print(res.get("language"))
    print("\n--- FULL TEXT ---")
    print(res.get("text"))
    words = res.get("words", [])
    print(f"\n--- WORD COUNT: {len(words)} ---")
    print("First 15 words with timestamps:")
    for w in words[:15]:
        print(f"  {w.get('start', 0):.2f}s - {w.get('end', 0):.2f}s: {w.get('word')}")
    
    # Save output for inspection
    with open("groq_whisper_test_result.json", "w", encoding="utf-8") as out_f:
        json.dump(res, out_f, indent=2, ensure_ascii=False)
    print("\nSaved full result to groq_whisper_test_result.json")
else:
    print("Error:", r.text)
