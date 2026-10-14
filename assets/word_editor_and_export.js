(function() {
  'use strict';

  // Get current project ID from URL
  function getProjectId() {
    const parts = window.location.pathname.split('/');
    const studioIdx = parts.indexOf('studio');
    if (studioIdx !== -1 && parts[studioIdx + 1]) {
      return parts[studioIdx + 1].split('?')[0];
    }
    return 'proj_demo_1';
  }

  const projectId = getProjectId();
  let activeProject = null;
  let activeWordId = null;
  let selectedColor = '#FFE600';
  let isBold = true;
  let isHighlighted = false;
  let displayScript = 'latn'; // 'latn' (Hinglish/English) or 'devanagari' (Native Hindi)
  let activeFilter = 'all'; // 'all', 'low_conf', 'highlighted'
  let searchQuery = '';
  let renderJobId = null;
  let renderPollTimer = null;
  let allPresets = [];
  let allPresetsMap = {};

  const COLOR_PRESETS = [
    { label: 'Yellow', hex: '#FFE600' },
    { label: 'Pink', hex: '#FF2E93' },
    { label: 'Cyan', hex: '#00F0FF' },
    { label: 'Lime', hex: '#39FF14' },
    { label: 'Orange', hex: '#FF7A00' },
    { label: 'White', hex: '#FFFFFF' }
  ];

  // Load all 234 official Moonshot presets
  async function loadAllPresets() {
    try {
      const res = await fetch('/assets/presets.json');
      if (res.ok) {
        allPresets = await res.json();
        allPresets.forEach(p => {
          if (p.id) allPresetsMap[p.id] = p;
        });
        populatePresetsUI();
      }
    } catch (e) {
      console.warn('[WordEditor] Could not load presets.json:', e);
    }
  }

  // Populate Preset selector and category dropdown
  function populatePresetsUI() {
    const select = document.getElementById('ms-preset-select');
    const catFilter = document.getElementById('ms-preset-category-filter');
    if (!select) return;

    const activeCat = catFilter ? catFilter.value : 'all';
    const filtered = (activeCat === 'all')
      ? allPresets
      : allPresets.filter(p => p.category === activeCat);

    select.innerHTML = filtered.map(p => `
      <option value="${p.id}">${p.name} — [${p.category.toUpperCase()}] (${p.captionEffect || 'static'}, ${p.fontFamily})</option>
    `).join('');

    const current = (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().project?.presetId) ||
                    activeProject?.presetId ||
                    'social-word-pink';
    select.value = current;
    updatePresetUI(current);
  }

  // Update UI indicators for the currently active preset
  function updatePresetUI(presetId) {
    const p = allPresetsMap[presetId];
    const name = p ? p.name : presetId;

    const badge = document.getElementById('ms-active-preset-badge');
    if (badge) badge.innerText = name;

    const dockLabel = document.getElementById('ms-dock-preset-name');
    if (dockLabel) dockLabel.innerText = `Preset: ${name}`;

    const select = document.getElementById('ms-preset-select');
    if (select && select.value !== presetId) select.value = presetId;

    const statPreset = document.getElementById('ms-stat-preset');
    if (statPreset) statPreset.innerText = p ? `${p.name} (${p.category})` : presetId;

    // Highlight active quick button
    document.querySelectorAll('.ms-quick-preset-btn').forEach(btn => {
      if (btn.getAttribute('data-preset') === presetId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Select a preset: syncs with React canvas preview and saves to backend
  async function selectPreset(presetId) {
    if (!presetId) return;
    if (!activeProject) activeProject = {};
    activeProject.presetId = presetId;

    // 1. Immediately notify Moonshot Zustand store to update video preview canvas
    if (window.__useEditor && window.__useEditor.getState) {
      const state = window.__useEditor.getState();
      if (typeof state.setPreset === 'function') {
        state.setPreset(presetId);
      }
    }

    // 2. Update all UI elements
    updatePresetUI(presetId);

    // 3. Invalidate any cached export
    try {
      localStorage.removeItem('moonshot:last-export:' + projectId);
      localStorage.removeItem('moonshot:active-export:' + projectId);
    } catch (e) {}

    // 4. Persist to backend
    await saveProjectToBackend();
  }

  // Helper to fetch latest project from backend or Zustand store
  async function loadProject() {
    if (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().project) {
      activeProject = window.__useEditor.getState().project;
      if (activeProject?.presetId) updatePresetUI(activeProject.presetId);
      return activeProject;
    }
    try {
      const res = await fetch(`/api/bootstrap/studio/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        activeProject = data.project;
        if (activeProject?.presetId) updatePresetUI(activeProject.presetId);
        return activeProject;
      }
    } catch (e) {
      console.warn('[WordEditor] Could not load project:', e);
    }
    return null;
  }

  // Save updated project to backend
  async function saveProjectToBackend() {
    if (!activeProject) return;
    try {
      // Sync from zustand if available
      if (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().project) {
        const zp = window.__useEditor.getState().project;
        if (zp) {
          activeProject.presetId = zp.presetId || activeProject.presetId;
          activeProject.captionStyleOverride = zp.captionStyleOverride || activeProject.captionStyleOverride;
        }
      }
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: activeProject.transcript,
          clips: activeProject.clips,
          presetId: activeProject.presetId,
          captionStyleOverride: activeProject.captionStyleOverride,
          scriptPreference: displayScript
        })
      });
      // Invalidate any old export cached in browser
      try {
        localStorage.removeItem('moonshot:last-export:' + projectId);
        localStorage.removeItem('moonshot:active-export:' + projectId);
      } catch (e) {}
    } catch (e) {
      console.error('[WordEditor] Save failed:', e);
    }
  }

  // Inject UI Markup
  function injectMarkup() {
    if (document.getElementById('ms-editor-root')) return;

    const root = document.createElement('div');
    root.id = 'ms-editor-root';
    root.innerHTML = `
      <!-- Floating Dock -->
      <div class="ms-floating-dock">
        <button type="button" class="ms-floating-pill" id="ms-pill-preset-picker" title="Switch caption preset style">
          <span>🎨</span>
          <span id="ms-dock-preset-name">Preset: Rose Flare</span>
        </button>
        <button type="button" class="ms-floating-pill" id="ms-pill-open-words">
          <span>✏️</span>
          <span>Edit Words & Highlights</span>
          <span id="ms-word-count-badge" style="background:rgba(255,255,255,0.12);padding:2px 6px;border-radius:10px;font-size:11px;">0</span>
        </button>
        <button type="button" class="ms-floating-pill ms-primary-pill" id="ms-pill-open-export">
          <span>🚀</span>
          <span>Export Video</span>
        </button>
      </div>

      <!-- Word Editor Drawer Backdrop -->
      <div class="ms-drawer-backdrop" id="ms-drawer-backdrop">
        <div class="ms-drawer-panel" id="ms-drawer-panel">
          <div class="ms-drawer-header">
            <div class="ms-drawer-title">
              <span>✏️</span>
              <span>Edit Words & Highlights</span>
            </div>

            <!-- Script Toggle (Hinglish vs Devanagari) -->
            <div class="ms-segmented-ctrl">
              <button type="button" class="ms-segment-btn active" id="ms-seg-latn" title="Show Romanized Hinglish">🔤 Hinglish</button>
              <button type="button" class="ms-segment-btn" id="ms-seg-hi" title="Show Native Hindi (Devanagari)">🕉️ Hindi</button>
            </div>

            <button type="button" class="ms-close-btn" id="ms-close-drawer">✕</button>
          </div>

          <!-- Caption Preset & Style Selector -->
          <div class="ms-preset-selector-box" style="margin: 8px 20px 4px 20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:13px;">🎨</span>
                <span style="font-size:11px;font-weight:700;color:#c7d2fe;text-transform:uppercase;letter-spacing:0.04em;">Selected Caption Preset</span>
              </div>
              <span id="ms-active-preset-badge" style="font-size:11px;background:#6366f1;color:#fff;padding:2px 8px;border-radius:10px;font-weight:600;">Rose Flare</span>
            </div>

            <!-- Quick Popular Presets Carousel -->
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;" id="ms-quick-presets">
              <button type="button" class="ms-quick-preset-btn" data-preset="dimension-story" title="Magenta raised lettering, viral real estate">🏢 Dimension Story</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="reach-counter" title="Yellow high-retention active counter">⚡ Reach Counter</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="still-time" title="Impact bold cream editorial">🎬 Still Time</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="chapter-one" title="Typewriter serif editorial storytelling">📜 Chapter 01</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="social-word-pink" title="Pink active-word karaoke tracking">🌸 Rose Flare</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="social-green-word" title="Phosphor green active karaoke tracking">🍀 Phosphor</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="desi-bold" title="Hindi & Hinglish hybrid display">🕉️ Desi Bold</button>
              <button type="button" class="ms-quick-preset-btn" data-preset="deep-glow" title="Magenta neon glow outline">✨ Deep Glow</button>
            </div>

            <!-- Complete Categorized 234 Presets Dropdown -->
            <div style="display:flex;gap:8px;">
              <select id="ms-preset-category-filter" class="ms-input" style="width:130px;font-size:11px;">
                <option value="all">All Categories (234)</option>
                <option value="social">Social / Viral (18)</option>
                <option value="real-estate">Real Estate (3)</option>
                <option value="editorial">Editorial (13)</option>
                <option value="creators">Creators (27)</option>
                <option value="dynamic">Dynamic (29)</option>
                <option value="desi">Desi / Indian (2)</option>
                <option value="playful">Playful (19)</option>
                <option value="business">Business (11)</option>
                <option value="retro">Retro (6)</option>
                <option value="multiline">Multiline (41)</option>
                <option value="aiedits">AI Edits (36)</option>
                <option value="fx">Visual FX (6)</option>
              </select>
              <select id="ms-preset-select" class="ms-input" style="flex:1;font-size:12px;font-weight:600;color:#818cf8;">
                <option value="">Loading 234 official presets...</option>
              </select>
            </div>
          </div>

          <!-- Quick Action & Filter Row -->
          <div style="padding:6px 20px 4px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div class="ms-filter-row" style="padding:0;gap:6px;">
              <button type="button" class="ms-filter-btn active" id="ms-flt-all">All</button>
              <button type="button" class="ms-filter-btn" id="ms-flt-lowconf">⚠️ Needs Review (<span id="ms-lowconf-count">0</span>)</button>
              <button type="button" class="ms-filter-btn" id="ms-flt-hl">★ Highlighted</button>
            </div>

            <button type="button" class="ms-btn" id="ms-btn-retranscribe" style="font-size:11px;padding:4px 10px;background:rgba(99,102,241,0.18);border-color:#6366f1;color:#c7d2fe;">
              <span>🎙️</span>
              <span>AI Re-Transcribe (Whisper Large)</span>
            </button>
          </div>

          <!-- Search Bar -->
          <div style="padding:4px 20px 8px 20px;">
            <input type="text" id="ms-word-search-input" class="ms-search-input" placeholder="🔍 Search words in captions (e.g. Highway, Universal, plot)..." style="width:100%;" />
          </div>

          <!-- Active Word Inspector -->
          <div class="ms-inspector-card" id="ms-inspector-card">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:12px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.04em;">Selected Word</span>
                <span id="ms-word-conf-tag" class="ms-conf-badge high" style="display:none;">High Conf</span>
              </div>
              <span id="ms-word-time-info" style="font-size:11px;color:#71717a;">Click a word below</span>
            </div>

            <!-- Edit Text Input -->
            <div class="ms-inspector-row">
              <input type="text" id="ms-word-text-input" class="ms-input" placeholder="Select a word to edit..." disabled />
              <button type="button" id="ms-btn-save-word" class="ms-btn ms-btn-primary" disabled>Save</button>
            </div>

            <!-- Quick Text Transformations & Add Words -->
            <div class="ms-inspector-row" style="gap:6px;">
              <button type="button" class="ms-btn" id="ms-btn-case-upper">ALL CAPS</button>
              <button type="button" class="ms-btn" id="ms-btn-case-title">Capitalize</button>
              <button type="button" class="ms-btn" id="ms-btn-case-lower">lower</button>
              <button type="button" class="ms-btn" id="ms-btn-punct-comma">+ ,</button>
              <button type="button" class="ms-btn" id="ms-btn-punct-excl">+ !</button>
              <button type="button" class="ms-btn" id="ms-btn-add-before" title="Add a word before">+ Word Before</button>
              <button type="button" class="ms-btn" id="ms-btn-add-after" title="Add a word after">+ Word After</button>
              <button type="button" class="ms-btn ms-btn-danger" id="ms-btn-delete-word">Delete</button>
            </div>

            <!-- Highlighting Controls -->
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#ffffff;cursor:pointer;">
                  <input type="checkbox" id="ms-chk-highlight" style="cursor:pointer;" />
                  <span>★ Highlight this word</span>
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#a1a1aa;cursor:pointer;">
                  <input type="checkbox" id="ms-chk-bold" checked style="cursor:pointer;" />
                  <span>Bold</span>
                </label>
              </div>

              <!-- Color Palette -->
              <div class="ms-color-palette" id="ms-color-palette">
                ${COLOR_PRESETS.map(p => `
                  <div class="ms-color-swatch ${p.hex === selectedColor ? 'active' : ''}" data-hex="${p.hex}" style="background:${p.hex};" title="${p.label}"></div>
                `).join('')}
                <input type="color" id="ms-custom-color" value="${selectedColor}" style="width:24px;height:24px;border:none;background:transparent;cursor:pointer;padding:0;" title="Custom Color" />
              </div>
            </div>
          </div>

          <!-- Captions List Scroll -->
          <div class="ms-captions-scroll" id="ms-captions-scroll">
            <div style="text-align:center;color:#71717a;padding:20px;font-size:13px;">Loading captions...</div>
          </div>
        </div>
      </div>

      <!-- Export Modal Backdrop -->
      <div class="ms-export-modal-backdrop" id="ms-export-modal-backdrop">
        <div class="ms-export-card">
          <div class="ms-export-header">
            <div style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#ffffff;">
              <span>🚀</span>
              <span>Export Finished Video</span>
            </div>
            <button type="button" class="ms-close-btn" id="ms-close-export">✕</button>
          </div>

          <div class="ms-export-body">
            <!-- Project Summary -->
            <div class="ms-summary-box">
              <div class="ms-stat-item">
                <span class="ms-stat-label">Resolution</span>
                <span class="ms-stat-val" id="ms-stat-res">1080 × 1920 (9:16)</span>
              </div>
              <div class="ms-stat-item">
                <span class="ms-stat-label">Duration</span>
                <span class="ms-stat-val" id="ms-stat-dur">--</span>
              </div>
              <div class="ms-stat-item">
                <span class="ms-stat-label">Total Words</span>
                <span class="ms-stat-val" id="ms-stat-words">--</span>
              </div>
              <div class="ms-stat-item">
                <span class="ms-stat-label">Caption Preset</span>
                <span class="ms-stat-val" id="ms-stat-preset" style="color:#818cf8;font-weight:700;">--</span>
              </div>
              <div class="ms-stat-item">
                <span class="ms-stat-label">Burned Subtitles</span>
                <span class="ms-stat-val" style="color:#a855f7;">Word Highlights (ASS)</span>
              </div>
            </div>

            <!-- Subtitle Script Option -->
            <div>
              <label style="font-size:12px;font-weight:600;color:#a1a1aa;margin-bottom:6px;display:block;">Caption Script for Burned Subtitles</label>
              <select id="ms-export-script" class="ms-input" style="width:100%;">
                <option value="latn">Hinglish (Roman Script - Recommended for Viral Reels)</option>
                <option value="devanagari">Devanagari (Native Hindi Script)</option>
              </select>
            </div>

            <!-- Quality Selector -->
            <div>
              <label style="font-size:12px;font-weight:600;color:#a1a1aa;margin-bottom:6px;display:block;">Export Quality</label>
              <select id="ms-export-quality" class="ms-input" style="width:100%;">
                <option value="1080">1080p Full HD (60fps) — Viral Shorts/Reels (Recommended)</option>
                <option value="original">Original Source Quality</option>
                <option value="720">720p Social Fast Export</option>
              </select>
            </div>

            <!-- Live Progress / Status -->
            <div id="ms-export-progress-wrap" style="display:none;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa;">
                <span id="ms-export-status-text">Preparing render...</span>
                <span id="ms-export-pct-text">0%</span>
              </div>
              <div class="ms-progress-bar-wrap">
                <div class="ms-progress-bar-fill" id="ms-export-progress-fill"></div>
              </div>
            </div>

            <!-- Video Player on Complete -->
            <div id="ms-export-player-wrap" style="display:none;flex-direction:column;gap:10px;">
              <video id="ms-export-video-player" controls class="ms-video-preview-player"></video>
              <div style="display:flex;gap:10px;">
                <a id="ms-download-link" href="#" download class="ms-export-action-btn" style="text-decoration:none;background:#10b981;border-color:#34d399;">
                  <span>⬇️</span>
                  <span>DOWNLOAD VIDEO (MP4)</span>
                </a>
              </div>
            </div>

            <!-- Action Button -->
            <button type="button" class="ms-export-action-btn" id="ms-btn-start-export">
              <span>⚡</span>
              <span>Render & Export Now</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Bind Persistent Top-Bar Button into Header if possible
    injectTopBarButton();

    // Bind event handlers
    bindEvents();
  }

  // Inject visible Export Button into Studio Top Nav
  function injectTopBarButton() {
    const existing = document.getElementById('ms-top-export-btn');
    if (existing) return;

    const nav = document.querySelector('header') || document.querySelector('nav');
    if (nav) {
      const topBtn = document.createElement('button');
      topBtn.type = 'button';
      topBtn.id = 'ms-top-export-btn';
      topBtn.className = 'ms-top-export-btn';
      topBtn.innerHTML = '<span>🚀</span><span>EXPORT VIDEO</span>';
      topBtn.onclick = openExportModal;
      nav.appendChild(topBtn);
    }
  }

  // Get active display text for a word based on selected script
  function getWordDisplayText(w) {
    if (!w) return '';
    if (displayScript === 'devanagari') {
      return w.text || w.textLatn || '';
    } else {
      return w.textLatn || w.text || '';
    }
  }

  // Render Captions List with filter and search
  function renderCaptionsList() {
    const container = document.getElementById('ms-captions-scroll');
    const badge = document.getElementById('ms-word-count-badge');
    const lowConfBadge = document.getElementById('ms-lowconf-count');
    if (!container || !activeProject) return;

    const transcript = activeProject.transcript || [];
    let totalWords = 0;
    let lowConfWords = 0;

    // Count statistics
    transcript.forEach(seg => {
      (seg.words || []).forEach(w => {
        totalWords++;
        if (w.confidence !== undefined && w.confidence < 0.75) {
          lowConfWords++;
        }
      });
    });

    if (badge) badge.innerText = totalWords.toString();
    if (lowConfBadge) lowConfBadge.innerText = lowConfWords.toString();

    if (transcript.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#71717a;padding:20px;font-size:13px;">No captions found. Upload a video to generate captions.</div>';
      return;
    }

    const q = searchQuery.toLowerCase().trim();

    const renderedSegments = transcript.map((seg, sIdx) => {
      const words = seg.words || [];

      // Filter words based on activeFilter & searchQuery
      const matchingWords = words.filter(w => {
        const textToMatch = `${w.text || ''} ${w.textLatn || ''}`.toLowerCase();
        if (q && !textToMatch.includes(q)) return false;

        if (activeFilter === 'low_conf') {
          return w.confidence !== undefined && w.confidence < 0.75;
        }
        if (activeFilter === 'highlighted') {
          return w.highlight || w.style?.highlight || (w.emphasisTier && w.emphasisTier >= 1);
        }
        return true;
      });

      if (matchingWords.length === 0 && (q || activeFilter !== 'all')) {
        return '';
      }

      const wordsHtml = words.map(w => {
        const isSel = w.id === activeWordId;
        const isHl = w.highlight || w.style?.highlight || (w.emphasisTier && w.emphasisTier >= 1);
        const isLowConf = w.confidence !== undefined && w.confidence < 0.75;
        const color = w.color || w.style?.color || (isHl ? '#FFE600' : 'inherit');
        const bold = w.isBold || w.style?.isBold ? 'font-weight:700;' : '';

        let styleStr = `${bold}`;
        if (isHl) {
          styleStr += `color:${color};border-color:${color};background:rgba(255,255,255,0.12);`;
        }

        const dispText = getWordDisplayText(w);
        const warnIcon = isLowConf ? '⚠️ ' : '';
        const confTitle = `Confidence: ${(Number(w.confidence || 0.95) * 100).toFixed(0)}% • Start: ${w.start}s`;

        return `
          <button type="button" class="ms-word-chip ${isSel ? 'selected' : ''} ${isHl ? 'highlighted' : ''} ${isLowConf ? 'low-conf' : ''}" data-word-id="${w.id}" style="${styleStr}" title="${confTitle}">
            ${warnIcon}${dispText}
          </button>
        `;
      }).join('');

      return `
        <div class="ms-caption-card">
          <div class="ms-caption-timing">
            <span>⏱️ ${seg.start}s – ${seg.end}s</span>
            <span style="color:#71717a;">${words.length} words</span>
          </div>
          <div class="ms-caption-words">
            ${wordsHtml}
          </div>
        </div>
      `;
    }).filter(Boolean).join('');

    if (!renderedSegments) {
      container.innerHTML = '<div style="text-align:center;color:#71717a;padding:20px;font-size:13px;">No words match your filter or search.</div>';
    } else {
      container.innerHTML = renderedSegments;
    }

    // Bind word chip clicks
    container.querySelectorAll('.ms-word-chip').forEach(chip => {
      chip.onclick = (e) => {
        const wId = e.currentTarget.getAttribute('data-word-id');
        selectWord(wId);
      };
    });
  }

  // Find word object and its segment
  function findWordAndSegment(wId) {
    if (!activeProject || !activeProject.transcript) return { word: null, segment: null, index: -1 };
    for (const seg of activeProject.transcript) {
      if (seg.words) {
        const idx = seg.words.findIndex(w => w.id === wId);
        if (idx !== -1) {
          return { word: seg.words[idx], segment: seg, index: idx };
        }
      }
    }
    return { word: null, segment: null, index: -1 };
  }

  // Select a word
  function selectWord(wId) {
    activeWordId = wId;
    const { word } = findWordAndSegment(wId);
    if (!word) return;

    // Seek player if available
    if (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().seekTo) {
      window.__useEditor.getState().seekTo(word.start);
    }
    const videoElem = document.querySelector('video');
    if (videoElem && Number.isFinite(word.start)) {
      videoElem.currentTime = word.start;
      // Brief play to audition word
      videoElem.play().then(() => {
        setTimeout(() => {
          if (!videoElem.paused) videoElem.pause();
        }, Math.max(400, Math.min(1200, (word.end - word.start) * 1000 + 200)));
      }).catch(() => {});
    }

    // Populate inspector
    const input = document.getElementById('ms-word-text-input');
    const saveBtn = document.getElementById('ms-btn-save-word');
    const timeInfo = document.getElementById('ms-word-time-info');
    const confTag = document.getElementById('ms-word-conf-tag');
    const chkHl = document.getElementById('ms-chk-highlight');
    const chkBold = document.getElementById('ms-chk-bold');

    if (input) {
      input.disabled = false;
      input.value = getWordDisplayText(word);
      input.focus();
    }
    if (saveBtn) saveBtn.disabled = false;
    if (timeInfo) timeInfo.innerText = `${word.start}s – ${word.end}s`;

    if (confTag) {
      confTag.style.display = 'inline-block';
      const confPct = Math.round(Number(word.confidence || 0.95) * 100);
      if (confPct >= 75) {
        confTag.className = 'ms-conf-badge high';
        confTag.innerText = `${confPct}% Conf`;
      } else {
        confTag.className = 'ms-conf-badge low';
        confTag.innerText = `⚠️ ${confPct}% Review`;
      }
    }

    isHighlighted = !!(word.highlight || word.style?.highlight || (word.emphasisTier && word.emphasisTier >= 1));
    isBold = !!(word.isBold || word.style?.isBold || (word.emphasisTier && word.emphasisTier >= 1));
    selectedColor = word.color || word.style?.color || '#FFE600';

    if (chkHl) chkHl.checked = isHighlighted;
    if (chkBold) chkBold.checked = isBold;

    updateColorSwatches();
    renderCaptionsList();
  }

  // Update color swatch UI
  function updateColorSwatches() {
    document.querySelectorAll('.ms-color-swatch').forEach(sw => {
      const hex = sw.getAttribute('data-hex');
      if (hex === selectedColor) {
        sw.classList.add('active');
      } else {
        sw.classList.remove('active');
      }
    });
  }

  // Apply word changes
  async function saveWordChanges(newText) {
    if (!activeWordId || !activeProject) return;
    const { word, segment } = findWordAndSegment(activeWordId);
    if (!word) return;

    if (newText !== undefined) {
      if (displayScript === 'devanagari') {
        word.text = newText;
      } else {
        word.textLatn = newText;
        if (!word.text || allAscii(newText)) {
          word.text = newText;
        }
      }
      word.userEdited = true;
      word.confidence = 1.0; // User manual correction confers 100% confidence
    }

    word.highlight = isHighlighted;
    word.isBold = isBold;
    word.color = selectedColor;
    word.emphasisTier = isHighlighted ? 1 : 0;
    word.style = {
      highlight: isHighlighted,
      color: selectedColor,
      isBold: isBold
    };

    // Update segment full text
    if (segment && segment.words) {
      segment.text = segment.words.map(w => w.text).join(' ');
      segment.textLatn = segment.words.map(w => w.textLatn || w.text).join(' ');
    }

    // Update Zustand store
    if (window.__useEditor && window.__useEditor.getState) {
      const state = window.__useEditor.getState();
      const updatedText = getWordDisplayText(word);
      if (newText !== undefined && state.updateWordText) {
        state.updateWordText(activeWordId, updatedText);
      }
      if (state.updateWordStyle) {
        state.updateWordStyle(activeWordId, word.style);
      }
      if (state.setWordEmphasisTier) {
        state.setWordEmphasisTier(activeWordId, isHighlighted ? 1 : 0);
      }
    }

    // Persist to backend
    await saveProjectToBackend();
    renderCaptionsList();
  }

  function allAscii(str) {
    return /^[\x00-\x7F]*$/.test(str);
  }

  // Insert word before or after active word
  async function insertWord(position = 'after') {
    if (!activeWordId || !activeProject) return;
    const { word, segment, index } = findWordAndSegment(activeWordId);
    if (!word || !segment) return;

    const newWordText = prompt(`Enter text for new word (${position} "${getWordDisplayText(word)}"):`);
    if (!newWordText || !newWordText.trim()) return;

    const trimmed = newWordText.trim();
    let newStart = word.start;
    let newEnd = word.end;

    if (position === 'after') {
      newStart = Number((word.end + 0.05).toFixed(2));
      newEnd = Number((word.end + 0.35).toFixed(2));
    } else {
      newStart = Math.max(0, Number((word.start - 0.35).toFixed(2)));
      newEnd = Number((word.start - 0.05).toFixed(2));
    }

    const newId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newWordObj = {
      id: newId,
      text: trimmed,
      textLatn: trimmed,
      start: newStart,
      end: newEnd,
      confidence: 1.0,
      highlight: false,
      userEdited: true,
      emphasisTier: 0,
      style: null
    };

    if (position === 'after') {
      segment.words.splice(index + 1, 0, newWordObj);
    } else {
      segment.words.splice(index, 0, newWordObj);
    }

    segment.text = segment.words.map(w => w.text).join(' ');
    segment.textLatn = segment.words.map(w => w.textLatn || w.text).join(' ');

    await saveProjectToBackend();
    selectWord(newId);
  }

  // Delete word
  async function deleteWord() {
    if (!activeWordId || !activeProject) return;
    if (!confirm('Are you sure you want to delete this word?')) return;

    const { segment } = findWordAndSegment(activeWordId);

    if (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().removeWord) {
      window.__useEditor.getState().removeWord(activeWordId);
      activeProject = window.__useEditor.getState().project;
    } else {
      activeProject.transcript.forEach(seg => {
        if (seg.words) {
          seg.words = seg.words.filter(w => w.id !== activeWordId);
          seg.text = seg.words.map(w => w.text).join(' ');
          seg.textLatn = seg.words.map(w => w.textLatn || w.text).join(' ');
        }
      });
    }

    activeWordId = null;
    await saveProjectToBackend();
    renderCaptionsList();
  }

  // Re-transcribe audio using high accuracy Whisper-large-v3
  async function retranscribeAudio() {
    if (!confirm('Re-transcribe this video using AI Whisper-large-v3?\n\nThis will re-analyze the speech audio with high precision.')) return;

    const btn = document.getElementById('ms-btn-retranscribe');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Transcribing audio...</span>';
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transcription failed');
      }

      await loadProject();
      renderCaptionsList();
      alert(`Transcription complete! Detected ${data.wordCount} words with high precision.`);
    } catch (err) {
      alert('Error re-transcribing audio: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🎙️</span><span>AI Re-Transcribe (Whisper Large)</span>';
      }
    }
  }

  // Drawer Open / Close
  function openWordDrawer() {
    loadProject().then(() => {
      renderCaptionsList();
      const backdrop = document.getElementById('ms-drawer-backdrop');
      const panel = document.getElementById('ms-drawer-panel');
      if (backdrop) backdrop.classList.add('active');
      if (panel) panel.classList.add('active');
    });
  }

  function closeWordDrawer() {
    const backdrop = document.getElementById('ms-drawer-backdrop');
    const panel = document.getElementById('ms-drawer-panel');
    if (backdrop) backdrop.classList.remove('active');
    if (panel) panel.classList.remove('active');
  }

  // Export Modal Open / Close
  function openExportModal() {
    loadProject().then(() => {
      const backdrop = document.getElementById('ms-export-modal-backdrop');
      const statDur = document.getElementById('ms-stat-dur');
      const statWords = document.getElementById('ms-stat-words');

      if (statDur) statDur.innerText = `${activeProject?.source?.originalDuration || 0}s`;
      if (statWords) {
        const wordsCount = activeProject?.transcript?.reduce((acc, s) => acc + (s.words ? s.words.length : 0), 0) || 0;
        statWords.innerText = `${wordsCount} words`;
      }

      if (backdrop) backdrop.classList.add('active');
    });
  }

  function closeExportModal() {
    const backdrop = document.getElementById('ms-export-modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    if (renderPollTimer) clearInterval(renderPollTimer);
  }

  // Start Video Export
  async function startExport() {
    const btn = document.getElementById('ms-btn-start-export');
    const progressWrap = document.getElementById('ms-export-progress-wrap');
    const statusText = document.getElementById('ms-export-status-text');
    const playerWrap = document.getElementById('ms-export-player-wrap');
    const scriptSelect = document.getElementById('ms-export-script');

    if (btn) btn.disabled = true;
    if (progressWrap) progressWrap.style.display = 'flex';
    if (playerWrap) playerWrap.style.display = 'none';

    // Clear stale export caches
    try {
      localStorage.removeItem('moonshot:last-export:' + projectId);
      localStorage.removeItem('moonshot:active-export:' + projectId);
    } catch (e) {}

    // Pull absolute latest in-memory editor state from Zustand
    if (window.__useEditor && window.__useEditor.getState && window.__useEditor.getState().project) {
      const zProj = window.__useEditor.getState().project;
      if (zProj) {
        activeProject = { ...activeProject, ...zProj };
      }
    }

    try {
      // Flush latest edits to backend first
      await saveProjectToBackend();

      statusText.innerText = 'Submitting render job...';
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          project: activeProject,
          kind: 'export',
          presetId: activeProject?.presetId,
          captionStyleOverride: activeProject?.captionStyleOverride,
          exportQuality: document.getElementById('ms-export-quality')?.value || '1080',
          scriptPreference: scriptSelect ? scriptSelect.value : (displayScript || activeProject?.scriptPreference || 'latn')
        })
      });

      const data = await res.json();
      if (!res.ok || !data.job) {
        throw new Error(data.error || 'Failed to start render');
      }

      renderJobId = data.job.id;
      pollRenderStatus(renderJobId);
    } catch (err) {
      alert('Export failed: ' + err.message);
      if (btn) btn.disabled = false;
      if (progressWrap) progressWrap.style.display = 'none';
    }
  }

  // Poll Render Job Status
  function pollRenderStatus(jobId) {
    if (renderPollTimer) clearInterval(renderPollTimer);

    const progressFill = document.getElementById('ms-export-progress-fill');
    const statusText = document.getElementById('ms-export-status-text');
    const pctText = document.getElementById('ms-export-pct-text');
    const playerWrap = document.getElementById('ms-export-player-wrap');
    const videoPlayer = document.getElementById('ms-export-video-player');
    const downloadLink = document.getElementById('ms-download-link');
    const btn = document.getElementById('ms-btn-start-export');

    renderPollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/render?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;

        if (job) {
          const pct = Math.min(100, Math.round(job.pct || 0));
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (pctText) pctText.innerText = `${pct}%`;

          if (job.status === 'complete') {
            clearInterval(renderPollTimer);
            if (statusText) statusText.innerText = 'Render complete! Ready for download.';
            if (progressFill) progressFill.style.width = '100%';
            if (pctText) pctText.innerText = '100%';

            // Show video player and download button
            const fileUrl = `/api/render/file/${jobId}`;
            const downloadUrl = `/api/render/file/${jobId}?dl=1`;

            if (videoPlayer) {
              videoPlayer.src = fileUrl;
              videoPlayer.load();
            }
            if (downloadLink) {
              downloadLink.href = downloadUrl;
            }
            if (playerWrap) playerWrap.style.display = 'flex';
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<span>⚡</span><span>Re-render Video</span>';
            }
          } else if (job.status === 'failed') {
            clearInterval(renderPollTimer);
            statusText.innerText = 'Render failed: ' + (job.error || 'Unknown error');
            if (btn) btn.disabled = false;
          } else {
            statusText.innerText = job.message || 'Burning subtitles & rendering video frames...';
          }
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }
    }, 800);
  }

  // Bind All Event Handlers
  function bindEvents() {
    // Open Word Drawer
    document.getElementById('ms-pill-open-words')?.addEventListener('click', openWordDrawer);
    document.getElementById('ms-close-drawer')?.addEventListener('click', closeWordDrawer);
    document.getElementById('ms-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'ms-drawer-backdrop') closeWordDrawer();
    });

    // Open Export Modal
    document.getElementById('ms-pill-open-export')?.addEventListener('click', openExportModal);
    document.getElementById('ms-close-export')?.addEventListener('click', closeExportModal);
    document.getElementById('ms-export-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'ms-export-modal-backdrop') closeExportModal();
    });

    // Script Segmented Buttons
    document.getElementById('ms-seg-latn')?.addEventListener('click', () => {
      displayScript = 'latn';
      document.getElementById('ms-seg-latn')?.classList.add('active');
      document.getElementById('ms-seg-hi')?.classList.remove('active');
      renderCaptionsList();
      if (activeWordId) selectWord(activeWordId);
    });

    document.getElementById('ms-seg-hi')?.addEventListener('click', () => {
      displayScript = 'devanagari';
      document.getElementById('ms-seg-hi')?.classList.add('active');
      document.getElementById('ms-seg-latn')?.classList.remove('active');
      renderCaptionsList();
      if (activeWordId) selectWord(activeWordId);
    });

    // Filter Buttons
    document.getElementById('ms-flt-all')?.addEventListener('click', () => {
      activeFilter = 'all';
      updateFilterButtons();
      renderCaptionsList();
    });
    document.getElementById('ms-flt-lowconf')?.addEventListener('click', () => {
      activeFilter = 'low_conf';
      updateFilterButtons();
      renderCaptionsList();
    });
    document.getElementById('ms-flt-hl')?.addEventListener('click', () => {
      activeFilter = 'highlighted';
      updateFilterButtons();
      renderCaptionsList();
    });

    // Search Input
    document.getElementById('ms-word-search-input')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCaptionsList();
    });

    // Re-transcribe button
    document.getElementById('ms-btn-retranscribe')?.addEventListener('click', retranscribeAudio);

    // Word text save
    document.getElementById('ms-btn-save-word')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input) saveWordChanges(input.value.trim());
    });

    document.getElementById('ms-word-text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveWordChanges(e.target.value.trim());
      }
    });

    // Text transformations
    document.getElementById('ms-btn-case-upper')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input && input.value) {
        input.value = input.value.toUpperCase();
        saveWordChanges(input.value);
      }
    });

    document.getElementById('ms-btn-case-title')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input && input.value) {
        input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1).toLowerCase();
        saveWordChanges(input.value);
      }
    });

    document.getElementById('ms-btn-case-lower')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input && input.value) {
        input.value = input.value.toLowerCase();
        saveWordChanges(input.value);
      }
    });

    document.getElementById('ms-btn-punct-comma')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input && input.value) {
        input.value = input.value.replace(/[,.!?]+$/, '') + ',';
        saveWordChanges(input.value);
      }
    });

    document.getElementById('ms-btn-punct-excl')?.addEventListener('click', () => {
      const input = document.getElementById('ms-word-text-input');
      if (input && input.value) {
        input.value = input.value.replace(/[,.!?]+$/, '') + '!';
        saveWordChanges(input.value);
      }
    });

    document.getElementById('ms-btn-add-before')?.addEventListener('click', () => insertWord('before'));
    document.getElementById('ms-btn-add-after')?.addEventListener('click', () => insertWord('after'));
    document.getElementById('ms-btn-delete-word')?.addEventListener('click', deleteWord);

    // Highlighting toggles
    document.getElementById('ms-chk-highlight')?.addEventListener('change', (e) => {
      isHighlighted = e.target.checked;
      saveWordChanges();
    });

    document.getElementById('ms-chk-bold')?.addEventListener('change', (e) => {
      isBold = e.target.checked;
      saveWordChanges();
    });

    // Color Swatches
    document.querySelectorAll('.ms-color-swatch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        selectedColor = e.currentTarget.getAttribute('data-hex');
        isHighlighted = true;
        const chkHl = document.getElementById('ms-chk-highlight');
        if (chkHl) chkHl.checked = true;
        updateColorSwatches();
        saveWordChanges();
      });
    });

    document.getElementById('ms-custom-color')?.addEventListener('input', (e) => {
      selectedColor = e.target.value;
      isHighlighted = true;
      const chkHl = document.getElementById('ms-chk-highlight');
      if (chkHl) chkHl.checked = true;
      updateColorSwatches();
      saveWordChanges();
    });

    // Preset Pill
    document.getElementById('ms-pill-preset-picker')?.addEventListener('click', () => {
      openWordDrawer();
      const sel = document.getElementById('ms-preset-select');
      if (sel) sel.focus();
    });

    // Preset Category Filter
    document.getElementById('ms-preset-category-filter')?.addEventListener('change', () => {
      populatePresetsUI();
    });

    // Preset Dropdown
    document.getElementById('ms-preset-select')?.addEventListener('change', (e) => {
      selectPreset(e.target.value);
    });

    // Quick Preset Buttons
    document.querySelectorAll('.ms-quick-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pid = e.currentTarget.getAttribute('data-preset');
        if (pid) selectPreset(pid);
      });
    });

    // Start Export
    document.getElementById('ms-btn-start-export')?.addEventListener('click', startExport);
  }

  function updateFilterButtons() {
    ['all', 'lowconf', 'hl'].forEach(k => {
      const btn = document.getElementById(`ms-flt-${k}`);
      if (!btn) return;
      if ((k === 'all' && activeFilter === 'all') ||
          (k === 'lowconf' && activeFilter === 'low_conf') ||
          (k === 'hl' && activeFilter === 'highlighted')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function syncWithEditorStore() {
    if (window.__useEditor && window.__useEditor.subscribe) {
      window.__useEditor.subscribe((state) => {
        const zp = state.project;
        if (zp?.presetId && activeProject && activeProject.presetId !== zp.presetId) {
          activeProject.presetId = zp.presetId;
          updatePresetUI(zp.presetId);
        }
      });
    }
  }

  // Initialize once DOM is ready
  function init() {
    injectMarkup();
    loadAllPresets();
    loadProject().then(() => {
      renderCaptionsList();
      syncWithEditorStore();
    });

    // Poll every 2s for top bar button injection if React re-rendered header
    setInterval(injectTopBarButton, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
