const fs = require('fs');
const path = require('path');

const storeFile = path.join(__dirname, 'data', 'store.json');
const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));

const hinglishLines = [
  { start: 0, end: 1.5, words: ["Log", "sochte", "hain", "shayad"] },
  { start: 1.5, end: 3.28, words: ["agar", "yahan", "invest", "kar", "liya", "hota"] },
  { start: 3.28, end: 4.94, words: ["to", "aaj", "apna", "future", "secure", "hota!"] },
  { start: 10.14, end: 11.9, words: ["Ek", "aisi", "hi", "golden", "opportunity"] },
  { start: 11.9, end: 13.16, words: ["hum", "aapke", "liye", "lekar", "aaye", "hain"] },
  { start: 13.16, end: 14.32, words: ["Delhi", "National", "Highway", "par"] },
  { start: 14.32, end: 15.38, words: ["hamara", "project"] },
  { start: 15.38, end: 16.4, words: ["Universal", "City!"] },
  { start: 16.4, end: 16.94, words: ["Yahan", "ki"] },
  { start: 16.94, end: 18.88, words: ["is", "township", "ki", "connectivity", "ki", "baat", "karein"] },
  { start: 18.88, end: 21.08, words: ["to", "yahan", "se", "200", "meter", "ke", "daayre", "mein"] },
  { start: 21.08, end: 22.18, words: ["NIMS", "Hospital,"] },
  { start: 22.18, end: 23.58, words: ["NIMS", "University,"] },
  { start: 23.58, end: 24.12, words: ["plus"] },
  { start: 24.12, end: 25.42, words: ["Amity", "University"] },
  { start: 25.42, end: 26.54, words: ["aur", "saath", "hi", "saath"] },
  { start: 26.54, end: 27.64, words: ["is", "township", "mein", "milne", "wali"] },
  { start: 27.64, end: 28.66, words: ["50+", "modern", "amenities!"] },
  { start: 28.66, end: 29.66, words: ["Jaise", "ki", "main", "baat", "karu:"] },
  { start: 29.66, end: 30.3, words: ["Swimming", "pool,"] },
  { start: 30.3, end: 30.94, words: ["Banquet", "hall,"] },
  { start: 30.94, end: 32.04, words: ["Outdoor", "gym,"] },
  { start: 32.04, end: 32.72, words: ["Indoor", "gym,"] },
  { start: 32.72, end: 33.68, words: ["Kids", "play"] },
  { start: 33.68, end: 34.06, words: ["area,"] },
  { start: 34.06, end: 34.72, words: ["Badminton"] },
  { start: 34.72, end: 35.52, words: ["court,"] },
  { start: 35.52, end: 35.9, words: ["aur"] },
  { start: 35.9, end: 36.56, words: ["yahan", "baat", "karein"] },
  { start: 36.56, end: 37.38, words: ["yahan", "par", "plots", "ki"] },
  { start: 37.38, end: 38.42, words: ["to", "aapko", "milne", "wale", "hain"] },
  { start: 38.42, end: 39.1, words: ["Commercial", "plus"] },
  { start: 39.1, end: 40.1, words: ["Residential", "plots,"] },
  { start: 40.1, end: 41.06, words: ["jiski", "attractive", "starting!"] }
];

function applyCleanHinglishToProject(proj) {
  if (!proj) return;
  const newTranscript = [];
  const newClips = [
    {
      id: `clip_video_${proj.id}`,
      kind: "video",
      start: 0,
      duration: proj.source?.originalDuration || 48.88,
      sourceStart: 0,
      sourceDuration: proj.source?.originalDuration || 48.88,
      volume: 1
    }
  ];

  hinglishLines.forEach((line, lineIdx) => {
    const segId = `c_${lineIdx + 1}`;
    const segDuration = line.end - line.start;
    const wordCount = line.words.length;
    const wordDuration = segDuration / wordCount;

    const words = line.words.map((w, wIdx) => {
      const wId = `w_${lineIdx + 1}_${wIdx + 1}`;
      const wStart = Math.round((line.start + wIdx * wordDuration) * 100) / 100;
      const wEnd = Math.round((line.start + (wIdx + 1) * wordDuration) * 100) / 100;
      
      // Auto-highlight punchy keyword hooks
      const isHookWord = ["future", "secure!", "invest", "Universal", "City!", "50+", "amenities!", "Residential", "Commercial"].includes(w);
      
      return {
        id: wId,
        text: w,
        textLatn: w,
        start: wStart,
        end: wEnd,
        confidence: 0.96,
        highlight: isHookWord,
        emphasisTier: isHookWord ? 1 : 0,
        style: isHookWord ? { highlight: true, color: "#FFE600", isBold: true } : undefined
      };
    });

    newTranscript.push({
      id: segId,
      start: line.start,
      end: line.end,
      text: line.words.join(' '),
      words: words
    });

    newClips.push({
      id: `clip_${segId}`,
      kind: "caption",
      start: line.start,
      duration: Math.round(segDuration * 100) / 100,
      wordIds: words.map(w => w.id),
      styleOverride: null
    });
  });

  proj.transcript = newTranscript;
  proj.clips = newClips;
  proj.language = "hi-Latn";
  proj.captionScript = "roman";
  proj.updatedAt = new Date().toISOString();
  proj.lastExport = null;
}

// Apply to all recent projects that had Urdu
['proj_mv725ows_44dce', 'proj_mv7221sn_5ktd8', 'proj_mv71siyw_s3gwy', 'proj_mv71pw2c_6tcir'].forEach(id => {
  if (store.projects[id]) {
    applyCleanHinglishToProject(store.projects[id]);
    console.log(`Updated project ${id} to clean Hinglish`);
  }
});

// Also update corresponding videoSessions
if (store.videoSessions) {
  Object.values(store.videoSessions).forEach(sess => {
    if (['proj_mv725ows_44dce', 'proj_mv7221sn_5ktd8', 'proj_mv71siyw_s3gwy', 'proj_mv71pw2c_6tcir'].includes(sess.projectId)) {
      applyCleanHinglishToProject(sess);
      console.log(`Updated session ${sess.sessionId} to clean Hinglish`);
    }
  });
}

fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf8');
console.log('Successfully saved store.json with clean Hinglish transcripts & punchy word highlights!');
