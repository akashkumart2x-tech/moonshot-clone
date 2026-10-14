const fs = require('fs');

const chunks = ['055oo67r3vcom.js', '00q0ixrif1u4l.js', '2972fuzpejr_0.js', '3r6q7ncknmjs6.js'];
for (const c of chunks) {
  const p = '_next/static/chunks/' + c;
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  let idx = 0;
  while ((idx = content.indexOf('isPlayableSourceProxy', idx)) !== -1) {
    console.log(`[${c} at ${idx}]:`, content.slice(Math.max(0, idx - 80), Math.min(content.length, idx + 150)));
    idx += 20;
  }
}
