const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

let idx = 0;
while ((idx = content.indexOf('/api/projects/', idx)) !== -1) {
  console.log(`\n[/api/projects/ at ${idx}]:`);
  console.log(content.slice(Math.max(0, idx - 80), Math.min(content.length, idx + 250)));
  idx += 14;
}
