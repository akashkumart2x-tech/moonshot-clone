const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/3r6q7ncknmjs6.js', 'utf8');

const snippet = content.slice(13500, 15500);
console.log(snippet);
