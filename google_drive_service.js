const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Readable } = require('stream');

let CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  const localConfigPath = path.join(__dirname, '..', 'copilotkit-app', 'data', 'oauth_config.json');
  if (fs.existsSync(localConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
      CLIENT_ID = cfg.clientId;
      CLIENT_SECRET = cfg.clientSecret;
    } catch (e) {}
  }
}

const TOKENS_PATH = path.join(__dirname, 'data', 'google_drive_tokens.json');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email'
];

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (fs.existsSync(TOKENS_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
      oauth2Client.setCredentials(tokens);
    } catch (e) {
      console.warn('[Google Drive] Could not parse tokens:', e.message);
    }
  }
  return oauth2Client;
}

function getAuthUrl(state = '') {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    login_hint: 'akashkumart2x@gmail.com',
    state
  });
}

async function handleCallback(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  console.log('[Google Drive] Saved new OAuth tokens to disk.');
  return client;
}

function isConnected() {
  if (!fs.existsSync(TOKENS_PATH)) return false;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    return !!(tokens.access_token || tokens.refresh_token);
  } catch {
    return false;
  }
}

async function getOrCreateFolder(folderName = 'Moonshot') {
  const client = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth: client });

  // Check if folder already exists
  const listRes = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive'
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    const existing = listRes.data.files[0];
    console.log(`[Google Drive] Found existing '${folderName}' folder:`, existing.id);
    return existing;
  }

  // Create folder
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  const createRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name, webViewLink'
  });

  console.log(`[Google Drive] Created new '${folderName}' folder:`, createRes.data.id);
  return createRes.data;
}

async function uploadTextFile(folderId, fileName, content, mimeType = 'text/plain') {
  const client = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };

  const media = {
    mimeType,
    body: stream
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink'
  });

  console.log(`[Google Drive] Uploaded '${fileName}' to folder:`, file.data.id, file.data.webViewLink);
  return file.data;
}

module.exports = {
  getAuthUrl,
  handleCallback,
  isConnected,
  getOrCreateFolder,
  uploadTextFile
};
