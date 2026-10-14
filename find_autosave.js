const fs = require('fs');
const glob = fs.readdirSync('_next/static/chunks');

for (const f of glob) {
  if (!f.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + f, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('queueProjectAutosave', idx)) !== -1) {
    console.log(`[${f} at ${idx}]:`, content.slice(Math.max(0, idx - 40), Math.min(content.length, idx + 160)));
    idx += 20;
  }
}
