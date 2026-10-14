const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/22p0vzz-jab2_.js', 'utf8');

console.log(content.slice(2000, 6000));
