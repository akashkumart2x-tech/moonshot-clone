const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, 'data', 'store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

const PROJ_ID = 'proj_mv7057hy_bzg0b';
const proj = store.projects[PROJ_ID];
if (!proj) {
  console.error(`Project ${PROJ_ID} not found in store`);
  process.exit(1);
}

const LANGUAGES = {
  hinglish: [
    { start: 0.0, end: 1.5, words: ["Kya", "aap", "bhi"] },
    { start: 1.5, end: 3.2, words: ["Pratap", "Nagar,"] },
    { start: 3.2, end: 4.5, words: ["Jagatpura,"] },
    { start: 4.5, end: 5.5, words: ["Shivdaspura,"] },
    { start: 5.5, end: 6.5, words: ["Patrakar", "Colony,"] },
    { start: 6.5, end: 7.5, words: ["Mansarovar", "me"] },
    { start: 7.5, end: 9.0, words: ["plot", "lene", "se", "chook", "gaye?"] },
    { start: 9.0, end: 11.2, words: ["To", "ye", "mauka", "na", "chhodein!"] },
    { start: 15.7, end: 18.1, words: ["Janakpuri", "aapke", "liye", "laya", "hai"] },
    { start: 18.1, end: 21.5, words: ["highway", "par", "125", "acre", "project"] },
    { start: 21.5, end: 25.0, words: ["jo", "hai", "Chaksu", "me!"] },
    { start: 25.0, end: 30.0, words: ["Chaksu", "Nagarpalika", "approved."] },
    { start: 30.0, end: 35.0, words: ["Small", "investment,", "Big", "returns!"] },
    { start: 35.0, end: 41.17, words: ["125", "acre", "prime", "township", "aapke", "liye!"] }
  ],

  english: [
    { start: 0.0, end: 1.5, words: ["Did", "you", "miss"] },
    { start: 1.5, end: 3.2, words: ["Pratap", "Nagar,"] },
    { start: 3.2, end: 4.5, words: ["Jagatpura,"] },
    { start: 4.5, end: 5.5, words: ["Shivdaspura,"] },
    { start: 5.5, end: 6.5, words: ["Patrakar", "Colony,"] },
    { start: 6.5, end: 7.5, words: ["or", "Mansarovar?"] },
    { start: 7.5, end: 9.0, words: ["Missed", "buying", "a", "plot?"] },
    { start: 9.0, end: 11.2, words: ["Don't", "miss", "this", "chance!"] },
    { start: 15.7, end: 18.1, words: ["Janakpuri", "brings", "to", "you"] },
    { start: 18.1, end: 21.5, words: ["a", "125-acre", "prime", "project"] },
    { start: 21.5, end: 25.0, words: ["located", "in", "Chaksu."] },
    { start: 25.0, end: 30.0, words: ["Under", "Chaksu", "Nagarpalika."] },
    { start: 30.0, end: 35.0, words: ["Low", "investment,", "High", "appreciation!"] },
    { start: 35.0, end: 41.17, words: ["125-acre", "township", "for", "you!"] }
  ],

  hindi: [
    { start: 0.0, end: 1.5, words: ["क्या", "आप", "भी"] },
    { start: 1.5, end: 3.2, words: ["प्रताप", "नगर,"] },
    { start: 3.2, end: 4.5, words: ["जगतपुरा,"] },
    { start: 4.5, end: 5.5, words: ["शिवदासपुरा,"] },
    { start: 5.5, end: 6.5, words: ["पत्रकार", "कॉलोनी,"] },
    { start: 6.5, end: 7.5, words: ["मानसरोवर", "में"] },
    { start: 7.5, end: 9.0, words: ["प्लॉट", "लेने", "से", "चूक", "गए?"] },
    { start: 9.0, end: 11.2, words: ["तो", "ये", "मौका", "न", "छोड़ें!"] },
    { start: 15.7, end: 18.1, words: ["जनकपुरी", "आपके", "लिए", "लाया", "है"] },
    { start: 18.1, end: 21.5, words: ["हाईवे", "पर", "125", "एकड़", "प्रोजेक्ट"] },
    { start: 21.5, end: 25.0, words: ["जो", "है", "चाकसू", "में!"] },
    { start: 25.0, end: 30.0, words: ["चाकसू", "नगरपालिका", "स्वीकृत।"] },
    { start: 30.0, end: 35.0, words: ["छोटा", "इन्वेस्टमेंट,", "बड़ा", "रिटर्न!"] },
    { start: 35.0, end: 41.17, words: ["125", "एकड़", "भव्य", "टाउनशिप!"] }
  ]
};

function applyLanguage(langKey) {
  const data = LANGUAGES[langKey] || LANGUAGES.hinglish;
  const transcript = [];
  const captionClips = [];

  data.forEach((seg, sIdx) => {
    const sId = `seg_${sIdx + 1}`;
    const wordObjs = [];
    const dur = seg.end - seg.start;
    const wordDur = dur / seg.words.length;

    seg.words.forEach((w, wIdx) => {
      const wStart = Number((seg.start + wIdx * wordDur).toFixed(2));
      const wEnd = Number((seg.start + (wIdx + 1) * wordDur).toFixed(2));
      wordObjs.push({
        id: `w_${sIdx + 1}_${wIdx + 1}`,
        text: w,
        textLatn: w,
        start: wStart,
        end: wEnd,
        confidence: 0.99
      });
    });

    transcript.push({
      id: sId,
      start: seg.start,
      end: seg.end,
      text: seg.words.join(' '),
      words: wordObjs
    });

    captionClips.push({
      id: `clip_c_${sIdx + 1}`,
      kind: 'caption',
      start: seg.start,
      duration: Math.max(0.1, Number((seg.end - seg.start).toFixed(2))),
      wordIds: wordObjs.map(w => w.id),
      styleOverride: null
    });
  });

  const videoClip = proj.clips.find(c => c.kind === 'video') || {
    id: `clip_video_${PROJ_ID}`,
    kind: 'video',
    start: 0,
    duration: 41.17,
    sourceStart: 0,
    sourceDuration: 41.17,
    volume: 1
  };

  proj.transcript = transcript;
  proj.clips = [videoClip, ...captionClips];
  proj.captionLanguage = langKey === 'hindi' ? 'hi' : 'en';
  proj.language = proj.captionLanguage;
  proj.captionScript = langKey === 'hindi' ? 'native' : 'roman';
  proj.source.matte = { status: 'ready', progress: 1 };
  proj.updatedAt = new Date().toISOString();
  proj.lastExport = null;

  for (const sess of Object.values(store.videoSessions)) {
    if (sess.projectId === PROJ_ID) {
      sess.transcript = transcript;
      sess.wordCount = transcript.reduce((a, s) => a + s.words.length, 0);
      sess.language = proj.captionLanguage;
      sess.updatedAt = proj.updatedAt;
    }
  }

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log(`Successfully applied ${langKey} to ${PROJ_ID} with ${transcript.length} short caption blocks (${captionClips.length} clips)!`);
}

const targetLang = process.argv[2] || 'hinglish';
applyLanguage(targetLang);
