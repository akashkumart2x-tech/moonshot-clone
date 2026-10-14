import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from faster_whisper import WhisperModel

# Use small model for accurate Hindi and English translation
model = WhisperModel('small', device='cpu', compute_type='int8')

print('Running translation to English with word timestamps...')
segments_en, _ = model.transcribe(
    'uploads/session_mv704mq9_dozhy/audio.wav',
    task='translate',
    word_timestamps=True,
    beam_size=5
)

results_en = []
for s_idx, s in enumerate(segments_en, 1):
    words = [{'id': f'w_en_{s_idx}_{w_idx}', 'text': w.word.strip(), 'start': round(w.start, 2), 'end': round(w.end, 2)} for w_idx, w in enumerate(s.words, 1)]
    results_en.append({'id': f'seg_en_{s_idx}', 'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip(), 'words': words})

with open('data/transcript_en.json', 'w', encoding='utf-8') as f:
    json.dump(results_en, f, indent=2, ensure_ascii=False)

print('Running Hindi (Devanagari) transcription with word timestamps...')
segments_hi, _ = model.transcribe(
    'uploads/session_mv704mq9_dozhy/audio.wav',
    language='hi',
    word_timestamps=True,
    beam_size=5
)

results_hi = []
for s_idx, s in enumerate(segments_hi, 1):
    words = [{'id': f'w_hi_{s_idx}_{w_idx}', 'text': w.word.strip(), 'start': round(w.start, 2), 'end': round(w.end, 2)} for w_idx, w in enumerate(s.words, 1)]
    results_hi.append({'id': f'seg_hi_{s_idx}', 'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip(), 'words': words})

with open('data/transcript_hi.json', 'w', encoding='utf-8') as f:
    json.dump(results_hi, f, indent=2, ensure_ascii=False)

print('Done extracting both!')
