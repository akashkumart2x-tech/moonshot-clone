const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/3r6q7ncknmjs6.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('R(', idx)) !== -1) {
  console.log(`\n--- Match at ${idx} ---`);
  console.log(content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 250)));
  idx += 3;
}
