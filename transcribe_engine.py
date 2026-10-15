import os
import sys
import json
import time
import requests

# Fix Windows console UTF-8 encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Optional transliteration support
try:
    from indic_transliteration import sanscript
    HAS_SANSCRIPT = True
except ImportError:
    HAS_SANSCRIPT = False

# High-frequency Hindi to Romanized Hinglish phonetic mapping for clean, natural reels captions
HINDI_TO_HINGLISH_MAP = {
    "लोग": "Log", "सोचते": "sochte", "हैं": "hain", "है": "hai", "शायद": "shayad", "अगर": "agar",
    "यहाँ": "yahan", "यहां": "yahan", "कर": "kar", "लिया": "liya", "होता": "hota", "तो": "to",
    "आज": "aaj", "अपना": "apna", "ठीक": "theek", "ऐसा": "aisa", "ऐसी": "aisi", "ही": "hi",
    "हम": "hum", "आपके": "aapke", "लिए": "liye", "लेकर": "lekar", "आए": "aaye", "आए हैं": "aaye hain",
    "दिल्ली": "Delhi", "नेशनल": "National", "हाइवे": "Highway", "हाईवे": "Highway", "पर": "par", "पहाड़": "pahad",
    "हमारा": "hamara", "यदि": "yadi", "इस": "is", "की": "ki", "का": "ka", "के": "ke", "में": "mein",
    "बात": "baat", "करें": "karein", "करूँ": "karu", "करूं": "karu", "करो": "karo",
    "दायरे": "daayre", "दाइरे": "daayre", "और": "aur", "साथ": "saath", "रहने": "rehne", "वाली": "wali",
    "वाले": "wale", "जैसे": "jaise", "कि": "ki", "मैं": "main", "मंदिर": "temple", "वर्ग": "varg",
    "गज": "gaj", "वर्गर्ज": "varg gaj", "तक": "tak", "देर": "der", "किस": "kis", "नीचे": "neeche",
    "दिए": "diye", "दिये": "diye", "गए": "gaye", "नंबरों": "numberon", "नमबरों": "numberon",
    "क्लिक": "click", "बुक": "book", "नमस्कार": "Namaskar", "दोस्तों": "dosto", "अंदर": "andar",
    "उपर": "upar", "ऊपर": "upar", "बिगा": "bigha", "बीघा": "bigha", "एक": "ek", "फ़र्स्ट": "first",
    "फेज": "phase", "टाउनशिप": "township", "कनेक्टिविटी": "connectivity", "सुविधाएं": "amenities",
    "प्लॉट": "plot", "प्लॉट्स": "plots", "कमर्शियल": "commercial", "रेजिडेंशियल": "residential",
    "रेजिडेंशल": "residential", "कॉमर्सल": "commercial", "स्वीमिंग": "swimming", "पूल": "pool",
    "बैंक्वेट": "banquet", "हॉल": "hall", "जिम": "gym", "स्टार्टिंग": "starting", "इन्वेस्ट": "invest",
    "जनकपुरी": "Janakpuri", "टॉक": "Tonk", "रोड": "Road"
}

def devanagari_to_hinglish_word(word: str) -> str:
    """Convert a Hindi Devanagari word to clean Romanized Hinglish."""
    if not word:
        return ""
    # If already pure ASCII (English words like 'invest', 'future', 'NIMS'), preserve as-is
    if all(ord(c) < 128 for c in word):
        return word
    clean = word.strip(" ,.!?;:।")
    if clean in HINDI_TO_HINGLISH_MAP:
        return HINDI_TO_HINGLISH_MAP[clean]
    # Fallback using indic-transliteration if available
    if HAS_SANSCRIPT:
        try:
            roman = sanscript.transliterate(clean, sanscript.DEVANAGARI, sanscript.ITRANS)
            # Basic phonetic cleanup for natural social reels reading
            roman = roman.replace('sh', 'sh').replace('A', 'aa').replace('I', 'ee').replace('U', 'oo')
            roman = roman.replace('M', 'n').replace('.N', 'n').replace('a$', '')
            return roman.lower().capitalize() if len(roman) > 3 else roman.lower()
        except Exception:
            pass
    return clean

class TranscriptionEngine:
    """Production-grade Multimodal Speech Recognition & Forced Word Alignment Engine."""

    def __init__(self):
        self.sarvam_key = os.environ.get("SARVAM_API_KEY")
        self.groq_key = os.environ.get("GROQ_API_KEY")
        self.openai_key = os.environ.get("OPENAI_API_KEY")

        # Load from app_secrets.json if present
        if not self.groq_key:
            try:
                base_dir = os.path.dirname(os.path.abspath(__file__))
                sec_path = os.path.join(base_dir, "app_secrets.json")
                if os.path.exists(sec_path):
                    with open(sec_path, "r", encoding="utf-8") as f:
                        sec = json.load(f)
                        self.groq_key = sec.get("groqApiKey") or sec.get("groq_api_key")
            except Exception:
                pass

    def transcribe(self, audio_path: str, domain_prompt: str = None, preferred_provider: str = "auto") -> dict:
        """
        Transcribe audio using the highest accuracy available engine.
        Priority:
          1. Sarvam Saaras v4 (if SARVAM_API_KEY configured and requested or auto)
          2. Groq Cloud Whisper-large-v3 (state-of-the-art multilingual 1.5B model, 200x real-time)
          3. OpenAI Whisper-1 (if OPENAI_API_KEY configured)
          4. Local faster-whisper (offline fallback)
        """
        default_prompt = (
            "Clear natural speech, accurate punctuation, proper casing, and authentic English, Hindi, and Hinglish vocabulary."
        )
        prompt = domain_prompt or default_prompt

        # Route 1: Sarvam Saaras v4 if key available
        if (preferred_provider == "sarvam" or (preferred_provider == "auto" and self.sarvam_key)) and self.sarvam_key:
            try:
                print("[TranscriptionEngine] Attempting Sarvam AI Saaras v4...")
                return self._transcribe_sarvam(audio_path, prompt)
            except Exception as e:
                print(f"[TranscriptionEngine] Sarvam AI failed ({e}), falling back to Groq Whisper-large-v3...")

        # Route 2: Groq Cloud Whisper-large-v3 (Leading High-Accuracy Multilingual Engine)
        if self.groq_key and preferred_provider in ["auto", "groq", "whisper_large"]:
            try:
                print("[TranscriptionEngine] Using Groq Cloud Whisper-large-v3 (High-Precision Multilingual)...")
                return self._transcribe_groq(audio_path, prompt)
            except Exception as e:
                print(f"[TranscriptionEngine] Groq API warning ({e}), falling back to secondary...")

        # Route 3: OpenAI Whisper-1
        if self.openai_key and preferred_provider in ["auto", "openai"]:
            try:
                print("[TranscriptionEngine] Using OpenAI Whisper-1 API...")
                return self._transcribe_openai(audio_path, prompt)
            except Exception as e:
                print(f"[TranscriptionEngine] OpenAI API warning ({e}), falling back...")

        # Route 4: Local faster-whisper fallback
        print("[TranscriptionEngine] Using local faster-whisper offline fallback...")
        return self._transcribe_local(audio_path)

    def _transcribe_groq(self, audio_path: str, prompt: str) -> dict:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.groq_key}"}

        with open(audio_path, "rb") as f:
            files = {"file": ("audio.wav", f, "audio/wav")}
            data = {
                "model": "whisper-large-v3",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
                "prompt": prompt
            }
            r = requests.post(url, files=files, data=data, headers=headers, timeout=60)

        if r.status_code != 200:
            raise RuntimeError(f"Groq API error ({r.status_code}): {r.text}")

        res = r.json()
        raw_words = res.get("words", [])
        return self._format_normalized_words(raw_words, res.get("language", "hi"), res.get("duration", 0), "groq_whisper_large_v3")

    def _transcribe_sarvam(self, audio_path: str, prompt: str) -> dict:
        url = "https://api.sarvam.ai/speech-to-text"
        headers = {"api-subscription-key": self.sarvam_key}

        with open(audio_path, "rb") as f:
            files = {"file": ("audio.wav", f, "audio/wav")}
            data = {
                "model": "saaras:v4",
                "mode": "codemix"
            }
            r = requests.post(url, files=files, data=data, headers=headers, timeout=60)

        if r.status_code != 200:
            raise RuntimeError(f"Sarvam API error ({r.status_code}): {r.text}")

        res = r.json()
        # If Sarvam does not provide word-level timestamps in batch mode, we align using faster-whisper VAD
        transcript_text = res.get("transcript", "")
        return self._align_text_to_audio(audio_path, transcript_text, "sarvam_saaras_v4")

    def _transcribe_openai(self, audio_path: str, prompt: str) -> dict:
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.openai_key}"}

        with open(audio_path, "rb") as f:
            files = {"file": ("audio.wav", f, "audio/wav")}
            data = {
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
                "prompt": prompt
            }
            r = requests.post(url, files=files, data=data, headers=headers, timeout=60)

        if r.status_code != 200:
            raise RuntimeError(f"OpenAI API error ({r.status_code}): {r.text}")

        res = r.json()
        raw_words = res.get("words", [])
        return self._format_normalized_words(raw_words, res.get("language", "hi"), res.get("duration", 0), "openai_whisper_1")

    def _transcribe_local(self, audio_path: str) -> dict:
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, info = model.transcribe(audio_path, word_timestamps=True, vad_filter=True)
            raw_words = []
            for s in segments:
                for w in s.words:
                    raw_words.append({
                        "word": w.word,
                        "start": w.start,
                        "end": w.end,
                        "probability": w.probability
                    })
            return self._format_normalized_words(raw_words, info.language, info.duration, "faster_whisper_local")
        except Exception as e:
            print(f"[TranscriptionEngine] Local faster-whisper unavailable ({e}). Returning fallback.")
            return {
                "engine": "none",
                "language": "hi",
                "duration": 0,
                "transcript": [],
                "wordCount": 0
            }

    def _format_normalized_words(self, raw_words: list, language: str, total_duration: float, engine_name: str) -> dict:
        """
        Format raw word timestamps into dual-script word objects and punchy reels captions (2-5 words per caption).
        Ensures word.text (Native/English) and word.textLatn (Hinglish/English) are both available.
        """
        processed_words = []
        full_transcript_segments = []

        cur_seg_words = []
        cur_seg_start = 0
        seg_idx = 1
        w_idx = 1

        for idx, rw in enumerate(raw_words):
            raw_text = rw.get("word", "").strip()
            if not raw_text:
                continue

            # Strip Perso-Arabic Urdu corruption if any
            if any('\u0600' <= ch <= '\u06FF' for ch in raw_text):
                continue

            w_start = round(float(rw.get("start", 0)), 2)
            w_end = round(float(rw.get("end", w_start + 0.3)), 2)
            if w_end <= w_start:
                w_end = round(w_start + 0.25, 2)

            conf = round(float(rw.get("probability", rw.get("confidence", 0.95))), 2)

            # Generate Romanized Hinglish equivalent
            latn_text = devanagari_to_hinglish_word(raw_text)

            # Detect punchy hook keywords for automatic emphasis suggestion
            is_hook = latn_text.lower() in [
                "future", "secure", "invest", "universal", "city", "golden", "opportunity",
                "township", "amenities", "swimming", "pool", "banquet", "hall", "gym",
                "plots", "commercial", "residential", "120", "bigha", "namaskar"
            ]

            w_obj = {
                "id": f"w_{seg_idx}_{w_idx}",
                "text": raw_text,
                "textLatn": latn_text,
                "start": w_start,
                "end": w_end,
                "confidence": conf,
                "highlight": is_hook,
                "emphasisTier": 1 if is_hook else 0,
                "style": {"highlight": True, "color": "#FFE600", "isBold": True} if is_hook else None
            }

            if not cur_seg_words:
                cur_seg_start = w_start

            cur_seg_words.append(w_obj)
            processed_words.append(w_obj)
            w_idx += 1

            # Break into reels caption chunk if:
            # 1. We reached 4-5 words, OR
            # 2. Significant pause (>0.6s) to next word, OR
            # 3. Punctuation boundary (. or ?)
            has_punct = raw_text.endswith((".", "!", "?", "।"))
            is_last = (idx == len(raw_words) - 1)
            next_start = raw_words[idx + 1].get("start", 0) if not is_last else 0
            has_pause = (next_start - w_end) > 0.55 if not is_last else False

            if len(cur_seg_words) >= 4 or has_punct or has_pause or is_last:
                seg_end = cur_seg_words[-1]["end"]
                full_transcript_segments.append({
                    "id": f"c_{seg_idx}",
                    "start": cur_seg_start,
                    "end": seg_end,
                    "text": " ".join(w["text"] for w in cur_seg_words),
                    "textLatn": " ".join(w["textLatn"] for w in cur_seg_words),
                    "words": cur_seg_words
                })
                seg_idx += 1
                w_idx = 1
                cur_seg_words = []

        return {
            "engine": engine_name,
            "language": language,
            "duration": total_duration,
            "transcript": full_transcript_segments,
            "wordCount": len(processed_words)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_engine.py <audio_path> [output_json]")
        sys.exit(1)

    audio = sys.argv[1]
    out_json = sys.argv[2] if len(sys.argv) > 2 else None

    engine = TranscriptionEngine()
    try:
        result = engine.transcribe(audio)
    except Exception as e:
        print(f"[TranscriptionEngine Error] {e}", file=sys.stderr)
        result = {
            "engine": "fallback",
            "language": "hi",
            "duration": 0,
            "transcript": [],
            "wordCount": 0,
            "error": str(e)
        }

    if out_json:
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"Transcription saved to {out_json}")

    print(json.dumps(result, ensure_ascii=True))
