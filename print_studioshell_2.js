const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

console.log(content.slice(1079500, 1084500));
