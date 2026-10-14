const fs = require('fs');
const filePath = '_next/static/chunks/3vm-xt69rdwro.js';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = 'ta=(0,S.create)(to);';
const repl1 = 'ta=(0,S.create)(to);if(typeof window!=="undefined"){window.__useEditor=ta;}';

if (!content.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}

content = content.replace(target1, repl1);

const target2 = 'updateWordText:(t,e)=>S(i=>{if(!i.project)return i;let r="roman"===(0,C.effectiveCaptionScript)(i.project),n=i.project.transcript.map(i=>({...i,words:i.words.map(i=>{if(i.id!==t)return i;if(!r){let{textLatn:t,...r}=i;return{...r,text:e}}return null!=i.textLatn?{...i,textLatn:e}:{...i,text:e}})}));return{...tn(i),project:{...i.project,transcript:n}}})';
const repl2 = 'updateWordText:(t,e)=>S(i=>{if(!i.project)return i;let n=i.project.transcript.map(i=>({...i,words:i.words.map(i=>{if(i.id!==t)return i;return{...i,text:e,textLatn:e}})}));return{...tn(i),project:{...i.project,transcript:n}}})';

if (!content.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}

content = content.replace(target2, repl2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched 3vm-xt69rdwro.js with window.__useEditor and dual-text update!');
