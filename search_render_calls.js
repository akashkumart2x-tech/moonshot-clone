const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
let pos = 118131; // start of tU
const endPos = 155000;
const sub = c.slice(pos, endPos);
let p = 0;
while ((p = sub.indexOf('/api/render', p)) !== -1) {
  console.log('Render api call at', p, ':', sub.slice(p - 100, p + 200));
  p += 11;
}
