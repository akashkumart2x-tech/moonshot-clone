const fs = require('fs');
const path = require('path');
const vp = require('./video_processor');

const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));
const proj = store.projects['proj_mv725ows_44dce'];

console.log('Project title:', proj.title);
console.log('Transcript length:', proj.transcript.length);
console.log('First segment words:', proj.transcript[0].words);

const outDir = path.join(__dirname, 'exports', 'test_proj_render');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const testOut = path.join(outDir, 'output_test.mp4');
console.log('Rendering 8 seconds test with ASS highlights...');

// Trim 8 seconds of source for instant test
const { execSync } = require('child_process');
const trimSource = path.join(outDir, 'trim_source.mp4');
execSync(`ffmpeg -y -i "${proj.source.filePath}" -t 8 -c copy "${trimSource}"`, { stdio: 'pipe' });

const res = vp.renderExportVideo(trimSource, proj, testOut);
console.log('Render complete! Result:', res);

// Extract frame at 3s to inspect highlight
const framePath = path.join(outDir, 'test_frame.jpg');
execSync(`ffmpeg -y -ss 00:00:03 -i "${testOut}" -vframes 1 -q:v 2 "${framePath}"`, { stdio: 'pipe' });
console.log('Frame extracted at:', framePath);
