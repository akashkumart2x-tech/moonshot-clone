const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

// Look for sidebar panel switcher
const idx = c.indexOf('"transcript"');
console.log('Snippet around "transcript":');
let pos = idx;
for (let i = 0; i < 5; i++) {
  console.log(pos, ':', c.slice(Math.max(0, pos - 50), Math.min(c.length, pos + 150)).replace(/\n/g, ' '));
  pos = c.indexOf('"transcript"', pos + 12);
}
