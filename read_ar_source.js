const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

const idx = 246864;
console.log(c.slice(idx, idx + 4000));
