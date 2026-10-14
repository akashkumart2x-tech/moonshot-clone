const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

const idx = c.indexOf('[b,y]=(0,r.useState)("transcript")');
console.log(c.slice(idx + 1500, idx + 4500));
