const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
const pos = 1084555;
console.log(c.slice(pos - 50, pos + 250));
