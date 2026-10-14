const fs = require('fs');

console.log('=== TRACING POST-UPLOAD REDIRECT & STATE UPDATE ===');

for (const chunk of ['2972fuzpejr_0.js', '3r6q7ncknmjs6.js', '406f5coob9w7z.js']) {
  if (!fs.existsSync('_next/static/chunks/' + chunk)) continue;
  const content = fs.readFileSync('_next/static/chunks/' + chunk, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('/api/upload', idx)) !== -1) {
    console.log(`\n--- [${chunk} at ${idx}] ---`);
    console.log(content.slice(Math.max(0, idx - 150), Math.min(content.length, idx + 250)));
    idx += 11;
  }
}
