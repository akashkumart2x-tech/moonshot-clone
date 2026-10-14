const fs = require('fs');

const studioHtml = fs.readFileSync('studio.html', 'utf8');
console.log('studio.html length:', studioHtml.length);

// What is the body content of studio.html?
const bodyStart = studioHtml.indexOf('<body');
const bodyEnd = studioHtml.indexOf('</body>');
console.log('Body tag snippet:');
console.log(studioHtml.slice(bodyStart, Math.min(bodyEnd, bodyStart + 1500)));

// What script tags are at the bottom of studio.html?
const scripts = studioHtml.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
console.log(`\nTotal script tags in studio.html: ${scripts.length}`);
scripts.forEach((s, i) => {
  if (s.includes('self.__next_f.push')) {
    console.log(`Script ${i}: Next.js flight data push (${s.length} chars)`);
  } else {
    console.log(`Script ${i}: ${s.slice(0, 100)}...`);
  }
});
