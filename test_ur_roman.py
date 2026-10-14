import re

# Comprehensive Urdu Perso-Arabic to Romanized Hindi / Hinglish mapping
URDU_TO_HINGLISH_MAP = {
    "لوگ": "Log", "سوزتے": "sochte", "سوچتے": "sochte", "ہیں": "hain", "سائید": "shayad", "شاید": "shayad",
    "اگر": "agar", "یہاں": "yahan", "انvest": "invest", "انویسٹ": "invest", "کر": "kar", "لیا": "liya", "ہوتا": "hota",
    "تو": "to", "آجاپنا": "aaj apna", "آج": "aaj", "اپنا": "apna", "ٹیکٹر": "future", "فیوچر": "future",
    "سکیور": "secure", "ایک": "ek", "ایسا": "aisa", "ایسی": "aisi", "ہی": "hi", "پیٹر": "golden",
    "ہم": "hum", "آپ": "aap", "آپکے": "aapke", "لئے": "liye", "لیے": "liye", "لے": "le",
    "لیکر": "lekar", "آئے": "aaye", "دیلی": "Delhi", "دہلی": "Delhi", "نیسٹل": "National", "نیشنل": "National",
    "ہائیوے": "Highway", "ہائیوے": "Highway", "پر": "par", "پہ": "pe", "ہمارا": "hamara", "ہمار": "hamara",
    "پروجید": "project", "پروجیکٹ": "project", "ایونیویرسل": "Universal", "یونیورسل": "Universal",
    "سیٹی": "City", "سٹی": "City", "دی": "ki", "کی": "ki", "کا": "ka", "کے": "ke", "میں": "mein",
    "ایسٹان": "township", "ٹاؤنشپ": "township", "کنیکٹیوٹی": "connectivity", "بات": "baat", "کریں": "karein",
    "کرو": "karu", "دوستہ": "200", "سیٹھ": "meter", "میٹر": "meter", "دائرے": "daayre",
    "نیم": "NIMS", "سوز": "Hospital", "ہسپتال": "Hospital", "سیونیویرسیٹی": "University", "یونیورسٹی": "University",
    "پلس": "plus", "ایمیٹی": "Amity", "امیٹی": "Amity", "اور": "aur", "ساةی": "saath", "ساتھ": "saath",
    "رہنے": "milne", "ملنے": "milne", "والی": "wali", "والے": "wale", "ٹیپٹی": "50+", "امینیٹیز": "amenities",
    "ایمیٹی": "amenities", "جسے": "jaise", "جیسے": "jaise", "بے": "main", "میکھوٹ": "Swimming pool",
    "بڑیکٹھ": "Banquet hall", "ہوتوٹ": "Outdoor", "انڈوڑ": "Indoor", "جیم": "gym", "پیٹھ": "Kids",
    "سپر": "play", "ایریہ": "area", "پیٹھن": "Badminton", "بیٹھن": "court", "پلوٹس": "plots",
    "پلوٹ": "plots", "کورمرسل": "Commercial", "کمرشل": "Commercial", "رجیدنسل": "Residential", "ریزیڈنشل": "Residential",
    "ایسٹاٹیں": "starting", "اسٹارٹنگ": "starting", "خوبصورت": "khoobsurat", "پراپرٹی": "property"
}

# Character-level phonetics for fallback
UR_CHAR_MAP = {
    'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
    'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
    'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
    'ہ': 'h', 'ۂ': 'h', 'ۃ': 't', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e',
    'ئ': 'i'
}

def transliterate_urdu_to_hinglish(text):
    if not any('\u0600' <= ch <= '\u06FF' for ch in text):
        return text
    clean_text = text.strip()
    if clean_text in URDU_TO_HINGLISH_MAP:
        return URDU_TO_HINGLISH_MAP[clean_text]
    # Check words
    words = clean_text.split()
    converted_words = []
    for w in words:
        if w in URDU_TO_HINGLISH_MAP:
            converted_words.append(URDU_TO_HINGLISH_MAP[w])
        else:
            # Fallback char by char
            roman = ''.join(UR_CHAR_MAP.get(ch, ch) for ch in w if ch not in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652')
            converted_words.append(roman if roman else w)
    return ' '.join(converted_words)

sample = "\u0644\u0648\u06af \u0633\u0648\u0632\u062a\u06d2 \u06c1\u06cc\u06ba \u0633\u0627\u0626\u06cc\u062f \u0627\u06af\u0631 \u06cc\u06c1\u0627\u06ba \u0627\u0646vest \u06a9\u0631 \u0644\u06cc\u0627 \u06c1\u0648\u062a\u0627 \u062a\u0648 \u0622\u062c\u0627\u067e\u0646\u0627 \u0679\u06cc\u06a9\u0679\u0631 \u0633\u06a9\u06cc\u0648\u0631 \u06c1\u0648\u062a\u0627"
print("Transliterated:", transliterate_urdu_to_hinglish(sample))


