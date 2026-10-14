const fs = require('fs');
const glob = fs.readdirSync('_next/static/chunks');

for (const f of glob) {
  if (!f.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + f, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('function studioProjectState', idx)) !== -1) {
    console.log(`Found in ${f} at ${idx}:`, content.slice(idx, idx + 400));
    idx += 25;
  }
}
