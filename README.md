[![English](https://img.shields.io/badge/English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/中文-red.svg)](README_zh.md)

---

# English Study Assistant

Stop clicking through folders — one browser tab to rule all your teaching materials.

## Why This Project?

You have hundreds of organized English learning files (audio, video, PDFs, images) spread across dozens of folders. Opening them one by one is painful. This app scans your material directory, builds an index, and serves everything as a clean web interface — with playback, progress tracking, and iPad support.

**Zero dependencies. Zero config. Double-click and go.**

## Features

- 📂 Auto-scan material directory → structured navigation (Level → Week → Day)
- 🎵 Audio/video players with auto-advance
- 📕 PDF reader with page turning (PDF.js)
- 📝 DOCX lyrics/translations inline display
- 🖼️ Image viewer with pinch-to-zoom
- ✅ Check-in + learning stats (days, streaks)
- 💾 Progress memory (resumes where you left off)
- 📱 iPad access via LAN (responsive layout)
- 🔒 Path traversal protection, XSS sanitization

## Quick Start

### Prerequisites

- Python 3.10+ (macOS ships with Python 3)
- A directory of organized English learning materials

### Usage

```bash
# Clone the repo
git clone https://github.com/twmissingu/english-study-app.git
cd english-study-app

# Edit serve.py — set MATERIAL_DIR to your material directory
# Default: ~/Documents/zyn/english-study

# Double-click start.command, or run:
python3 serve.py
```

Browser opens automatically at `http://localhost:8080`.

### iPad Access

1. Connect iPad to the same WiFi
2. Open Safari, enter the URL shown in terminal (e.g. `http://192.168.x.x:8080`)

## Material Directory Structure

```
your-materials/
├── Level 1/
│   ├── Week 1/
│   │   ├── Day 1-Topic/
│   │   │   ├── 01-handout.jpg
│   │   │   ├── 02-explanation.mp3
│   │   │   ├── 03-song.mp4
│   │   │   └── 04-checkin.png
│   │   ├── Day 2-Topic/
│   │   └── ...
│   └── Week 2/
└── Level 2/
```

Files are auto-detected by extension: jpg/png → image, mp3/wav → audio, mp4/mov → video, pdf → PDF, docx → document.

## For AI Agents

```bash
# Clone and run
git clone https://github.com/twmissingu/english-study-app.git
cd english-study-app

# Configure material path in serve.py (line 16)
# MATERIAL_DIR = Path.home() / "Documents" / "zyn" / "english-study"

# Start
python3 serve.py
# → Scans materials, generates data.json, starts server on :8080
```

Key files:
- `serve.py` — Backend: directory scanner + HTTP server
- `static/app.js` — Frontend: navigation, playback, progress
- `static/index.html` — SPA entry point
- `static/style.css` — Responsive styles

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Server | Python `http.server` | macOS built-in, zero deps |
| Index | `os.walk` + `python-docx` | Scan + DOCX extraction |
| Frontend | Vanilla HTML/CSS/JS | No framework needed |
| PDF | PDF.js v3 (offline) | Browser-native rendering |
| Storage | localStorage | Zero-config persistence |

## License

[MIT](LICENSE)
