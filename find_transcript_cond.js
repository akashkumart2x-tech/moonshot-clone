const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

let idx = 0;
while ((idx = c.indexOf('"transcript"===', idx)) !== -1) {
  console.log('Match at', idx, ':', c.slice(idx - 100, idx + 400).replace(/\n/g, ' '));
  idx += 15;
}
idx = 0;
while ((idx = c.indexOf('==="transcript"', idx)) !== -1) {
  console.log('Match2 at', idx, ':', c.slice(idx - 100, idx + 400).replace(/\n/g, ' '));
  idx += 15;
}
