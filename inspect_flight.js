const fs = require('fs');

const studioHtml = fs.readFileSync('studio.html', 'utf8');
const scripts = studioHtml.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
const flightScript = scripts[33];

console.log('Flight script snippet (first 3000 chars):');
console.log(flightScript.slice(0, 3000));
