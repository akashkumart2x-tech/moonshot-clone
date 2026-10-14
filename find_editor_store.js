const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

let idx = 1074000;
while ((idx = content.indexOf('initialProject', idx)) !== -1) {
  console.log(`[initialProject at ${idx}]:`);
  console.log(content.slice(Math.max(0, idx - 50), Math.min(content.length, idx + 300)));
  idx += 14;
  if (idx > 1085000) break;
}
