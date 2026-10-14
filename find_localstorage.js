const fs = require('fs');
const glob = fs.readdirSync('_next/static/chunks');
const keys = new Set();
for (const file of glob) {
  if (!file.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + file, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('localStorage', idx)) !== -1) {
    const snippet = content.slice(idx, idx + 120);
    console.log(`[${file}] ${snippet.replace(/\n/g, ' ')}`);
    idx += 12;
  }
}
