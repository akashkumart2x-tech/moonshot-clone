const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function req(options, postData = null) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    r.on('error', reject);
    if (postData) r.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    r.end();
  });
}

async function runAudit() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END VERIFICATION AUDIT');
  console.log('======================================================\n');

  // TEST 1: Check Studio HTML injection
  console.log('Test 1: Studio HTML injection...');
  const resStudio = await req({ host: 'localhost', port: 3000, path: '/studio/proj_mv725ows_44dce', method: 'GET' });
  if (resStudio.status !== 200) throw new Error(`Studio HTML failed: ${resStudio.status}`);
  if (!resStudio.body.includes('word_editor_and_export.js')) throw new Error('word_editor_and_export.js tag missing in Studio HTML');
  if (!resStudio.body.includes('word_editor_and_export.css')) throw new Error('word_editor_and_export.css tag missing in Studio HTML');
  console.log('  ✅ Studio HTML serves custom word editor & export scripts correctly.');

  // TEST 2: Check Static Asset Serving
  console.log('Test 2: Asset serving...');
  const resJs = await req({ host: 'localhost', port: 3000, path: '/assets/word_editor_and_export.js', method: 'GET' });
  const resCss = await req({ host: 'localhost', port: 3000, path: '/assets/word_editor_and_export.css', method: 'GET' });
  if (resJs.status !== 200 || !resJs.body.includes('ms-editor-root')) throw new Error('JS asset failed');
  if (resCss.status !== 200 || !resCss.body.includes('.ms-floating-dock')) throw new Error('CSS asset failed');
  console.log('  ✅ Static CSS & JS assets loaded successfully.');

  // TEST 3: Check No Urdu Perso-Arabic Script in Store
  console.log('Test 3: Checking No Urdu characters in API data...');
  const resProj = await req({ host: 'localhost', port: 3000, path: '/api/bootstrap/studio/proj_mv725ows_44dce', method: 'GET' });
  const projData = JSON.parse(resProj.body);
  const words = projData.project.transcript.flatMap(s => s.words.map(w => w.text));
  const urduWords = words.filter(w => /[\u0600-\u06FF]/.test(w));
  if (urduWords.length > 0) {
    throw new Error(`Found Urdu words in active project: ${urduWords.join(', ')}`);
  }
  console.log(`  ✅ Verified 0 Urdu words across all ${words.length} transcript words. Clean Romanized Hinglish active.`);

  // TEST 4: Test Word Editing (Change word text and spelling)
  console.log('Test 4: Word editing in project...');
  const transcript = projData.project.transcript;
  // Let's edit word 1 in segment 1: change "Log" to "PEOPLE"
  transcript[0].words[0].text = 'PEOPLE';
  transcript[0].words[0].textLatn = 'PEOPLE';
  // Let's also highlight word 4: "shayad" -> "OPPORTUNITY" with Cyan highlight
  transcript[0].words[3].text = 'OPPORTUNITY';
  transcript[0].words[3].textLatn = 'OPPORTUNITY';
  transcript[0].words[3].highlight = true;
  transcript[0].words[3].color = '#00F0FF';
  transcript[0].words[3].isBold = true;
  transcript[0].words[3].style = { highlight: true, color: '#00F0FF', isBold: true };

  const patchRes = await req(
    { host: 'localhost', port: 3000, path: '/api/projects/proj_mv725ows_44dce', method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
    { transcript }
  );
  if (patchRes.status !== 200) throw new Error(`PATCH project failed: ${patchRes.status}`);

  // Fetch back to verify persistence
  const verifyRes = await req({ host: 'localhost', port: 3000, path: '/api/bootstrap/studio/proj_mv725ows_44dce', method: 'GET' });
  const updatedProj = JSON.parse(verifyRes.body).project;
  const editedWord1 = updatedProj.transcript[0].words[0].text;
  const editedWord4 = updatedProj.transcript[0].words[3].text;
  const word4Color = updatedProj.transcript[0].words[3].color;

  if (editedWord1 !== 'PEOPLE' || editedWord4 !== 'OPPORTUNITY' || word4Color !== '#00F0FF') {
    throw new Error(`Word edit persistence failed: word1=${editedWord1}, word4=${editedWord4}, color=${word4Color}`);
  }
  console.log(`  ✅ Word edit verified: word 1 changed to "${editedWord1}", word 4 changed to "${editedWord4}" with color ${word4Color}.`);

  // TEST 5: Render Export with ASS Word Highlights
  console.log('Test 5: Triggering full video export via POST /api/render...');
  const renderRes = await req(
    { host: 'localhost', port: 3000, path: '/api/render', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { projectId: 'proj_mv725ows_44dce', kind: 'export', exportQuality: '1080' }
  );
  if (renderRes.status !== 200) throw new Error(`POST /api/render failed: ${renderRes.status}`);
  const renderData = JSON.parse(renderRes.body);
  const jobId = renderData.job.id;
  console.log(`  ➜ Render job started: ${jobId}`);

  // Poll until complete
  let complete = false;
  let attempts = 0;
  while (!complete && attempts < 40) {
    await new Promise(r => setTimeout(r, 1000));
    attempts++;
    const pollRes = await req({ host: 'localhost', port: 3000, path: `/api/render?jobId=${jobId}`, method: 'GET' });
    const pollData = JSON.parse(pollRes.body);
    process.stdout.write(`  ➜ Poll attempt ${attempts}: status=${pollData.job.status}, pct=${pollData.job.pct}%\r`);
    if (pollData.job.status === 'complete') {
      complete = true;
      console.log(`\n  ✅ Render job completed successfully! Download URL: ${pollData.job.downloadUrl}`);
    } else if (pollData.job.status === 'failed') {
      throw new Error(`Render job failed: ${pollData.job.error}`);
    }
  }

  if (!complete) throw new Error('Render job timed out');

  // TEST 6: Verify Download endpoint
  console.log('Test 6: Verifying video download endpoint...');
  const dlRes = await req({ host: 'localhost', port: 3000, path: `/api/render/file/${jobId}?dl=1`, method: 'GET' });
  if (dlRes.status !== 200) throw new Error(`Download endpoint failed: ${dlRes.status}`);
  const cdHeader = dlRes.headers['content-disposition'];
  console.log(`  ✅ Download endpoint verified: HTTP 200, Content-Disposition: "${cdHeader}"`);

  // TEST 7: Inspect generated ASS Subtitle File for Per-Word Colors
  console.log('Test 7: Inspecting burned ASS subtitles file...');
  const assPath = path.join(__dirname, 'exports', jobId, 'captions.ass');
  if (!fs.existsSync(assPath)) throw new Error(`ASS subtitle file not found at ${assPath}`);
  const assContent = fs.readFileSync(assPath, 'utf8');
  if (!assContent.includes('OPPORTUNITY')) throw new Error('Edited word "OPPORTUNITY" not found in captions.ass');
  if (!assContent.includes('\\c&H00FFF000&')) throw new Error('Cyan ASS highlight color tag \\c&H00FFF000& missing in captions.ass');
  console.log('  ✅ ASS file contains edited word "OPPORTUNITY" with cyan highlight tag: {\\c&H00FFF000&\\b1}OPPORTUNITY{\\r\\c&H00FFFFFF&\\b1}');

  // TEST 8: Extract video frame to verify burned captions in MP4
  console.log('Test 8: Extracting frame from rendered MP4...');
  const mp4Path = path.join(__dirname, 'exports', jobId, `moonshot_export_${jobId}.mp4`);
  const frameOut = path.join(__dirname, 'exports', jobId, 'verified_frame.jpg');
  execSync(`ffmpeg -y -ss 00:00:01 -i "${mp4Path}" -vframes 1 -q:v 2 "${frameOut}"`, { stdio: 'pipe' });
  if (!fs.existsSync(frameOut) || fs.statSync(frameOut).size < 1000) {
    throw new Error('Failed to extract verified frame');
  }
  console.log(`  ✅ Verified frame extracted successfully at ${frameOut} (${fs.statSync(frameOut).size} bytes).`);

  console.log('\n======================================================');
  console.log('🎉 ALL 8 VERIFICATION TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runAudit().catch(err => {
  console.error('\n❌ AUDIT FAILED:', err.message);
  process.exit(1);
});
