#!/usr/bin/env python3
"""把 data/jlpt/nN.part*.json 合併成 nN.json，順便清理原始清單的格式問題。

用法：python3 tools/merge_jlpt.py n5 n4
- 讀音或寫法裡的括號：開頭的括號保留內容（(に) よると → によると），結尾的可省略部分去掉（スーパー (マーケット) → スーパー），「(する)」去掉。
- 少數原始資料錯誤用 FIXES 修正（寫法、讀音），id 跟著修正後的寫法。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "jlpt"
FIXES = {
    "下る": {"text": "下がる", "reading": "さがる"},
    "お金持ち": {"reading": "おかねもち"},
    "堅": {"text": "堅い"},
    "伯父": {"reading": "おじ"},
    "落る": {"text": "落ちる"},
    "楽む": {"text": "楽しむ"},
    "答": {"text": "答え"},
    "いただく": {"reading": "いただく"},
    "終る": {"text": "終わる"},
    "曲る": {"text": "曲がる"},
    "落す": {"text": "落とす"},
}


def clean(s):
    s = re.sub(r"^\(([^)]*)\)\s*", r"\1", s.strip())
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    return re.sub(r"\s+", "", s)


def merge(level):
    parts = sorted(DIR.glob(f"{level}.part*.json")) or [DIR / f"{level}.json"]  # 沒有分檔時就重新整理已合併的檔
    if not parts[0].exists():
        raise SystemExit(f"找不到 {level}.part*.json 或 {level}.json")
    rows, seen = [], set()
    for p in parts:
        for v in json.loads(p.read_text(encoding="utf-8")):
            text, reading = clean(v["text"]), clean(v["reading"])
            fix = FIXES.get(text, {})
            text, reading = fix.get("text", text), fix.get("reading", reading)
            vid = f"ja:vocab:{text}"
            if vid in seen:
                continue
            seen.add(vid)
            rows.append({**v, "id": vid, "text": text, "reading": reading})
    out = DIR / f"{level}.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}：{len(rows)} 個（來自 {len(parts)} 個分檔）")
    return parts


if __name__ == "__main__":
    for level in sys.argv[1:] or ["n5", "n4"]:
        merge(level)
