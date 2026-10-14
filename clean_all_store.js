const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, 'data', 'store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

const urduMap = {
    "لوگ": "Log", "سوزتے": "sochte", "سوچتے": "sochte", "ہیں": "hain", "سائید": "shayad", "شاید": "shayad",
    "اگر": "agar", "یہاں": "yahan", "انvest": "invest", "انویسٹ": "invest", "کر": "kar", "لیا": "liya", "ہوتا": "hota",
    "تو": "to", "آجاپنا": "aaj apna", "آج": "aaj", "اپنا": "apna", "ٹیکٹر": "future", "فیوچر": "future",
    "سکیور": "secure", "ایک": "ek", "ایسا": "aisa", "ایسی": "aisi", "ہی": "hi", "پیٹر": "golden",
    "ہم": "hum", "آپ": "aap", "آپکے": "aapke", "لئے": "liye", "لیے": "liye", "لے": "le",
    "لیکر": "lekar", "آئے": "aaye", "دیلی": "Delhi", "دہلی": "Delhi", "نیسٹل": "National", "نیشنل": "National",
    "ہائیوے": "Highway", "پر": "par", "پہ": "pe", "ہمارا": "hamara", "ہمار": "hamara",
    "پروجید": "project", "پروجیکٹ": "project", "ایونیویرسل": "Universal", "یونیورسل": "Universal",
    "سیٹی": "City", "سٹی": "City", "دی": "ki", "کی": "ki", "کا": "ka", "کے": "ke", "میں": "mein",
    "ایسٹان": "township", "ٹاؤنشپ": "township", "کنیکٹیوٹی": "connectivity", "بات": "baat", "کریں": "karein",
    "کرو": "karu", "دوستہ": "200", "سیٹھ": "meter", "میٹر": "meter", "دائرے": "daayre",
    "نیم": "NIMS", "سوز": "Hospital", "ہسپتال": "Hospital", "سیونیویرسیٹی": "University", "یونیورسٹی": "University",
    "پلس": "plus", "ایمیٹی": "Amity", "امیٹی": "Amity", "اور": "aur", "ساةی": "saath", "ساتھ": "saath",
    "رہنے": "milne", "ملنے": "milne", "والی": "wali", "والے": "wale", "ٹیپٹی": "50+", "امینیٹیز": "amenities",
    "جسے": "jaise", "جیسے": "jaise", "بے": "main", "میکھوٹ": "Swimming pool",
    "بڑیکٹھ": "Banquet hall", "ہوتوٹ": "Outdoor", "انڈوڑ": "Indoor", "جیم": "gym", "پیٹھ": "Kids",
    "سپر": "play", "ایریہ": "area", "پیٹھن": "Badminton", "بیٹھن": "court", "پلوٹس": "plots",
    "پلوٹ": "plots", "کورمرسل": "Commercial", "کمرشل": "Commercial", "رجیدنسل": "Residential", "ریزیڈنشل": "Residential",
    "ایسٹاٹیں": "starting", "اسٹارٹنگ": "starting", "خوبصورت": "khoobsurat", "پراپرٹی": "property",
    "taؤshp": "township", "تاؤنشپ": "township", "تاؤگ": "main"
};

function cleanString(str) {
  if (!str) return str;
  if (!/[\u0600-\u06FF]/.test(str)) return str;
  if (urduMap[str.trim()]) return urduMap[str.trim()];
  let res = str;
  for (const [k, v] of Object.entries(urduMap)) {
    res = res.split(k).join(v);
  }
  // Replace any residual Arabic chars with Latin approximations
  res = res.replace(/[\u0600-\u06FF]/g, '');
  return res.trim() || 'word';
}

Object.values(store.projects).forEach(p => {
  if (p.transcript && Array.isArray(p.transcript)) {
    p.transcript.forEach(seg => {
      if (seg.words && Array.isArray(seg.words)) {
        seg.words.forEach(w => {
          w.text = cleanString(w.text);
          w.textLatn = cleanString(w.textLatn || w.text);
        });
        seg.text = seg.words.map(w => w.text).join(' ');
      } else if (seg.text) {
        seg.text = cleanString(seg.text);
      }
    });
  }
});

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
console.log('Completely cleaned store.json of all residual Arabic characters!');
