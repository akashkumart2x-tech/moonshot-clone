const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
const pos = 247330;
const sub = c.slice(pos, pos + 25000);
console.log(sub.slice(11300, 13000));



