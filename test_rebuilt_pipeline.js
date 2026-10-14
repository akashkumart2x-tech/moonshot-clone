const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const vp = require('./video_processor');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'rebuilt_test_runs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(data);
    const u = new URL(urlPath, BASE_URL);
    const req = http.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: chunks });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function putFile(urlPath, filePath) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const u = new URL(urlPath, BASE_URL);
    const req = http.request(u, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: chunks });
        }
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE_URL);
    const req = http.request(u, { method: 'GET' }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: chunks });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function downloadFile(urlPath, destPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE_URL);
    const file = fs.createWriteStream(destPath);
    const req = http.request(u, { method: 'GET' }, res => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve({ status: res.statusCode, headers: res.headers, size: fs.statSync(destPath).size }));
      });
    });
    req.on('error', err => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
    req.end();
  });
}

async function runMoonshotUploadPipeline(label, filePath, title) {
  console.log(`\n======================================================`);
  console.log(`[TEST ${label}] Processing: ${path.basename(filePath)}`);
  console.log(`======================================================`);

  const stat = fs.statSync(filePath);
  const inputProbe = vp.probeVideo(filePath);
  console.log(`[TEST ${label}] Source Metadata:`, {
    size: stat.size,
    duration: inputProbe.duration,
    res: `${inputProbe.width}x${inputProbe.height}`,
    sha256: inputProbe.sha256.slice(0, 16) + '...'
  });

  // Step 1: POST /api/upload/mpu (confirm it returns 501 fallback cleanly)
  const mpuRes = await postJson('/api/upload/mpu', { action: 'create', sizeBytes: stat.size });
  if (mpuRes.status !== 501) throw new Error(`Expected MPU 501 fallback, got ${mpuRes.status}`);
  console.log(`[TEST ${label}] 1. /api/upload/mpu correctly triggered 501 fallback`);

  // Step 2: POST /api/upload/signed-url
  const signedRes = await postJson('/api/upload/signed-url', {
    contentType: 'video/mp4',
    ext: 'mp4',
    sizeBytes: stat.size,
    lane: 'editor'
  });
  if (signedRes.status !== 200) throw new Error(`Signed URL failed: ${JSON.stringify(signedRes)}`);
  const { uploadUrl, relPath, uploadSessionId } = signedRes.body;
  console.log(`[TEST ${label}] 2. Signed URL generated:`, { uploadSessionId, uploadUrl, relPath });

  // Step 3: PUT /api/upload/put-file
  console.log(`[TEST ${label}] 3. Streaming bytes via PUT...`);
  const putStart = Date.now();
  const putRes = await putFile(uploadUrl, filePath);
  const putDuration = Date.now() - putStart;
  if (putRes.status !== 200) throw new Error(`PUT upload failed: ${JSON.stringify(putRes)}`);
  console.log(`[TEST ${label}] -> PUT acknowledged immediately in ${putDuration}ms:`, putRes.body);

  // Step 4: POST /api/upload (The EXACT JSON finalization called by Moonshot's R() in 3r6q7ncknmjs6.js)
  console.log(`[TEST ${label}] 4. Calling POST /api/upload (JSON finalize contract)...`);
  const finalizeRes = await postJson('/api/upload', {
    relPath,
    durationSec: inputProbe.duration,
    width: inputProbe.width,
    height: inputProbe.height,
    title,
    transport: 'gcs_single',
    uploadSessionId,
    uploadMetrics: { uploadClientMs: putDuration },
    sizeBytes: stat.size,
    posterDataUrl: 'data:image/jpeg;base64,/9j/test'
  });
  if (finalizeRes.status !== 200) throw new Error(`JSON finalize failed: ${JSON.stringify(finalizeRes)}`);
  const { projectId, durationSec, mediaKind, relPath: previewUrl } = finalizeRes.body;
  console.log(`[TEST ${label}] -> Upload Finalized Successfully:`, { projectId, durationSec, mediaKind, previewUrl });

  // Step 5: POST /api/generate (called when user clicks 'Create Video' in Moonshot homepage)
  console.log(`[TEST ${label}] 5. Calling POST /api/generate for project ${projectId}...`);
  const genRes = await postJson('/api/generate', {
    projectId,
    presetId: 'social-word-pink',
    outputMode: 'video'
  });
  if (genRes.status !== 200 || !genRes.body.success) throw new Error(`Generate failed: ${JSON.stringify(genRes)}`);
  console.log(`[TEST ${label}] -> Generate confirmed project ${projectId}`);

  // Step 6: GET /api/bootstrap/studio/:projectId (called when user lands in /studio/:id)
  console.log(`[TEST ${label}] 6. Fetching GET /api/bootstrap/studio/${projectId}...`);
  const studioRes = await getJson(`/api/bootstrap/studio/${projectId}`);
  if (studioRes.status !== 200) throw new Error(`Studio bootstrap failed: ${JSON.stringify(studioRes)}`);
  const proj = studioRes.body.project;
  console.log(`[TEST ${label}] -> Studio State Loaded:`, {
    id: proj.id,
    title: proj.title,
    sourceFilePath: proj.source.filePath,
    previewUrl: proj.source.previewUrl,
    duration: proj.source.originalDuration,
    dimensions: `${proj.source.width}x${proj.source.height}`,
    hasLastExport: !!proj.lastExport
  });

  // Strict verification that project source is the newly uploaded video
  if (!proj.source.filePath.includes(uploadSessionId)) {
    throw new Error(`Project source path does NOT contain uploadSessionId ${uploadSessionId}!`);
  }

  // Step 7: POST /api/render (called when user clicks Export in Studio)
  console.log(`[TEST ${label}] 7. Calling POST /api/render for project ${projectId}...`);
  const renderRes = await postJson('/api/render', {
    projectId,
    kind: 'export',
    contentHash: 'hash_' + label + '_' + Date.now()
  });
  if (renderRes.status !== 200 || !renderRes.body.job) throw new Error(`Render failed: ${JSON.stringify(renderRes)}`);
  const job = renderRes.body.job;
  console.log(`[TEST ${label}] -> Render Completed:`, {
    jobId: job.id,
    status: job.status,
    downloadUrl: job.downloadUrl,
    duration: job.durationSec,
    dimensions: `${job.width}x${job.height}`,
    sizeBytes: job.sizeBytes
  });

  // Step 8: Download Export
  const downloadDest = path.join(OUT_DIR, `export_${label.toLowerCase()}.mp4`);
  console.log(`[TEST ${label}] 8. Downloading rendered video from ${job.downloadUrl}...`);
  const dlRes = await downloadFile(job.downloadUrl, downloadDest);
  console.log(`[TEST ${label}] -> Downloaded (${dlRes.size} bytes) to ${downloadDest}`);

  // Step 9: FFprobe output verification
  const exportProbe = vp.probeVideo(downloadDest);
  console.log(`[TEST ${label}] 9. Export Probed Output:`, {
    path: downloadDest,
    duration: exportProbe.duration,
    res: `${exportProbe.width}x${exportProbe.height}`,
    size: exportProbe.size,
    sha256: exportProbe.sha256.slice(0, 16) + '...'
  });

  return {
    label,
    projectId,
    uploadSessionId,
    jobId: job.id,
    downloadUrl: job.downloadUrl,
    input: inputProbe,
    export: exportProbe
  };
}

async function main() {
  const videoA = path.join(__dirname, 'test_assets', 'video_a.mp4');
  const videoB = path.join(__dirname, 'test_assets', 'video_b.mp4');
  const demoPath = path.join(__dirname, 'assets', 'demo_reel.mp4');
  const demoProbe = vp.probeVideo(demoPath);

  // TEST 1: Video A (4.0s, 1080x1920)
  const resA = await runMoonshotUploadPipeline('A', videoA, 'Clip A - Product Reel');

  // TEST 2: Video B (7.0s, 720x1280)
  const resB = await runMoonshotUploadPipeline('B', videoB, 'Clip B - Social Short');

  // TEST 3: Repeated Upload (Video A uploaded as Clip C with new session and new project)
  const resC = await runMoonshotUploadPipeline('C', videoA, 'Clip C - Repeated Upload Test');

  // TEST 4: State Recovery Verification
  console.log(`\n======================================================`);
  console.log(`[TEST 4] State Recovery & Page Refresh Verification`);
  console.log(`======================================================`);
  const refreshA = await getJson(`/api/bootstrap/studio/${resA.projectId}`);
  const refreshB = await getJson(`/api/bootstrap/studio/${resB.projectId}`);
  if (refreshA.body.project.source.filePath !== resA.input.path && !refreshA.body.project.source.filePath.includes(resA.uploadSessionId)) {
    throw new Error('Project A state corrupted upon refresh!');
  }
  if (refreshB.body.project.source.filePath !== resB.input.path && !refreshB.body.project.source.filePath.includes(resB.uploadSessionId)) {
    throw new Error('Project B state corrupted upon refresh!');
  }
  console.log(`[PASS] Both Project A and Project B retain their exact isolated source paths after refresh!`);

  // TEST 5: Error Handling
  console.log(`\n======================================================`);
  console.log(`[TEST 5] Error Handling & Validation`);
  console.log(`======================================================`);
  const badRender = await postJson('/api/render', { projectId: 'proj_non_existent_id' });
  if (badRender.status !== 404) {
    throw new Error(`Expected 404 for non-existent project render, got ${badRender.status}`);
  }
  console.log(`[PASS] Non-existent project correctly rejected with HTTP 404.`);

  // FINAL METADATA AUDIT
  console.log(`\n======================================================`);
  console.log(`🔍 COMPREHENSIVE SUITE METRICS COMPARISON`);
  console.log(`======================================================`);
  console.log('Video A Export:', { duration: resA.export.duration, res: `${resA.export.width}x${resA.export.height}`, sha256: resA.export.sha256 });
  console.log('Video B Export:', { duration: resB.export.duration, res: `${resB.export.width}x${resB.export.height}`, sha256: resB.export.sha256 });
  console.log('Video C Export:', { duration: resC.export.duration, res: `${resC.export.width}x${resC.export.height}`, sha256: resC.export.sha256 });

  // ASSERTIONS
  console.log('\n--- VERIFICATION ASSERTIONS ---');
  // 1. Duration A matches 4s, B matches 7s
  if (Math.abs(resA.export.duration - 4.0) > 0.1) throw new Error('Export A duration does not match Video A');
  if (Math.abs(resB.export.duration - 7.0) > 0.1) throw new Error('Export B duration does not match Video B');
  console.log('[PASS] Exact duration matches verified');

  // 2. Dimensions match
  if (resA.export.width !== 1080 || resA.export.height !== 1920) throw new Error('Export A resolution mismatch');
  if (resB.export.width !== 720 || resB.export.height !== 1280) throw new Error('Export B resolution mismatch');
  console.log('[PASS] Exact dimension matches verified');

  // 3. Hashes are distinct
  if (resA.export.sha256 === resB.export.sha256) throw new Error('Export A and B produced identical hash!');
  if (resA.export.sha256 === demoProbe.sha256 || resB.export.sha256 === demoProbe.sha256) {
    throw new Error('Export produced old demo reel hash!');
  }
  console.log('[PASS] Hashes are distinct, no video reuse observed');

  // 4. Repeated upload C received new job and unique project
  if (resC.projectId === resA.projectId || resC.jobId === resA.jobId) {
    throw new Error('Repeated upload reused project ID or job ID!');
  }
  console.log('[PASS] Consecutive uploads assign unique project IDs and job IDs');

  console.log(`\n🎉 ALL 5 TEST PHASES PASSED WITH 100% SUCCESS! 🎉\n`);

  fs.writeFileSync(path.join(OUT_DIR, 'rebuilt_suite_results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    demoReel: demoProbe,
    testA: resA,
    testB: resB,
    testC: resC
  }, null, 2));
}

main().catch(err => {
  console.error('\n❌ REBUILT PIPELINE SUITE FAILED:', err);
  process.exit(1);
});
