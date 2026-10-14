# Moonshot Full Clone (`makemoonshot.co`)

A complete, fully functional, production-grade clone of [Moonshot](https://makemoonshot.co/) — the AI Video Editor for Pro Short-Form Edits (Reels, TikTok, Shorts).

Reverse-engineered directly from upstream production bundles using static chunk graph analysis, Next.js 15 App Router hydration extraction, and live studio state store reconstruction.

---

## 🌟 Key Functional Architecture

### 1. Genuine Next.js React App Runtime
- **52 Production Chunks Loaded Locally**:
  All client-side React components, runtime chunk loaders, and state stores (`turbopack-1_nc4sk00oq96.js`, `055oo67r3vcom.js`, `22p0vzz-jab2_.js`, `3vm-xt69rdwro.js`, etc.) run directly from `/_next/static/chunks/` with zero missing dependencies.
- **Full App Router RSC Streaming**:
  Server supports Next.js RSC client transitions (`text/x-component`) and dynamic route state trees.

### 2. Interactive Moonshot Studio Editor (`/studio/:id`)
- **Live Kinetic Captions**:
  Real-time word-by-word kinetic animation rendered over vertical video footage with adjustable font styles, emphasis colors, animations, and safe areas.
- **Word-Level Transcript Synchronization**:
  Full 11-segment, 58-word transcript fixture (`assets/demo_timings.json`) synchronized with interactive seek, selection, and replacement capabilities.
- **Video Player Transport**:
  Complete playback control (Play/Pause, Scrubber timeline, Volume, Speed, Frame-accurate seeking) with 9:16 vertical video preview (`assets/demo_reel.mp4`).
- **Studio Tools & Shelves**:
  Switch between all 252 caption templates in the sidebar, inspect b-roll cutaways, hook titles, background cutouts, audio tracks, and sound effects.
- **Export & Render Pipeline**:
  `/api/render` generates and delivers turnkey video and SRT caption exports.

### 3. Complete Landing Page Experience (`/`)
- **252 Templates Across 16 Shelves**:
  Full interactive carousel with animated category switching and preview posters/videos across all shelves:
  - *Popular AI, AI Edits, Real Estate AI, Spatial AI, Behind the Person AI, Playful AI, Multiline AI, Dynamic, Editorial AI, Neon & FX, Creators, Desi, Social, Speakers, Retro, abc*.
- **Drag-and-Drop Video Uploader**:
  Upload custom video/audio or use the pre-loaded demo reel.
- **Before & After Interactive Comparison Slider**:
  Side-by-side interactive split slider comparing unedited raw footage with Moonshot's finished edit.
- **Billing Calculator & FAQ**:
  Interactive billing cycle toggles (Weekly, Monthly, Yearly) and 12-question animated accordion.

---

## 🚀 Quick Start

The local server is already running! Simply open your browser to:

- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Direct Studio Editor**: [http://localhost:3000/studio/proj_demo_1](http://localhost:3000/studio/proj_demo_1)

### To Restart the Server:
```bash
cd "D:\AAKASH\motion graphics\moonshot-clone"
node server.js
```

---

## 🛠 Discovered & Implemented API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/me` | GET | Authenticated creator session with Pro billing and quota usage |
| `/api/ai-credits` | GET | Unlimited creator AI generation units |
| `/api/upload` | POST | Direct video/audio multipart upload fallback |
| `/api/upload/signed-url` | POST | Signed upload URL negotiation for direct file transfer |
| `/api/upload/put-file` | PUT | Raw file data ingestion endpoint |
| `/api/upload/finalize` | POST | Video metadata binding and project creation |
| `/api/generate` | POST | Template assignment and processing pipeline activation |
| `/api/bootstrap/studio/:id` | GET | Studio editor bootstrap state & project data loader |
| `/api/projects/:id` | GET/PUT/PATCH/DELETE | Full CRUD for project clips, transcripts, and overrides |
| `/api/source/preview` | GET | HTTP 206 Partial Content range stream matching `.preview-1080x1920-v7.mp4` |
| `/api/render` | POST | Video rendering and compilation trigger |
| `/api/render/download/:id` | GET | Direct video download stream |
| `/api/templates/discovery` | GET | 252 template definitions across 16 categories |

---

## 📂 Project Directory Structure

```
moonshot-clone/
├── _next/static/chunks/       # 52 production JS & CSS chunks (React runtime, StudioShell, Turbopack)
├── assets/
│   ├── demo_reel.mp4          # High-resolution vertical demo reel video
│   ├── demo_timings.json      # Word-by-word timestamped transcript fixture
│   └── templates.json         # 252 templates across 16 shelves with CDN posters
├── index.html                 # Production landing page with client hydration scripts
├── studio.html                # Production Studio workspace with dynamic route bindings
├── server.js                  # Node.js server with REST APIs, RSC streaming, and project store
└── package.json
```
