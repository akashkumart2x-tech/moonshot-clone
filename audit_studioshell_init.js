const fs = require('fs');

console.log('=== INSPECTING STUDIOSHELL COMPONENT ===');
// Look at 22p0vzz-jab2_.js where StudioBootstrap renders m (StudioShell)
const bootChunk = fs.readFileSync('_next/static/chunks/22p0vzz-jab2_.js', 'utf8');
const bootIdx = bootChunk.indexOf('initialProject');
console.log('StudioShell invocation snippet:');
console.log(bootChunk.slice(bootIdx - 100, bootIdx + 300));
