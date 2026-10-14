const fs = require('fs');
const filePath = '_next/static/chunks/055oo67r3vcom.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Export button visibility
const targetBtn = 'className:"h-11 w-11 rounded-lg px-0 shadow-[0_10px_24px_-12px_rgba(79,70,229,0.85)] sm:h-9 sm:w-auto sm:px-3",children:(0,o.jsxs)("span",{className:"inline-flex items-center gap-2",children:[(0,o.jsx)(ev.IconDownload,{size:15}),(0,o.jsx)("span",{className:"hidden sm:inline",children:l?P:"Export"})]})';

const replBtn = 'className:"h-9 min-w-[84px] rounded-lg px-3 shadow-[0_10px_24px_-12px_rgba(79,70,229,0.85)] bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold text-xs transition-all",children:(0,o.jsxs)("span",{className:"inline-flex items-center gap-1.5",children:[(0,o.jsx)(ev.IconDownload,{size:15}),(0,o.jsx)("span",{className:"inline font-bold tracking-wide",children:l?P:"Export"})]})';

if (!content.includes(targetBtn)) {
  console.error('targetBtn not found!');
  process.exit(1);
}
content = content.replace(targetBtn, replBtn);

// 2. Export handler e8
const targetE8 = 'e8=(0,r.useCallback)(()=>{!G||(N(!!_,G,e9)?e6(e=>e+1):lU(G.id)||e2(!0))},[_,e9,G,e2])';
const replE8 = 'e8=(0,r.useCallback)(()=>{if(typeof window!=="undefined"&&window.__openExportSection){window.__openExportSection();}else if(G){e2(!0);}},[G,e2]);if(typeof window!=="undefined"){window.__setExportOpen=e2;}';

if (!content.includes(targetE8)) {
  console.error('targetE8 not found!');
  process.exit(1);
}
content = content.replace(targetE8, replE8);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched 055oo67r3vcom.js with visible Export button & open handlers!');
