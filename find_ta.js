const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/3vm-xt69rdwro.js', 'utf8');
const idx = c.indexOf('"useEditor"');
const snippet = c.slice(0, idx);
const pos = snippet.lastIndexOf('ta=');
console.log('pos:', pos);
console.log(snippet.slice(pos - 50, pos + 200));

