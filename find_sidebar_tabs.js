const fs = require('fs');
const c = fs.readFileSync('_next/static/chunks/055oo67r3vcom.js', 'utf8');

const idx = c.indexOf('[b,y]=(0,r.useState)("transcript")');
if (idx !== -1) {
  console.log(c.slice(idx - 100, idx + 1500));
} else {
  console.log('Not found, searching useState("transcript")');
  const pos = c.indexOf('("transcript")');
  console.log(c.slice(pos - 100, pos + 300));
}
