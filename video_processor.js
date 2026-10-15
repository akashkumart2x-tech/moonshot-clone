const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Inspect video using ffprobe
 */
function probeVideo(filePath) {
  try {
    const stdout = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`, {
      timeout: 15000
    }).toString();
    const json = JSON.parse(stdout);
    const vStream = json.streams?.find(s => s.codec_type === 'video');
    const aStream = json.streams?.find(s => s.codec_type === 'audio');
    
    let duration = parseFloat(json.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = parseFloat(vStream?.duration || 10);
    }
    duration = Number(duration.toFixed(2));

    const width = parseInt(vStream?.width || 1080);
    const height = parseInt(vStream?.height || 1920);
    
    let fps = 30;
    if (vStream?.r_frame_rate) {
      const parts = vStream.r_frame_rate.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round(Number(parts[0]) / Number(parts[1]));
      }
    }

    const size = parseInt(json.format?.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0));
    let sha256 = 'unknown';
    if (fs.existsSync(filePath)) {
      const fileBytes = fs.readFileSync(filePath);
      sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
    }

    return {
      duration,
      width,
      height,
      fps: fps || 30,
      hasAudio: !!aStream,
      codec: vStream?.codec_name || 'h264',
      size,
      sha256
    };
  } catch (err) {
    console.error(`[video_processor] ffprobe error on ${filePath}:`, err.message);
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: 0 };
    return {
      duration: 10,
      width: 1080,
      height: 1920,
      fps: 30,
      hasAudio: false,
      codec: 'h264',
      size: stat.size,
      sha256: 'unknown'
    };
  }
}

/**
 * Extract audio from video into 16kHz mono WAV for speech recognition
 */
function extractAudio(videoPath, audioPath) {
  try {
    const dir = path.dirname(audioPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const probe = probeVideo(videoPath);
    if (!probe.hasAudio) {
      console.log(`[video_processor] Video has no audio track: ${videoPath}`);
      return false;
    }

    execSync(
      `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`,
      { timeout: 45000, stdio: 'pipe' }
    );
    return fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1000;
  } catch (err) {
    console.warn(`[video_processor] Audio extraction warning for ${videoPath}:`, err.message);
    return false;
  }
}

/**
 * Transcribe audio using high-accuracy multimodal engine (Groq Whisper-large-v3 / Sarvam AI / OpenAI)
 */
function transcribeAudio(audioPath, jsonOutputPath = null, preferredProvider = 'auto') {
  try {
    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1000) {
      console.log(`[video_processor] Audio file empty or non-existent (${audioPath})`);
      return { language: 'en', duration: 0, transcript: [], wordCount: 0 };
    }

    const transcribeScript = path.join(__dirname, 'transcribe_engine.py');
    const targetJson = jsonOutputPath || path.join(path.dirname(audioPath), 'transcript.json');
    const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const cmd = `"${pythonBin}" "${transcribeScript}" "${audioPath}" "${targetJson}"`;

    execSync(cmd, {
      timeout: 120000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    });

    if (fs.existsSync(targetJson)) {
      const result = JSON.parse(fs.readFileSync(targetJson, 'utf8'));
      console.log(`[video_processor] High-accuracy transcription complete: ${result.wordCount} words detected (${result.language}) via engine ${result.engine}.`);
      return result;
    } else {
      throw new Error(`Transcript file was not created: ${targetJson}`);
    }
  } catch (err) {
    console.error(`[video_processor] High-accuracy transcription failed:`, err.message);
    return { language: 'en', duration: 0, transcript: [], wordCount: 0, error: err.message };
  }
}

/**
 * Generate fast-start H.264 preview proxy satisfying Moonshot contract (.preview-WxH-v7.mp4)
 */
function generatePreviewProxy(sourcePath, previewPath) {
  try {
    const dir = path.dirname(previewPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const probe = probeVideo(sourcePath);
    const audioFlag = probe.hasAudio ? '-c:a aac -b:a 128k' : '-an';

    execSync(
      `ffmpeg -y -i "${sourcePath}" -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -movflags +faststart ${audioFlag} "${previewPath}"`,
      { timeout: 60000, stdio: 'pipe' }
    );
    return true;
  } catch (err) {
    console.error(`[video_processor] Preview generation failed for ${sourcePath}:`, err.message);
    fs.copyFileSync(sourcePath, previewPath);
    return false;
  }
}

/**
 * Load complete Moonshot preset definitions (234 presets)
 */
let OFFICIAL_PRESETS = [];
let OFFICIAL_PRESETS_MAP = {};
try {
  const presetsPath = path.join(__dirname, 'presets.json');
  if (fs.existsSync(presetsPath)) {
    OFFICIAL_PRESETS = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    OFFICIAL_PRESETS.forEach(p => {
      if (p.id) OFFICIAL_PRESETS_MAP[p.id] = p;
    });
  }
} catch (err) {
  console.warn('[video_processor] Could not load presets.json:', err.message);
}

/**
 * High-fidelity font mapping for ASS subtitle rendering
 */
const FONT_MAP = {
  'libre-baskerville': 'Georgia',
  'instrument-serif': 'Georgia',
  'dm-serif': 'Georgia',
  'playfair-display': 'Georgia',
  'unna': 'Georgia',
  'gloock': 'Georgia',
  'anton': 'Impact',
  'archivo-black': 'Impact',
  'black-han-sans': 'Impact',
  'passion-one': 'Impact',
  'bebas-neue': 'Impact',
  'cousine-bold': 'Courier New',
  'space-mono': 'Courier New',
  'google:Oxygen%20Mono': 'Courier New',
  'google:Courier%20Prime': 'Courier New',
  'montserrat-bold': 'Montserrat',
  'montserrat': 'Montserrat',
  'montserrat-black': 'Montserrat',
  'poppins-bold': 'Poppins',
  'poppins-medium': 'Poppins',
  'baloo-2': 'Trebuchet MS',
  'bricolage-grotesque': 'Trebuchet MS',
  'nunito-black': 'Trebuchet MS',
  'fredoka-one': 'Trebuchet MS',
  'luckiest-guy': 'Trebuchet MS',
  'bagel-fat': 'Trebuchet MS',
  'sour-gummy': 'Trebuchet MS',
  'gloria-hallelujah': 'Comic Sans MS',
  'just-me-again': 'Comic Sans MS',
  'caveat-brush': 'Comic Sans MS',
  'caveat-bold': 'Comic Sans MS',
  'dancing-script': 'Segoe Script',
  'shadows-into-light': 'Comic Sans MS',
  'parisienne': 'Segoe Script',
  'inter-tight-extrabold': 'Segoe UI',
  'inter-bold': 'Segoe UI',
  'inter-black': 'Segoe UI',
  'inter-regular': 'Segoe UI',
  'inter-medium': 'Segoe UI',
  'inter-tight-semibold': 'Segoe UI',
  'roboto': 'Arial',
  'roboto-condensed': 'Arial'
};

/**
 * Convert Hex color #RRGGBB, #RRGGBBAA, rgb(...), or rgba(...) to ASS color format &HAABBGGRR&
 */
function parseColorToAss(colorStr, defaultColor = '&H00FFFFFF&') {
  if (!colorStr || typeof colorStr !== 'string') return defaultColor;
  const str = colorStr.trim();
  if (str === 'transparent') return '&HFF000000&';

  if (str.startsWith('#')) {
    let clean = str.slice(1);
    if (clean.length === 3) clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    if (clean.length === 6) {
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      return `&H00${b}${g}${r}&`;
    }
    if (clean.length === 8) {
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      const a = (255 - parseInt(clean.slice(6, 8), 16)).toString(16).padStart(2, '0');
      return `&H${a}${b}${g}${r}&`;
    }
  }

  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    let alpha = 0;
    if (rgbMatch[4] !== undefined) {
      alpha = Math.round((1 - Math.max(0, Math.min(1, parseFloat(rgbMatch[4])))) * 255);
    }
    const aHex = alpha.toString(16).padStart(2, '0');
    return `&H${aHex}${b}${g}${r}&`;
  }

  return defaultColor;
}

function hexToAssColor(hex, defaultColor = '&H00FFFFFF&') {
  return parseColorToAss(hex, defaultColor);
}

/**
 * Format seconds to ASS timestamp (H:MM:SS.cc)
 */
function formatAssTime(sec) {
  const totalSec = Math.max(0, sec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  const cs = Math.floor((totalSec % 1) * 100).toString().padStart(2, '0');
  return `${h}:${m}:${s}.${cs}`;
}

/**
 * Format seconds to SRT timestamp 00:00:00,000
 */
function formatSrtTime(sec) {
  const totalSec = Math.max(0, sec);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  const ms = Math.floor((totalSec % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

/**
 * Moonshot Preset Style Dictionary matching in-editor preview exactly
 */
const PRESET_STYLES = {
  'social-word-pink': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#FF6FA5',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4.5,
    strokeColor: '#141414',
    shadowPx: 3,
    shadowColor: '#000000',
    captionEffect: 'karaoke',
    isBold: true
  },
  'social-green-word': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#3DDC97',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4.5,
    strokeColor: '#141414',
    shadowPx: 3,
    shadowColor: '#000000',
    captionEffect: 'karaoke',
    isBold: true
  },
  'social-yellow': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#FFE500',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4.5,
    strokeColor: '#141414',
    shadowPx: 3,
    shadowColor: '#000000',
    captionEffect: 'karaoke',
    isBold: true
  },
  'social-mint': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#8FE04F',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4.5,
    strokeColor: '#141414',
    shadowPx: 3,
    shadowColor: '#000000',
    captionEffect: 'karaoke',
    isBold: true
  },
  'social-3d': {
    fontFamily: 'Montserrat',
    fontStyle: 'italic',
    fontSizePx: 88,
    color: '#2B6FFF',
    emphasisColor: '#2B6FFF',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 5,
    strokeColor: '#FFFFFF',
    shadowPx: 4,
    shadowColor: '#0B2E7A',
    captionEffect: 'word',
    isBold: true
  },
  'social-pink': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#FF2D9A',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4,
    strokeColor: '#141414',
    captionEffect: 'karaoke',
    isBold: true
  },
  'social-caps': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#FFFFFF',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4,
    strokeColor: '#141414',
    captionEffect: 'word',
    isBold: true
  },
  'social-outline': {
    fontFamily: 'Montserrat',
    fontSizePx: 85,
    color: '#FFFFFF',
    emphasisColor: '#FFFFFF',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 6,
    strokeColor: '#141414',
    captionEffect: 'word',
    isBold: true
  },
  'social-card': {
    fontFamily: 'Montserrat',
    fontSizePx: 80,
    color: '#111111',
    emphasisColor: '#111111',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 0,
    captionEffect: 'none',
    isBold: true
  },
  'dimension-story': {
    fontFamily: 'Poppins',
    fontSizePx: 104,
    color: '#FFFFFF',
    emphasisColor: '#EC00B5',
    textTransform: 'uppercase',
    positionYPct: 0.47,
    strokePx: 4.5,
    strokeColor: '#141414',
    captionEffect: 'word',
    isBold: true
  },
  'reach-counter': {
    fontFamily: 'Poppins',
    fontSizePx: 104,
    color: '#FFFFFF',
    emphasisColor: '#FFE600',
    textTransform: 'uppercase',
    positionYPct: 0.47,
    strokePx: 4.5,
    strokeColor: '#141414',
    captionEffect: 'word',
    isBold: true
  },
  'still-time': {
    fontFamily: 'Impact',
    fontSizePx: 88,
    color: '#FFF5D6',
    emphasisColor: '#FFF5D6',
    textTransform: 'uppercase',
    positionYPct: 0.72,
    strokePx: 4.5,
    strokeColor: '#141414',
    captionEffect: 'none',
    isBold: true
  },
  'chapter-one': {
    fontFamily: 'Courier New',
    fontSizePx: 60,
    color: '#FFF5D6',
    emphasisColor: '#FFF5D6',
    textTransform: 'none',
    positionYPct: 0.72,
    strokePx: 4.5,
    strokeColor: '#141414',
    captionEffect: 'none',
    isBold: true
  },
  'slow-mornings': {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSizePx: 68,
    color: '#FFF5D6',
    emphasisColor: '#FFF5D6',
    textTransform: 'none',
    positionYPct: 0.72,
    strokePx: 4.5,
    strokeColor: '#141414',
    captionEffect: 'none',
    isBold: false
  },
  'lime-stack': {
    fontFamily: 'Montserrat',
    fontSizePx: 95,
    color: '#FFFFFF',
    emphasisColor: '#F9FD45',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4,
    strokeColor: '#141414',
    captionEffect: 'karaoke',
    isBold: true
  },
  'lime-impact': {
    fontFamily: 'Montserrat',
    fontSizePx: 90,
    color: '#FFFFFF',
    emphasisColor: '#7FFF33',
    textTransform: 'uppercase',
    positionYPct: 0.78,
    strokePx: 4,
    strokeColor: '#141414',
    captionEffect: 'karaoke',
    isBold: true
  },
  'black-ink': {
    fontFamily: 'Impact',
    fontSizePx: 85,
    color: '#000000',
    emphasisColor: '#000000',
    strokePx: 4.5,
    strokeColor: '#FFFFFF',
    textTransform: 'uppercase',
    positionYPct: 0.75,
    captionEffect: 'none',
    isBold: true
  }
};

/**
 * Resolve effective style combining preset defaults and project custom overrides
 */
function resolveCaptionStyle(project) {
  const presetId = project?.presetId || 'social-word-pink';
  const official = OFFICIAL_PRESETS_MAP[presetId];
  const hardcoded = PRESET_STYLES[presetId];
  const override = project?.captionStyleOverride || {};

  let base = null;
  if (official) {
    const rawFont = official.fontFamily || 'Montserrat';
    const mappedFont = FONT_MAP[rawFont] || FONT_MAP[rawFont.toLowerCase()] || rawFont.split(',')[0].trim().replace(/['"]/g, '');
    const isItalic = (official.desc && official.desc.toLowerCase().includes('italic')) || official.fontStyle === 'italic';
    const isBold = rawFont.includes('bold') || rawFont.includes('black') || rawFont === 'anton' || (official.strokePx && official.strokePx > 3) || (official.desc && official.desc.toLowerCase().includes('bold'));

    let textColor = official.color || '#FFFFFF';
    let shadowColor = '#000000';
    if (textColor.startsWith('rgba(0,0,0') || textColor.startsWith('rgba(0, 0, 0')) {
      shadowColor = textColor;
      textColor = '#FFFFFF';
    }

    base = {
      presetId: official.id,
      name: official.name,
      category: official.category,
      fontFamily: mappedFont,
      fontStyle: isItalic ? 'italic' : 'normal',
      fontSizePx: official.fontSizePx || 85,
      color: textColor,
      emphasisColor: official.emphasisColor || '#FFE600',
      textTransform: official.textTransform || 'none',
      positionYPct: official.positionYPct !== undefined ? official.positionYPct : 0.75,
      strokePx: official.strokePx !== undefined ? official.strokePx : 4.5,
      strokeColor: official.strokeColor || '#141414',
      shadowPx: (official.category === 'social' || official.category === 'dynamic') ? 3 : 2,
      shadowColor: shadowColor,
      captionEffect: official.captionEffect || 'none',
      animIn: official.animIn || 'none',
      isBold: isBold
    };
  } else if (hardcoded) {
    base = { ...hardcoded, presetId };
  } else {
    base = { ...PRESET_STYLES['social-word-pink'], presetId: 'social-word-pink' };
  }

  return {
    presetId,
    name: base.name || presetId,
    category: base.category || 'social',
    fontFamily: override.fontFamily || base.fontFamily,
    fontStyle: override.fontStyle || base.fontStyle || 'normal',
    fontSizePx: override.fontSizePx || base.fontSizePx,
    color: override.color || base.color,
    emphasisColor: override.emphasisColor || base.emphasisColor,
    textTransform: override.textTransform || base.textTransform,
    positionYPct: override.positionYPct !== undefined ? override.positionYPct : base.positionYPct,
    strokePx: override.strokePx !== undefined ? override.strokePx : base.strokePx,
    strokeColor: override.strokeColor || base.strokeColor || '#141414',
    shadowPx: override.shadowPx !== undefined ? override.shadowPx : (base.shadowPx || 2),
    shadowColor: override.shadowColor || base.shadowColor || '#000000',
    captionEffect: override.captionEffect || base.captionEffect || 'none',
    animIn: override.animIn || base.animIn || 'none',
    isBold: override.isBold !== undefined ? override.isBold : base.isBold
  };
}

const DIMENSION_ACCENT_COLORS = ['#47D8EC', '#ED48C5', '#EFE676', '#F47E5C'];
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'
]);

function pickHeroWord(words) {
  if (!words || words.length === 0) return null;
  const manual = words.find(w => w.highlight || w.style?.highlight || (w.emphasisTier && w.emphasisTier >= 1) || w.color || w.style?.color);
  if (manual) return manual;

  let best = null;
  let bestScore = -1;
  words.forEach(w => {
    const raw = (w.textLatn || w.text || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    const isStop = STOP_WORDS.has(raw);
    const score = (isStop ? 0 : 10) + raw.length;
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  });
  return best || words[Math.floor(words.length / 2)] || words[0];
}

/**
 * Generate Multi-Line 3D Hero ASS subtitles for presets with creator treatments (e.g. dimension-story)
 */
function generateMultiLineHeroAss(project, videoWidth = 1080, videoHeight = 1920, preferredScript = 'latn') {
  const transcript = project.transcript || [];
  if (!transcript || transcript.length === 0) return '';

  const scale = videoHeight / 1920;
  const leadFs = Math.max(28, Math.round(95 * scale));
  const heroFs = Math.max(60, Math.round(260 * scale));
  const tailFs = Math.max(28, Math.round(95 * scale));
  const behindFs = Math.max(24, Math.round(80 * scale));

  const cx = Math.round(videoWidth / 2);
  const behindY = Math.round(0.19 * videoHeight);
  const leadY = Math.round(0.445 * videoHeight);
  const heroY = Math.round(0.518 * videoHeight);
  const tailY = Math.round(0.588 * videoHeight);

  const header = `[Script Info]
Title: Moonshot Multi-Line 3D Hero Export - dimension-story
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Lead,Arial,${leadFs},&H00FFFFFF&,&H000000FF&,&H00141414&,&H80000000&,1,0,0,0,100,100,0,0,1,3,4,2,10,10,10,1
Style: Tail,Arial,${tailFs},&H00FFFFFF&,&H000000FF&,&H00141414&,&H80000000&,1,1,0,0,100,100,0,0,1,3,4,2,10,10,10,1
Style: Behind,Segoe Print,${behindFs},&H00EF46D9&,&H000000FF&,&H00141414&,&H80000000&,1,1,0,0,100,100,0,0,1,3,4,2,10,10,10,1
Style: HeroShadow,Arial Black,${heroFs},&H00150E18&,&H000000FF&,&H00150E18&,&H00150E18&,1,0,0,0,100,100,-2,0,1,8,0,2,10,10,10,1
Style: HeroMid,Arial Black,${heroFs},&H003B2529&,&H000000FF&,&H003B2529&,&H003B2529&,1,0,0,0,100,100,-2,0,1,5,0,2,10,10,10,1
Style: HeroFace,Arial Black,${heroFs},&H005C7EF4&,&H000000FF&,&H00141414&,&H00000000&,1,0,0,0,100,100,-2,0,1,3,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = [];

  // Dynamic 3D Hero Generation directly from the project's actual transcript
  transcript.forEach((seg, idx) => {
    const segStart = seg.start;
    const segEnd = seg.end;
    const startAss = formatAssTime(segStart);
    const endAss = formatAssTime(segEnd);
    const words = seg.words || [];

    if (idx > 0) {
      const prevSeg = transcript[idx - 1];
      const prevWords = prevSeg?.words || [];
      const prevText = prevWords.map(w => preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text)).join(' ').trim();
      if (prevText) {
        dialogueLines.push(`Dialogue: 1,${startAss},${endAss},Behind,,0,0,0,,{\\pos(${cx},${behindY})}${prevText}`);
      }
    }

    if (words.length > 0) {
      let heroWord = pickHeroWord(words);
      let heroColorHex = DIMENSION_ACCENT_COLORS[idx % DIMENSION_ACCENT_COLORS.length];
      if (heroWord && (heroWord.color || heroWord.style?.color)) {
        heroColorHex = heroWord.color || heroWord.style?.color;
      }

      const heroAssColor = hexToAssColor(heroColorHex, '&H005C7EF4&');
      const heroIdx = words.indexOf(heroWord);
      const leadWords = heroIdx > 0 ? words.slice(0, heroIdx) : [];
      const tailWords = heroIdx !== -1 && heroIdx < words.length - 1 ? words.slice(heroIdx + 1) : [];

      const leadText = leadWords.map(w => preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text)).join(' ').toLowerCase();
      const heroText = (preferredScript === 'devanagari' ? heroWord.text : (heroWord.textLatn || heroWord.text)).toLowerCase();
      const tailText = tailWords.map(w => preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text)).join(' ').toLowerCase();

      if (leadText) {
        dialogueLines.push(`Dialogue: 2,${startAss},${endAss},Lead,,0,0,0,,{\\pos(${cx},${leadY})}${leadText}`);
      }

      dialogueLines.push(`Dialogue: 2,${startAss},${endAss},HeroShadow,,0,0,0,,{\\pos(${cx + 8},${heroY + 8})}${heroText}`);
      dialogueLines.push(`Dialogue: 3,${startAss},${endAss},HeroMid,,0,0,0,,{\\pos(${cx + 4},${heroY + 4})}${heroText}`);
      dialogueLines.push(`Dialogue: 4,${startAss},${endAss},HeroFace,,0,0,0,,{\\c${heroAssColor}\\pos(${cx},${heroY})}${heroText}`);

      if (tailText) {
        dialogueLines.push(`Dialogue: 2,${startAss},${endAss},Tail,,0,0,0,,{\\pos(${cx},${tailY})}${tailText}`);
      }
    }
  });

  return header + dialogueLines.join('\n') + '\n';
}

/**
 * Generate ASS content matching editor preview typography, positioning, colors and highlights
 */
function generateAssContent(projectOrTranscript, videoWidth = 1080, videoHeight = 1920, preferredScript = 'latn') {
  const project = (typeof projectOrTranscript === 'object' && !Array.isArray(projectOrTranscript))
    ? projectOrTranscript
    : { transcript: projectOrTranscript };

  const transcript = project.transcript || [];
  if (!transcript || transcript.length === 0) return '';

  const style = resolveCaptionStyle(project);

  // If preset is dimension-story or real-estate creator treatment, render multi-line 3D hero layout!
  if (style.presetId === 'dimension-story' || style.creatorTreatment === 'dimension-story' || style.category === 'real-estate') {
    return generateMultiLineHeroAss(project, videoWidth, videoHeight, preferredScript);
  }

  const clips = project.clips || null;

  // Scale typography proportionally to actual video resolution (calibrated against 1080x1920 reference)
  const refHeight = 1920;
  const scale = videoHeight / refHeight;
  const scaledFontSize = Math.max(24, Math.round(style.fontSizePx * scale));

  // Align vertical position to match preview positionYPct
  // positionYPct is distance from top (e.g. 0.78 = 78% from top = 22% from bottom)
  const marginV = Math.max(40, Math.round(videoHeight * (1 - style.positionYPct) - (scaledFontSize * 0.4)));
  const marginH = Math.max(30, Math.round(videoWidth * 0.05));
  const outlinePx = Math.max(1.2, Math.round(style.strokePx * scale));
  const shadowPx = Math.max(0, Math.round((style.shadowPx || 2) * scale));

  const primaryAssColor = parseColorToAss(style.color, '&H00FFFFFF&');
  const emphasisAssColor = parseColorToAss(style.emphasisColor, '&H0000E6FF&');
  const outlineAssColor = parseColorToAss(style.strokeColor, '&H00141414&');
  const shadowAssColor = parseColorToAss(style.shadowColor, '&H80000000&');

  // ASS format strictly uses comma as CSV field separator. Extract single font name without commas.
  let fontName = 'Arial';
  if (style.fontFamily) {
    const candidate = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    if (candidate) fontName = candidate;
  }

  const isAnimated = style.captionEffect === 'word' ||
                    style.captionEffect === 'karaoke' ||
                    style.captionEffect === 'weight-karaoke' ||
                    style.captionEffect === 'bounce' ||
                    style.captionEffect === 'pulse' ||
                    style.category === 'social' ||
                    style.category === 'dynamic';

  const header = `[Script Info]
Title: Moonshot Export Subtitles - ${style.presetId}
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${scaledFontSize},${primaryAssColor},&H000000FF&,${outlineAssColor},${shadowAssColor},${style.isBold ? 1 : 0},${style.fontStyle === 'italic' ? 1 : 0},0,0,100,100,0,0,1,${outlinePx},${shadowPx},2,${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = [];

  transcript.forEach((seg, idx) => {
    let segStart = seg.start;
    let segEnd = seg.end;

    // Check if timeline clips provide custom timing adjustments
    if (clips && Array.isArray(clips)) {
      const clip = clips.find(c => c.kind === 'caption' && (
        c.id === `clip_c_${idx + 1}` ||
        (Array.isArray(c.wordIds) && seg.words?.some(w => c.wordIds.includes(w.id)))
      ));
      if (clip) {
        segStart = clip.start;
        segEnd = Number((clip.start + clip.duration).toFixed(2));
      }
    }

    const words = seg.words || [];

    if (isAnimated && words.length > 0) {
      // Generate word-by-word active karaoke dialogue frames matching preview speaking progress
      for (let i = 0; i < words.length; i++) {
        const activeWord = words[i];
        const wStart = (i === 0) ? Math.min(segStart, activeWord.start) : Math.max(segStart, activeWord.start);
        const nextWord = words[i + 1];
        const wEnd = nextWord ? Math.max(wStart + 0.05, nextWord.start) : Math.max(wStart + 0.1, Math.max(activeWord.end, segEnd));

        const startAss = formatAssTime(wStart);
        const endAss = formatAssTime(wEnd);

        const textWithHighlights = words.map((w, j) => {
          let rawText = (preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text)) || '';
          if (style.textTransform === 'uppercase') rawText = rawText.toUpperCase();
          else if (style.textTransform === 'lowercase') rawText = rawText.toLowerCase();

          const hasManualHighlight = !!w.highlight ||
                                    !!w.emphasis ||
                                    (w.emphasisTier !== undefined && w.emphasisTier >= 1) ||
                                    w.role === 'impact' ||
                                    !!w.style?.highlight ||
                                    !!w.color ||
                                    !!w.style?.color;

          const isActiveSpeaking = (j === i);

          if (hasManualHighlight) {
            const manualColor = w.color || w.style?.color || style.emphasisColor;
            const assColor = parseColorToAss(manualColor, emphasisAssColor);
            const boldTag = (w.isBold || style.isBold) ? '\\b1' : '\\b0';
            return `{\\c${assColor}${boldTag}}${rawText}{\\c${primaryAssColor}${style.isBold ? '\\b1' : '\\b0'}}`;
          } else if (isActiveSpeaking) {
            const boldTag = '\\b1';
            return `{\\c${emphasisAssColor}${boldTag}}${rawText}{\\c${primaryAssColor}${style.isBold ? '\\b1' : '\\b0'}}`;
          } else {
            return rawText;
          }
        }).join(' ');

        dialogueLines.push(`Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${textWithHighlights}`);
      }
    } else {
      // Static preset or single dialogue event
      const startAss = formatAssTime(segStart);
      const endAss = formatAssTime(segEnd);

      let textWithHighlights = '';
      if (words.length > 0) {
        textWithHighlights = words.map(w => {
          let rawText = (preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text)) || '';
          if (style.textTransform === 'uppercase') rawText = rawText.toUpperCase();
          else if (style.textTransform === 'lowercase') rawText = rawText.toLowerCase();

          const hasManualHighlight = !!w.highlight ||
                                    !!w.emphasis ||
                                    (w.emphasisTier !== undefined && w.emphasisTier >= 1) ||
                                    w.role === 'impact' ||
                                    !!w.style?.highlight ||
                                    !!w.color ||
                                    !!w.style?.color;

          const wordColor = w.color || w.style?.color || (hasManualHighlight ? style.emphasisColor : style.color);
          const isBold = w.isBold !== undefined ? w.isBold : (w.style?.isBold !== undefined ? w.style.isBold : (hasManualHighlight || style.isBold));

          if (hasManualHighlight || (wordColor && wordColor.toUpperCase() !== style.color.toUpperCase())) {
            const assColor = parseColorToAss(wordColor, emphasisAssColor);
            const boldTag = isBold ? '\\b1' : '\\b0';
            return `{\\c${assColor}${boldTag}}${rawText}{\\c${primaryAssColor}${style.isBold ? '\\b1' : '\\b0'}}`;
          } else if (isBold && !style.isBold) {
            return `{\\b1}${rawText}{\\c${primaryAssColor}\\b0}`;
          } else {
            return rawText;
          }
        }).join(' ');
      } else {
        let rawText = (preferredScript === 'devanagari' ? seg.text : (seg.textLatn || seg.text)) || '';
        if (style.textTransform === 'uppercase') rawText = rawText.toUpperCase();
        textWithHighlights = rawText;
      }

      dialogueLines.push(`Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${textWithHighlights}`);
    }
  });

  return header + dialogueLines.join('\n') + '\n';
}

/**
 * Generate standard SRT content
 */
function generateSrtContent(transcript, clips = null, preferredScript = 'latn') {
  if (!transcript || transcript.length === 0) return '';
  return transcript.map((seg, idx) => {
    let start = seg.start;
    let end = seg.end;

    if (clips && Array.isArray(clips)) {
      const clip = clips.find(c => c.kind === 'caption' && (
        c.id === `clip_c_${idx + 1}` ||
        (Array.isArray(c.wordIds) && seg.words?.some(w => c.wordIds.includes(w.id)))
      ));
      if (clip) {
        start = clip.start;
        end = Number((clip.start + clip.duration).toFixed(2));
      }
    }

    const startStr = formatSrtTime(start);
    const endStr = formatSrtTime(end);

    const wordsText = (seg.words && seg.words.length > 0)
      ? seg.words.map(w => (preferredScript === 'devanagari' ? w.text : (w.textLatn || w.text))).join(' ')
      : null;
    const text = wordsText || (preferredScript === 'devanagari' ? seg.text : (seg.textLatn || seg.text)) || '';

    return `${idx + 1}\n${startStr} --> ${endStr}\n${text}\n`;
  }).join('\n');
}

/**
 * Render exported video using FFmpeg with advanced ASS per-word highlighted subtitles
 * Strictly applies video trims, canvas scaling, typography, and styling matching editor preview
 */
function renderExportVideo(sourcePath, projectOrTranscript, outputPath, title = 'Export') {
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const probe = probeVideo(sourcePath);
  const audioFlag = probe.hasAudio ? '-c:a aac -b:a 256k' : '-an';

  const project = (typeof projectOrTranscript === 'object' && !Array.isArray(projectOrTranscript))
    ? projectOrTranscript
    : { transcript: projectOrTranscript };

  const transcript = project.transcript || [];
  const clips = project.clips || [];
  const preferredScript = project.scriptPreference || 'latn';

  // Target 1080x1920 high definition resolution for vertical studio export
  const targetW = 1080;
  const targetH = 1920;

  // Support video clip timeline trims
  const videoClip = clips.find(c => c.kind === 'video');
  let trimArgs = '';
  if (videoClip) {
    const srcStart = parseFloat(videoClip.sourceStart || 0);
    const srcDuration = parseFloat(videoClip.sourceDuration || videoClip.duration || 0);
    if (srcStart > 0.05) {
      trimArgs += ` -ss ${srcStart.toFixed(2)}`;
    }
    if (srcDuration > 0 && srcDuration < probe.duration - 0.1) {
      trimArgs += ` -t ${srcDuration.toFixed(2)}`;
    }
  }

  const assPath = path.join(outDir, 'captions.ass');
  const assContent = generateAssContent(project, targetW, targetH, preferredScript);
  fs.writeFileSync(assPath, assContent, 'utf8');

  // Also write SRT for reference and download
  const srtPath = path.join(outDir, 'captions.srt');
  const srtContent = generateSrtContent(transcript, clips, preferredScript);
  fs.writeFileSync(srtPath, srtContent, 'utf8');

  if (!transcript || transcript.length === 0) {
    console.log(`[video_processor] No subtitles to burn for ${outputPath}, rendering trimmed source video at 1080p...`);
    execSync(
      `ffmpeg -y -i "${sourcePath}" ${trimArgs} -vf "scale=${targetW}:${targetH}:flags=lanczos" -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p -movflags +faststart ${audioFlag} "${outputPath}"`,
      { timeout: 120000, stdio: 'pipe' }
    );
    return probeVideo(outputPath);
  }

  // Escape ASS path for FFmpeg subtitles filter on Windows
  const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

  try {
    console.log(`[video_processor] Rendering high-quality 1080p export with preview-matched ASS subtitles: ${sourcePath} -> ${outputPath}`);
    execSync(
      `ffmpeg -y -i "${sourcePath}" ${trimArgs} -vf "scale=${targetW}:${targetH}:flags=lanczos,subtitles='${escapedAss}'" -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p -movflags +faststart ${audioFlag} "${outputPath}"`,
      { timeout: 180000, stdio: 'pipe' }
    );
  } catch (err) {
    console.warn(`[video_processor] ASS subtitles filter warning (${err.message}), attempting fallback direct encode...`);
    execSync(
      `ffmpeg -y -i "${sourcePath}" ${trimArgs} -vf "scale=${targetW}:${targetH}:flags=lanczos" -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p -movflags +faststart ${audioFlag} "${outputPath}"`,
      { timeout: 120000, stdio: 'pipe' }
    );
  }

  return probeVideo(outputPath);
}

module.exports = {
  probeVideo,
  extractAudio,
  transcribeAudio,
  generatePreviewProxy,
  hexToAssColor,
  resolveCaptionStyle,
  generateAssContent,
  generateSrtContent,
  renderExportVideo,
  PRESET_STYLES
};
