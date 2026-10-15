const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Readable } = require('stream');

let CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// Load from local ignored credentials file if present
try {
  const credsPath = path.join(__dirname, 'google_credentials.json');
  if ((!CLIENT_ID || !CLIENT_SECRET) && fs.existsSync(credsPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    CLIENT_ID = CLIENT_ID || creds.clientId || creds.client_id || '';
    CLIENT_SECRET = CLIENT_SECRET || creds.clientSecret || creds.client_secret || '';
  }
} catch (e) {}

const DEFAULT_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://moonshot-video-editor.onrender.com/api/auth/google/callback';

const TOKENS_PATH = path.join(__dirname, 'data', 'google_drive_tokens.json');
let inMemoryTokens = null;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email'
];

function setTokens(tokens) {
  inMemoryTokens = tokens;
  try {
    fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true });
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Google Drive] Could not write tokens to disk:', e.message);
  }
}

function getTokens() {
  if (inMemoryTokens) return inMemoryTokens;
  if (fs.existsSync(TOKENS_PATH)) {
    try {
      inMemoryTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
      return inMemoryTokens;
    } catch (e) {}
  }
  return null;
}

function getOAuthClient(redirectUri = null) {
  const redirect = redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirect);
  const tokens = getTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }
  return oauth2Client;
}

function getAuthUrl(redirectUri = null, state = '') {
  const client = getOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    login_hint: 'akashkumart2x@gmail.com',
    state
  });
}

async function handleCallback(code, redirectUri = null) {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  setTokens(tokens);
  console.log('[Google Drive] Saved and activated new OAuth tokens.');
  return { client, tokens };
}

function isConnected() {
  const tokens = getTokens();
  return !!(tokens && (tokens.access_token || tokens.refresh_token));
}

async function getOrCreateFolder(folderName = 'Moonshot', redirectUri = null) {
  const client = getOAuthClient(redirectUri);
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

async function uploadTextFile(folderId, fileName, content, mimeType = 'text/plain', redirectUri = null) {
  const client = getOAuthClient(redirectUri);
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

async function uploadMediaFile(folderId, fileName, filePath, mimeType = 'video/mp4', redirectUri = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist on disk: ${filePath}`);
  }

  const client = getOAuthClient(redirectUri);
  const drive = google.drive({ version: 'v3', auth: client });

  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };

  const media = {
    mimeType,
    body: fs.createReadStream(filePath)
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink, size'
  });

  console.log(`[Google Drive] Uploaded media '${fileName}' (${fs.statSync(filePath).size} bytes) ->`, file.data.id, file.data.webViewLink);
  return file.data;
}

function setCredentials(clientId, clientSecret) {
  if (clientId) CLIENT_ID = clientId;
  if (clientSecret) CLIENT_SECRET = clientSecret;
}

module.exports = {
  getAuthUrl,
  handleCallback,
  isConnected,
  getOrCreateFolder,
  uploadTextFile,
  uploadMediaFile,
  setTokens,
  getTokens,
  setCredentials
};
