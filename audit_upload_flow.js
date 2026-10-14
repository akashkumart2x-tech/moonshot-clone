const fs = require('fs');

console.log('=== AUDITING INDEX.HTML & UPLOAD HANDLERS ===');

const indexHtml = fs.readFileSync('index.html', 'utf8');
console.log('index.html size:', indexHtml.length);

// Search for upload button, dropzone, input type=file, or api/upload in index.html
const fileInputMatches = indexHtml.match(/<input[^>]*type=["']file["'][^>]*>/g) || [];
console.log('File inputs in index.html:', fileInputMatches);

// Check Next.js page scripts loaded by index.html
const scripts = indexHtml.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/g) || [];
console.log(`Scripts in index.html: ${scripts.length}`);

// Find which script defines the upload dropzone / file picker
const chunks = fs.readdirSync('_next/static/chunks');
for (const chunk of chunks) {
  if (!chunk.endsWith('.js')) continue;
  const content = fs.readFileSync('_next/static/chunks/' + chunk, 'utf8');
  if (content.includes('/api/upload') || content.includes('uploadSessionId')) {
    console.log(`Chunk ${chunk} contains /api/upload references!`);
  }
}
