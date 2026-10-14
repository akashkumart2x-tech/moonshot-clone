const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

// Find where TranscriptPane or similar component is rendered in the sidebar
let idx = 0;
while ((idx = c.indexOf('TranscriptPane', idx)) !== -1) {
  console.log('Match at', idx, ':', c.slice(idx - 100, idx + 300).replace(/\n/g, ' '));
  idx += 14;
}
