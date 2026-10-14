const fs = require('fs');
const path = require('path');

console.log('=== AUDITING CLIENT CODE & ASSETS ===');

const studioHtml = fs.readFileSync('studio.html', 'utf8');
const scriptMatches = studioHtml.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/g) || [];
console.log(`Found ${scriptMatches.length} script tags in studio.html:`);

let missingScripts = 0;
scriptMatches.forEach(tag => {
  const m = tag.match(/src=["']([^"']+)["']/);
  if (m) {
    const src = m[1];
    const localPath = src.startsWith('/') ? src.slice(1) : src;
    const exists = fs.existsSync(localPath);
    console.log(`  ${exists ? '✅' : '❌ MISSING'} ${src}`);
    if (!exists) missingScripts++;
  }
});

const cssMatches = studioHtml.match(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/g) || [];
console.log(`\nFound ${cssMatches.length} CSS tags in studio.html:`);
let missingCss = 0;
cssMatches.forEach(tag => {
  const m = tag.match(/href=["']([^"']+)["']/);
  if (m) {
    const href = m[1];
    const localPath = href.startsWith('/') ? href.slice(1) : href;
    const exists = fs.existsSync(localPath);
    console.log(`  ${exists ? '✅' : '❌ MISSING'} ${href}`);
    if (!exists) missingCss++;
  }
});

console.log(`\nSummary: Missing scripts: ${missingScripts}, Missing CSS: ${missingCss}`);
