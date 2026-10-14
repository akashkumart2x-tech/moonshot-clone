const fs = require('fs');
const content = fs.readFileSync('_next/static/chunks/0ob696nzsanu4.js', 'utf8');
const regex = /eS\("([^"]+)","([^"]+)","([^"]+)","([^"]+)",ew\(([^)]+)\)\)/g;
let match;
const presets = {};
while ((match = regex.exec(content)) !== null) {
  const id = match[1];
  const name = match[2];
  const body = match[5];
  presets[id] = { id, name, raw: body };
}
console.log('Found presets count:', Object.keys(presets).length);
console.log(JSON.stringify(presets, null, 2));
