const fs = require('fs');
let c = fs.readFileSync('studio.html', 'utf8');

if (!c.includes('word_editor_and_export.js')) {
  const insertTags = `
<link rel="stylesheet" href="/assets/word_editor_and_export.css">
<script src="/assets/word_editor_and_export.js"></script>
</body></html>`;
  c = c.replace('</body></html>', insertTags);
  fs.writeFileSync('studio.html', c, 'utf8');
  console.log('Successfully injected into studio.html');
} else {
  console.log('Already present in studio.html');
}
