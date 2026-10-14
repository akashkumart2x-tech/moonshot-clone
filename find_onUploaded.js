const fs = require('fs');
const chunks = fs.readdirSync('_next/static/chunks');

for (const chunk of chunks) {
  if (!chunk.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + chunk, 'utf8');
  // Check references to onUploaded or similar props
  let idx = 0;
  while ((idx = content.indexOf('onUploaded', idx)) !== -1) {
    console.log(`[${chunk} onUploaded at ${idx}]:`, content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 150)));
    idx += 10;
  }
}
