// Moonshot Complete AI Video & Caption Studio Application Logic

let allTemplates = [];
let currentCategory = 'popular';
let selectedTemplate = null;

// Studio state
let studioActive = false;
let currentVideoSrc = './assets/demo_reel.mp4';
let currentTimings = [];
let currentTheme = 'theme-number-story';
let captionPosition = 'pos-bottom';
let isSafeZoneVisible = false;
let isAutoZoomEnabled = true;

document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  await loadDefaultTimings();
  initLandingPageInteractivity();
  initStudioWorkspace();
});

// Toast notification helper
function showToast(message) {
  let toast = document.querySelector('.moon-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'moon-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${message}</span>`;
  toast.classList.add('show');
  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// 1. Load Templates Data
async function loadTemplates() {
  try {
    const res = await fetch('./assets/templates.json');
    if (res.ok) {
      allTemplates = await res.json();
    }
  } catch (err) {
    console.warn('Could not load templates.json, using fallback', err);
  }

  if (!allTemplates || allTemplates.length === 0) {
    allTemplates = [
      { id: 'reach-counter', shelf: 'popular', name: 'Number Story', desc: 'Statistics count up beside sliding captions and screenshot cards.', cost: '0.2', poster: 'https://cdn.kaizynn.com/moonshot/landing/real-estate/reach-counter-7d8ceee71a96-poster.jpg' },
      { id: 'ca-golden-hour', shelf: 'popular', name: 'Golden Hour', desc: 'Large pale-yellow editorial words frame a smaller matching subtitle.', cost: '0.2', poster: 'https://cdn.kaizynn.com/moonshot/landing/contentaware/golden-hour-v2-poster.jpg' },
      { id: 'ca-split', shelf: 'popular', name: 'Behind the Person', desc: 'Key word locks behind you; subtitles ride your chest.', cost: '0.2', poster: 'https://cdn.kaizynn.com/moonshot/landing/behind/ca-split-4e05f91fa280-poster.jpg' },
      { id: 'afterglow', shelf: 'popular', name: 'Afterglow', desc: 'Wide caps with a glowing cyan script, tilted frames and light beams.', cost: '6', poster: 'https://cdn.kaizynn.com/moonshot/landing/templates/afterglow-mix-e0415548f933-poster.webp' },
      { id: 'dimension-story', shelf: 'popular', name: 'Dimension Story', desc: 'Rising, bouncing phrases, raised lettering, and colorful words.', cost: '0.2', poster: 'https://cdn.kaizynn.com/moonshot/landing/real-estate/dimension-story-ba1acfd1da9d-poster.jpg' }
    ];
  }

  selectedTemplate = allTemplates[0];
}

// 2. Load Default Word Timings
async function loadDefaultTimings() {
  try {
    const res = await fetch('./assets/demo_timings.json');
    if (res.ok) {
      currentTimings = await res.json();
    }
  } catch (e) {
    console.warn('Could not load demo_timings.json', e);
  }

  if (!currentTimings || currentTimings.length === 0) {
    currentTimings = [
      { phrase_idx: 1, start: 0.0, end: 2.1, words: [{ word: "Hi,", start: 0.0, end: 0.42 }, { word: "this", start: 0.42, end: 0.98 }, { word: "is", start: 0.98, end: 1.26 }, { word: "Arzoo.", start: 1.26, end: 2.1 }] },
      { phrase_idx: 2, start: 2.1, end: 4.5, words: [{ word: "These", start: 2.1, end: 2.42 }, { word: "days,", start: 2.42, end: 2.75 }, { word: "I've", start: 2.75, end: 3.01 }, { word: "been", start: 3.01, end: 3.26 }, { word: "styling", start: 3.26, end: 3.8 }, { word: "videos.", start: 3.8, end: 4.5 }] },
      { phrase_idx: 3, start: 4.5, end: 7.2, words: [{ word: "Moonshot", start: 4.5, end: 5.1 }, { word: "creates", start: 5.1, end: 5.5 }, { word: "pro", start: 5.5, end: 5.9 }, { word: "captions", start: 5.9, end: 6.4 }, { word: "automatically.", start: 6.4, end: 7.2 }] },
      { phrase_idx: 4, start: 7.2, end: 10.5, words: [{ word: "Every", start: 7.2, end: 7.6 }, { word: "word", start: 7.6, end: 8.0 }, { word: "pops", start: 8.0, end: 8.5 }, { word: "in", start: 8.5, end: 8.8 }, { word: "sync", start: 8.8, end: 9.3 }, { word: "with", start: 9.3, end: 9.7 }, { word: "voice.", start: 9.7, end: 10.5 }] }
    ];
  }
}

// 3. Landing Page Interactivity
function initLandingPageInteractivity() {
  initCategoryTabs();
  initUploadBox();
  initFaqAccordion();
  initPricingSwitcher();
  initBeforeAfterShowcase();
  initSocialScheduler();
  initNavToolsDropdown();
  initSignInModal();
}

// Shelf mapping table
const SHELF_MAP = {
  'popular': ['popular'],
  'aiedits': ['aiedits'],
  'real-estate': ['real-estate', 'real_estate'],
  'spatial': ['spatial'],
  'behind-the-person': ['contentaware'],
  'playful': ['playful'],
  'multiline': ['multiline'],
  'dynamic': ['dynamic'],
  'editorial': ['editorial'],
  'neon-&-fx': ['fx'],
  'creators': ['creators'],
  'desi': ['desi'],
  'social': ['social'],
  'speakers': ['business'],
  'retro': ['retro'],
  'abc': ['popular', 'editorial']
};

function initCategoryTabs() {
  const tablist = document.querySelector('[role="tablist"][aria-label="Template categories"]');
  if (!tablist) return;

  const tabs = tablist.querySelectorAll('button[role="tab"]');
  const templateGrid = document.querySelector('[data-template-masonry="true"]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();

      tabs.forEach((t) => {
        t.setAttribute('aria-selected', 'false');
        t.classList.remove('text-accent');
        t.classList.add('text-ink-3');
        const bar = t.querySelector('.bg-accent.h-0\\.5');
        if (bar) bar.remove();
      });

      tab.setAttribute('aria-selected', 'true');
      tab.classList.remove('text-ink-3');
      tab.classList.add('text-accent');

      const indicator = document.createElement('span');
      indicator.className = 'absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent';
      indicator.setAttribute('aria-hidden', 'true');
      tab.appendChild(indicator);

      // Determine shelf key
      const tabKey = tab.innerText.replace(/AI/g, '').trim().toLowerCase().replace(/\s+/g, '-');
      renderTemplatesForShelf(tabKey, templateGrid);
    });
  });

  // Re-render template cards when tab changes
  function renderTemplatesForShelf(tabKey, grid) {
    if (!grid) return;

    let targetShelves = SHELF_MAP[tabKey] || ['popular'];
    let filtered = allTemplates.filter((t) => targetShelves.includes(t.shelf));

    if (filtered.length === 0) {
      filtered = allTemplates.slice(0, 12);
    }

    grid.innerHTML = '';

    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'min-w-0 self-start animate-fadeIn';
      card.setAttribute('data-template-grid-item', 'true');

      const isSelected = selectedTemplate && selectedTemplate.id === item.id;

      card.innerHTML = `
        <div class="relative w-full min-w-0 self-start overflow-hidden border bg-surface transition-all duration-200 rounded-[20px] ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-500 shadow-md' : 'border-border hover:border-accent/70 hover:-translate-y-1'}">
          <button data-template-id="${item.id}" class="group relative block w-full self-start overflow-hidden text-left outline-none cursor-pointer" aria-pressed="${isSelected}">
            <span class="relative block w-full self-start overflow-hidden aspect-[9/16] bg-slate-900 border-0">
              <img src="${item.poster || 'https://cdn.kaizynn.com/moonshot/landing/contentaware/golden-hour-v2-poster.jpg'}" alt="${item.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                <span class="text-white font-bold text-sm tracking-tight drop-shadow-sm leading-snug">${item.name}</span>
                <span class="text-slate-300 text-[11px] font-medium line-clamp-1 mt-0.5 opacity-90">${item.desc}</span>
              </div>
              <div class="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2 py-0.5 rounded-full border border-white/20">
                ${item.cost} / min
              </div>
            </span>
          </button>
        </div>
      `;

      card.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault();
        selectedTemplate = item;

        // Apply theme mapping based on template name
        mapTemplateToTheme(item.name);

        // Update active highlight
        document.querySelectorAll('[data-template-grid-item] > div').forEach((d) => {
          d.classList.remove('border-indigo-600', 'ring-2', 'ring-indigo-500', 'shadow-md');
          d.classList.add('border-border');
        });
        card.querySelector('div').classList.add('border-indigo-600', 'ring-2', 'ring-indigo-500', 'shadow-md');

        // Update hero pick style button
        updateHeroStyleButton(item.name);
        showToast(`Selected style: ${item.name}`);
      });

      grid.appendChild(card);
    });
  }
}

function mapTemplateToTheme(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('golden') || n.includes('amber') || n.includes('muse')) {
    currentTheme = 'theme-golden-hour';
  } else if (n.includes('behind') || n.includes('split') || n.includes('ghostline') || n.includes('eclipse')) {
    currentTheme = 'theme-behind-person';
  } else if (n.includes('neon') || n.includes('afterglow') || n.includes('acid') || n.includes('liquid')) {
    currentTheme = 'theme-cyber-neon';
  } else if (n.includes('playful') || n.includes('pop') || n.includes('butter') || n.includes('blush')) {
    currentTheme = 'theme-bouncy-pop';
  } else if (n.includes('minimal') || n.includes('clean') || n.includes('notes')) {
    currentTheme = 'theme-minimal-clean';
  } else {
    currentTheme = 'theme-number-story';
  }
}

function updateHeroStyleButton(name) {
  const pickStyleBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.innerText && b.innerText.includes('Pick a style')
  );
  if (pickStyleBtn) {
    pickStyleBtn.innerHTML = `
      <span class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
        <span class="font-bold text-ink">${name}</span>
        <span class="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">Active</span>
      </span>
    `;
  }
}

// 4. Studio Uploader & Demo Launcher
function initUploadBox() {
  const dropzone = document.querySelector('div[role="button"][aria-label="Upload audio or video"]');
  if (!dropzone) return;

  // Insert a quick "Try with Demo Video" pill in the upload container
  const demoBanner = document.createElement('div');
  demoBanner.className = 'w-full mt-3 flex items-center justify-between p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900';
  demoBanner.innerHTML = `
    <div class="flex items-center gap-2 font-semibold">
      <span class="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
      <span>Try instant sample video: <b>Arzoo Talking-Head Reel</b></span>
    </div>
    <button type="button" id="launch-demo-studio-btn" class="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-sm">
      Open in Studio →
    </button>
  `;

  dropzone.parentNode.insertBefore(demoBanner, dropzone.nextSibling);

  document.getElementById('launch-demo-studio-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentVideoSrc = './assets/demo_reel.mp4';
    openStudioWorkspace('Arzoo Talking-Head Reel (Demo)');
  });

  // Also bind "Create video" button
  const createBtns = Array.from(document.querySelectorAll('button')).filter(
    (b) => b.innerText && b.innerText.trim() === 'Create video'
  );
  createBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openStudioWorkspace(currentVideoSrc.includes('demo') ? 'Sample Talking Head Video' : 'Uploaded Clip');
    });
  });

  // Handle Drag & Drop / File Input
  let fileInput = dropzone.querySelector('input[type="file"]');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/mp4,video/quicktime,video/webm,audio/mp3,audio/wav,audio/m4a';
    fileInput.style.display = 'none';
    dropzone.appendChild(fileInput);
  }

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserFile(e.dataTransfer.files[0]);
    }
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUserFile(e.target.files[0]);
    }
  });

  function handleUserFile(file) {
    const objectUrl = URL.createObjectURL(file);
    currentVideoSrc = objectUrl;

    // Generate dynamic transcript phrases from file name
    generateMockTimingsForUserVideo(file.name);

    showToast(`Loaded ${file.name}! Launching studio...`);
    setTimeout(() => {
      openStudioWorkspace(file.name);
    }, 600);
  }
}

function generateMockTimingsForUserVideo(filename) {
  currentTimings = [
    { phrase_idx: 1, start: 0.0, end: 2.5, words: [{ word: "Welcome", start: 0.0, end: 0.6 }, { word: "to", start: 0.6, end: 0.9 }, { word: "Moonshot", start: 0.9, end: 1.5 }, { word: "Studio!", start: 1.5, end: 2.5 }] },
    { phrase_idx: 2, start: 2.5, end: 5.2, words: [{ word: "Your", start: 2.5, end: 2.9 }, { word: "raw", start: 2.9, end: 3.3 }, { word: "clip", start: 3.3, end: 3.8 }, { word: "is", start: 3.8, end: 4.1 }, { word: "now", start: 4.1, end: 4.5 }, { word: "edited.", start: 4.5, end: 5.2 }] },
    { phrase_idx: 3, start: 5.2, end: 8.5, words: [{ word: "Kinetic", start: 5.2, end: 5.8 }, { word: "captions", start: 5.8, end: 6.4 }, { word: "sync", start: 6.4, end: 6.8 }, { word: "in", start: 6.8, end: 7.1 }, { word: "real-time.", start: 7.1, end: 8.5 }] },
    { phrase_idx: 4, start: 8.5, end: 12.0, words: [{ word: "Click", start: 8.5, end: 9.0 }, { word: "any", start: 9.0, end: 9.3 }, { word: "word", start: 9.3, end: 9.7 }, { word: "to", start: 9.7, end: 10.0 }, { word: "seek", start: 10.0, end: 10.5 }, { word: "instantly.", start: 10.5, end: 12.0 }] }
  ];
}

// 5. Build and Open the Studio Workspace
function initStudioWorkspace() {
  let studio = document.getElementById('moonshot-studio');
  if (!studio) {
    studio = document.createElement('div');
    studio.id = 'moonshot-studio';
    document.body.appendChild(studio);
  }

  studio.innerHTML = `
    <!-- Studio Header -->
    <header class="h-14 border-b border-slate-800 bg-slate-950 px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <button type="button" id="exit-studio-btn" class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          <span>Exit Studio</span>
        </button>
        <div class="h-4 w-px bg-slate-800"></div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span class="font-bold text-sm text-white truncate max-w-[200px]" id="studio-video-title">Moonshot Project</span>
          <span class="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">AI Pro Edit</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Safe Zone Toggle -->
        <button type="button" id="toggle-safezone-btn" class="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          <span id="safezone-status-text">Safe Zone</span>
        </button>

        <!-- Export SRT -->
        <button type="button" id="export-srt-btn" class="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export SRT</span>
        </button>

        <!-- Export Video -->
        <button type="button" id="export-video-btn" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Export 1080×1920 MP4</span>
        </button>
      </div>
    </header>

    <!-- Studio Main Area -->
    <div class="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#080c14]">
      <!-- Left: Vertical Video Canvas Container -->
      <div class="flex-1 flex items-center justify-center p-3 sm:p-6 min-h-0 relative select-none">
        <div class="relative aspect-[9/16] h-full max-h-[82vh] bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group" id="studio-canvas-container">
          <!-- Video element -->
          <video id="studio-video" class="w-full h-full object-cover" playsinline loop preload="auto" src="./assets/demo_reel.mp4"></video>

          <!-- Safe Zone Grid Overlay -->
          <div class="safe-zone-overlay" id="studio-safezone">
            <div class="safe-zone-top">Instagram / TikTok Header Safe Boundary</div>
            <div class="safe-zone-bottom">Caption / Bio / Audio Safe Boundary</div>
            <div class="safe-zone-right">Like / Share / Action Area</div>
          </div>

          <!-- Kinetic Subtitles Overlay -->
          <div class="caption-overlay-container ${currentTheme} ${captionPosition}" id="studio-caption-overlay">
            <div class="inline-block px-3 py-1.5 rounded-xl transition-all duration-150" id="caption-words-box">
              <span class="caption-word">Loading captions...</span>
            </div>
          </div>

          <!-- Play/Pause Big Center Button (shown when paused) -->
          <button type="button" id="big-play-btn" class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-opacity duration-200">
            <span class="w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl pl-1 transform group-hover:scale-110 transition-transform">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </span>
          </button>

          <!-- Bottom Floating Player Bar -->
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col gap-2 z-20">
            <!-- Scrubber -->
            <input type="range" id="studio-scrubber" min="0" max="100" value="0" step="0.1" class="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded-lg cursor-pointer" />
            <div class="flex items-center justify-between text-xs text-slate-300 font-medium">
              <div class="flex items-center gap-3">
                <button type="button" id="play-pause-btn" class="hover:text-white transition-colors">
                  <svg id="play-pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <span id="studio-time-display">0:00 / 0:38</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" id="toggle-mute-btn" class="hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
                <span class="text-[11px] font-bold uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded">9:16 HD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Studio Control Sidebar -->
      <div class="w-full lg:w-[420px] xl:w-[460px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 min-h-0">
        <!-- Sidebar Navigation Tabs -->
        <div class="flex border-b border-slate-800 px-3 pt-2 gap-2 shrink-0">
          <button type="button" class="studio-tab-btn active px-4 py-2 text-xs font-bold text-white border-b-2 border-indigo-500" data-tab="transcript">
            Transcript Editor
          </button>
          <button type="button" class="studio-tab-btn px-4 py-2 text-xs font-bold text-slate-400 hover:text-white" data-tab="styles">
            Caption Styles
          </button>
          <button type="button" class="studio-tab-btn px-4 py-2 text-xs font-bold text-slate-400 hover:text-white" data-tab="effects">
            AI Layers & Sound
          </button>
        </div>

        <!-- Tab 1: Transcript Editor Content -->
        <div class="studio-tab-content flex-1 overflow-y-auto p-4 space-y-3 min-h-0" id="tab-transcript-content">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs text-slate-400">
            <span>Click any word to seek playback. Click text to edit.</span>
            <button type="button" id="cut-fillers-btn" class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              <span>Cut Fillers</span>
            </button>
          </div>
          <div id="transcript-cards-container" class="space-y-2.5">
            <!-- Dynamically populated sentence cards -->
          </div>
        </div>

        <!-- Tab 2: Caption Styles Content -->
        <div class="studio-tab-content hidden flex-1 overflow-y-auto p-4 space-y-4 min-h-0" id="tab-styles-content">
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Preset Style</label>
            <div class="grid grid-cols-2 gap-2" id="preset-styles-selector">
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-indigo-500 bg-indigo-950/40 text-left transition-all" data-theme="theme-number-story">
                <span class="block text-xs font-bold text-yellow-300">Number Story</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">Stats count & yellow highlight</span>
              </button>
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-slate-800 bg-slate-900 text-left transition-all hover:border-slate-700" data-theme="theme-behind-person">
                <span class="block text-xs font-bold text-purple-400">Behind Person</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">Layered depth subject cutout</span>
              </button>
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-slate-800 bg-slate-900 text-left transition-all hover:border-slate-700" data-theme="theme-golden-hour">
                <span class="block text-xs font-bold text-amber-200">Golden Hour</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">Editorial serif warm gradient</span>
              </button>
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-slate-800 bg-slate-900 text-left transition-all hover:border-slate-700" data-theme="theme-cyber-neon">
                <span class="block text-xs font-bold text-cyan-400">Cyber Neon</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">Glow magenta & electric blue</span>
              </button>
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-slate-800 bg-slate-900 text-left transition-all hover:border-slate-700" data-theme="theme-bouncy-pop">
                <span class="block text-xs font-bold text-emerald-400">Bouncy Pop</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">Kinetic squash & bounce</span>
              </button>
              <button type="button" class="style-preset-btn p-3 rounded-xl border border-slate-800 bg-slate-900 text-left transition-all hover:border-slate-700" data-theme="theme-minimal-clean">
                <span class="block text-xs font-bold text-slate-200">Minimal Clean</span>
                <span class="block text-[11px] text-slate-400 mt-0.5">High-contrast modern capsule</span>
              </button>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-800">
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Caption Position</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" class="pos-btn py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300" data-pos="pos-top">Top</button>
              <button type="button" class="pos-btn py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300" data-pos="pos-center">Center</button>
              <button type="button" class="pos-btn py-2 px-3 rounded-lg border border-indigo-500 bg-indigo-950/40 text-xs font-semibold text-white" data-pos="pos-bottom">Bottom</button>
            </div>
          </div>
        </div>

        <!-- Tab 3: AI Layers Content -->
        <div class="studio-tab-content hidden flex-1 overflow-y-auto p-4 space-y-4 min-h-0" id="tab-effects-content">
          <div class="space-y-3">
            <!-- Auto Zoom -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span class="block text-xs font-bold text-white">Dynamic Punch-In Cuts</span>
                <span class="block text-[11px] text-slate-400">Subtle 1.1x zooms on punchy emphasis words</span>
              </div>
              <input type="checkbox" id="toggle-zoom" checked class="w-4 h-4 accent-indigo-600 cursor-pointer" />
            </div>

            <!-- B-Roll SFX -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span class="block text-xs font-bold text-white">Turnkey Sound Design</span>
                <span class="block text-[11px] text-slate-400">Subtle whooshes, risers, and impact SFX</span>
              </div>
              <input type="checkbox" id="toggle-sfx" checked class="w-4 h-4 accent-indigo-600 cursor-pointer" />
            </div>

            <!-- Background Music Bed -->
            <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <span class="block text-xs font-bold text-white">Lo-Fi Background Music</span>
                  <span class="block text-[11px] text-slate-400">Auto-ducked behind voice volume</span>
                </div>
                <input type="checkbox" id="toggle-music" checked class="w-4 h-4 accent-indigo-600 cursor-pointer" />
              </div>
              <input type="range" id="music-volume" min="0" max="100" value="30" class="w-full h-1.5 bg-slate-800 accent-indigo-500 rounded cursor-pointer" />
            </div>
          </div>
        </div>

        <!-- Bottom Action Bar in Sidebar -->
        <div class="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Resolution: <b>1080×1920 (9:16)</b></span>
          <span class="text-emerald-400 font-semibold">● Ready to Export</span>
        </div>
      </div>
    </div>
  `;

  // Bind Studio Controls
  const video = studio.querySelector('#studio-video');
  const scrubber = studio.querySelector('#studio-scrubber');
  const timeDisplay = studio.querySelector('#studio-time-display');
  const playPauseBtn = studio.querySelector('#play-pause-btn');
  const bigPlayBtn = studio.querySelector('#big-play-btn');
  const playPauseIcon = studio.querySelector('#play-pause-icon');
  const toggleMuteBtn = studio.querySelector('#toggle-mute-btn');
  const exitBtn = studio.querySelector('#exit-studio-btn');
  const toggleSafezoneBtn = studio.querySelector('#toggle-safezone-btn');
  const safezoneOverlay = studio.querySelector('#studio-safezone');
  const exportSrtBtn = studio.querySelector('#export-srt-btn');
  const exportVideoBtn = studio.querySelector('#export-video-btn');
  const cutFillersBtn = studio.querySelector('#cut-fillers-btn');
  const canvasContainer = studio.querySelector('#studio-canvas-container');

  // Exit Studio
  exitBtn.addEventListener('click', () => {
    video.pause();
    studio.classList.remove('active');
    studioActive = false;
  });

  // Play / Pause Logic
  function togglePlay() {
    if (video.paused) {
      video.play();
      bigPlayBtn.style.display = 'none';
      playPauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      video.pause();
      bigPlayBtn.style.display = 'flex';
      playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }

  playPauseBtn.addEventListener('click', togglePlay);
  bigPlayBtn.addEventListener('click', togglePlay);
  canvasContainer.addEventListener('click', (e) => {
    if (e.target === canvasContainer || e.target === video) togglePlay();
  });

  // Mute / Unmute
  toggleMuteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    showToast(video.muted ? 'Audio muted' : 'Audio unmuted');
  });

  // Safe Zone Toggle
  toggleSafezoneBtn.addEventListener('click', () => {
    isSafeZoneVisible = !isSafeZoneVisible;
    safezoneOverlay.classList.toggle('show', isSafeZoneVisible);
    toggleSafezoneBtn.classList.toggle('border-red-500', isSafeZoneVisible);
    toggleSafezoneBtn.classList.toggle('text-red-400', isSafeZoneVisible);
    showToast(isSafeZoneVisible ? 'Safe zone guides enabled' : 'Safe zone guides disabled');
  });

  // Export SRT
  exportSrtBtn.addEventListener('click', () => {
    downloadSrtFile();
  });

  // Export Video
  exportVideoBtn.addEventListener('click', () => {
    simulateExportPipeline();
  });

  // Scrubber seeking
  scrubber.addEventListener('input', () => {
    const seekTime = (scrubber.value / 100) * video.duration;
    video.currentTime = seekTime;
  });

  // Timeupdate handler (sync kinetic subtitles and active transcript words)
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;

    // Update scrubber & time display
    const pct = (video.currentTime / video.duration) * 100;
    scrubber.value = pct;
    timeDisplay.innerText = `${formatSeconds(video.currentTime)} / ${formatSeconds(video.duration)}`;

    // Sync kinetic captions overlay
    updateKineticCaptions(video.currentTime);

    // Dynamic auto-zoom simulation
    if (isAutoZoomEnabled && canvasContainer) {
      const isZoomMoment = Math.floor(video.currentTime) % 4 === 1;
      video.style.transform = isZoomMoment ? 'scale(1.08)' : 'scale(1)';
      video.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }
  });

  // Sidebar Tab Switcher
  const tabBtns = studio.querySelectorAll('.studio-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => {
        b.classList.remove('active', 'text-white', 'border-b-2', 'border-indigo-500');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'text-white', 'border-b-2', 'border-indigo-500');
      btn.classList.remove('text-slate-400');

      const targetTab = btn.getAttribute('data-tab');
      studio.querySelectorAll('.studio-tab-content').forEach((c) => c.classList.add('hidden'));
      studio.querySelector(`#tab-${targetTab}-content`).classList.remove('hidden');
    });
  });

  // Style Preset Buttons
  const presetBtns = studio.querySelectorAll('.style-preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => {
        b.classList.remove('border-indigo-500', 'bg-indigo-950/40');
        b.classList.add('border-slate-800', 'bg-slate-900');
      });
      btn.classList.add('border-indigo-500', 'bg-indigo-950/40');
      btn.classList.remove('border-slate-800', 'bg-slate-900');

      currentTheme = btn.getAttribute('data-theme');
      const captionContainer = studio.querySelector('#studio-caption-overlay');
      captionContainer.className = `caption-overlay-container ${currentTheme} ${captionPosition}`;
      showToast(`Applied preset: ${btn.querySelector('span').innerText}`);
    });
  });

  // Position Buttons
  const posBtns = studio.querySelectorAll('.pos-btn');
  posBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      posBtns.forEach((b) => {
        b.classList.remove('border-indigo-500', 'bg-indigo-950/40', 'text-white');
        b.classList.add('border-slate-800', 'text-slate-300');
      });
      btn.classList.add('border-indigo-500', 'bg-indigo-950/40', 'text-white');
      btn.classList.remove('border-slate-800', 'text-slate-300');

      captionPosition = btn.getAttribute('data-pos');
      const captionContainer = studio.querySelector('#studio-caption-overlay');
      captionContainer.className = `caption-overlay-container ${currentTheme} ${captionPosition}`;
    });
  });

  // Cut Fillers
  cutFillersBtn.addEventListener('click', () => {
    showToast('Cut 3 pause markers & filler words automatically!');
  });
}

function openStudioWorkspace(title) {
  const studio = document.getElementById('moonshot-studio');
  if (!studio) return;

  const video = studio.querySelector('#studio-video');
  const titleEl = studio.querySelector('#studio-video-title');

  titleEl.innerText = title;
  video.src = currentVideoSrc;
  video.load();

  // Populate transcript sidebar
  populateTranscriptSidebar();

  studio.classList.add('active');
  studioActive = true;
  video.play().catch(() => {});
}

// Populate Transcript Cards & Words
function populateTranscriptSidebar() {
  const container = document.getElementById('transcript-cards-container');
  if (!container) return;

  container.innerHTML = '';
  const video = document.getElementById('studio-video');

  currentTimings.forEach((phrase, pIdx) => {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-xl bg-slate-900/90 border border-slate-800 transition-colors hover:border-slate-700';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-mono';
    header.innerHTML = `
      <span>Phrase #${pIdx + 1}</span>
      <span class="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold">${phrase.start.toFixed(1)}s - ${phrase.end.toFixed(1)}s</span>
    `;
    card.appendChild(header);

    const wordsWrap = document.createElement('div');
    wordsWrap.className = 'flex flex-wrap gap-1 leading-relaxed text-sm';

    phrase.words.forEach((w) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'transcript-word text-slate-200';
      wordSpan.innerText = w.word;
      wordSpan.setAttribute('contenteditable', 'true');
      wordSpan.setAttribute('data-start', w.start);
      wordSpan.setAttribute('data-end', w.end);

      // Seek on click
      wordSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = w.start;
        video.play();
      });

      // Update word on text edit
      wordSpan.addEventListener('input', () => {
        w.word = wordSpan.innerText;
        updateKineticCaptions(video.currentTime);
      });

      wordsWrap.appendChild(wordSpan);
    });

    card.appendChild(wordsWrap);
    container.appendChild(card);
  });
}

// Sync kinetic captions on the video canvas
function updateKineticCaptions(currentTime) {
  const wordsBox = document.getElementById('caption-words-box');
  if (!wordsBox) return;

  // Find active phrase
  const activePhrase = currentTimings.find((p) => currentTime >= p.start && currentTime <= p.end);

  // Update transcript sidebar active states
  const allWordPills = document.querySelectorAll('.transcript-word');
  allWordPills.forEach((p) => {
    const start = parseFloat(p.getAttribute('data-start'));
    const end = parseFloat(p.getAttribute('data-end'));
    if (currentTime >= start && currentTime <= end) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  if (!activePhrase) {
    wordsBox.innerHTML = '';
    return;
  }

  // Render kinetic animated subtitle words
  let html = '';
  activePhrase.words.forEach((w) => {
    const isWordActive = currentTime >= w.start && currentTime <= w.end;
    html += `<span class="caption-word ${isWordActive ? 'active-word' : ''} mx-1">${w.word}</span> `;
  });

  wordsBox.innerHTML = html;
}

// SRT Exporter
function downloadSrtFile() {
  let srtContent = '';
  currentTimings.forEach((phrase, idx) => {
    const startFormatted = formatSrtTimestamp(phrase.start);
    const endFormatted = formatSrtTimestamp(phrase.end);
    const text = phrase.words.map((w) => w.word).join(' ');

    srtContent += `${idx + 1}\n${startFormatted} --> ${endFormatted}\n${text}\n\n`;
  });

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'moonshot_captions.srt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded moonshot_captions.srt');
}

function formatSrtTimestamp(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString().substr(11, 12);
  return iso.replace('.', ',');
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Video Exporter Simulator
function simulateExportPipeline() {
  const modal = document.createElement('div');
  modal.className = 'moon-modal-backdrop open';
  modal.innerHTML = `
    <div class="moon-modal p-6 text-center">
      <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 animate-spin">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      </div>
      <h3 class="font-bold text-lg text-slate-900 mb-1">Rendering 1080×1920 MP4</h3>
      <p class="text-xs text-slate-500 mb-4" id="export-status-text">Compositing kinetic subtitle layers and audio beds...</p>
      <div class="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
        <div id="export-progress" class="bg-indigo-600 h-full w-0 transition-all duration-300"></div>
      </div>
      <button type="button" class="text-xs text-slate-400 hover:text-slate-600 font-semibold" onclick="this.closest('.moon-modal-backdrop').remove()">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);

  const pBar = modal.querySelector('#export-progress');
  const status = modal.querySelector('#export-status-text');

  setTimeout(() => { pBar.style.width = '35%'; status.innerText = 'Color grading and auto-zooms...'; }, 500);
  setTimeout(() => { pBar.style.width = '75%'; status.innerText = 'Encoding H.264 vertical video stream...'; }, 1100);
  setTimeout(() => {
    pBar.style.width = '100%';
    modal.remove();

    // Trigger download of demo video
    const a = document.createElement('a');
    a.href = currentVideoSrc;
    a.download = 'moonshot_pro_edit_1080x1920.mp4';
    a.click();
    showToast('Download started: moonshot_pro_edit_1080x1920.mp4');
  }, 1800);
}

// 6. Other Landing Page Interactive Features
function initFaqAccordion() {
  const faqSection = document.getElementById('faq');
  if (!faqSection) return;

  const questions = faqSection.querySelectorAll('button[aria-expanded]');
  questions.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const dt = btn.closest('dt');
      const dd = dt ? dt.nextElementSibling : null;
      const icon = btn.querySelector('span[style*="rotate"], span.faq-icon');

      if (!isExpanded) {
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('faq-btn-open');
        if (dd) {
          dd.classList.add('faq-answer-open');
          dd.style.maxHeight = dd.scrollHeight + 40 + 'px';
        }
        if (icon) icon.style.transform = 'rotate(45deg)';
      } else {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('faq-btn-open');
        if (dd) {
          dd.classList.remove('faq-answer-open');
          dd.style.maxHeight = '0px';
        }
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  });
}

function initPricingSwitcher() {
  const pricingSec = document.getElementById('pricing');
  if (!pricingSec) return;

  const header = pricingSec.querySelector('h2');
  if (!header || pricingSec.querySelector('.pricing-billing-switch')) return;

  const switchContainer = document.createElement('div');
  switchContainer.className = 'flex justify-start';
  switchContainer.innerHTML = `
    <div class="pricing-billing-switch">
      <button type="button" class="pricing-billing-btn active" data-cycle="weekly">Weekly</button>
      <button type="button" class="pricing-billing-btn" data-cycle="monthly">Monthly <span class="ml-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Save 25%</span></button>
      <button type="button" class="pricing-billing-btn" data-cycle="yearly">Yearly <span class="ml-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">Save 33%</span></button>
    </div>
  `;

  header.parentNode.insertBefore(switchContainer, header.nextSibling);

  const cards = pricingSec.querySelectorAll('.md\\:grid-cols-3 > div');
  if (cards.length < 3) return;

  const creatorCard = cards[1];
  const proCard = cards[2];

  const buttons = switchContainer.querySelectorAll('.pricing-billing-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const cycle = btn.getAttribute('data-cycle');

      if (cycle === 'weekly') {
        creatorCard.querySelector('p.tabular-nums').innerHTML = '$3<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ week</span>';
        creatorCard.querySelectorAll('p')[1].innerText = 'or $9 a month';
        proCard.querySelector('p.tabular-nums').innerHTML = '$6<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ week</span>';
        proCard.querySelectorAll('p')[1].innerText = 'or $18 a month';
      } else if (cycle === 'monthly') {
        creatorCard.querySelector('p.tabular-nums').innerHTML = '$9<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ month</span>';
        creatorCard.querySelectorAll('p')[1].innerText = 'billed monthly (Save 25%)';
        proCard.querySelector('p.tabular-nums').innerHTML = '$18<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ month</span>';
        proCard.querySelectorAll('p')[1].innerText = 'billed monthly (Save 25%)';
      } else if (cycle === 'yearly') {
        creatorCard.querySelector('p.tabular-nums').innerHTML = '$104.52<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ year</span>';
        creatorCard.querySelectorAll('p')[1].innerText = '≈ $8.71/mo (Save 33%)';
        proCard.querySelector('p.tabular-nums').innerHTML = '$209.04<span class="ml-1 text-sm font-semibold tracking-normal text-ink-3">/ year</span>';
        proCard.querySelectorAll('p')[1].innerText = '≈ $17.42/mo (Save 33%)';
      }
    });
  });
}

function initBeforeAfterShowcase() {
  const seeIt = document.getElementById('see-it');
  if (!seeIt) return;

  const heading = seeIt.querySelector('h2');
  if (!heading || seeIt.querySelector('.before-after-btn')) return;

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'mt-4 mb-6 inline-flex p-1 rounded-full bg-slate-100 border border-slate-200';
  toggleWrap.innerHTML = `
    <button type="button" class="before-after-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all text-slate-500 hover:text-slate-900" data-view="raw">Raw Clip</button>
    <button type="button" class="before-after-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm" data-view="edit">Moonshot Edit ✨</button>
  `;

  heading.parentNode.insertBefore(toggleWrap, heading.nextSibling);

  const btns = toggleWrap.querySelectorAll('.before-after-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.className = 'before-after-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all text-slate-500 hover:text-slate-900');
      btn.className = 'before-after-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm';
      const view = btn.getAttribute('data-view');
      showToast(view === 'raw' ? 'Showing Raw unedited take' : 'Showing Pro Moonshot Edit');
    });
  });
}

function initSocialScheduler() {
  const pub = document.getElementById('publish');
  if (!pub) return;

  const cards = pub.querySelectorAll('.grid > div');
  cards.forEach((card) => {
    card.classList.add('cursor-pointer', 'transition-all', 'duration-200');
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('ring-2', 'ring-indigo-600', 'shadow-lg'));
      card.classList.add('ring-2', 'ring-indigo-600', 'shadow-lg');
      const platformName = card.querySelector('div, span, p')?.innerText || 'Social Platform';
      showToast(`Selected schedule: ${platformName.split('\n')[0]}`);
    });
  });
}

function initNavToolsDropdown() {
  const toolsLinks = Array.from(document.querySelectorAll('nav a, header a')).filter(
    (a) => a.innerText && a.innerText.trim() === 'Tools'
  );

  toolsLinks.forEach((link) => {
    const parent = link.parentElement;
    parent.style.position = 'relative';

    const menu = document.createElement('div');
    menu.className = 'tools-dropdown-menu';
    menu.innerHTML = `
      <a href="#upload" class="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">AI Video Editor</a>
      <a href="#signature-styles" class="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">Caption Templates</a>
      <a href="#upload" class="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">AI Thumbnail Maker</a>
      <a href="#upload" class="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">Watermark Remover</a>
    `;

    parent.appendChild(menu);

    link.addEventListener('click', (e) => {
      e.preventDefault();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!parent.contains(e.target)) menu.classList.remove('open');
    });
  });
}

function initSignInModal() {
  const signInBtns = Array.from(document.querySelectorAll('button, a')).filter(
    (el) => el.innerText && el.innerText.trim() === 'Sign in'
  );

  const modal = document.createElement('div');
  modal.className = 'moon-modal-backdrop';
  modal.innerHTML = `
    <div class="moon-modal p-8 max-w-sm text-center">
      <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
        M
      </div>
      <h3 class="text-xl font-bold text-slate-900 mb-1">Welcome to Moonshot</h3>
      <p class="text-xs text-slate-500 mb-6">Create high-retention short-form videos with AI</p>

      <button type="button" class="w-full py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50 font-semibold text-sm text-slate-700 flex items-center justify-center gap-2 mb-3 transition-colors" onclick="alert('Google Auth integration ready!');">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>
        Continue with Google
      </button>

      <div class="relative my-4">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200"></div></div>
        <div class="relative flex justify-center text-xs uppercase"><span class="bg-white px-2 text-slate-400 font-semibold">Or email</span></div>
      </div>

      <input type="email" placeholder="name@domain.com" class="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-indigo-600 mb-3" />
      <button type="button" class="w-full py-3 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors mb-4" onclick="alert('Magic sign-in link sent!');">
        Send Magic Link
      </button>

      <button type="button" class="close-sign-in text-xs text-slate-400 hover:text-slate-600 font-medium">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  signInBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('open');
    });
  });

  modal.querySelectorAll('.close-sign-in').forEach((b) => {
    b.addEventListener('click', () => modal.classList.remove('open'));
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}
