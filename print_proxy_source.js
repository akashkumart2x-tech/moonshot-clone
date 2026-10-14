const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/0dlw1-lwrj04k.js', 'utf8');

console.log(content.slice(31500, 33500));
