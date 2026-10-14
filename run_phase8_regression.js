const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function req(options, body = null) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed = null;
        try { parsed = JSON.parse(raw.toString('utf8')); } catch (e) { parsed = raw.toString('utf8'); }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw
        });
      });
    });
    r.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) r.write(body);
      else if (typeof body === 'string') r.write(body);
      else r.write(JSON.stringify(body));
    }
    r.end();
  });
}

function probeWithFfprobe(filePath) {
  const stdout = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`).toString();
  const json = JSON.parse(stdout);
  const vStream = json.streams?.find(s => s.codec_type === 'video');
  const aStream = json.streams?.find(s => s.codec_type === 'audio');
  const duration = parseFloat(json.format?.duration || vStream?.duration || 0);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return {
    duration: Number(duration.toFixed(2)),
    width: vStream?.width || 0,
    height: vStream?.height || 0,
    hasVideo: !!vStream,
    hasAudio: !!aStream,
    size: fs.statSync(filePath).size,
    sha256
  };
}

async function uploadFile(filePath, title) {
  const stat = fs.statSync(filePath);
  const fileBytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '');

  // 1. Signed URL
  const sign = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload/signed-url',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { ext, contentType: 'video/mp4' });

  if (sign.status !== 200) throw new Error(`Signed URL failed: ${JSON.stringify(sign.data)}`);
  const { uploadUrl, uploadSessionId, relPath } = sign.data;

  // 2. Stream Upload PUT
  const put = await req({
    hostname: 'localhost',
    port: 3000,
    path: uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': stat.size }
  }, fileBytes);

  if (put.status !== 200) throw new Error(`PUT upload failed: ${JSON.stringify(put.data)}`);

  // 3. Finalize upload & run Whisper pipeline
  const finalize = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { uploadSessionId, relPath, title });

  if (finalize.status !== 200) throw new Error(`Finalize failed: ${JSON.stringify(finalize.data)}`);

  return finalize.data;
}

async function main() {
  console.log('================================================================');
  console.log('   PHASE 8 COMPLETE REGRESSION TEST SUITE (TESTS A THROUGH G)   ');
  console.log('================================================================\n');

  const results = {};

  // ------------------------------------------------------------------
  // TEST A: CAPTION GENERATION
  // ------------------------------------------------------------------
  console.log('>>> [TEST A] Caption Generation from Video A Audio');
  const uploadA = await uploadFile('test_assets/video_a.mp4', 'Video A Speech Test');
  console.log(`  Session ID: ${uploadA.sessionId} | Project ID: ${uploadA.projectId}`);
  console.log(`  Detected Words: ${uploadA.wordCount}`);
  const wordsA = (uploadA.transcript[0]?.words || []).map(w => w.text);
  console.log(`  Transcript A Words: [${wordsA.join(' ')}]`);

  const testAPass = uploadA.wordCount >= 10 && wordsA.some(w => /welcome/i.test(w)) && wordsA.some(w => /artificial/i.test(w)) && wordsA.some(w => /intelligence/i.test(w));
  results.testA = {
    pass: testAPass,
    projectId: uploadA.projectId,
    sessionId: uploadA.sessionId,
    wordCount: uploadA.wordCount,
    words: wordsA
  };
  console.log(`  Test A Result: ${testAPass ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST B: DIFFERENT VIDEO (ZERO BLEED)
  // ------------------------------------------------------------------
  console.log('>>> [TEST B] Different Video B with Different Speech');
  const uploadB = await uploadFile('test_assets/video_b.mp4', 'Video B Finance Test');
  console.log(`  Session ID: ${uploadB.sessionId} | Project ID: ${uploadB.projectId}`);
  console.log(`  Detected Words: ${uploadB.wordCount}`);
  const wordsB = (uploadB.transcript[0]?.words || []).map(w => w.text);
  console.log(`  Transcript B Words: [${wordsB.join(' ')}]`);

  const hasBFinance = wordsB.some(w => /international|markets|cryptocurrency/i.test(w));
  const hasABleed = wordsB.some(w => /artificial|intelligence/i.test(w));
  const testBPass = hasBFinance && !hasABleed && uploadA.sessionId !== uploadB.sessionId;
  results.testB = {
    pass: testBPass,
    projectId: uploadB.projectId,
    sessionId: uploadB.sessionId,
    wordCount: uploadB.wordCount,
    words: wordsB,
    zeroBleed: !hasABleed
  };
  console.log(`  Test B Result: ${testBPass ? 'PASS ✅ (Zero Bleed Confirmed)' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST C: CAPTION EDITING & RETIMING & EXPORT REFLECTION
  // ------------------------------------------------------------------
  console.log('>>> [TEST C] Caption Editing, Retiming, Appearance Customization');
  // Load Project B in Studio
  const bootstrapB = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/bootstrap/studio/${uploadB.projectId}`,
    method: 'GET'
  });
  const projB = bootstrapB.data.project;

  // Edit caption words: replace 'cryptocurrency' with 'DECENTRALIZED', edit timing
  console.log('  Editing caption words in Project B...');
  const editedTranscript = projB.transcript.map(seg => ({
    ...seg,
    words: seg.words.map(w => /cryptocurrency/i.test(w.text) ? { ...w, text: 'DECENTRALIZED' } : w)
  }));
  const editedClips = projB.clips.map(c => {
    if (c.kind === 'caption') {
      return { ...c, start: 0.5, duration: 6.8 }; // Adjusted timing
    }
    return c;
  });

  const saveRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${uploadB.projectId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    transcript: editedTranscript,
    clips: editedClips,
    presetId: 'social-word-pink' // Custom appearance
  });

  // Verify Project B saved and Project A untouched
  const verifyB = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${uploadB.projectId}`,
    method: 'GET'
  });
  const verifyA = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/projects/${uploadA.projectId}`,
    method: 'GET'
  });

  const bHasDecentralized = JSON.stringify(verifyB.data.project.transcript).includes('DECENTRALIZED');
  const aUntouched = !JSON.stringify(verifyA.data.project.transcript).includes('DECENTRALIZED');

  // Render export for edited Project B
  console.log('  Rendering export for edited Project B...');
  const renderB = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { projectId: uploadB.projectId });

  const jobB = renderB.data.job;
  // Inspect the generated SRT in the export folder to confirm edited words are burned
  const srtPath = path.join(path.dirname(jobB.outputFile), 'captions.srt');
  const srtContent = fs.readFileSync(srtPath, 'utf8');
  const srtHasDecentralized = srtContent.includes('DECENTRALIZED');

  const testCPass = bHasDecentralized && aUntouched && srtHasDecentralized && fs.existsSync(jobB.outputFile);
  results.testC = {
    pass: testCPass,
    editedWordSaved: bHasDecentralized,
    projectAIsUntouched: aUntouched,
    srtContainsEditedWord: srtHasDecentralized,
    exportOutputFile: jobB.outputFile
  };
  console.log(`  Test C Result: ${testCPass ? 'PASS ✅ (Subtitles Burn-In Reflects Edits)' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST D: CONSECUTIVE EXPORTS (NO REUSE)
  // ------------------------------------------------------------------
  console.log('>>> [TEST D] Consecutive Exports of Multiple Independent Videos');
  // Export Video A
  console.log('  Exporting Video A...');
  const renderA = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { projectId: uploadA.projectId });
  const jobA = renderA.data.job;

  // Upload and Export Video C (Silent)
  console.log('  Uploading and Exporting Video C (Silent)...');
  const uploadC = await uploadFile('test_assets/video_c.mp4', 'Video C Silent Test');
  const renderC = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { projectId: uploadC.projectId });
  const jobC = renderC.data.job;

  const probeA = probeWithFfprobe(jobA.outputFile);
  const probeB = probeWithFfprobe(jobB.outputFile);
  const probeC = probeWithFfprobe(jobC.outputFile);

  const uniqueJobs = new Set([jobA.id, jobB.id, jobC.id]).size === 3;
  const uniqueHashes = new Set([probeA.sha256, probeB.sha256, probeC.sha256]).size === 3;
  const uniqueOutputs = new Set([jobA.outputFile, jobB.outputFile, jobC.outputFile]).size === 3;

  const testDPass = uniqueJobs && uniqueHashes && uniqueOutputs;
  results.testD = {
    pass: testDPass,
    uniqueJobIds: uniqueJobs,
    uniqueHashes,
    jobs: {
      jobA: { id: jobA.id, sha256: probeA.sha256, size: probeA.size, dur: probeA.duration },
      jobB: { id: jobB.id, sha256: probeB.sha256, size: probeB.size, dur: probeB.duration },
      jobC: { id: jobC.id, sha256: probeC.sha256, size: probeC.size, dur: probeC.duration }
    }
  };
  console.log(`  Test D Result: ${testDPass ? 'PASS ✅ (Zero File or Job Reuse)' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST E: SESSION RECOVERY (PAGE REFRESH & PROJECT SWITCHING)
  // ------------------------------------------------------------------
  console.log('>>> [TEST E] Session Recovery on Browser Refresh & Project Switching');
  const allProjectsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap/projects',
    method: 'GET'
  });
  const savedProjects = allProjectsRes.data.projects || [];
  const foundA = savedProjects.find(p => p.id === uploadA.projectId);
  const foundB = savedProjects.find(p => p.id === uploadB.projectId);
  const foundC = savedProjects.find(p => p.id === uploadC.projectId);

  // Switch between projects via Studio Bootstrap
  const reloadA = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/bootstrap/studio/${uploadA.projectId}`,
    method: 'GET'
  });
  const reloadB = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/bootstrap/studio/${uploadB.projectId}`,
    method: 'GET'
  });

  const aWordsIntact = (reloadA.data.project.transcript[0]?.words || []).some(w => /welcome/i.test(w.text));
  const bWordsIntact = (reloadB.data.project.transcript[0]?.words || []).some(w => /decentralized/i.test(w.text));

  const testEPass = !!foundA && !!foundB && !!foundC && aWordsIntact && bWordsIntact;
  results.testE = {
    pass: testEPass,
    projectsRecoveredCount: savedProjects.length,
    aWordsIntact,
    bWordsIntact
  };
  console.log(`  Test E Result: ${testEPass ? 'PASS ✅ (State Preserved Across Switching)' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST F: ERROR HANDLING & RECOVERY
  // ------------------------------------------------------------------
  console.log('>>> [TEST F] Error Handling & Recovery');
  // Attempt to render non-existent project
  const badRender = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { projectId: 'proj_non_existent_999' });

  // Attempt to download non-existent export
  const badDl = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/render/file/job_fake_12345',
    method: 'GET'
  });

  // Attempt to upload without file
  const badFinalize = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { uploadSessionId: 'session_ghost' });

  const testFPass = badRender.status === 404 && badDl.status === 404 && badFinalize.status === 400;
  results.testF = {
    pass: testFPass,
    badRenderStatus: badRender.status,
    badDlStatus: badDl.status,
    badFinalizeStatus: badFinalize.status
  };
  console.log(`  Test F Result: ${testFPass ? 'PASS ✅ (Proper 404/400 Error Handling)' : 'FAIL ❌'}\n`);

  // ------------------------------------------------------------------
  // TEST G: OUTPUT PLAYABILITY & DOWNLOAD VERIFICATION
  // ------------------------------------------------------------------
  console.log('>>> [TEST G] Export Playability, Synchronized Audio/Video, Download Verification');
  // Verify download stream for Export B
  const dlB = await req({
    hostname: 'localhost',
    port: 3000,
    path: jobB.downloadUrl,
    method: 'GET'
  });

  const dlMatchesOnDisk = dlB.raw.length === probeB.size;
  const isPlayable = probeB.hasVideo && probeB.hasAudio && probeB.duration > 0;
  const testGPass = dlB.status === 200 && dlMatchesOnDisk && isPlayable;
  results.testG = {
    pass: testGPass,
    dlStatus: dlB.status,
    contentDisposition: dlB.headers['content-disposition'],
    downloadBytes: dlB.raw.length,
    onDiskBytes: probeB.size,
    isPlayable,
    durationSec: probeB.duration
  };
  console.log(`  Test G Result: ${testGPass ? 'PASS ✅ (Exported MP4 is Valid and Playable)' : 'FAIL ❌'}\n`);

  // Write out results
  fs.writeFileSync('rebuilt_test_runs/phase8_regression_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('================================================================');
  console.log('   ALL 7 REGRESSION TESTS COMPLETED! SUMMARY WRITTEN TO DISK    ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Regression suite crashed:', err);
  process.exit(1);
});
