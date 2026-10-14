const fs = require('fs');
const glob = fs.readdirSync('_next/static/chunks');

for (const f of glob) {
  if (!f.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + f, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('function isPlayableSourceProxy', idx)) !== -1) {
    console.log(`Found function in ${f} at ${idx}:`, content.slice(idx, idx + 250));
    idx += 30;
  }
  let idx2 = 0;
  while ((idx2 = content.indexOf('isPlayableSourceProxy:', idx2)) !== -1) {
    console.log(`Found export in ${f} at ${idx2}:`, content.slice(idx2, idx2 + 250));
    idx2 += 22;
  }
}
