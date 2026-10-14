const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

let pos = 0;
while ((pos = c.indexOf('aR', pos)) !== -1) {
  console.log(pos, ':', c.slice(Math.max(0, pos - 20), Math.min(c.length, pos + 50)).replace(/\n/g, ' '));
  pos += 2;
}
