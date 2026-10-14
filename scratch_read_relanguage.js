const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');
const idx = c.indexOf('function iE({onRelanguage:e})');
console.log(c.slice(idx - 300, idx + 2500));
