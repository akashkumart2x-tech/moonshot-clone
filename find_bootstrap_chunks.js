const fs = require('fs');
const chunks = fs.readdirSync('_next/static/chunks');

for (const chunk of chunks) {
  if (!chunk.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + chunk, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('/api/bootstrap', idx)) !== -1) {
    console.log(`\n[${chunk} at ${idx}]:`);
    console.log(content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 200)));
    idx += 14;
  }
}
