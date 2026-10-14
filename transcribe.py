import sys
import json
import os

# Fix Windows console UTF-8 encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from transcribe_engine import TranscriptionEngine

def transcribe_audio(audio_path, output_json=None, language=None):
    if not os.path.exists(audio_path):
        print(f"Error: audio file {audio_path} does not exist", file=sys.stderr)
        sys.exit(1)

    engine = TranscriptionEngine()
    result = engine.transcribe(audio_path)

    if output_json:
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"[transcribe.py] Saved to {output_json}", file=sys.stderr)

    print(json.dumps(result, ensure_ascii=True))
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_path> [output_json] [language]")
        sys.exit(1)
    out = sys.argv[2] if len(sys.argv) > 2 else None
    lang = sys.argv[3] if len(sys.argv) > 3 else None
    transcribe_audio(sys.argv[1], out, lang)
