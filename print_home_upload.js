const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/406f5coob9w7z.js', 'utf8');

const snippet = content.slice(37000, 42000);
console.log(snippet);
