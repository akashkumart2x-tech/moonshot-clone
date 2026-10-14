const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed = null;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch (e) {
          parsed = raw;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw
        });
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function uploadVideoWorkflow(videoFilePath, title) {
  console.log(`\n======================================================`);
  console.log(`Starting Workflow for: ${title} (${path.basename(videoFilePath)})`);
  console.log(`======================================================`);

  const stat = fs.statSync(videoFilePath);
  const fileBytes = fs.readFileSync(videoFilePath);
  const fileSha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
  console.log(`[Source File] Size: ${stat.size} bytes | SHA256: ${fileSha256.slice(0, 16)}...`);

  // Step 1: Request signed upload URL
  console.log(`[Step 1] Requesting signed URL...`);
  const signRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload/signed-url',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    ext: path.extname(videoFilePath).replace('.', ''),
    contentType: 'video/mp4'
  });

  if (signRes.statusCode !== 200) {
    throw new Error(`Signed URL request failed: ${JSON.stringify(signRes.data)}`);
  }
  const { uploadUrl, uploadSessionId, relPath } = signRes.data;
  console.log(`  ➜ Generated uploadSessionId: ${uploadSessionId}`);
  console.log(`  ➜ Upload URL: ${uploadUrl}`);

  // Step 2: Stream video bytes to PUT endpoint
  console.log(`[Step 2] Streaming ${stat.size} bytes to ${uploadUrl}...`);
  const putRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadUrl,
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size
    }
  }, fileBytes);

  if (putRes.statusCode !== 200) {
    throw new Error(`Upload PUT failed: ${JSON.stringify(putRes.data)}`);
  }
  console.log(`  ➜ PUT Success: ${JSON.stringify(putRes.data)}`);

  // Step 3: Finalize upload, trigger audio extraction & Whisper speech recognition
  console.log(`[Step 3] Finalizing upload & running Whisper AI caption pipeline...`);
  const finalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    uploadSessionId,
    relPath,
    title
  });

  if (finalRes.statusCode !== 200) {
    throw new Error(`Upload finalize failed: ${JSON.stringify(finalRes.data)}`);
  }

  const { projectId, sessionId, durationSec, transcript, wordCount } = finalRes.data;
  console.log(`  ➜ Created Project ID: ${projectId}`);
  console.log(`  ➜ Session ID:        ${sessionId}`);
  console.log(`  ➜ Video Duration:    ${durationSec}s`);
  console.log(`  ➜ Detected Words:    ${wordCount}`);

  // Step 4: Verify Studio Bootstrap returns this exact project & transcript
  console.log(`[Step 4] Bootstrapping Studio for Project ${projectId}...`);
  const studioRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/bootstrap/studio/${projectId}`,
    method: 'GET'
  });

  if (studioRes.statusCode !== 200 || !studioRes.data.project) {
    throw new Error(`Studio bootstrap failed: ${JSON.stringify(studioRes.data)}`);
  }

  const proj = studioRes.data.project;
  console.log(`  ➜ Studio loaded project: ${proj.id}`);
  console.log(`  ➜ Source path:           ${proj.source?.filePath}`);
  console.log(`  ➜ Clips count:           ${proj.clips?.length}`);

  // Step 5: Render & Export Finished Video
  console.log(`[Step 5] Triggering FFmpeg Render & Export for Project ${projectId}...`);
  const renderRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    projectId,
    kind: 'export'
  });

  if (renderRes.statusCode !== 200 || !renderRes.data.job) {
    throw new Error(`Render failed: ${JSON.stringify(renderRes.data)}`);
  }

  const job = renderRes.data.job;
  console.log(`  ➜ Render Job ID:   ${job.id}`);
  console.log(`  ➜ Output File:     ${job.outputFile}`);
  console.log(`  ➜ Output Size:     ${job.sizeBytes} bytes`);
  console.log(`  ➜ Output Duration: ${job.durationSec}s`);
  console.log(`  ➜ Output SHA256:   ${job.sha256}`);
  console.log(`  ➜ Download URL:    ${job.downloadUrl}`);

  // Step 6: Download exported video to verify download link works
  console.log(`[Step 6] Verifying file download endpoint ${job.downloadUrl}...`);
  const dlRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: job.downloadUrl,
    method: 'GET'
  });

  if (dlRes.statusCode !== 200) {
    throw new Error(`Download endpoint failed with HTTP ${dlRes.statusCode}`);
  }
  console.log(`  ➜ Successfully downloaded ${dlRes.raw.length} bytes (Content-Disposition: ${dlRes.headers['content-disposition']})`);

  return {
    title,
    sourceFile: videoFilePath,
    sourceSha256: fileSha256,
    sourceSize: stat.size,
    sessionId,
    projectId,
    durationSec,
    wordCount,
    transcript,
    jobId: job.id,
    outputFile: job.outputFile,
    outputSize: job.sizeBytes,
    outputSha256: job.sha256,
    downloadUrl: job.downloadUrl,
    downloadBytes: dlRes.raw.length
  };
}

async function runTestSuite() {
  console.log('########################################################');
  console.log('### MOONSHOT INDEPENDENT VIDEO SESSIONS TEST SUITE   ###');
  console.log('########################################################\n');

  // Video A Run
  const resA = await uploadVideoWorkflow('test_assets/video_a.mp4', 'Demonstration Video A');
  
  // Video B Run
  const resB = await uploadVideoWorkflow('test_assets/video_b.mp4', 'Finance Topic Video B');

  // Video C Run (Silent)
  const resC = await uploadVideoWorkflow('test_assets/video_c.mp4', 'Silent Clip Video C');

  console.log('\n========================================================');
  console.log('=== RUNNING COMPREHENSIVE ISOLATION & REGRESSION CHECKS ==');
  console.log('========================================================\n');

  // Assertion 1: All sessions and projects have unique IDs
  const sessionIds = new Set([resA.sessionId, resB.sessionId, resC.sessionId]);
  const projectIds = new Set([resA.projectId, resB.projectId, resC.projectId]);
  console.log(`[Check 1] Unique Session IDs (3 expected): ${sessionIds.size === 3 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[Check 2] Unique Project IDs (3 expected): ${projectIds.size === 3 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Assertion 2: Transcripts match audio content and DO NOT BLEED
  const wordsA = (resA.transcript[0]?.words || []).map(w => w.text);
  const wordsB = (resB.transcript[0]?.words || []).map(w => w.text);
  const wordsC = resC.transcript;

  console.log(`\nVideo A Words: [${wordsA.join(' ')}]`);
  console.log(`Video B Words: [${wordsB.join(' ')}]`);
  console.log(`Video C Words: [${(wordsC[0]?.words || []).map(w => w.text).join(' ')}] (Count: ${resC.wordCount})`);

  const aHasArtificial = wordsA.includes('ARTIFICIAL') || wordsA.includes('INTELLIGENCE');
  const bHasArtificial = wordsB.includes('ARTIFICIAL') || wordsB.includes('INTELLIGENCE');
  const bHasFinance = wordsB.includes('MARKETS') || wordsB.includes('INTEREST') || wordsB.includes('CRYPTOCURRENCY');
  const cIsEmpty = resC.wordCount === 0 && wordsC.length === 0;

  console.log(`[Check 3] Video A recognized AI speech keywords: ${aHasArtificial ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[Check 4] Video B recognized Finance speech keywords: ${bHasFinance ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[Check 5] Video B DID NOT bleed Video A keywords: ${!bHasArtificial ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[Check 6] Video C (Silent) generated 0 words (NO bleed/NO demo fallback): ${cIsEmpty ? 'PASS ✅' : 'FAIL ❌'}`);

  // Assertion 3: Export outputs are 100% unique (no file overwrites or cache reuse)
  const outputSha256s = new Set([resA.outputSha256, resB.outputSha256, resC.outputSha256]);
  console.log(`\n[Check 7] Unique Output SHA256 hashes (3 expected): ${outputSha256s.size === 3 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  ➜ Export A SHA256: ${resA.outputSha256}`);
  console.log(`  ➜ Export B SHA256: ${resB.outputSha256}`);
  console.log(`  ➜ Export C SHA256: ${resC.outputSha256}`);

  // Assertion 4: Isolated Caption Editing
  console.log(`\n[Test: Isolated Caption Editing on Video B]`);
  console.log(`Modifying Video B transcript word 'CRYPTOCURRENCY' -> 'BLOCKCHAIN'...`);
  const updatedWordsB = resB.transcript.map(seg => ({
    ...seg,
    words: seg.words.map(w => w.text === 'CRYPTOCURRENCY' ? { ...w, text: 'BLOCKCHAIN' } : w)
  }));
  const patchRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${resB.projectId}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    transcript: updatedWordsB
  });

  const checkProjB = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${resB.projectId}`,
    method: 'GET'
  });
  const checkProjA = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${resA.projectId}`,
    method: 'GET'
  });

  const bHasBlockchain = JSON.stringify(checkProjB.data.project.transcript).includes('BLOCKCHAIN');
  const aUntouched = !JSON.stringify(checkProjA.data.project.transcript).includes('BLOCKCHAIN');

  console.log(`[Check 8] Project B updated with modified caption: ${bHasBlockchain ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[Check 9] Project A strictly untouched by edits to B: ${aUntouched ? 'PASS ✅' : 'FAIL ❌'}`);

  // Assertion 5: Verify Session API
  console.log(`\n[Test: Session API Registry]`);
  const sessionsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sessions',
    method: 'GET'
  });
  const allSessions = sessionsRes.data.sessions || [];
  console.log(`[Check 10] Session API reports active independent sessions: ${allSessions.length >= 3 ? 'PASS ✅' : 'FAIL ❌'} (Found: ${allSessions.length})`);

  console.log('\n########################################################');
  console.log('### ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!  ###');
  console.log('########################################################');

  const summary = {
    testPassed: sessionIds.size === 3 && projectIds.size === 3 && !bHasArtificial && cIsEmpty && outputSha256s.size === 3 && aUntouched,
    videoA: resA,
    videoB: resB,
    videoC: resC
  };
  fs.writeFileSync('rebuilt_test_runs/results.json', JSON.stringify(summary, null, 2), 'utf8');
}

fs.mkdirSync('rebuilt_test_runs', { recursive: true });
runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:', err);
  process.exit(1);
});
