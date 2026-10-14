const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

const regex = /([a-zA-Z0-9_$]+)=[^;]+aR/g;
let m;
while ((m = regex.exec(c.slice(1000000, 1060000))) !== null) {
  console.log(m[0].slice(0, 80));
}

// Find where aR appears before line 1055152
const idx = 1055152;
const snippet = c.slice(idx - 5000, idx);
const match = snippet.match(/([a-zA-Z0-9_$]+)\s*=\s*([a-zA-Z0-9_$]+)\.SubtitlesEditor|([a-zA-Z0-9_$]+)\s*=\s*([a-zA-Z0-9_$]+)\.TranscriptEditor/);
console.log('SubtitlesEditor match:', match);
const allImports = snippet.match(/[a-zA-Z0-9_$]+\.i\([0-9]+\)/g);
console.log('Recent imports:', allImports?.slice(-10));
