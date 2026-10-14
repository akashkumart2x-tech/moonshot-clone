const fs = require('fs');

const chunks = ['25vcslh0ddtnv.js', '055oo67r3vcom.js', '2303t7zuylyt-.js', '00q0ixrif1u4l.js'];

for (const c of chunks) {
  const p = '_next/static/chunks/' + c;
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  console.log(`\n=== Chunk ${c} (${content.length} chars) ===`);
  
  // Search for player, video, previewUrl, source
  let idx = 0;
  while ((idx = content.indexOf('previewUrl', idx)) !== -1) {
    console.log(`[previewUrl at ${idx}]:`, content.slice(Math.max(0, idx - 60), Math.min(content.length, idx + 120)));
    idx += 10;
  }
}
