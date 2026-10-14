const fs = require('fs');

const studioHtml = fs.readFileSync('studio.html', 'utf8');
const scripts = studioHtml.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
const flightScript = scripts[33];

let idx = 0;
while ((idx = flightScript.indexOf('bootstrap', idx)) !== -1) {
  console.log(`\nMatch at ${idx}:`);
  console.log(flightScript.slice(Math.max(0, idx - 100), Math.min(flightScript.length, idx + 200)));
  idx += 9;
}
