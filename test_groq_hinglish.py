import os
import json
import time
import requests
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

groq_key = os.environ.get("GROQ_API_KEY")
audio_path = r"D:\AAKASH\motion graphics\moonshot-clone\uploads\session_mv723uzg_khgnl\audio.wav"

with open(audio_path, "rb") as f:
    files = {"file": ("audio.wav", f, "audio/wav")}
    data = {
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
        "prompt": "Log sochte hain shayad agar yahan invest kar liya hota to aaj apna future secure hota. Hamara project Universal City Delhi National Highway par. 200 meter ke daayre mein NIMS Hospital, NIMS University, Amity University. 50 plus amenities jaise swimming pool, banquet hall, outdoor gym, indoor gym, kids play area, temple. Commercial plus residential plots."
    }
    headers = {"Authorization": f"Bearer {groq_key}"}
    r = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", files=files, data=data, headers=headers)

if r.status_code == 200:
    res = r.json()
    print("Detected language:", res.get("language"))
    print("Full text:\n", res.get("text"))
    with open("groq_whisper_hinglish_result.json", "w", encoding="utf-8") as out_f:
        json.dump(res, out_f, indent=2, ensure_ascii=False)
else:
    print("Error:", r.text)
