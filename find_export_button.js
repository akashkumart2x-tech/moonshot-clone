const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

// Look for Export button rendering in StudioShell
let idx = 0;
while ((idx = c.indexOf('Export', idx)) !== -1) {
  const snippet = c.slice(Math.max(0, idx - 80), Math.min(c.length, idx + 100));
  if (snippet.includes('button') || snippet.includes('onClick') || snippet.includes('export')) {
    console.log('Export match at', idx, ':', snippet.replace(/\n/g, ' '));
  }
  idx += 6;
}
