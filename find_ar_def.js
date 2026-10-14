const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

const idx = c.indexOf('aR={');
const idx2 = c.indexOf('let aR=');
const idx3 = c.indexOf('var aR=');
const idx4 = c.indexOf('aR=');

console.log('Definitions of aR:', { idx, idx2, idx3, idx4 });
if (idx4 !== -1) {
  console.log(c.slice(idx4 - 50, idx4 + 300));
}
