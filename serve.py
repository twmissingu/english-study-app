#!/usr/bin/env python3
"""晓华亲子英语 · 学习助手 — 扫描素材目录 + 启动 HTTP 服务器"""

import http.server
import json
import os
import re
import socket
import sys
import threading
import webbrowser
from pathlib import Path
from urllib.parse import unquote

PORT = 8080
MATERIAL_DIR = Path.home() / "Documents" / "zyn" / "english-study"
OUTPUT_FILE = Path(__file__).parent / "data.json"
STATIC_DIR = Path(__file__).parent / "static"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg"}
VIDEO_EXT = {".mp4", ".mov", ".webm"}
PDF_EXT = {".pdf"}
DOCX_EXT = {".docx"}
PPTX_EXT = {".pptx"}


def get_file_type(ext):
    ext = ext.lower()
    if ext in IMAGE_EXT:
        return "image"
    if ext in AUDIO_EXT:
        return "audio"
    if ext in VIDEO_EXT:
        return "video"
    if ext in PDF_EXT:
        return "pdf"
    if ext in DOCX_EXT:
        return "document"
    if ext in PPTX_EXT:
        return "slide"
    return None


def extract_docx_html(filepath):
    """Extract DOCX content as simple HTML."""
    try:
        import docx
    except ImportError:
        return "<p><em>需要安装 python-docx: pip3 install python-docx</em></p>"

    try:
        doc = docx.Document(filepath)
        parts = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            runs_html = []
            for run in para.runs:
                t = run.text
                if not t:
                    continue
                if run.bold:
                    t = f"<b>{t}</b>"
                if run.italic:
                    t = f"<i>{t}</i>"
                runs_html.append(t)
            if runs_html:
                parts.append("<p>" + "".join(runs_html) + "</p>")
            elif text:
                parts.append(f"<p>{text}</p>")
        return "".join(parts) if parts else "<p><em>（空文档）</em></p>"
    except Exception as e:
        return f"<p><em>解析失败: {e}</em></p>"


def parse_number_prefix(filename):
    """Extract number prefix like '01-' from filename."""
    m = re.match(r"^(\d+)-", filename)
    return m.group(1) if m else None


def clean_label(name):
    """Clean a filename into a display label."""
    # Strip watermarks
    name = re.sub(r"[（(]晓华独家.*?[）)]", "", name)
    name = re.sub(r"加微信\d+后续免费包更新", "", name)
    # Strip leading number prefix
    name = re.sub(r"^\d+-", "", name)
    return name.strip()


def scan_day_folder(day_path):
    """Scan a day folder and return items grouped by number prefix."""
    files_by_id = {}
    for f in sorted(day_path.iterdir()):
        if f.is_dir():
            continue
        ext = f.suffix
        ftype = get_file_type(ext)
        if ftype is None:
            continue
        item_id = parse_number_prefix(f.name)
        if item_id is None:
            item_id = f"_{len(files_by_id):02d}"
        if item_id not in files_by_id:
            files_by_id[item_id] = {"id": item_id, "type": ftype, "label": "", "files": [], "content": ""}
        entry = files_by_id[item_id]
        rel_path = str(f.relative_to(MATERIAL_DIR))
        entry["files"].append(rel_path)
        # Derive label from filename
        label = clean_label(f.stem)
        if label and not entry["label"]:
            entry["label"] = label
        # Extract DOCX content
        if ext.lower() == ".docx":
            entry["content"] = extract_docx_html(f)
        # Update type if needed (prefer video over audio if both exist)
        if ftype == "video" and entry["type"] == "audio":
            entry["type"] = "video"

    items = sorted(files_by_id.values(), key=lambda x: x["id"])
    return items


def scan_level_yubei():
    """Scan 预备级 (preparatory level)."""
    level_dir = MATERIAL_DIR / "预备级"
    if not level_dir.exists():
        return None

    weeks = []
    week_dirs = sorted(
        [d for d in level_dir.iterdir() if d.is_dir() and re.match(r"^第\d+周$", d.name)],
        key=lambda d: int(re.search(r"\d+", d.name).group()),
    )

    for week_dir in week_dirs:
        week_num = int(re.search(r"\d+", week_dir.name).group())
        days = []
        day_dirs = [d for d in week_dir.iterdir() if d.is_dir() and is_day_folder(d.name)]
        for day_dir in day_dirs:
            day_num = parse_day_number(day_dir.name)
            if day_num == 0:
                day_num = len(days) + 1
            items = scan_day_folder(day_dir)
            if items:
                days.append({"number": day_num, "name": parse_day_short_name(day_dir.name), "items": items})
        days.sort(key=lambda d: d["number"])
        if days:
            weeks.append({"number": week_num, "theme": "", "days": days})

    # Try to extract theme from first day name
    for w in weeks:
        for d in w["days"]:
            if d["name"]:
                w["theme"] = clean_label(d["name"])
                break

    return {"name": "预备级", "weeks": weeks}


def parse_day_number(name):
    """Extract day number from folder name like 'Day1-...' or '第一天 ...'."""
    m = re.search(r"[Dd]ay\s*(\d+)", name)
    if m:
        return int(m.group(1))
    m = re.search(r"第(.?)天", name)
    if m:
        cn = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7}
        return cn.get(m.group(1), 0)
    return 0


def parse_day_short_name(name):
    """Extract short name from day folder name, stripping watermarks."""
    # "Day1-主题儿歌 tall and short" → "主题儿歌 tall and short"
    m = re.match(r"[Dd]ay\s*\d+\s*[-—]\s*(.*)", name)
    if m:
        return clean_label(m.group(1))
    # "第一天 主题儿歌just like me" → "主题儿歌just like me"
    m = re.match(r"第.天\s*(.*)", name)
    if m:
        return clean_label(m.group(1))
    return clean_label(name)


def is_day_folder(name):
    """Check if a folder name represents a day lesson."""
    return bool(re.match(r"[Dd]ay\s*\d+", name) or re.match(r"第.天", name))


def scan_level_jichu():
    """Scan 基础级 (foundation level)."""
    level_dir = MATERIAL_DIR / "基础级"
    if not level_dir.exists():
        return None

    weeks = []
    week_dirs = sorted(
        [d for d in level_dir.iterdir() if d.is_dir() and "第" in d.name and "周" in d.name],
        key=lambda d: int(re.search(r"第(\d+)周", d.name).group(1)),
    )

    for week_dir in week_dirs:
        m = re.search(r"第(\d+)周", week_dir.name)
        week_num = int(m.group(1))
        theme_m = re.search(r"主题[：:]\s*(.*)", week_dir.name)
        theme = clean_label(theme_m.group(1)) if theme_m else ""

        days = []
        day_dirs = [d for d in week_dir.iterdir() if d.is_dir() and is_day_folder(d.name)]
        for day_dir in day_dirs:
            day_num = parse_day_number(day_dir.name)
            if day_num == 0:
                day_num = len(days) + 1
            items = scan_day_folder(day_dir)
            if items:
                days.append({"number": day_num, "name": parse_day_short_name(day_dir.name), "items": items})
        days.sort(key=lambda d: d["number"])
        if days:
            weeks.append({"number": week_num, "theme": theme, "days": days})

    return {"name": "基础级", "weeks": weeks}


def scan_level_peiban(stage_num):
    """Scan 陪伴营 N阶 (companion camp stage N)."""
    level_dir = MATERIAL_DIR / f"陪伴营 {stage_num}阶"
    if not level_dir.exists():
        return None

    # Find the main course folder
    main_course = None
    cn = num_to_chinese(stage_num)
    candidates = [
        "正课",
        f"00-{cn}阶正课内容",
        f"00-{cn}阶正课",
        f"{cn}阶正课",
    ]
    for candidate in candidates:
        p = level_dir / candidate
        if p.exists():
            main_course = p
            break
    if main_course is None:
        # Try to find folder containing week directories
        for d in level_dir.iterdir():
            if d.is_dir() and any("周" in sub.name for sub in d.iterdir() if sub.is_dir()):
                main_course = d
                break
    if main_course is None:
        return None

    weeks = []
    week_dirs = sorted(
        [d for d in main_course.iterdir() if d.is_dir() and "第" in d.name and "周" in d.name],
        key=lambda d: int(re.search(r"第(\d+)周", d.name).group(1)),
    )

    for week_dir in week_dirs:
        m = re.search(r"第(\d+)周", week_dir.name)
        week_num = int(m.group(1))
        theme_m = re.search(r"主题[：:]\s*(.*)", week_dir.name)
        theme = clean_label(theme_m.group(1)) if theme_m else ""

        days = []
        day_dirs = [d for d in week_dir.iterdir() if d.is_dir() and is_day_folder(d.name)]
        for day_dir in day_dirs:
            day_num = parse_day_number(day_dir.name)
            if day_num == 0:
                day_num = len(days) + 1
            items = scan_day_folder(day_dir)
            if items:
                days.append({"number": day_num, "name": parse_day_short_name(day_dir.name), "items": items})
        days.sort(key=lambda d: d["number"])
        if days:
            weeks.append({"number": week_num, "theme": theme, "days": days})

    return {"name": f"陪伴营 {stage_num}阶", "weeks": weeks}


def num_to_chinese(n):
    return {1: "一", 2: "二", 3: "三", 4: "四"}.get(n, str(n))


def get_local_ip():
    """Get the local IP address for LAN access."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def generate_index():
    """Scan all material directories and generate data.json."""
    print("📂 扫描素材目录...")
    levels = []

    for scanner in [scan_level_yubei, scan_level_jichu,
                    lambda: scan_level_peiban(1),
                    lambda: scan_level_peiban(2),
                    lambda: scan_level_peiban(3),
                    lambda: scan_level_peiban(4)]:
        result = scanner()
        if result and result["weeks"]:
            levels.append(result)
            total_days = sum(len(w["days"]) for w in result["weeks"])
            print(f"  ✓ {result['name']}: {len(result['weeks'])} 周, {total_days} 天")

    data = {
        "levels": levels,
        "serverIP": get_local_ip(),
        "port": PORT,
    }

    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    OUTPUT_FILE.write_text(json_str, encoding="utf-8")
    # Also write to static/ so the HTTP server can serve it
    (STATIC_DIR / "data.json").write_text(json_str, encoding="utf-8")
    print(f"✓ 索引已生成: {OUTPUT_FILE}")
    return data


class UnifiedHandler(http.server.SimpleHTTPRequestHandler):
    """Single handler: /materials/... → material dir, everything else → static dir."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "application/javascript",
        ".js": "application/javascript",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        path = unquote(path)
        if path.startswith("/materials/"):
            rel = path[len("/materials/"):]
            resolved = (MATERIAL_DIR / rel).resolve()
            if not str(resolved).startswith(str(MATERIAL_DIR.resolve())):
                return str(MATERIAL_DIR)
            return str(resolved)
        rel = path.lstrip("/")
        resolved = (STATIC_DIR / rel).resolve()
        if not str(resolved).startswith(str(STATIC_DIR.resolve())):
            return str(STATIC_DIR)
        return str(resolved)

    def log_message(self, format, *args):
        # Only log errors (4xx, 5xx)
        if len(args) >= 2:
            status = str(args[1])
            if status.startswith(("4", "5")):
                super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


class ThreadedHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


def start_server():
    """Start HTTP server (single port, multi-threaded)."""
    server = ThreadedHTTPServer(("0.0.0.0", PORT), UnifiedHandler)

    ip = get_local_ip()
    print(f"\n🌐 访问地址:")
    print(f"   本机: http://localhost:{PORT}")
    print(f"   局域网: http://{ip}:{PORT}")
    print(f"\n📱 iPad 请在浏览器输入: http://{ip}:{PORT}")
    print(f"\n按 Ctrl+C 停止服务器\n")

    # Open browser
    threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.shutdown()


if __name__ == "__main__":
    os.chdir(Path(__file__).parent)
    generate_index()
    start_server()
