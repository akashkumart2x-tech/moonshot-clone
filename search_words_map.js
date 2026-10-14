const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
const pos = 247330;
const sub = c.slice(pos, pos + 30000);
let p = 0;
while ((p = sub.indexOf('.words.map', p)) !== -1) {
  console.log('words.map at', p, ':', sub.slice(p - 60, p + 160));
  p += 10;
}
