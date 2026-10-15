const http = require('http');
const fs = require('fs');
const path = require('path');
const vp = require('./video_processor');
const gdrive = require('./google_drive_service');

const PORT = process.env.PORT || 3000;

// Storage directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const EXPORTS_DIR = path.join(__dirname, 'exports');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load default timings fixture for fallback demo project only
let demoTimings = [];
try {
  demoTimings = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'demo_timings.json'), 'utf8'));
} catch (e) {
  console.warn('Could not read demo_timings.json:', e.message);
}

// Stores
const projects = new Map();
const uploadSessions = new Map();
const videoSessions = new Map();
const renderJobs = new Map();

// Cloud database persistence (Neon PostgreSQL)
let pgPool = null;
let pgConnected = false;
const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    });

    pgPool.on('error', (err) => {
      console.warn('[Store] PostgreSQL background pool error (safe):', err.message);
    });

    pgPool.query(`
      CREATE TABLE IF NOT EXISTS moonshot_store (
        store_key VARCHAR(64) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).then(async () => {
      pgConnected = true;
      console.log('[Store] Connected to PostgreSQL cloud database (Neon Pool).');
      try {
        const res = await pgPool.query("SELECT data FROM moonshot_store WHERE store_key = 'master_store';");
        if (res.rows.length > 0 && res.rows[0].data) {
          const data = res.rows[0].data;
          if (data.projects) Object.entries(data.projects).forEach(([k, v]) => projects.set(k, v));
          if (data.uploadSessions) Object.entries(data.uploadSessions).forEach(([k, v]) => uploadSessions.set(k, v));
          if (data.videoSessions) Object.entries(data.videoSessions).forEach(([k, v]) => videoSessions.set(k, v));
          if (data.renderJobs) Object.entries(data.renderJobs).forEach(([k, v]) => renderJobs.set(k, v));
          console.log(`[Store] Synced ${projects.size} projects from Neon PostgreSQL.`);
        }

        try {
          const credRes = await pgPool.query("SELECT data FROM moonshot_store WHERE store_key = 'google_oauth_credentials';");
          if (credRes.rows.length > 0 && credRes.rows[0].data) {
            const creds = credRes.rows[0].data;
            if (creds.clientId && creds.clientSecret) {
              gdrive.setCredentials(creds.clientId, creds.clientSecret);
              console.log('[Store] Loaded Google OAuth app credentials from Neon PostgreSQL.');
            }
          }

          const tokenRes = await pgPool.query("SELECT data FROM moonshot_store WHERE store_key = 'google_drive_tokens';");
          if (tokenRes.rows.length > 0 && tokenRes.rows[0].data) {
            gdrive.setTokens(tokenRes.rows[0].data);
            console.log('[Store] Loaded Google Drive user tokens from Neon PostgreSQL.');
          }
        } catch (tErr) {}
      } catch (e) {
        console.warn('[Store] Could not read master_store from PostgreSQL:', e.message);
      }
    }).catch(err => {
      console.warn('[Store] PostgreSQL connection failed, operating with local JSON store:', err.message);
      pgConnected = false;
    });
  } catch (err) {
    console.warn('[Store] pg module initialization error:', err.message);
  }
}

let savePgTimeout = null;
function saveStore() {
  const data = {
    projects: Object.fromEntries(projects.entries()),
    uploadSessions: Object.fromEntries(uploadSessions.entries()),
    videoSessions: Object.fromEntries(videoSessions.entries()),
    renderJobs: Object.fromEntries(renderJobs.entries())
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Store] Failed to save store:', e.message);
  }

  if (pgConnected && pgPool) {
    clearTimeout(savePgTimeout);
    savePgTimeout = setTimeout(async () => {
      try {
        const query = `
          INSERT INTO moonshot_store (store_key, data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (store_key)
          DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
        `;
        await pgPool.query(query, ['master_store', data]);
      } catch (err) {
        console.warn('[Store] Cloud DB sync warning:', err.message);
      }
    }, 1000);
  }
}

function loadStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (data.projects) Object.entries(data.projects).forEach(([k, v]) => projects.set(k, v));
      if (data.uploadSessions) Object.entries(data.uploadSessions).forEach(([k, v]) => uploadSessions.set(k, v));
      if (data.videoSessions) Object.entries(data.videoSessions).forEach(([k, v]) => videoSessions.set(k, v));
      if (data.renderJobs) Object.entries(data.renderJobs).forEach(([k, v]) => renderJobs.set(k, v));
      console.log(`[Store] Loaded ${projects.size} projects, ${videoSessions.size} video sessions, ${renderJobs.size} render jobs from disk.`);
    }
  } catch (e) {
    console.warn('[Store] Failed to load store:', e.message);
  }
}

function createProjectFixture({
  id = 'proj_demo_1',
  presetId = 'social-word-pink',
  videoUrl = '/assets/demo_reel.preview-1080x1920-v7.mp4',
  title = 'Demo Project',
  sourcePath = path.join(__dirname, 'assets', 'demo_reel.mp4'),
  previewPath = path.join(__dirname, 'assets', 'demo_reel.preview-1080x1920-v7.mp4'),
  duration = 13.5,
  width = 1080,
  height = 1920,
  fps = 30,
  customTranscript = null,
  lastExport = null
}) {
  // STRICT SEPARATION: ONLY proj_demo_1 gets demoTimings if customTranscript is not provided.
  // Any uploaded video with empty or null transcript will get an empty array [], NEVER demo words!
  const transcript = Array.isArray(customTranscript)
    ? customTranscript
    : (id === 'proj_demo_1' ? demoTimings.map((seg, sIdx) => ({
        id: `seg_${sIdx + 1}`,
        start: seg.start,
        end: seg.end,
        text: seg.words.map(w => w.word).join(' '),
        words: seg.words.map((w, wIdx) => ({
          id: `w_${sIdx + 1}_${wIdx + 1}`,
          text: w.word,
          start: w.start,
          end: w.end,
          confidence: 0.98
        }))
      })) : []);

  const effectiveDuration = duration || (transcript[transcript.length - 1]?.end ?? 13.5);

  const videoClip = {
    id: `clip_video_${id}`,
    kind: 'video',
    start: 0,
    duration: effectiveDuration,
    sourceStart: 0,
    sourceDuration: effectiveDuration,
    volume: 1
  };

  const captionClips = transcript.map((seg, sIdx) => ({
    id: `clip_c_${sIdx + 1}`,
    kind: 'caption',
    start: seg.start,
    duration: Math.max(0.1, Number((seg.end - seg.start).toFixed(2))),
    wordIds: seg.words ? seg.words.map(w => w.id) : [],
    styleOverride: null
  }));

  const proj = {
    id,
    title,
    presetId,
    outputMode: 'video',
    userId: 'usr_moonshot_creator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aspectRatio: width <= height ? '9:16' : '16:9',
    source: {
      id: `src_${id}`,
      kind: 'video',
      filePath: sourcePath,
      previewFilePath: previewPath,
      previewUrl: videoUrl,
      downloadUrl: videoUrl,
      originalDuration: effectiveDuration,
      width,
      height,
      fps,
      matte: {
        status: 'ready',
        progress: 1
      }
    },
    pipeline: {
      transcribe: { status: 'done', progress: 1 },
      hook: { status: 'done', progress: 1 },
      caption: { status: 'done', progress: 1 },
      broll: { status: 'done', progress: 1 },
      music: { status: 'done', progress: 1 },
      sfx: { status: 'done', progress: 1 },
      color: { status: 'done', progress: 1 },
      dynamicfx: { status: 'skipped' },
      background: { status: 'skipped' },
      elements: { status: 'skipped' }
    },
    transcript,
    clips: [videoClip, ...captionClips],
    brollSceneCuts: [],
    audioTracks: []
  };

  if (lastExport) {
    proj.lastExport = lastExport;
  }

  return proj;
}

function resolveProject(id) {
  if (!id) return null;
  if (projects.has(id)) return projects.get(id);
  const vSess = videoSessions.get(id);
  if (vSess && projects.has(vSess.projectId)) {
    return projects.get(vSess.projectId);
  }
  for (const sess of videoSessions.values()) {
    if (sess.sessionId === id || sess.projectId === id) {
      if (projects.has(sess.projectId)) return projects.get(sess.projectId);
    }
  }
  return null;
}

// Initialize store and demo project
loadStore();
if (!projects.has('proj_demo_1')) {
  projects.set('proj_demo_1', createProjectFixture({
    id: 'proj_demo_1',
    presetId: 'archive',
    title: 'Interactive Demo Clip',
    videoUrl: '/assets/demo_reel.preview-1080x1920-v7.mp4',
    sourcePath: path.join(__dirname, 'assets', 'demo_reel.mp4'),
    previewPath: path.join(__dirname, 'assets', 'demo_reel.preview-1080x1920-v7.mp4')
  }));
  saveStore();
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

function streamVideo(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Video not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// Load Studio HTML template
function getStudioHtml(projectId) {
  let html = '';
  try {
    html = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
  } catch (e) {
    try { html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); } catch (err) {}
  }
  return html.replace(/proj_123/g, projectId);
}

// Parse multipart/form-data buffer
function parseMultipartBuffer(buffer, boundary) {
  const boundaryBuffer = Buffer.from('--' + boundary);
  const result = { fields: {}, file: null };
  let start = 0;

  while ((start = buffer.indexOf(boundaryBuffer, start)) !== -1) {
    start += boundaryBuffer.length;
    if (buffer.slice(start, start + 2).toString() === '--') break;
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;

    const partBuffer = buffer.slice(start, nextBoundary - 2);
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = partBuffer.slice(0, headerEnd).toString('utf8');
    const bodyBuffer = partBuffer.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (filenameMatch) {
        result.file = {
          filename: filenameMatch[1],
          data: bodyBuffer
        };
      } else {
        result.fields[fieldName] = bodyBuffer.toString('utf8');
      }
    }
    start = nextBoundary;
  }
  return result;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-Moonshot-Upload-Retry, rsc',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // =========================================================================
  // PRIORITY STATIC ASSET RESOLUTION (Must precede page routes so relative
  // requests like /studio/static/chunks/... never return HTML!)
  // =========================================================================

  // 1. Chunks resolution (e.g. /static/chunks/..., /_next/static/chunks/..., /studio/static/chunks/...)
  if (pathname.includes('/static/chunks/')) {
    const chunkName = pathname.split('/static/chunks/').pop().split('?')[0];
    const chunkFile = path.join(__dirname, '_next', 'static', 'chunks', chunkName);
    if (fs.existsSync(chunkFile)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(chunkFile).pipe(res);
    }
  }

  // 2. Other static assets (e.g. /static/..., /_next/static/...)
  if (pathname.includes('/static/')) {
    const sub = pathname.slice(pathname.indexOf('/static/') + '/static/'.length).split('?')[0];
    const candidate = path.join(__dirname, '_next', 'static', sub);
    if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
      const ext = path.extname(candidate).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(candidate).pipe(res);
    }
  }

  // 3. Uploads directory resolution (handles /uploads/... and /studio/uploads/...)
  if (pathname.includes('/uploads/')) {
    const sub = pathname.slice(pathname.indexOf('/uploads/') + '/uploads/'.length).split('?')[0];
    const uploadFile = path.join(UPLOADS_DIR, sub);
    if (fs.existsSync(uploadFile) && !fs.statSync(uploadFile).isDirectory()) {
      const ext = path.extname(uploadFile).toLowerCase();
      if (ext === '.mp4' || ext === '.webm') {
        return streamVideo(uploadFile, req, res);
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(uploadFile).pipe(res);
    }
  }

  // 4. Exports directory resolution (handles /exports/... and /studio/exports/...)
  if (pathname.includes('/exports/')) {
    const sub = pathname.slice(pathname.indexOf('/exports/') + '/exports/'.length).split('?')[0];
    const exportFile = path.join(EXPORTS_DIR, sub);
    if (fs.existsSync(exportFile) && !fs.statSync(exportFile).isDirectory()) {
      return streamVideo(exportFile, req, res);
    }
  }

  // 5. Assets directory resolution (handles /assets/... and /studio/assets/...)
  if (pathname.includes('/assets/')) {
    const sub = pathname.slice(pathname.indexOf('/assets/') + '/assets/'.length).split('?')[0];
    const assetFile = path.join(__dirname, 'assets', sub);
    if (fs.existsSync(assetFile) && !fs.statSync(assetFile).isDirectory()) {
      const ext = path.extname(assetFile).toLowerCase();
      if (ext === '.mp4' || ext === '.webm') {
        return streamVideo(assetFile, req, res);
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(assetFile).pipe(res);
    }
  }

  // =========================================================================
  // API ENDPOINTS
  // =========================================================================

  // API 1: Current User / Auth
  if (pathname === '/api/me') {
    return sendJson(res, {
      user: {
        id: 'usr_moonshot_creator',
        name: 'Moonshot Creator',
        email: 'creator@makemoonshot.co',
        plan: 'pro',
        billing: {
          plan: 'pro',
          status: 'active',
          billingCycle: 'monthly',
          planExpiresAt: '2028-01-01T00:00:00.000Z',
          quotaResetsAt: '2028-01-01T00:00:00.000Z',
          subscription: { status: 'active' },
          limits: { maxSourceDurationSec: 7200, quotaResets: 'monthly' },
          usage: {
            exportSec: { limit: 72000, used: 60, remaining: 71940 },
            transcriptionSec: { limit: 72000, used: 60, remaining: 71940 }
          },
          mediaAllowance: { weeklySec: 72000, weeklyRemainingSec: 71940, packRemainingSec: 0 }
        }
      }
    });
  }

  // API 2: AI Credits
  if (pathname.startsWith('/api/ai-credits')) {
    return sendJson(res, {
      balance: { availableUnits: 999999, totalUnits: 999999 },
      mode: 'enforce',
      freeUses: {}
    });
  }

  // API 3: Upload Probe
  if (pathname === '/api/upload/probe') {
    return sendJson(res, { eligible: false });
  }
  if (pathname === '/api/upload/probe/report') {
    return sendJson(res, { ok: true });
  }

  // API 4: Multipart Upload (MPU) fallback signal -> 501 tells client to use direct signed URL immediately
  if (pathname === '/api/upload/mpu') {
    res.writeHead(501, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({ error: 'Multipart upload not supported, use direct signed URL' }));
  }

  // API 5: Signed Upload URL generator (Initializes a completely independent session)
  if (pathname === '/api/upload/signed-url') {
    const body = await readBody(req);
    const uploadId = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const uploadDir = path.join(UPLOADS_DIR, uploadId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext = (body.ext || 'mp4').toLowerCase().replace(/^\./, '');
    const sourceFile = path.join(uploadDir, `source.${ext}`);
    const relPath = `/uploads/${uploadId}/source.${ext}`;

    const session = {
      id: uploadId,
      uploadDir,
      sourceFile,
      relPath,
      ext,
      contentType: body.contentType || 'video/mp4',
      createdAt: Date.now()
    };
    uploadSessions.set(uploadId, session);
    saveStore();

    console.log(`[Upload Session Created] ID: ${uploadId} -> Target: ${sourceFile}`);

    return sendJson(res, {
      uploadUrl: `/api/upload/put-file?uploadId=${uploadId}`,
      relPath,
      uploadSessionId: uploadId,
      headers: {}
    });
  }

  // API 6: Streaming Direct Put File
  if (pathname === '/api/upload/put-file') {
    const uploadId = parsedUrl.searchParams.get('uploadId');
    const session = uploadSessions.get(uploadId);
    if (!session) {
      console.error(`[Upload] PUT session not found: ${uploadId}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Upload session not found' }));
    }

    console.log(`[Upload Streaming] Writing body to ${session.sourceFile}...`);
    const writeStream = fs.createWriteStream(session.sourceFile);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      try {
        const stat = fs.statSync(session.sourceFile);
        console.log(`[Upload Stream Complete] Stored ${session.sourceFile} (${stat.size} bytes)`);
        session.sizeBytes = stat.size;
        saveStore();

        // Respond HTTP 200 immediately
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ ok: true, relPath: session.relPath }));
      } catch (err) {
        console.error(`[Upload Finish Error]:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    writeStream.on('error', (err) => {
      console.error(`[Upload Stream Error]:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // API 7: Core Upload Ingestion, Audio Extraction, Whisper Speech Recognition & Project Creation
  if (pathname === '/api/upload' || pathname === '/api/upload/finalize') {
    const contentType = req.headers['content-type'] || '';

    // CASE A: JSON Finalize Payload
    if (contentType.includes('application/json')) {
      const body = await readBody(req);
      const uploadId = body.uploadSessionId;
      console.log(`[Upload Finalize] Finalizing session: ${uploadId}`);

      let session = uploadSessions.get(uploadId);
      if (!session && body.relPath) {
        for (const s of uploadSessions.values()) {
          if (s.relPath === body.relPath) { session = s; break; }
        }
      }

      if (!session || !fs.existsSync(session.sourceFile)) {
        console.error(`[Upload Finalize Error] Source file missing for session ${uploadId}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Uploaded source file not found on disk' }));
      }

      // Step 1: Probe video
      if (!session.probe) {
        console.log(`[Upload Pipeline] Probing ${session.sourceFile}...`);
        session.probe = vp.probeVideo(session.sourceFile);
      }

      // Step 2: Ensure preview proxy exists
      if (!session.previewFilePath || !fs.existsSync(session.previewFilePath)) {
        const previewName = `source.preview-${session.probe.width}x${session.probe.height}-v7.mp4`;
        session.previewFilePath = path.join(session.uploadDir, previewName);
        if (!fs.existsSync(session.previewFilePath)) {
          console.log(`[Upload Pipeline] Generating preview proxy: ${session.previewFilePath}...`);
          vp.generatePreviewProxy(session.sourceFile, session.previewFilePath);
        }
        session.previewUrl = `/uploads/${session.id}/${previewName}`;
      }

      // Step 3: Extract Audio for Speech Recognition
      const audioFile = path.join(session.uploadDir, 'audio.wav');
      console.log(`[Upload Pipeline] Extracting audio -> ${audioFile}...`);
      const hasExtractedAudio = vp.extractAudio(session.sourceFile, audioFile);

      // Step 4: Run Real Whisper Speech Recognition
      const transcriptFile = path.join(session.uploadDir, 'transcript.json');
      let speechResult = { language: 'en', duration: session.probe.duration, transcript: [], wordCount: 0 };
      if (hasExtractedAudio) {
        console.log(`[Upload Pipeline] Running Whisper speech recognition on extracted audio...`);
        speechResult = vp.transcribeAudio(audioFile, transcriptFile);
      } else {
        console.log(`[Upload Pipeline] Video has no audio or audio extraction produced no track. Transcript will be empty.`);
      }

      const duration = session.probe.duration;
      const width = session.probe.width;
      const height = session.probe.height;
      const fps = session.probe.fps;
      const title = body.title || path.basename(session.sourceFile);

      // Step 5: Create a 100% INDEPENDENT Project (Fresh ID, strictly bound to this video's source & transcript)
      const projId = 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      
      const proj = createProjectFixture({
        id: projId,
        presetId: 'social-word-pink',
        videoUrl: session.previewUrl,
        title,
        sourcePath: session.sourceFile,
        previewPath: session.previewFilePath,
        duration,
        width,
        height,
        fps,
        customTranscript: speechResult.transcript || [],
        lastExport: null
      });

      projects.set(projId, proj);

      // Step 6: Create Independent Video Session Record
      const videoSession = {
        sessionId: session.id,
        projectId: projId,
        sourceAssetId: `src_${projId}`,
        sourceFile: session.sourceFile,
        previewFilePath: session.previewFilePath,
        previewUrl: session.previewUrl,
        audioFile,
        transcriptFile,
        metadata: {
          duration,
          width,
          height,
          fps,
          sizeBytes: session.sizeBytes || fs.statSync(session.sourceFile).size,
          sha256: session.probe.sha256
        },
        transcript: speechResult.transcript || [],
        wordCount: speechResult.wordCount || 0,
        language: speechResult.language || 'en',
        captionStyling: { presetId: 'social-word-pink' },
        renderJobId: null,
        renderStatus: 'idle',
        lastExport: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      videoSessions.set(session.id, videoSession);
      saveStore();

      console.log(`[Upload Pipeline Success] Created Project ${projId} & Session ${session.id}:`);
      console.log(`  ➜ Words detected: ${videoSession.wordCount} (${videoSession.language})`);
      console.log(`  ➜ Source Video:   ${session.sourceFile}`);
      console.log(`  ➜ Preview Video:  ${session.previewUrl}`);

      return sendJson(res, {
        projectId: projId,
        sessionId: session.id,
        project: { id: projId },
        relPath: session.previewUrl,
        durationSec: duration,
        mediaKind: 'video',
        transcript: videoSession.transcript,
        wordCount: videoSession.wordCount
      });
    }

    // CASE B: Multipart Form Data Direct Upload
    if (contentType.includes('multipart/form-data')) {
      console.log(`[Upload Pipeline] Processing multipart/form-data upload...`);
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryMatch) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing boundary in multipart request' }));
      }
      const boundary = boundaryMatch[1] || boundaryMatch[2];
      const rawBuffer = await readRawBody(req);
      const parsed = parseMultipartBuffer(rawBuffer, boundary);

      if (!parsed.file || !parsed.file.data || parsed.file.data.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No video file data uploaded' }));
      }

      const uploadId = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      const uploadDir = path.join(UPLOADS_DIR, uploadId);
      fs.mkdirSync(uploadDir, { recursive: true });
      const sourceFile = path.join(uploadDir, 'source.mp4');
      fs.writeFileSync(sourceFile, parsed.file.data);

      const probe = vp.probeVideo(sourceFile);
      const previewName = `source.preview-${probe.width}x${probe.height}-v7.mp4`;
      const previewPath = path.join(uploadDir, previewName);
      vp.generatePreviewProxy(sourceFile, previewPath);
      const previewUrl = `/uploads/${uploadId}/${previewName}`;

      // Extract Audio & Run Whisper
      const audioFile = path.join(uploadDir, 'audio.wav');
      const hasAudio = vp.extractAudio(sourceFile, audioFile);
      const transcriptFile = path.join(uploadDir, 'transcript.json');
      let speechResult = { language: 'en', duration: probe.duration, transcript: [], wordCount: 0 };
      if (hasAudio) {
        speechResult = vp.transcribeAudio(audioFile, transcriptFile);
      }

      const projId = 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      const title = parsed.fields.title || parsed.file.filename || 'Uploaded Video';

      const proj = createProjectFixture({
        id: projId,
        presetId: 'social-word-pink',
        videoUrl: previewUrl,
        title,
        sourcePath: sourceFile,
        previewPath,
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        customTranscript: speechResult.transcript || [],
        lastExport: null
      });

      projects.set(projId, proj);

      const videoSession = {
        sessionId: uploadId,
        projectId: projId,
        sourceAssetId: `src_${projId}`,
        sourceFile,
        previewFilePath: previewPath,
        previewUrl,
        audioFile,
        transcriptFile,
        metadata: {
          duration: probe.duration,
          width: probe.width,
          height: probe.height,
          fps: probe.fps,
          sizeBytes: parsed.file.data.length,
          sha256: probe.sha256
        },
        transcript: speechResult.transcript || [],
        wordCount: speechResult.wordCount || 0,
        language: speechResult.language || 'en',
        captionStyling: { presetId: 'social-word-pink' },
        renderJobId: null,
        renderStatus: 'idle',
        lastExport: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      videoSessions.set(uploadId, videoSession);
      uploadSessions.set(uploadId, { id: uploadId, uploadDir, sourceFile, relPath: previewUrl, previewFilePath: previewPath, previewUrl, probe, sizeBytes: parsed.file.data.length });
      saveStore();

      console.log(`[Upload Pipeline Success] Multipart created Project ${projId} & Session ${uploadId}`);

      return sendJson(res, {
        projectId: projId,
        sessionId: uploadId,
        project: { id: projId },
        relPath: previewUrl,
        durationSec: probe.duration,
        uploadSessionId: uploadId,
        transport: 'direct',
        mediaKind: 'video',
        transcript: videoSession.transcript,
        wordCount: videoSession.wordCount
      });
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Unsupported upload content-type: ${contentType}` }));
  }

  // API 8: Video Sessions API
  if (pathname === '/api/sessions' && req.method === 'GET') {
    return sendJson(res, {
      sessions: Array.from(videoSessions.values())
    });
  }

  if (pathname.startsWith('/api/sessions/')) {
    const parts = pathname.replace('/api/sessions/', '').split('/');
    const sessionId = parts[0];
    const subRoute = parts[1];

    const session = videoSessions.get(sessionId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Session ${sessionId} not found` }));
    }

    // Sub-route: Regenerate captions on current video only
    if (subRoute === 'regenerate-captions' && req.method === 'POST') {
      console.log(`[Session] Regenerating captions for session ${sessionId}...`);
      const hasAudio = vp.extractAudio(session.sourceFile, session.audioFile);
      let speechResult = { language: 'en', duration: session.metadata.duration, transcript: [], wordCount: 0 };
      if (hasAudio) {
        speechResult = vp.transcribeAudio(session.audioFile, session.transcriptFile);
      }
      session.transcript = speechResult.transcript || [];
      session.wordCount = speechResult.wordCount || 0;
      session.language = speechResult.language || 'en';
      session.updatedAt = new Date().toISOString();

      // Update associated project
      const proj = projects.get(session.projectId);
      if (proj) {
        proj.transcript = session.transcript;
        proj.clips = [
          proj.clips.find(c => c.kind === 'video') || {
            id: `clip_video_${proj.id}`,
            kind: 'video',
            start: 0,
            duration: session.metadata.duration,
            sourceStart: 0,
            sourceDuration: session.metadata.duration,
            volume: 1
          },
          ...session.transcript.map((seg, sIdx) => ({
            id: `clip_c_${sIdx + 1}`,
            kind: 'caption',
            start: seg.start,
            duration: Math.max(0.1, Number((seg.end - seg.start).toFixed(2))),
            wordIds: seg.words ? seg.words.map(w => w.id) : [],
            styleOverride: null
          }))
        ];
        proj.updatedAt = new Date().toISOString();
        proj.lastExport = null;
      }
      saveStore();

      return sendJson(res, {
        success: true,
        sessionId,
        transcript: session.transcript,
        wordCount: session.wordCount
      });
    }

    return sendJson(res, { session });
  }

  // API 9: Generate Project (/api/generate)
  if (pathname === '/api/generate') {
    const body = await readBody(req);
    const projId = body.projectId || 'proj_demo_1';
    console.log(`[Generate] Request for project: ${projId}`, body);

    let proj = resolveProject(projId);
    if (!proj) {
      console.warn(`[Generate] Project ${projId} not in store, creating fixture...`);
      proj = createProjectFixture({ id: projId, presetId: body.presetId || 'social-word-pink', customTranscript: [] });
      projects.set(projId, proj);
    } else {
      if (body.presetId) proj.presetId = body.presetId;
      if (body.outputMode) proj.outputMode = body.outputMode;
    }
    saveStore();

    return sendJson(res, {
      success: true,
      project: { id: proj.id }
    });
  }

  // API 9.1: Generation Status Poll (/api/generate/status)
  if (pathname === '/api/generate/status' || pathname.startsWith('/api/generate/status')) {
    const id = parsedUrl.searchParams.get('id') || 'proj_demo_1';
    const proj = resolveProject(id);
    const pipeline = (proj && proj.pipeline) ? proj.pipeline : {
      transcribe: { status: 'done', progress: 1 },
      hook: { status: 'done', progress: 1 },
      caption: { status: 'done', progress: 1 },
      broll: { status: 'done', progress: 1 },
      music: { status: 'done', progress: 1 },
      sfx: { status: 'done', progress: 1 },
      color: { status: 'done', progress: 1 },
      dynamicfx: { status: 'skipped' },
      background: { status: 'skipped' },
      elements: { status: 'skipped' }
    };
    return sendJson(res, {
      pipeline,
      generation: { status: 'done' }
    });
  }

  // API 10: Studio Bootstrap (/api/bootstrap/studio/:id)
  if (pathname.startsWith('/api/bootstrap/studio/')) {
    const id = pathname.replace('/api/bootstrap/studio/', '').split('?')[0];
    let proj = resolveProject(id);
    if (!proj) {
      console.warn(`[Bootstrap Studio] Project ${id} not found in store; initializing clean project`);
      proj = createProjectFixture({ id, presetId: 'social-word-pink', customTranscript: [] });
      projects.set(id, proj);
      saveStore();
    }

    console.log(`[Bootstrap Studio] Loaded Project ${proj.id} (Source: ${proj.source?.filePath}, Words: ${proj.transcript?.length || 0})`);
    return sendJson(res, {
      state: 'ready',
      project: proj,
      advancedEditor: true,
      socialPublishingEnabled: false,
      editChatEnabled: true
    });
  }

  // API 11: Projects Bootstrap List
  if (pathname.startsWith('/api/bootstrap/projects')) {
    return sendJson(res, {
      authenticated: true,
      projects: Array.from(projects.values())
    });
  }

  // API 12: Individual Project GET/PUT/PATCH/DELETE
  if (pathname.startsWith('/api/projects/')) {
    const parts = pathname.replace('/api/projects/', '').split('/');
    const projId = parts[0];
    const subRoute = parts[1];

    let proj = resolveProject(projId);
    if (!proj) {
      proj = createProjectFixture({ id: projId, presetId: 'social-word-pink', customTranscript: [] });
      projects.set(projId, proj);
      saveStore();
    }

    // Sub-route: Re-transcribe endpoint for a specific project
    if (subRoute === 'transcribe' && req.method === 'POST') {
      const sourceFile = proj.source?.filePath;
      if (!sourceFile || !fs.existsSync(sourceFile)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Source file does not exist' }));
      }
      const audioPath = path.join(path.dirname(sourceFile), 'audio.wav');
      vp.extractAudio(sourceFile, audioPath);
      const speech = vp.transcribeAudio(audioPath);
      proj.transcript = speech.transcript || [];
      proj.updatedAt = new Date().toISOString();
      proj.lastExport = null;
      saveStore();
      return sendJson(res, { success: true, transcript: proj.transcript, wordCount: speech.wordCount });
    }

    if (subRoute === 'audio-export' || subRoute === 'broll' || subRoute === 'music' || subRoute === 'head-stickers' || subRoute === 'sticker-cuts') {
      return sendJson(res, { ok: true, cuts: {}, missing: [], stickers: [] });
    }

    if (req.method === 'DELETE') {
      projects.delete(projId);
      saveStore();
      return sendJson(res, { deleted: true });
    }

    // Handles autosave PUT / PATCH from Studio editor!
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await readBody(req);
      Object.assign(proj, body);
      proj.updatedAt = new Date().toISOString();
      proj.lastExport = null; // Any caption or timeline edit resets export so next render reflects latest changes!

      // Keep linked videoSession in sync
      for (const sess of videoSessions.values()) {
        if (sess.projectId === proj.id || sess.sessionId === projId) {
          if (body.transcript) sess.transcript = body.transcript;
          sess.lastExport = null;
          sess.updatedAt = proj.updatedAt;
        }
      }

      saveStore();
      console.log(`[Project Update] Saved changes to ${proj.id} (Clips: ${proj.clips?.length}, Transcript Segments: ${proj.transcript?.length})`);
      return sendJson(res, { project: proj });
    }

    return sendJson(res, { project: proj });
  }

  // API 13: Render & Export Engine (True FFmpeg Video Render with strict project isolation)
  if (pathname === '/api/render' && req.method === 'POST') {
    const body = await readBody(req);
    const projId = body.projectId;
    const proj = resolveProject(projId);
    if (!proj) {
      console.error(`[Export Error] Project ${projId} not found`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Project ${projId} not found` }));
    }

    // Invalidate any prior export cache immediately
    proj.lastExport = null;
    for (const sess of videoSessions.values()) {
      if (sess.projectId === proj.id) {
        sess.lastExport = null;
      }
    }

    // Merge in-memory project updates from client payload if provided
    if (body.project && typeof body.project === 'object') {
      if (body.project.transcript) proj.transcript = body.project.transcript;
      if (body.project.clips) proj.clips = body.project.clips;
      if (body.project.presetId) proj.presetId = body.project.presetId;
      if (body.project.captionStyleOverride) proj.captionStyleOverride = body.project.captionStyleOverride;
      if (body.project.scriptPreference) proj.scriptPreference = body.project.scriptPreference;
      if (body.project.title) proj.title = body.project.title;
    }

    if (body.scriptPreference) proj.scriptPreference = body.scriptPreference;
    if (body.presetId) proj.presetId = body.presetId;
    if (body.captionStyleOverride) proj.captionStyleOverride = body.captionStyleOverride;

    const jobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const jobDir = path.join(EXPORTS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    const outputFile = path.join(jobDir, `moonshot_export_${jobId}.mp4`);

    function resolveSourceVideo(p) {
      if (!p) return null;
      const candidates = [];
      if (p.source?.filePath) candidates.push(p.source.filePath);
      if (p.source?.previewFilePath) candidates.push(p.source.previewFilePath);

      // Check if path has uploads/subfolder relative path (fixes Windows vs Linux paths)
      const raw = p.source?.filePath || '';
      const match = raw.match(/uploads[\\/].*$/i);
      if (match) {
        candidates.push(path.join(__dirname, match[0]));
        candidates.push(path.join(process.cwd(), match[0]));
        candidates.push(path.resolve(match[0]));
      }

      // Check all video sessions for this project
      for (const sess of videoSessions.values()) {
        if (sess.projectId === p.id || sess.sessionId === p.id) {
          if (sess.sourceFile) candidates.push(sess.sourceFile);
          if (sess.previewFilePath) candidates.push(sess.previewFilePath);
          if (sess.previewUrl) {
            candidates.push(path.join(__dirname, sess.previewUrl.replace(/^\//, '')));
          }
          const sMatch = (sess.sourceFile || '').match(/uploads[\\/].*$/i);
          if (sMatch) {
            candidates.push(path.join(__dirname, sMatch[0]));
          }
        }
      }

      // Also check proj.source.previewUrl
      if (p.source?.previewUrl) {
        candidates.push(path.join(__dirname, p.source.previewUrl.replace(/^\//, '')));
      }

      // Fallback demo reel if proj_demo_1
      if (p.id === 'proj_demo_1') {
        candidates.push(path.join(__dirname, 'assets', 'demo_reel.mp4'));
      }

      for (const c of candidates) {
        if (c && fs.existsSync(c)) {
          return c;
        }
      }
      return null;
    }

    const sourceToRender = resolveSourceVideo(proj);
    if (!sourceToRender) {
      console.error(`[Export Error] Source file does not exist on disk for project ${projId}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Source video file missing on disk for project ${projId}` }));
    }

    console.log(`[Export] Rendering project ${projId} (Preset: ${proj.presetId || 'social-word-pink'}, Script: ${proj.scriptPreference || 'latn'}, Source: ${sourceToRender}) -> ${outputFile}...`);

    try {
      // Passes full project so subtitles filter uses latest edited word text, timing, and preset styles!
      const outProbe = vp.renderExportVideo(sourceToRender, proj, outputFile, proj.title);
      console.log(`[Export Success] Job ${jobId} rendered: ${outputFile} (${outProbe.size} bytes, ${outProbe.duration}s, ${outProbe.width}x${outProbe.height}, sha256: ${outProbe.sha256.slice(0, 16)})`);

      const job = {
        id: jobId,
        projectId: projId,
        status: 'complete',
        progress: 1,
        contentHash: body.contentHash || 'hash_' + Date.now(),
        plannedRenderEngine: 'ffmpeg-libass',
        outputFile,
        durationSec: outProbe.duration,
        width: outProbe.width,
        height: outProbe.height,
        sizeBytes: outProbe.size,
        sha256: outProbe.sha256,
        downloadUrl: `/api/render/file/${jobId}?dl=1`,
        completedAt: new Date().toISOString()
      };

      renderJobs.set(jobId, job);
      proj.lastExport = {
        jobId,
        contentHash: job.contentHash,
        completedAt: job.completedAt
      };

      // Also update linked videoSession
      for (const sess of videoSessions.values()) {
        if (sess.projectId === projId) {
          sess.renderJobId = jobId;
          sess.renderStatus = 'complete';
          sess.lastExport = proj.lastExport;
          sess.exportOutputFile = outputFile;
          sess.exportDownloadUrl = job.downloadUrl;
        }
      }

      // Asynchronously upload export to Google Drive if authorized
      const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
      const host = req.headers.host || `localhost:${PORT}`;
      const currentRedirectUri = `${proto}://${host}/api/auth/google/callback`;

      if (gdrive.isConnected()) {
        gdrive.getOrCreateFolder('Moonshot', currentRedirectUri).then(async (folder) => {
          const driveFile = await gdrive.uploadMediaFile(folder.id, `moonshot_export_${jobId}.mp4`, outputFile, 'video/mp4', currentRedirectUri);
          job.gdriveLink = driveFile.webViewLink;
          for (const sess of videoSessions.values()) {
            if (sess.projectId === projId) {
              sess.gdriveLink = driveFile.webViewLink;
            }
          }
          console.log(`[Google Drive Auto-Sync] Job ${jobId} uploaded to Drive: ${driveFile.webViewLink}`);
          saveStore();
        }).catch(err => console.warn('[Google Drive Auto-Sync Warning]', err.message));
      }

      saveStore();

      return sendJson(res, { job });
    } catch (renderErr) {
      console.error(`[Export Error] FFmpeg rendering failed:`, renderErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Rendering failed: ${renderErr.message}` }));
    }
  }

  // API 14: Render Job Status Poll (/api/render?jobId=...)
  if (pathname === '/api/render' && req.method === 'GET') {
    const jobId = parsedUrl.searchParams.get('jobId');
    const job = renderJobs.get(jobId);
    if (job) {
      return sendJson(res, { job });
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Render job ${jobId} not found` }));
  }

  // API 15: Export File Download & Preview (/api/render/file/:jobId)
  if (pathname.startsWith('/api/render/file/')) {
    const jobId = pathname.replace('/api/render/file/', '').replace(/\?.*$/, '');
    const job = renderJobs.get(jobId);
    if (!job || !fs.existsSync(job.outputFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Render file not found');
    }

    if (parsedUrl.searchParams.get('url') === '1') {
      return sendJson(res, { url: `/api/render/file/${jobId}?dl=1` });
    }

    res.setHeader('Content-Disposition', `attachment; filename="moonshot_export_${jobId}.mp4"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return streamVideo(job.outputFile, req, res);
  }

  // API 16: Export Download Alias (/api/render/download/:jobId)
  if (pathname.startsWith('/api/render/download/')) {
    const jobId = pathname.replace('/api/render/download/', '').replace(/\?.*$/, '');
    const job = renderJobs.get(jobId);
    if (!job || !fs.existsSync(job.outputFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Export file not found');
    }
    res.setHeader('Content-Disposition', `attachment; filename="moonshot_export_${jobId}.mp4"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return streamVideo(job.outputFile, req, res);
  }

  // API 16.1: Manual Google Drive Upload for Export (/api/render/upload-to-drive/:jobId)
  if (pathname.startsWith('/api/render/upload-to-drive/')) {
    const jobId = pathname.replace('/api/render/upload-to-drive/', '').replace(/\?.*$/, '');
    const job = renderJobs.get(jobId);
    if (!job || !fs.existsSync(job.outputFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Export file not found' }));
    }

    const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;

    if (!gdrive.isConnected()) {
      const authUrl = gdrive.getAuthUrl(redirectUri, `job_${jobId}`);
      return sendJson(res, { connected: false, authRequired: true, authUrl });
    }

    try {
      const folder = await gdrive.getOrCreateFolder('Moonshot', redirectUri);
      const driveFile = await gdrive.uploadMediaFile(folder.id, `moonshot_export_${jobId}.mp4`, job.outputFile, 'video/mp4', redirectUri);
      job.gdriveLink = driveFile.webViewLink;
      saveStore();
      return sendJson(res, { success: true, gdriveLink: driveFile.webViewLink, fileId: driveFile.id });
    } catch (err) {
      console.error('[Google Drive Upload Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // API 16.2: Google Drive Connection Status & Auth URL (/api/gdrive/status)
  if (pathname === '/api/gdrive/status') {
    const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;
    return sendJson(res, {
      connected: gdrive.isConnected(),
      authUrl: gdrive.getAuthUrl(redirectUri)
    });
  }

  // API 17: Templates Discovery
  if (pathname.startsWith('/api/templates/')) {
    try {
      const templatesFile = path.join(__dirname, 'assets', 'templates.json');
      if (fs.existsSync(templatesFile)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return fs.createReadStream(templatesFile).pipe(res);
      }
    } catch (e) {}
    return sendJson(res, { shelves: [] });
  }

  // API 18: Telemetry & Stubs
  if (pathname === '/api/events' || pathname === '/api/feedback' || pathname.startsWith('/api/telemetry/')) {
    return sendJson(res, { ok: true });
  }

  // API 19: Matte stub
  if (pathname === '/api/matte') {
    return sendJson(res, {
      status: 'ready',
      matte: { status: 'ready', progress: 1 }
    });
  }

  // API 20: Source preview proxy & relay tickets
  if (pathname === '/api/source/preview') {
    const projId = parsedUrl.searchParams.get('projectId');
    const proj = projId ? projects.get(projId) : null;
    const srcFile = proj?.source?.filePath || path.join(__dirname, 'assets', 'demo_reel.mp4');
    return streamVideo(srcFile, req, res);
  }
  if (pathname === '/api/source/preview-proxy') {
    const body = await readBody(req);
    const projId = body.projectId;
    const proj = projId ? projects.get(projId) : null;
    const previewUrl = proj?.source?.previewUrl || '/assets/demo_reel.preview-1080x1920-v7.mp4';
    return sendJson(res, {
      status: 'ready',
      previewUrl,
      targetKey: 'original',
      progress: 1
    });
  }
  if (pathname === '/api/source/relay-ticket') {
    const body = await readBody(req);
    const projId = body.projectId;
    const proj = projId ? projects.get(projId) : null;
    return sendJson(res, {
      relayUrl: body.src || proj?.source?.previewUrl || '/assets/demo_reel.preview-1080x1920-v7.mp4'
    });
  }

  // API 21: File streaming proxy
  if (pathname.startsWith('/api/files/')) {
    const sub = pathname.replace('/api/files/', '').split('?')[0];
    const candidate = path.join(__dirname, sub);
    if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
      return streamVideo(candidate, req, res);
    }
  }

  // =========================================================================
  // PAGE ROUTES
  // =========================================================================

  // Studio Route: /studio or /studio/:id (ONLY when not a file request with extension)
  if ((pathname === '/studio' || pathname.startsWith('/studio/')) && !path.extname(pathname)) {
    const reqProjId = pathname.replace(/^\/studio\/?/, '').split('?')[0] || 'proj_demo_1';
    const proj = resolveProject(reqProjId);
    const finalProjId = proj ? proj.id : reqProjId;

    // Direct browser HTML load with project ID injected
    const studioHtml = getStudioHtml(finalProjId);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(studioHtml);
    return;
  }

  // API: Google OAuth Login for Google Drive Sync
  if (pathname === '/api/auth/google/login' || pathname === '/api/drive/connect') {
    const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;
    const authUrl = gdrive.getAuthUrl(redirectUri);
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  // API: Google OAuth Callback & Automated Moonshot Folder Upload
  if (pathname === '/api/auth/google/callback') {
    const code = parsedUrl.searchParams.get('code');
    const error = parsedUrl.searchParams.get('error');
    const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:30px;border-radius:12px;background:#18181b;color:#f4f4f5;text-align:center;">
          <h2 style="color:#ef4444;">Google Authorization Cancelled</h2>
          <p>${error}</p>
          <a href="/api/auth/google/login" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none;margin-top:20px;font-weight:700;">Retry Authorization</a>
        </div>
      `);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing code in callback');
    }

    try {
      const { tokens } = await gdrive.handleCallback(code, redirectUri);
      if (pgPool) {
        try {
          await pgPool.query(`
            INSERT INTO moonshot_store (store_key, data, updated_at)
            VALUES ('google_drive_tokens', $1, NOW())
            ON CONFLICT (store_key) DO UPDATE SET data = $1, updated_at = NOW();
          `, [tokens]);
          console.log('[Store] Persisted Google Drive OAuth credentials to Neon PostgreSQL.');
        } catch (dbErr) {
          console.warn('[Store] Cloud DB token persistence warning:', dbErr.message);
        }
      }

      const folder = await gdrive.getOrCreateFolder('Moonshot', redirectUri);

      const linksContent = `=====================================================
MOONSHOT REPLICA - CLOUD DEPLOYMENT & PORTAL LINKS
=====================================================

1. GITHUB REPOSITORY:
   https://github.com/akashkumart2x-tech/moonshot-clone

2. 1-CLICK RENDER CLOUD DEPLOY (DOCKER WEB SERVICE):
   https://render.com/deploy?repo=https://github.com/akashkumart2x-tech/moonshot-clone

3. 1-CLICK RAILWAY CLOUD DEPLOY:
   https://railway.app/new/template?template=https://github.com/akashkumart2x-tech/moonshot-clone

4. CLOUD DATABASE (NEON POSTGRESQL):
   Database: moonshot_db
   Host: ep-icy-surf-b3wm90n1-pooler.c-4.ap-southeast-1.aws.neon.tech
   Region: AWS AP-Southeast-1 (Singapore)
   Connection URI: postgresql://neondb_owner:***@ep-icy-surf-b3wm90n1-pooler.c-4.ap-southeast-1.aws.neon.tech/moonshot_db?sslmode=require

5. ENVIRONMENT VARIABLES FOR CLOUD HOST:
   PORT=3000
   NODE_ENV=production
   GROQ_API_KEY=[Configured in Render / Railway Environment]
   DATABASE_URL=[Configured in Render / Railway Environment]

6. LOCAL STUDIO PREVIEW & EDITING (WHEN RUNNING LOCALLY):
   http://localhost:3000/studio/proj_demo_1
   http://localhost:3000/studio/proj_mv7gvbgy_uq72r (Video 1: 3D Hero Dimension Story)
   http://localhost:3000/studio/proj_mv7057hy_bzg0b (Video 2: Social Word Pink Karaoke)

=====================================================
Generated automatically on 2026-10-14
`;

      await gdrive.uploadTextFile(folder.id, 'Moonshot_App_Links.txt', linksContent, 'text/plain');

      const htmlPortal = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Moonshot AI Video Editor - Cloud Portal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 40px 20px; }
    .card { max-width: 680px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { margin-top: 0; font-size: 26px; background: linear-gradient(135deg, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 9999px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; text-decoration: none; font-weight: 700; margin: 8px 6px 8px 0; }
    .btn-secondary { background: #27272a; color: #e4e4e7; border: 1px solid #3f3f46; }
    .section { margin: 24px 0; padding: 16px; background: #09090b; border-radius: 10px; border: 1px solid #27272a; font-size: 14px; line-height: 1.6; }
    code { background: #27272a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #a5b4fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Moonshot AI Video Editor</h1>
    <p>Permanent cloud deployment portal, repository, and infrastructure links.</p>
    <div style="margin: 20px 0;">
      <a class="btn" href="https://render.com/deploy?repo=https://github.com/akashkumart2x-tech/moonshot-clone" target="_blank">Deploy to Render (1-Click)</a>
      <a class="btn btn-secondary" href="https://github.com/akashkumart2x-tech/moonshot-clone" target="_blank">View GitHub Repo</a>
    </div>
    <div class="section">
      <strong>Cloud PostgreSQL Database:</strong><br/>
      Cluster: <code>muddy-butterfly-77662263</code> (Neon AWS AP-Southeast-1)<br/>
      Database: <code>moonshot_db</code> (Pre-seeded with 54 projects & renders)
    </div>
  </div>
</body>
</html>`;
      await gdrive.uploadTextFile(folder.id, 'Moonshot_Portal.html', htmlPortal, 'text/html');

      const folderLink = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Google Drive Upload Complete</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { max-width: 580px; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 36px; text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.6); }
            h2 { color: #22c55e; margin-top: 0; font-size: 24px; }
            p { color: #d4d4d8; font-size: 15px; line-height: 1.6; }
            .btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 9999px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 16px; font-weight: 700; text-decoration: none; margin-top: 24px; box-shadow: 0 8px 24px rgba(16,185,129,0.4); }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>✅ Moonshot Folder Created on Google Drive!</h2>
            <p>The <strong>Moonshot</strong> folder was successfully created in your Google Drive and the cloud deployment links have been uploaded.</p>
            <p style="color:#a1a1aa;font-size:14px;">Uploaded files: <code>Moonshot_App_Links.txt</code> and <code>Moonshot_Portal.html</code></p>
            <a class="btn" href="${folderLink}" target="_blank">Open Moonshot Folder in Google Drive ➔</a>
          </div>
        </body>
        </html>
      `);
    } catch (e) {
      console.error('[Google Drive Error]', e);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:30px;border-radius:12px;background:#18181b;color:#f4f4f5;text-align:center;">
          <h2 style="color:#ef4444;">Google Drive Upload Failed</h2>
          <p>${e.message}</p>
          <a href="/api/auth/google/login" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none;margin-top:20px;font-weight:700;">Retry Authorization</a>
        </div>
      `);
    }
  }

  // Root Homepage
  if (pathname === '/' || pathname === '/index.html') {
    const indexFile = path.join(__dirname, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return fs.createReadStream(indexFile).pipe(res);
  }

  // Direct disk file check
  let diskFile = path.join(__dirname, pathname);
  if (fs.existsSync(diskFile) && !fs.statSync(diskFile).isDirectory()) {
    const ext = path.extname(diskFile).toLowerCase();
    if (ext === '.mp4' || ext === '.webm') {
      return streamVideo(diskFile, req, res);
    }
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return fs.createReadStream(diskFile).pipe(res);
  }

  // Fallback to index.html for client-side navigation
  const fallback = path.join(__dirname, 'index.html');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(fallback).pipe(res);
});

// Listen on all network interfaces (IPv4/IPv6 container support)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ======================================================`);
  console.log(`  🚀 Moonshot Rebuilt Server Active on 0.0.0.0:${PORT}!`);
  console.log(`  ➜ Localhost: http://localhost:${PORT}`);
  console.log(`  ➜ Studio:    http://localhost:${PORT}/studio/proj_demo_1`);
  console.log(`  ======================================================\n`);
});
