const fs = require('fs');

const studioChunks = [
  '29vpa5uyjd0dx.js', '00q0ixrif1u4l.js', '2aia9alvl-6m_.js', '1nt832golrwbo.js',
  '1up-v9eizj_lf.js', '246_cqkrj0tnk.js', '0abp1l-nb3v1s.js', '0zteezvoi0fld.js',
  '0zq31vk-615cm.js', '3hc0ua5mdrntj.js', '0rud2853acr80.js', '055oo67r3vcom.js',
  '25vcslh0ddtnv.js', '1ilw-h9w_p26i.js', '2303t7zuylyt-.js', '3epy2o43c2g1y.js',
  '3w3dbcb5vpg0b.js'
];

console.log('=== AUDITING STUDIOSHELL API CALLS & CONTRACTS ===');

const apiEndpoints = new Set();
for (const chunk of studioChunks) {
  const p = '_next/static/chunks/' + chunk;
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');

  // Match /api/... strings
  const matches = content.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || [];
  matches.forEach(m => apiEndpoints.add(m));
}

console.log('API Endpoints referenced by Studio:');
Array.from(apiEndpoints).sort().forEach(ep => console.log(`  ${ep}`));
