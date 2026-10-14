const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('studioProjectState', idx)) !== -1) {
  console.log(`[studioProjectState at ${idx}]:`);
  console.log(content.slice(Math.max(0, idx - 50), Math.min(content.length, idx + 250)));
  idx += 18;
}
