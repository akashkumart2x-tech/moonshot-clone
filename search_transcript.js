const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
let idx = 0;
while ((idx = c.indexOf('"transcript"', idx)) !== -1) {
  console.log(idx, ':', c.slice(idx - 30, idx + 80).replace(/\r?\n/g, ' '));
  idx += 12;
}
