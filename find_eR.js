const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/406f5coob9w7z.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('eR=', idx)) !== -1) {
  console.log(`\n--- eR definition at ${idx} ---`);
  console.log(content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 400)));
  idx += 3;
}
