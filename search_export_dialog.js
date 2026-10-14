const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
const pos = 1103421;
const idx = c.slice(0, pos).lastIndexOf('e8');
console.log('e8 in entire file before 1103421:', idx);
if (idx !== -1) {
  console.log(c.slice(idx - 50, idx + 100));
}
