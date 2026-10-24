#!/usr/bin/env python3
"""把 Gemini API 金鑰存到專案的 .env（不會 commit，權限 600），voice.py 會自動讀取。

用法：.venv/bin/python tools/setup_key.py   （輸入時不會顯示在畫面上）
"""
import getpass
import os
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env"


def main():
    key = getpass.getpass("貼上 Gemini API 金鑰後按 Enter（畫面不會顯示）：").strip()
    if not key:
        raise SystemExit("沒有輸入金鑰，未儲存。")
    lines = [l for l in (ENV.read_text().splitlines() if ENV.exists() else []) if not l.startswith("GEMINI_API_KEY=")]
    lines.append(f"GEMINI_API_KEY={key}")
    ENV.write_text("\n".join(lines) + "\n")
    os.chmod(ENV, 0o600)
    print(f"已儲存到 {ENV}（長度 {len(key)} 字元，僅本機可讀）")


if __name__ == "__main__":
    main()
