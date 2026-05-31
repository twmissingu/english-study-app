# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

英语学习助手 — a local web app that serves children's English learning materials (3,654 files across 6 levels, 72 weeks) as a structured SPA. Parent-operated, child watches. Supports iPad via LAN.

## Commands

```bash
# Start the app (scans materials, launches server, opens browser)
./start.command

# Or manually
python3 serve.py

# Install python-docx dependency (auto-handled by serve.py, but manual install)
pip3 install python-docx
```

Server runs on `http://localhost:8080`. LAN access via `http://<machine-ip>:8080`.

## Architecture

```
english-study/
├── start.command          # macOS launcher (double-click)
├── serve.py               # Python: scan materials → generate data.json → start HTTP server
├── static/
│   ├── index.html         # SPA entry point
│   ├── app.js             # Frontend logic (DataManager, Navigation, ContentRenderer, AutoPlayer, ProgressManager)
│   ├── style.css          # Styles (responsive: 768px tablet, 1024px desktop)
│   └── vendor/pdfjs/      # PDF.js offline bundle
├── data.json              # Auto-generated directory index (do not edit manually)
└── [原始素材目录，只读]     # 预备级/, 基础级/, 陪伴营 1-4阶/
```

### Data Flow

1. `serve.py` scans `english-study/` material directories on startup → outputs `data.json`
2. `app.js` fetches `data.json` → renders sidebar navigation + content area
3. Progress stored in browser `localStorage` (per-device, no sync)

### Key Data Structure (data.json)

```json
{
  "levels": [{
    "name": "预备级",
    "weeks": [{
      "number": 1,
      "theme": "主题儿歌 Old MacDonald",
      "days": [{
        "number": 1,
        "name": "主题儿歌",
        "items": [{
          "id": "01",
          "type": "image|audio|video|pdf|document|slide",
          "label": "讲义",
          "files": ["relative/path/to/file.png"]
        }]
      }]
    }]
  }]
}
```

### Material Directory Conventions

- 6 levels: 预备级 (12wk/5day), 基础级 (24wk/5day), 陪伴营 1-4阶 (12wk/7day)
- Files numbered `01-`, `02-`, ... within each day folder — number determines display/playback order
- File type mapping: jpg/png→image, mp3/wav→audio, mp4/mov→video, pdf→pdf, docx→document, pptx→slide
- Material directories are **read-only** — never modify files in the level folders

## Behavioral Rules

Core principle: make fewer mistakes, not appear smarter. When in doubt, be conservative.

### File Editing Guardrails

- Read the file first before any edit. Use the Read tool, confirm the content, then use Edit with exact string matching.
- Only change lines directly related to the user's request. Don't refactor adjacent code.
- If a file exceeds 300 lines, read it in chunks. Never assume what's in unread sections.

### Hard Prohibitions

1. **NEVER add content the user didn't request** — no "while I'm at it" additions.
2. **NEVER fabricate results** — if a sub-task result is unknown, say "needs verification."
3. **NEVER expand authorization** — permission to edit file A doesn't extend to file B.
4. **NEVER abstract prematurely** — don't create abstractions unless at least 3 concrete use cases exist.
5. **NEVER say "looks fine" without reading the source** — no opinion without evidence.

### Reporting Standard

- Failed: state what failed, where, and the specific error. No softening.
- Succeeded: state what was done. No disclaimers.
- Unknown: state what you don't know. No guessing.

### Communication

- Conclusion first, reasoning second. Max 3 sentences for routine updates.
- One word or one sentence: prefer the shorter option.
