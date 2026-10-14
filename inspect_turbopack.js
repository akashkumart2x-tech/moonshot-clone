const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/turbopack-1_nc4sk00oq96.js', 'utf8');

console.log('turbopack loader length:', content.length);
let idx = 0;
while ((idx = content.indexOf('chunks', idx)) !== -1) {
  console.log(`[chunks at ${idx}]:`, content.slice(Math.max(0, idx - 80), Math.min(content.length, idx + 120)));
  idx += 6;
}
