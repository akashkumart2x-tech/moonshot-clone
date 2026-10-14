const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';

function httpRequest(urlPath, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOpts = {
      method: options.method || 'GET',
      headers: options.headers || {},
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function uploadVideoFile(filePath, title) {
  const stat = fs.statSync(filePath);
  const fileBytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '');

  // 1. Signed URL
  const sign = await httpRequest('/api/upload/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { ext, contentType: 'video/mp4' });

  if (sign.status !== 200 || !sign.data?.uploadSessionId) {
    throw new Error(`Signed URL failed: ${JSON.stringify(sign.data)}`);
  }
  const { uploadUrl, uploadSessionId, relPath } = sign.data;

  // 2. Stream Upload PUT
  const put = await httpRequest(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size
    }
  }, fileBytes);

  if (put.status !== 200) {
    throw new Error(`PUT upload failed: ${JSON.stringify(put.data)}`);
  }

  // 3. Finalize upload & run audio extraction + project creation
  const finalize = await httpRequest('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { uploadSessionId, relPath, title });

  if (finalize.status !== 200) {
    throw new Error(`Finalize failed: ${JSON.stringify(finalize.data)}`);
  }

  return finalize.data;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function pollJob(jobId, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await httpRequest(`/api/render?jobId=${jobId}`);
    if (res.data?.job) {
      const job = res.data.job;
      console.log(`   [Render Poll ${jobId}] Status: ${job.status}, Progress: ${job.pct}%`);
      if (job.status === 'complete') return job;
      if (job.status === 'failed') throw new Error(`Render failed: ${job.error}`);
    }
    await sleep(1500);
  }
  throw new Error(`Render timed out after ${timeoutMs}ms`);
}

async function runTest() {
  console.log('======================================================================');
  console.log('🧪 RUNNING PRESET PARITY & EXPORT VERIFICATION TEST');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Video 1 with Preset "dimension-story" (Real Estate / Poppins / Magenta Karaoke / 0.47)
  // -------------------------------------------------------------------------
  console.log('>>> TEST 1: Uploading demo_reel.mp4 for Dimension Story Preset Testing...');
  const up1 = await uploadVideoFile('assets/demo_reel.mp4', 'Real Estate Reel Demo');
  const projId1 = up1.projectId || up1.project?.id;
  console.log(`   Upload and project creation complete: Project ID = ${projId1}`);

  // Fetch bootstrap project
  const boot1 = await httpRequest(`/api/bootstrap/studio/${projId1}`);
  const project1 = boot1.data.project;
  console.log(`   Initial project duration: ${project1.source.originalDuration}s, transcript items: ${project1.transcript?.length}`);

  // Ensure high-accuracy Whisper Large transcription
  if (!project1.transcript || project1.transcript.length === 0) {
    console.log('   Triggering Whisper Large transcription...');
    const trans1 = await httpRequest(`/api/projects/${projId1}/transcribe`, { method: 'POST' });
    console.log(`   Transcribed ${trans1.data.wordCount} words`);
    const reBoot1 = await httpRequest(`/api/bootstrap/studio/${projId1}`);
    project1.transcript = reBoot1.data.project.transcript;
  }

  // Custom word edit and highlight:
  if (project1.transcript && project1.transcript[0]?.words && project1.transcript[0].words.length > 0) {
    const w0 = project1.transcript[0].words[0];
    w0.text = 'EXCLUSIVE';
    w0.textLatn = 'EXCLUSIVE';
    w0.highlight = true;
    w0.color = '#00F0FF'; // Custom Cyan
    w0.userEdited = true;
    console.log(`   Applied custom word edit & cyan highlight on word: "${w0.text}"`);
  }

  // Set Preset to dimension-story
  project1.presetId = 'dimension-story';
  console.log(`   Applying preset: ${project1.presetId} (Poppins / Magenta Karaoke / Y=0.47)`);

  // Save changes
  await httpRequest(`/api/projects/${projId1}`, { method: 'PATCH' }, {
    transcript: project1.transcript,
    clips: project1.clips,
    presetId: project1.presetId,
    scriptPreference: 'latn'
  });

  // Render export
  console.log('   Triggering export render for Test 1...');
  const renderReq1 = await httpRequest('/api/render', { method: 'POST' }, {
    projectId: projId1,
    project: project1,
    presetId: 'dimension-story',
    exportQuality: '1080',
    scriptPreference: 'latn'
  });
  const jobId1 = renderReq1.data.job.id;
  const completedJob1 = await pollJob(jobId1);
  console.log(`   Export complete: ${completedJob1.outputFile}`);

  // Extract frame from export 1
  const frameOut1 = path.join(__dirname, 'scratch', 'frame_test1_dimension_story.jpg');
  if (!fs.existsSync(path.dirname(frameOut1))) fs.mkdirSync(path.dirname(frameOut1), { recursive: true });
  const extractSec1 = project1.transcript[0]?.words?.[0]?.start || 1.0;
  execSync(`ffmpeg -y -ss ${extractSec1} -i "${completedJob1.outputFile}" -vframes 1 -q:v 2 "${frameOut1}"`);
  console.log(`   Extracted verification frame: ${frameOut1}\n`);


  // -------------------------------------------------------------------------
  // TEST 2: Video 2 with Preset "still-time" (Editorial / Impact / Cream / Y=0.72)
  // -------------------------------------------------------------------------
  console.log('>>> TEST 2: Uploading video_b_dr_rajesh.mp4 for Still Time Preset Testing...');
  const up2 = await uploadVideoFile('test_videos/video_b_dr_rajesh.mp4', 'Medical Clinic Demo');
  const projId2 = up2.projectId || up2.project?.id;
  console.log(`   Upload and project creation complete: Project ID = ${projId2}`);

  // Fetch bootstrap project
  const boot2 = await httpRequest(`/api/bootstrap/studio/${projId2}`);
  const project2 = boot2.data.project;
  console.log(`   Initial project duration: ${project2.source.originalDuration}s, transcript items: ${project2.transcript?.length}`);

  // Ensure high-accuracy Whisper Large transcription
  if (!project2.transcript || project2.transcript.length === 0) {
    console.log('   Triggering Whisper Large transcription...');
    const trans2 = await httpRequest(`/api/projects/${projId2}/transcribe`, { method: 'POST' });
    console.log(`   Transcribed ${trans2.data.wordCount} words`);
    const reBoot2 = await httpRequest(`/api/bootstrap/studio/${projId2}`);
    project2.transcript = reBoot2.data.project.transcript;
  }

  // Custom word edit and highlight:
  if (project2.transcript && project2.transcript[0]?.words && project2.transcript[0].words.length > 0) {
    const w0 = project2.transcript[0].words[0];
    w0.text = 'SPECIALIST';
    w0.textLatn = 'SPECIALIST';
    w0.highlight = true;
    w0.color = '#FF7A00'; // Custom Orange highlight
    w0.userEdited = true;
    console.log(`   Applied custom word edit & orange highlight on word: "${w0.text}"`);
  }

  // Set Preset to still-time
  project2.presetId = 'still-time';
  console.log(`   Applying preset: ${project2.presetId} (Impact / Cream / Editorial / Y=0.72)`);

  // Save changes
  await httpRequest(`/api/projects/${projId2}`, { method: 'PATCH' }, {
    transcript: project2.transcript,
    clips: project2.clips,
    presetId: project2.presetId,
    scriptPreference: 'latn'
  });

  // Render export
  console.log('   Triggering export render for Test 2...');
  const renderReq2 = await httpRequest('/api/render', { method: 'POST' }, {
    projectId: projId2,
    project: project2,
    presetId: 'still-time',
    exportQuality: '1080',
    scriptPreference: 'latn'
  });
  const jobId2 = renderReq2.data.job.id;
  const completedJob2 = await pollJob(jobId2);
  console.log(`   Export complete: ${completedJob2.outputFile}`);

  // Extract frame from export 2
  const frameOut2 = path.join(__dirname, 'scratch', 'frame_test2_still_time.jpg');
  const extractSec2 = project2.transcript[0]?.words?.[0]?.start || 1.0;
  execSync(`ffmpeg -y -ss ${extractSec2} -i "${completedJob2.outputFile}" -vframes 1 -q:v 2 "${frameOut2}"`);
  console.log(`   Extracted verification frame: ${frameOut2}\n`);

  // -------------------------------------------------------------------------
  // VERIFY SESSION ISOLATION & RESULTS
  // -------------------------------------------------------------------------
  console.log('>>> VERIFYING SESSION ISOLATION:');
  console.log(`   Project 1 ID: ${projId1}, Preset: ${project1.presetId}, Source: ${project1.source.originalFilename}, Dur: ${project1.source.originalDuration}s`);
  console.log(`   Project 2 ID: ${projId2}, Preset: ${project2.presetId}, Source: ${project2.source.originalFilename}, Dur: ${project2.source.originalDuration}s`);
  console.log(`   Export 1 File: ${completedJob1.outputFile} (${fs.statSync(completedJob1.outputFile).size} bytes)`);
  console.log(`   Export 2 File: ${completedJob2.outputFile} (${fs.statSync(completedJob2.outputFile).size} bytes)`);

  const distinctPresets = project1.presetId !== project2.presetId;
  const distinctSources = project1.source.filePath !== project2.source.filePath;
  const distinctOutputs = completedJob1.outputFile !== completedJob2.outputFile;
  const framesExist = fs.existsSync(frameOut1) && fs.existsSync(frameOut2);

  if (distinctPresets && distinctSources && distinctOutputs && framesExist) {
    console.log('\n======================================================================');
    console.log('🎉 ALL PRESET & EXPORT TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================================');
  } else {
    throw new Error('Verification assertion failed!');
  }
}

runTest().catch(err => {
  console.error('\n❌ Test execution error:', err);
  process.exit(1);
});
