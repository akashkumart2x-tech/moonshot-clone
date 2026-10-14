const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/1up-v9eizj_lf.js', 'utf8');

console.log(content.slice(23900, 26500));
